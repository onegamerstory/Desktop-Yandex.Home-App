import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { YandexDevice, CameraStreamResult } from '../../types/index';
import { connectYandexGoloomWebRtc, GoloomConnection } from '../../services/yandexGoloomWebRtc';
import { getQuasarCameraDevice } from '../../services/yandexIoT';
import {
  hasCameraPrivacyControl,
  isCameraPrivacyModeEnabled,
  mergeCameraDeviceState,
  getCameraPrivacyInstance,
} from '../../constants';
import { X, RefreshCw, Loader2, Video, AlertCircle, Eye, EyeOff, Maximize2, Settings2 } from 'lucide-react';

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
  const selectedQualityRef = useRef<QualityPreset>(QUALITY_PRESETS[0]);
  const [cameraDevice, setCameraDevice] = useState<YandexDevice>(device);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamProtocol, setStreamProtocol] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>(QUALITY_PRESETS[0]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

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
      // Silent reconnect: stop old tracks without clearing the video frame
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (webrtcConnectionRef.current) { webrtcConnectionRef.current.cleanupSoft(); webrtcConnectionRef.current = null; }
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
        const onDisconnect = () => {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(async () => {
            reconnectTimerRef.current = null;
            const v = videoRef.current;
            if (!v) return;
            // Fast path: reuse cached room credentials (same room_id, no HTTP call)
            const cached = lastWebrtcRoomRef.current;
            if (cached) {
              if (webrtcConnectionRef.current) { webrtcConnectionRef.current.cleanupSoft(); webrtcConnectionRef.current = null; }
              try {
                webrtcConnectionRef.current = await connectYandexGoloomWebRtc(cached, v, onDisconnect, selectedQualityRef.current);
                return;
              } catch {
                // Fast path failed — fall back to full reconnect
              }
            }
            loadStreamRef.current?.(true);
          }, 300);
        };
        webrtcConnectionRef.current = await connectYandexGoloomWebRtc(stream.webrtc, video, onDisconnect, selectedQualityRef.current);
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
  }, [cleanupPlayer, device.id, onGetStream, privacyEnabled]);

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
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-full bg-purple-50 dark:bg-primary/20 text-purple-600 dark:text-primary">
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                {cameraDevice.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
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
                    : 'bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
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
            <button
              onClick={() => videoRef.current?.requestFullscreen?.()}
              disabled={isLoading || !streamProtocol}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Полноэкранный режим"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={loadStream}
              disabled={isLoading || isTogglingPrivacy}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Обновить поток"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
                          ? 'bg-purple-600 text-white font-semibold'
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
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-medium"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-xs text-gray-500 dark:text-slate-400 border-t border-gray-200 dark:border-white/10">
          WebRTC может показывать чёрный экран в режиме приватности. Переключите приватность как в приложении «Дом с Алисой».
        </div>
      </div>
    </div>
  );
};
