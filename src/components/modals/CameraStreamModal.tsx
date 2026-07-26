import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { YandexDevice, CameraStreamResult, YandexWebRtcRoom } from '../../types/index';
import { connectYandexGoloomWebRtc, GoloomConnection, waitForVideoFrame, TOO_MANY_PEERS_RETRY_MS } from '../../services/yandexGoloomWebRtc';

import { getQuasarCameraDevice } from '../../services/yandexIoT';
import {
  hasCameraPrivacyControl,
  isCameraPrivacyModeEnabled,
  isYandexCameraDevice,
  mergeCameraDeviceState,
  getCameraPrivacyInstance,
} from '../../constants';
import { attachVideoAudioBoost, VideoAudioBoost } from '../../utils/videoAudioBoost';
import { debugLog, debugWarn } from '../../utils/debugLog';
import { X, RefreshCw, Loader2, Video, AlertCircle, Eye, EyeOff, Maximize2, Settings2, PictureInPicture2 } from 'lucide-react';

const QUALITY_PRESETS = [
  { label: 'High', width: 2560, height: 1440 },
  { label: 'Low', width: 848,  height: 480  },
] as const;
type QualityPreset = typeof QUALITY_PRESETS[number];

const MAX_STREAM_RETRIES = 10;
const STREAM_RETRY_DELAY_MS = 3000;

const normalizeStreamErrorMessage = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : 'Не удалось получить видеопоток';
  const marker = 'Error: ';
  const idx = raw.lastIndexOf(marker);
  return idx >= 0 ? raw.slice(idx + marker.length) : raw;
};

const isNonRetryableStreamError = (message: string): boolean =>
  message.includes('приват')
  || message.includes('не умеет')
  || message.includes('X_TOKEN')
  || message.includes('Quasar auth')
  || message.includes('Требуется вход')
  || message.includes('QR')
  || message.includes('Камера не найдена');

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
  const stagingVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const webrtcConnectionRef = useRef<GoloomConnection | null>(null);
  const loadStreamRef = useRef<((silent?: boolean) => void) | null>(null);
  const lastWebrtcRoomRef = useRef<import('../../types/index').YandexWebRtcRoom | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const credentialRefreshInFlightRef = useRef(false);
  const activeConnectionIdRef = useRef<string | null>(null);
  const scheduleReconnectRef = useRef<() => void>(() => {});
  const performSeamlessCredentialRefreshRef = useRef<(cleanupOld: () => void, connectionId: string) => boolean>(() => false);
  const refreshInFlightRef = useRef<Promise<YandexDevice> | null>(null);
  /** Incremented on close/unmount — async work must match to continue. */
  const sessionRef = useRef(0);
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const streamRetryCountRef = useRef(0);
  const audioBoostRef = useRef<VideoAudioBoost | null>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectedQualityRef = useRef<QualityPreset>(QUALITY_PRESETS[0]);
  const prevPrivacyRef = useRef(false);
  const cameraDeviceRef = useRef<YandexDevice>(device);
  const [cameraDevice, setCameraDevice] = useState<YandexDevice>(device);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamProtocol, setStreamProtocol] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null);
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

  const exitPiPIfActive = useCallback(() => {
    const video = videoRef.current;
    if (!video || document.pictureInPictureElement !== video) return;
    void document.exitPictureInPicture();
    setIsPictureInPicture(false);
  }, []);

  /** Black screen in PiP during silent reconnect — do not close the PiP window. */
  const blankPiPIfVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || document.pictureInPictureElement !== video) return;
    video.pause();
    video.srcObject = null;
    video.removeAttribute('src');
    void video.load();
  }, []);

  const privacyEnabled = isCameraPrivacyModeEnabled(cameraDevice);
  const showPrivacyButton = hasCameraPrivacyControl(cameraDevice);

  useEffect(() => {
    cameraDeviceRef.current = cameraDevice;
  }, [cameraDevice]);

  const PRIVACY_ON_NOTICE = 'Режим приватности включён. Камера не передаёт видео.';

  const isSessionAlive = useCallback((session: number) => session === sessionRef.current, []);

  const clearPendingTimers = useCallback(() => {
    for (const id of pendingTimersRef.current) {
      clearTimeout(id);
    }
    pendingTimersRef.current.clear();
    reconnectTimerRef.current = null;
  }, []);

  const scheduleSessionTimer = useCallback((
    session: number,
    fn: () => void,
    delayMs: number,
  ) => {
    const id = window.setTimeout(() => {
      pendingTimersRef.current.delete(id);
      if (!isSessionAlive(session)) return;
      fn();
    }, delayMs);
    pendingTimersRef.current.add(id);
    return id;
  }, [isSessionAlive]);

  const abortStreamSession = useCallback(() => {
    sessionRef.current += 1;
    clearPendingTimers();
    credentialRefreshInFlightRef.current = false;
    activeConnectionIdRef.current = null;
    lastWebrtcRoomRef.current = null;
    loadStreamRef.current = null;
    streamRetryCountRef.current = 0;
    performSeamlessCredentialRefreshRef.current = () => false;
    scheduleReconnectRef.current = () => {};
  }, [clearPendingTimers]);

  const cleanupPlayer = useCallback(() => {
    abortStreamSession();
    if (audioBoostRef.current) {
      debugLog('camera', 'cleanupPlayer releaseVideoAudioBoost', {
        contextState: audioBoostRef.current.contextState,
      });
      audioBoostRef.current.release();
      audioBoostRef.current = null;
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
    if (stagingVideoRef.current) {
      stagingVideoRef.current.srcObject = null;
    }
  }, [abortStreamSession]);

  const reportStreamError = useCallback((message: string, options?: { osNotify?: boolean }) => {
    exitPiPIfActive();
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (document.pictureInPictureElement === video) {
        video.srcObject = null;
      }
    }
    setReconnectNotice(null);
    streamRetryCountRef.current = 0;
    setError(message);
    setShowFreezeFrame(false);
    setIsLoading(false);

    if (options?.osNotify && window.api?.showCameraStreamErrorNotification) {
      void window.api.showCameraStreamErrorNotification({
        deviceId: device.id,
        deviceName: cameraDeviceRef.current.name,
        message,
      });
    }
  }, [device.id, exitPiPIfActive]);

  const scheduleStreamRetry = useCallback((session: number, message: string) => {
    if (!isSessionAlive(session)) return;

    streamRetryCountRef.current += 1;
    if (streamRetryCountRef.current >= MAX_STREAM_RETRIES) {
      reportStreamError(message, { osNotify: true });
      return;
    }

    blankPiPIfVideo();
    setError(null);
    setPrivacyNotice(null);
    setReconnectNotice(
      `Переподключение… (попытка ${streamRetryCountRef.current}/${MAX_STREAM_RETRIES})`,
    );

    reconnectTimerRef.current = scheduleSessionTimer(session, () => {
      reconnectTimerRef.current = null;
      if (!isSessionAlive(session)) return;
      loadStreamRef.current?.(true);
    }, STREAM_RETRY_DELAY_MS);
  }, [blankPiPIfVideo, isSessionAlive, reportStreamError, scheduleSessionTimer]);

  const enterPrivacyWaitingState = useCallback((silent = false) => {
    if (!silent) {
      cleanupPlayer();
      setError(null);
      setStreamProtocol(null);
      setIsLoading(false);
    }
    setPrivacyNotice(PRIVACY_ON_NOTICE);
  }, [cleanupPlayer]);

  const refreshCameraDevice = useCallback(async (options?: { retry?: boolean }): Promise<YandexDevice> => {
    const session = sessionRef.current;
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        const quasarDevice = await getQuasarCameraDevice(device.id, options);
        if (!isSessionAlive(session)) return device;
        const merged = mergeCameraDeviceState(device, quasarDevice);
        setCameraDevice(merged);
        return merged;
      } catch {
        if (!isSessionAlive(session)) return device;
        if (options?.retry !== false) {
          setCameraDevice(device);
        }
        return device;
      }
    })();

    refreshInFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (refreshInFlightRef.current === task) {
        refreshInFlightRef.current = null;
      }
    }
  }, [device, isSessionAlive]);

  const performSeamlessCredentialRefresh = useCallback((cleanupOld: () => void, connectionId: string): boolean => {
    const session = sessionRef.current;
    if (!isSessionAlive(session)) {
      cleanupOld();
      return false;
    }
    if (activeConnectionIdRef.current !== connectionId) {
      cleanupOld();
      return false;
    }
    if (credentialRefreshInFlightRef.current) {
      cleanupOld();
      return false;
    }

    credentialRefreshInFlightRef.current = true;
    let refreshWatchdog: ReturnType<typeof setTimeout> | null = scheduleSessionTimer(session, () => {
      if (!credentialRefreshInFlightRef.current) return;
      credentialRefreshInFlightRef.current = false;
      lastWebrtcRoomRef.current = null;
      loadStreamRef.current?.(true);
    }, 45000);

    const clearRefreshWatchdog = () => {
      if (refreshWatchdog !== null) {
        clearTimeout(refreshWatchdog);
        pendingTimersRef.current.delete(refreshWatchdog);
        refreshWatchdog = null;
      }
    };

    const scheduleReconnectAfterRefreshFailure = () => {
      if (!isSessionAlive(session)) return;
      lastWebrtcRoomRef.current = null;
      scheduleSessionTimer(session, () => loadStreamRef.current?.(true), 3000);
    };

    void (async () => {
      let stagingConn: GoloomConnection | null = null;
      let retryScheduled = false;

      const isTooManyPeers = (err: unknown) =>
        err instanceof Error && /слишком много|too.?many/i.test(err.message);

      try {
        const mainVideo = videoRef.current;
        const stagingVideo = stagingVideoRef.current;
        if (!mainVideo || !stagingVideo) {
          cleanupOld();
          scheduleReconnectAfterRefreshFailure();
          return;
        }

        const stream = await onGetStream(device.id);
        if (!isSessionAlive(session)) {
          return;
        }
        if (stream.protocol !== 'webrtc' || !stream.webrtc) {
          throw new Error('WebRTC room not available');
        }

        try {
          stagingConn = await connectYandexGoloomWebRtc(
            stream.webrtc,
            stagingVideo,
            undefined,
            selectedQualityRef.current,
            undefined,
          );
        } catch (err) {
          if (isTooManyPeers(err)) {
            stagingConn?.cleanup();
            retryScheduled = true;
            scheduleSessionTimer(session, () => {
              credentialRefreshInFlightRef.current = false;
              void performSeamlessCredentialRefreshRef.current(cleanupOld, connectionId);
            }, TOO_MANY_PEERS_RETRY_MS);
            return;
          }
          throw err;
        }

        if (!isSessionAlive(session)) {
          stagingConn.cleanup();
          return;
        }

        await waitForVideoFrame(stagingVideo);
        if (!isSessionAlive(session)) {
          stagingConn.cleanup();
          return;
        }

        const newStream = stagingVideo.srcObject;
        if (!newStream) {
          throw new Error('Staging stream missing after connect');
        }

        mainVideo.srcObject = newStream;
        mainVideo.muted = false;
        try { await mainVideo.play(); } catch { /* ignore */ }
        stagingVideo.srcObject = null;
        setShowFreezeFrame(false);
        setError(null);

        cleanupOld();
        webrtcConnectionRef.current = stagingConn;
        activeConnectionIdRef.current = stagingConn.id;
        stagingConn = null;
        lastWebrtcRoomRef.current = stream.webrtc;
      } catch (err) {
        stagingConn?.cleanup();
        if (!isSessionAlive(session)) return;
        if (isTooManyPeers(err)) {
          retryScheduled = true;
          scheduleSessionTimer(session, () => {
            credentialRefreshInFlightRef.current = false;
            void performSeamlessCredentialRefreshRef.current(cleanupOld, connectionId);
          }, TOO_MANY_PEERS_RETRY_MS);
          return;
        }
        cleanupOld();
        activeConnectionIdRef.current = null;
        scheduleReconnectAfterRefreshFailure();
      } finally {
        clearRefreshWatchdog();
        if (!retryScheduled) {
          credentialRefreshInFlightRef.current = false;
        }
      }
    })();

    return true;
  }, [device.id, onGetStream, isSessionAlive, scheduleSessionTimer]);

  useEffect(() => {
    performSeamlessCredentialRefreshRef.current = performSeamlessCredentialRefresh;
  }, [performSeamlessCredentialRefresh]);

  const loadStream = useCallback(async (silent = false) => {
    if (isCameraPrivacyModeEnabled(cameraDeviceRef.current)) {
      enterPrivacyWaitingState(silent);
      return;
    }

    if (!silent) {
      cleanupPlayer();
      setIsLoading(true);
      setError(null);
      setPrivacyNotice(null);
      setStreamProtocol(null);
    } else {
      blankPiPIfVideo();
      captureFreezeFrame();
      clearPendingTimers();
      if (webrtcConnectionRef.current) { webrtcConnectionRef.current.cleanupSoft(); webrtcConnectionRef.current = null; }
      setPrivacyNotice(null);
    }

    const session = sessionRef.current;
    if (!isSessionAlive(session)) return;

    try {
      const stream = await onGetStream(device.id);
      if (!isSessionAlive(session)) return;

      streamRetryCountRef.current = 0;
      setReconnectNotice(null);
      setStreamProtocol(stream.protocol);
      setError(null);

      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (stream.protocol === 'webrtc' && stream.webrtc) {
        lastWebrtcRoomRef.current = stream.webrtc;

        const scheduleReconnect = () => {
          if (!isSessionAlive(session)) return;
          reconnectTimerRef.current = scheduleSessionTimer(session, () => {
            reconnectTimerRef.current = null;
            if (!isSessionAlive(session)) return;
            lastWebrtcRoomRef.current = null;
            loadStreamRef.current?.(true);
          }, 3000);
        };
        scheduleReconnectRef.current = scheduleReconnect;

        const conn = await connectYandexGoloomWebRtc(
          stream.webrtc,
          video,
          () => scheduleReconnect(),
          selectedQualityRef.current,
          (oldCleanup, connId) => {
            if (!isSessionAlive(session)) return false;
            return performSeamlessCredentialRefreshRef.current(oldCleanup, connId);
          },
        );
        if (!isSessionAlive(session)) {
          conn.cleanup();
          return;
        }
        webrtcConnectionRef.current = conn;
        activeConnectionIdRef.current = conn.id;
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
          if (!data.fatal || !isSessionAlive(session)) return;
          scheduleStreamRetry(session, 'Не удалось воспроизвести HLS-поток');
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
      if (!isSessionAlive(session)) return;
      const message = normalizeStreamErrorMessage(err);
      if (privacyEnabled || message.includes('приват') || message.includes('не умеет')) {
        setPrivacyNotice('Камера может быть в режиме приватности. Отключите его кнопкой ниже.');
        reportStreamError(message);
        return;
      }
      if (isNonRetryableStreamError(message)) {
        reportStreamError(message);
        return;
      }
      if (streamProtocol || silent) {
        captureFreezeFrame();
      }
      scheduleStreamRetry(session, message);
    } finally {
      if (isSessionAlive(session)) {
        setIsLoading(false);
      }
    }
  }, [cleanupPlayer, clearPendingTimers, device.id, onGetStream, privacyEnabled, captureFreezeFrame, enterPrivacyWaitingState, reportStreamError, isSessionAlive, scheduleSessionTimer, scheduleStreamRetry, blankPiPIfVideo, streamProtocol]);

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

  // Boost Yandex camera audio above the HTMLMediaElement 1.0 volume cap (mics are often quiet).
  // Do NOT depend on cameraDevice — privacy polls refresh it every ~20s and would re-run
  // this effect; tearing down MediaElementSource then re-attaching throws InvalidStateError
  // and can unmount the entire React tree (blank app, only CSS background left).
  //
  // CRITICAL: createMediaElementSource must run AFTER the element has a MediaStream.
  // Attaching on an empty <video> and then switching srcObject (Goloom combined stream)
  // often yields silent playback in Chromium/Electron even though the audio track is live.
  useEffect(() => {
    if (!isOpen || !streamProtocol) return;
    const video = videoRef.current;
    if (!video) return;
    if (!isYandexCameraDevice(cameraDeviceRef.current)) return;

    const applyBoost = (reason: string) => {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        const liveAudio = stream.getAudioTracks().filter((t) => t.readyState === 'live');
        if (liveAudio.length === 0) {
          debugLog('camera', 'skip attachVideoAudioBoost — waiting for audio track', {
            reason,
            videoTracks: stream.getVideoTracks().length,
          });
          return;
        }
      } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        debugLog('camera', 'skip attachVideoAudioBoost — no media yet', {
          reason,
          readyState: video.readyState,
        });
        return;
      }

      video.muted = false;
      video.volume = 1;
      try {
        const boost = attachVideoAudioBoost(video);
        audioBoostRef.current = boost;
        debugLog('camera', 'attachVideoAudioBoost', {
          reason,
          streamProtocol,
          videoWidth: video.videoWidth,
          contextState: boost.contextState,
          paused: video.paused,
          audioTracks: stream instanceof MediaStream
            ? stream.getAudioTracks().map((t) => ({
              id: t.id,
              enabled: t.enabled,
              muted: t.muted,
              readyState: t.readyState,
            }))
            : null,
        });
        boost.resume();
      } catch (err) {
        debugWarn('camera', 'attachVideoAudioBoost failed', err);
      }
    };

    const onPlaying = () => applyBoost('playing');
    video.addEventListener('playing', onPlaying);
    // If playback already started before this effect ran, attach immediately.
    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      applyBoost('effect-already-playing');
    }

    return () => {
      video.removeEventListener('playing', onPlaying);
      debugLog('camera', 'releaseVideoAudioBoost', {
        contextState: audioBoostRef.current?.contextState,
      });
      audioBoostRef.current?.release();
      audioBoostRef.current = null;
    };
  }, [isOpen, streamProtocol]);

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

  // OS notification "Повторить" → reconnect this camera
  useEffect(() => {
    if (!isOpen || !window.api?.onCameraStreamRetry) return;

    const unsubscribe = window.api.onCameraStreamRetry(({ deviceId }) => {
      if (deviceId !== device.id) return;
      streamRetryCountRef.current = 0;
      setError(null);
      setReconnectNotice(null);
      loadStreamRef.current?.();
    });

    return unsubscribe;
  }, [isOpen, device.id]);

  // While streaming: poll every 20 s to catch physical privacy-button presses.
  // While privacy is ON (no stream): poll every 5 s waiting for it to be lifted,
  // then auto-reconnect so the user doesn't have to press "Повторить" manually.
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const session = sessionRef.current;
    const isWaitingForPrivacy = privacyEnabled && !streamProtocol && !error;
    const interval = isWaitingForPrivacy ? 5000 : 20000;

    const poll = setInterval(() => {
      if (!isSessionAlive(session)) return;
      void refreshCameraDevice({ retry: false });
    }, interval);

    return () => clearInterval(poll);
  }, [isOpen, streamProtocol, isLoading, error, privacyEnabled, refreshCameraDevice, isSessionAlive]);

  // React when privacy state changes mid-session.
  useEffect(() => {
    const wasEnabled = prevPrivacyRef.current;
    prevPrivacyRef.current = privacyEnabled;

    if (!wasEnabled && privacyEnabled && streamProtocol && !isLoading) {
      // Privacy just turned ON while streaming → stop stream, wait for it to be lifted
      cleanupPlayer();
      setStreamProtocol(null);
      setError(null);
      setPrivacyNotice(PRIVACY_ON_NOTICE);
    }

    if (wasEnabled && !privacyEnabled && !streamProtocol && !isLoading && isOpen) {
      // Privacy just turned OFF while we were waiting → auto-reconnect
      setPrivacyNotice(null);
      loadStreamRef.current?.();
    }
  }, [privacyEnabled, streamProtocol, isLoading, isOpen, cleanupPlayer]);

  useEffect(() => {
    debugLog('camera', 'modal isOpen effect', { isOpen, deviceId: device.id, session: sessionRef.current });
    if (!isOpen) {
      cleanupPlayer();
      setError(null);
      setPrivacyNotice(null);
      setReconnectNotice(null);
      setStreamProtocol(null);
      return;
    }

    const session = sessionRef.current;

    const openStream = async () => {
      if (isCameraPrivacyModeEnabled(device)) {
        enterPrivacyWaitingState();
        void refreshCameraDevice({ retry: false });
        return;
      }

      const refreshedDevice = await refreshCameraDevice({ retry: true });
      if (!isSessionAlive(session)) {
        return;
      }

      if (isCameraPrivacyModeEnabled(refreshedDevice)) {
        enterPrivacyWaitingState();
        return;
      }

      loadStreamRef.current?.();
    };

    void openStream();

    return () => {
      debugLog('camera', 'modal isOpen cleanup', { deviceId: device.id });
      cleanupPlayer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Final safety net when Dashboard unmounts the modal entirely
  useEffect(() => () => {
    debugLog('camera', 'modal unmount cleanupPlayer');
    cleanupPlayer();
  }, [cleanupPlayer]);

  useEffect(() => {
    debugLog('camera', 'ui state', {
      isOpen,
      streamProtocol,
      isLoading,
      privacyEnabled,
      hasError: Boolean(error),
      session: sessionRef.current,
    });
  }, [isOpen, streamProtocol, isLoading, privacyEnabled, error]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-full bg-[#176f91]/10 dark:bg-primary/20">
              <Video className="w-5 h-5 text-[#176f91] dark:text-primary" />
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
            {pipSupported && (
              <button
                onClick={() => { void handleTogglePictureInPicture(); }}
                disabled={isLoading || !streamProtocol}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                  isPictureInPicture
                    ? 'text-[#176f91] dark:text-primary bg-[#176f91]/10 dark:bg-primary/20'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
                title={isPictureInPicture ? 'Закрыть окно поверх других' : 'Окно поверх других приложений'}
              >
                <PictureInPicture2 className="w-5 h-5" />
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

        <div className="relative w-full aspect-video overflow-hidden rounded-b-2xl bg-black">
          <video
            ref={stagingVideoRef}
            className="hidden"
            playsInline
            muted
            aria-hidden
          />
          <video
            ref={videoRef}
            className="block h-full w-full object-contain"
            controls
            playsInline
            autoPlay
          />
          <canvas
            ref={freezeCanvasRef}
            className={`absolute inset-0 h-full w-full object-contain pointer-events-none ${showFreezeFrame ? 'z-[5]' : 'hidden'}`}
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
                          ? 'bg-[#176f91] dark:bg-primary text-white font-semibold'
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

          {reconnectNotice && !error && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 text-white text-xs text-center">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              <span>{reconnectNotice}</span>
            </div>
          )}

          {privacyNotice && !error && !isLoading && !reconnectNotice && (
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
                  className="px-4 py-2 rounded-lg bg-[#176f91] dark:bg-primary hover:bg-[#145a72] dark:hover:bg-primary-hover text-white text-sm font-medium"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
