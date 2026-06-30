import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { YandexDevice, CameraStreamResult, YandexWebRtcRoom } from '../../types/index';
import { connectYandexGoloomWebRtc, GoloomConnection, JWT_FAST_REUSE_MIN_TTL_MS } from '../../services/yandexGoloomWebRtc';

/** Returns false if the room JWT is expired or will expire soon (fast-path unsafe). */
const isRoomCredentialFresh = (room: YandexWebRtcRoom): boolean => {
  try {
    const b64 = room.credentials.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!b64) return true;
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > Date.now() + JWT_FAST_REUSE_MIN_TTL_MS;
  } catch {
    return true;
  }
};
import { getQuasarCameraDevice } from '../../services/yandexIoT';
import {
  hasCameraPrivacyControl,
  isCameraPrivacyModeEnabled,
  mergeCameraDeviceState,
  getCameraPrivacyInstance,
} from '../../constants';
import { X, RefreshCw, Loader2, Video, AlertCircle, Eye, EyeOff, Maximize2, Settings2, PictureInPicture2 } from 'lucide-react';

const QUALITY_PRESETS = [
  { label: 'High', width: 2560, height: 1440 },
  { label: 'Low', width: 848,  height: 480  },
] as const;
type QualityPreset = typeof QUALITY_PRESETS[number];

interface CameraStreamModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onGetStream: (deviceId: string) => Promise<CameraStreamResult>;
  onSetPrivacy: (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => Promise<void>;
  onPrivacyChanged?: () => void;
}

export const CameraStreamModal: React.FC<CameraStreamModalProps> = ({
  device,
  isOpen,
  onClose,
  onGetStream,
  onSetPrivacy,
  onPrivacyChanged,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const webrtcConnectionRef = useRef<GoloomConnection | null>(null);
  const loadStreamRef = useRef<((silent?: boolean) => void) | null>(null);
  const lastWebrtcRoomRef = useRef<import('../../types/index').YandexWebRtcRoom | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectedQualityRef = useRef<QualityPreset>(QUALITY_PRESETS[0]);
  const prevPrivacyRef = useRef(false);
  const [cameraDevice, setCameraDevice] = useState<YandexDevice>(device);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamProtocol, setStreamProtocol] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>(QUALITY_PRESETS[0]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showFreezeFrame, setShowFreezeFrame] = useState(false);
  const pipSupported = typeof document !== 'undefined' && document.pictureInPictureEnabled;

  const captureFreezeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = freezeCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setShowFreezeFrame(true);
  }, []);

  const privacyEnabled = isCameraPrivacyModeEnabled(cameraDevice);
  const showPrivacyButton = hasCameraPrivacyControl(cameraDevice);

  const refreshCameraDevice = useCallback(async () => {
    try {
      const quasarDevice = await getQuasarCameraDevice(device.id);
      setCameraDevice(mergeCameraDeviceState(device, quasarDevice));
    } catch {
      setCameraDevice(device);
    }
  }, [device]);

  const cleanupPlayer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (webrtcConnectionRef.current) {
      webrtcConnectionRef.current.cleanup();
      webrtcConnectionRef.current = null;
    }
    if (document.pictureInPictureElement === videoRef.current) {
      void document.exitPictureInPicture();
    }
    setShowFreezeFrame(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
  }, []);

  const loadStream = useCallback(async (silent = false) => {
    if (!silent) {
      cleanupPlayer();
      setIsLoading(true);
      setError(null);
      setPrivacyNotice(null);
      setStreamProtocol(null);
    } else {
      // Silent reconnect: capture last frame before tracks are torn down
      captureFreezeFrame();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (webrtcConnectionRef.current) { webrtcConnectionRef.current.cleanupSoft(); webrtcConnectionRef.current = null; }
      // Clear stale error so the overlay doesn't stay on top of a recovered stream
      setError(null);
      setPrivacyNotice(null);
    }

    try {
      const stream = await onGetStream(device.id);
      setStreamProtocol(stream.protocol);

      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (stream.protocol === 'webrtc' && stream.webrtc) {
        lastWebrtcRoomRef.current = stream.webrtc;

        const scheduleReconnect = (forceNewCredentials = false) => {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          if (forceNewCredentials) captureFreezeFrame();
          const delayMs = forceNewCredentials ? 0 : 3000;
          reconnectTimerRef.current = setTimeout(async () => {
            reconnectTimerRef.current = null;
            const v = videoRef.current;
            if (!v) return;
            if (forceNewCredentials) {
              lastWebrtcRoomRef.current = null;
            }
            const cached = lastWebrtcRoomRef.current;
            if (cached && isRoomCredentialFresh(cached)) {
              if (webrtcConnectionRef.current) { webrtcConnectionRef.current.cleanupSoft(); webrtcConnectionRef.current = null; }
              try {
                webrtcConnectionRef.current = await connectYandexGoloomWebRtc(
                  cached, v, () => scheduleReconnect(false), selectedQualityRef.current,
                  () => scheduleReconnect(true),
                );
                return;
              } catch (err) {
                const isBusy = err instanceof Error && /слишком много|too.?many/i.test(err.message);
                if (isBusy) await new Promise(r => window.setTimeout(r, 3000));
              }
            }
            loadStreamRef.current?.(true);
          }, delayMs);
        };

        webrtcConnectionRef.current = await connectYandexGoloomWebRtc(
          stream.webrtc,
          video,
          () => scheduleReconnect(false),
          selectedQualityRef.current,
          () => scheduleReconnect(true),
        );
        return;
      }

      const streamUrl = stream.streamUrl;
      if (!streamUrl) {
        throw new Error('URL видеопотока не получен');
      }

      if (stream.protocol === 'hls' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setError('Не удалось воспроизвести HLS-поток');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        await video.play().catch(() => {});
      } else {
        video.src = streamUrl;
        await video.play().catch(() => {
          setError('Браузер не поддерживает воспроизведение этого формата потока');
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось получить видеопоток';
      if (privacyEnabled || message.includes('приват') || message.includes('не умеет')) {
        setPrivacyNotice('Камера может быть в режиме приватности. Отключите его кнопкой ниже.');
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [cleanupPlayer, device.id, onGetStream, privacyEnabled, captureFreezeFrame]);

  const handleTogglePrivacy = useCallback(async () => {
    setIsTogglingPrivacy(true);
    setError(null);
    setPrivacyNotice(null);
    try {
      const nextPrivacyEnabled = !privacyEnabled;
      const instance = getCameraPrivacyInstance(cameraDevice);
      await onSetPrivacy(device.id, nextPrivacyEnabled, instance);
      await refreshCameraDevice();
      onPrivacyChanged?.();
      if (!nextPrivacyEnabled) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        await loadStream();
      } else {
        cleanupPlayer();
        setStreamProtocol(null);
        setPrivacyNotice('Режим приватности включён. Камера не передаёт видео.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось изменить режим приватности';
      setError(message);
    } finally {
      setIsTogglingPrivacy(false);
    }
  }, [
    cleanupPlayer,
    cameraDevice,
    device.id,
    loadStream,
    onPrivacyChanged,
    onSetPrivacy,
    privacyEnabled,
    refreshCameraDevice,
  ]);

  const handleTogglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // User cancelled or PiP not allowed (e.g. video not playing yet)
    }
  }, [pipSupported]);

  const handleQualityChange = useCallback((preset: QualityPreset) => {
    setSelectedQuality(preset);
    selectedQualityRef.current = preset;
    setShowQualityMenu(false);
    // Soft-cleanup keeps the last video frame visible while reconnecting
    if (webrtcConnectionRef.current) {
      webrtcConnectionRef.current.cleanupSoft();
      webrtcConnectionRef.current = null;
    }
    // Silent reconnect with the new quality (no black flash, no loading spinner)
    loadStreamRef.current?.(true);
  }, []);

  // Hide freeze-frame overlay once the live stream resumes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen) return;
    const hideFreeze = () => {
      if (video.videoWidth > 0) setShowFreezeFrame(false);
    };
    video.addEventListener('playing', hideFreeze);
    video.addEventListener('resize', hideFreeze);
    return () => {
      video.removeEventListener('playing', hideFreeze);
      video.removeEventListener('resize', hideFreeze);
    };
  }, [isOpen, streamProtocol]);

  // Track native PiP window open/close
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPictureInPicture(true);
    const onLeave = () => setIsPictureInPicture(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [isOpen, streamProtocol]);

  // Close quality menu when clicking outside
  useEffect(() => {
    if (!showQualityMenu) return;
    const handler = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showQualityMenu]);

  useEffect(() => {
    setCameraDevice(device);
  }, [device]);

  // Keep loadStreamRef up to date without causing useEffect re-runs
  useEffect(() => {
    loadStreamRef.current = loadStream;
  });

  // While streaming: poll every 20 s to catch physical privacy-button presses.
  // While privacy is ON (no stream): poll every 5 s waiting for it to be lifted,
  // then auto-reconnect so the user doesn't have to press "Повторить" manually.
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const isWaitingForPrivacy = privacyEnabled && !streamProtocol && !error;
    const interval = isWaitingForPrivacy ? 5000 : 20000;

    const poll = setInterval(async () => {
      await refreshCameraDevice();
      // Auto-reconnect is handled by the privacyEnabled-change effect below
    }, interval);

    return () => clearInterval(poll);
  }, [isOpen, streamProtocol, isLoading, error, privacyEnabled, refreshCameraDevice]);

  // React when privacy state changes mid-session.
  useEffect(() => {
    const wasEnabled = prevPrivacyRef.current;
    prevPrivacyRef.current = privacyEnabled;

    if (!wasEnabled && privacyEnabled && streamProtocol && !isLoading) {
      // Privacy just turned ON while streaming → stop stream, wait for it to be lifted
      cleanupPlayer();
      setStreamProtocol(null);
      setError(null);
      setPrivacyNotice('Режим приватности включён. Камера не передаёт видео.');
    }

    if (wasEnabled && !privacyEnabled && !streamProtocol && !isLoading && isOpen) {
      // Privacy just turned OFF while we were waiting → auto-reconnect
      setPrivacyNotice(null);
      loadStreamRef.current?.();
    }
  }, [privacyEnabled, streamProtocol, isLoading, isOpen, cleanupPlayer]);

  useEffect(() => {
    if (!isOpen) {
      cleanupPlayer();
      setError(null);
      setPrivacyNotice(null);
      setStreamProtocol(null);
      return;
    }

    void refreshCameraDevice();
    loadStreamRef.current?.();

    return () => {
      cleanupPlayer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-soft rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-border-soft">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-full bg-[#176f91]/10 dark:bg-primary/20 text-[#176f91] dark:text-primary">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-card-fg truncate">
                {cameraDevice.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-muted">
                {privacyEnabled
                  ? 'Режим приватности включён'
                  : streamProtocol
                    ? `Протокол: ${streamProtocol.toUpperCase()}`
                    : 'Получение видеопотока...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showPrivacyButton && (
              <button
                onClick={handleTogglePrivacy}
                disabled={isLoading || isTogglingPrivacy}
                className={`hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  privacyEnabled
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                    : 'bg-gray-100 dark:bg-surface text-slate-700 dark:text-card-fg hover:bg-gray-200 dark:hover:bg-surface-warm'
                }`}
                title={privacyEnabled ? 'Отключить режим приватности' : 'Включить режим приватности'}
              >
                {isTogglingPrivacy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : privacyEnabled ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                {privacyEnabled ? 'Отключить приватность' : 'Включить приватность'}
              </button>
            )}
            {pipSupported && (
              <button
                onClick={() => { void handleTogglePictureInPicture(); }}
                disabled={isLoading || !streamProtocol}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                  isPictureInPicture
                    ? 'text-[#176f91] dark:text-primary bg-[#176f91]/10 dark:bg-primary/20'
                    : 'text-gray-500 dark:text-muted hover:bg-gray-100 dark:hover:bg-surface'
                }`}
                title={isPictureInPicture ? 'Закрыть окно поверх других' : 'Окно поверх других приложений'}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => videoRef.current?.requestFullscreen?.()}
              disabled={isLoading || !streamProtocol}
              className="p-2 rounded-lg text-gray-500 dark:text-muted hover:bg-gray-100 dark:hover:bg-surface transition-colors disabled:opacity-50"
              title="Полноэкранный режим"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={loadStream}
              disabled={isLoading || isTogglingPrivacy}
              className="p-2 rounded-lg text-gray-500 dark:text-muted hover:bg-gray-100 dark:hover:bg-surface transition-colors disabled:opacity-50"
              title="Обновить поток"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 dark:text-muted hover:bg-gray-100 dark:hover:bg-surface transition-colors"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={freezeCanvasRef}
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${showFreezeFrame ? 'z-[5]' : 'hidden'}`}
          />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-sm">Подключение к камере...</p>
            </div>
          )}

          {/* Quality selector — shown only when WebRTC stream is active */}
          {streamProtocol === 'webrtc' && !isLoading && !error && (
            <div ref={qualityMenuRef} className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setShowQualityMenu(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-sm transition-colors"
                title="Качество видео"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {selectedQuality.label}
              </button>
              {showQualityMenu && (
                <div className="absolute top-full right-0 mt-1 min-w-[90px] bg-black/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-xl border border-white/10">
                  {QUALITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleQualityChange(preset)}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                        selectedQuality.label === preset.label
                          ? 'bg-[#176f91] text-white font-semibold'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {privacyNotice && !error && !isLoading && (
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-amber-500/90 text-white text-xs text-center">
              {privacyNotice}
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white px-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm">{error}</p>
              {privacyNotice && (
                <p className="text-xs text-amber-200">{privacyNotice}</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {showPrivacyButton && privacyEnabled && (
                  <button
                    onClick={handleTogglePrivacy}
                    disabled={isTogglingPrivacy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-medium disabled:opacity-50"
                  >
                    {isTogglingPrivacy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    Отключить приватность
                  </button>
                )}
                <button
                  onClick={loadStream}
                  className="px-4 py-2 rounded-lg bg-[#176f91] hover:bg-[#145a72] text-sm font-medium"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-xs text-gray-500 dark:text-muted border-t border-gray-200 dark:border-border-soft">
          WebRTC может показывать чёрный экран в режиме приватности. Переключите приватность как в приложении «Дом с Алисой».
        </div>
      </div>
    </div>
  );
};
