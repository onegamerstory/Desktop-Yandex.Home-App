import { YandexWebRtcRoom } from '../types/index';

const CONNECTION_TIMEOUT_MS = 90000;
const VIDEO_TIMEOUT_MS = 30000;

const log = (...args: unknown[]) => console.log('[Goloom]', ...args);
const logErr = (...args: unknown[]) => console.error('[Goloom]', ...args);

const waitForWsOpen = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
    }
    ws.addEventListener('open', () => { log('WS opened'); resolve(); }, { once: true });
    ws.addEventListener('error', (e) => {
        logErr('WS open error', e);
        reject(new Error('Не удалось подключиться к WebRTC-серверу'));
    }, { once: true });
});

const readWsMessage = (ws: WebSocket) => new Promise<string>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => { cleanup(); resolve(typeof event.data === 'string' ? event.data : ''); };
    const onError = () => { cleanup(); reject(new Error('Ошибка WebSocket-соединения')); };
    const onClose = () => { cleanup(); reject(new Error('WebSocket-соединение закрыто')); };
    const cleanup = () => {
        ws.removeEventListener('message', onMessage);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onClose);
    };
    ws.addEventListener('message', onMessage);
    ws.addEventListener('error', onError);
    ws.addEventListener('close', onClose);
});

// Resolves on ICE connected OR full connection connected (whichever comes first)
const waitForPeerConnected = (pc: RTCPeerConnection) => new Promise<void>((resolve, reject) => {
    let done = false;

    const timeout = window.setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        logErr('WebRTC connection timeout, last connectionState:', pc.connectionState, 'ICE:', pc.iceConnectionState);
        reject(new Error('Таймаут WebRTC-подключения'));
    }, CONNECTION_TIMEOUT_MS);

    let iceConnectedAt = 0;

    const tryResolve = () => {
        if (done) return;
        const cs = pc.connectionState;
        const ice = pc.iceConnectionState;
        log('connectionState ->', cs, '| iceConnectionState ->', ice);

        if (cs === 'connected') {
            done = true;
            cleanup();
            resolve();
            return;
        }

        if (ice === 'connected' || ice === 'completed') {
            if (!iceConnectedAt) {
                iceConnectedAt = Date.now();
                // Give DTLS up to 5s to finish after ICE; resolve anyway after that
                window.setTimeout(() => {
                    if (done) return;
                    log('DTLS did not complete 5s after ICE — resolving anyway, connectionState:', pc.connectionState);
                    done = true;
                    cleanup();
                    resolve();
                }, 5000);
            }
        }

        if (cs === 'failed' || cs === 'closed' || ice === 'failed') {
            done = true;
            cleanup();
            reject(new Error(`WebRTC: ${cs} / ICE: ${ice}`));
        }
    };

    const cleanup = () => {
        window.clearTimeout(timeout);
        pc.removeEventListener('connectionstatechange', tryResolve);
        pc.removeEventListener('iceconnectionstatechange', tryResolve);
    };

    pc.addEventListener('connectionstatechange', tryResolve);
    pc.addEventListener('iceconnectionstatechange', tryResolve);
    tryResolve();
});

const waitForVideoFrame = (video: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
        cleanup();
        logErr('No video frames after', VIDEO_TIMEOUT_MS / 1000, 's. videoWidth:', video.videoWidth, 'readyState:', video.readyState);
        reject(new Error('Камера не передаёт видео. Возможно, включён режим приватности.'));
    }, VIDEO_TIMEOUT_MS);

    const checkReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            log('Video frame received:', video.videoWidth, 'x', video.videoHeight);
            cleanup();
            resolve();
        }
    };

    const onLoadedData = () => { log('video loadeddata', video.videoWidth, 'x', video.videoHeight); checkReady(); };
    const onPlaying = () => { log('video playing', video.videoWidth, 'x', video.videoHeight); checkReady(); };
    const onResize = () => { log('video resize:', video.videoWidth, 'x', video.videoHeight); checkReady(); };

    const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('resize', onResize);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('resize', onResize);
    checkReady();
});

const sendAck = (ws: WebSocket, uid: string) => {
    ws.send(JSON.stringify({ uid, ack: { status: { code: 'OK' } } }));
};

const handleSignalingMessage = async (
    raw: string,
    pc: RTCPeerConnection,
    ws: WebSocket,
    pendingCandidates: RTCIceCandidateInit[],
    state: { remoteDescSet: boolean },
    onSlotsConfig?: (mid: string) => void,
) => {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(msg).filter(k => k !== 'uid');
    if (keys.length > 0) {
        log('recv:', keys.join(', '));
    }

    if ('slotsConfig' in msg) {
        const cfg = msg.slotsConfig as {
            slots?: Array<{ participantVideoByMid?: { mid?: string; limitationReason?: string } }>;
        } | undefined;
        // Extract video mid from first slot with non-empty mid
        const slot = cfg?.slots?.find(s => s.participantVideoByMid?.mid);
        const mid = slot?.participantVideoByMid?.mid ?? '';
        const limitation = slot?.participantVideoByMid?.limitationReason ?? '';
        log('slotsConfig received: mid=', mid || '(empty)', '| limitationReason=', limitation || '(none)');
        onSlotsConfig?.(mid);
    }

    if (msg.subscriberSdpOffer) {
        const offer = msg.subscriberSdpOffer as { pcSeq: number; sdp: string };
        // Extract codec info from SDP for diagnostics
        const videoLine = offer.sdp.split('\n').find(l => l.startsWith('m=video'));
        const codecLines = offer.sdp.split('\n').filter(l => l.includes('VP8') || l.includes('VP9') || l.includes('H264') || l.includes('AV1') || l.includes('rtpmap'));
        log('SDP offer received, pcSeq:', offer.pcSeq, '| video m-line:', videoLine?.trim(), '| codecs:', codecLines.slice(0, 4).map(l => l.trim()).join(' / '));
        await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
        state.remoteDescSet = true;

        for (const c of pendingCandidates.splice(0)) {
            try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        log('SDP answer sent');
        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            subscriberSdpAnswer: { pcSeq: offer.pcSeq, sdp: answer.sdp },
        }));
    }

    if (msg.webrtcIceCandidate) {
        const candidate = msg.webrtcIceCandidate as {
            candidate: string; sdpMid: string; sdpMlineIndex: number;
        };
        if (candidate.candidate) {
            const init: RTCIceCandidateInit = {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMlineIndex,
            };
            if (!state.remoteDescSet) {
                log('queuing ICE candidate');
                pendingCandidates.push(init);
            } else {
                try { await pc.addIceCandidate(init); } catch (e) { logErr('addIceCandidate error:', e); }
            }
        }
    }

    if (msg.uid && msg.ack == null) {
        sendAck(ws, String(msg.uid));
    }
};

export interface GoloomConnection {
    /** Full cleanup — stops stream and clears the video element. */
    cleanup: () => void;
    /** Soft cleanup — stops the WebSocket/PeerConnection but keeps the last video frame visible. */
    cleanupSoft: () => void;
    setQuality: (width: number, height: number) => void;
}

export const connectYandexGoloomWebRtc = async (
    room: YandexWebRtcRoom,
    video: HTMLVideoElement,
    onDisconnect?: () => void,
    initialQuality: { width: number; height: number } = { width: 2560, height: 1440 },
): Promise<GoloomConnection> => {
    const pendingCandidates: RTCIceCandidateInit[] = [];
    const state = { remoteDescSet: false };
    let closed = false;

    // Map of transceiver mid → MediaStream, populated by ontrack
    const videoStreams = new Map<string, MediaStream>();
    // All received audio tracks
    const audioTracks: MediaStreamTrack[] = [];

    // Promise that resolves when server sends slotsConfig with an actual mid assigned
    let slotsConfigResolve: ((mid: string) => void) | null = null;
    const slotsConfigPromise = new Promise<string>(resolve => { slotsConfigResolve = resolve; });

    const doCleanup = (ws: WebSocket, pc: RTCPeerConnection, unexpected = false, keepVideo = false) => {
        if (closed) return;
        closed = true;
        log('Cleanup', keepVideo ? '(keeping video frame)' : '');
        pc.close();
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        if (!keepVideo) video.srcObject = null;
        if (unexpected) onDisconnect?.();
    };

    log('Connecting to', room.serviceUrl);
    const ws = new WebSocket(room.serviceUrl);
    await waitForWsOpen(ws);

    const hello = {
        hello: {
            credentials: room.credentials,
            participantId: room.participantId,
            roomId: room.roomId,
            serviceName: room.serviceName,
            sdkInitializationId: crypto.randomUUID(),
            capabilitiesOffer: {},
            sendAudio: false,
            sendSharing: false,
            sendVideo: false,
            sdkInfo: { hwConcurrency: 4, implementation: 'browser', version: '5.4.0' },
            participantAttributes: { description: '', name: 'mike', role: 'SPEAKER' },
            participantMeta: {
                description: '', name: 'mike', role: 'SPEAKER',
                sendAudio: false, sendVideo: false,
            },
        },
        uid: crypto.randomUUID(),
    };
    ws.send(JSON.stringify(hello));
    log('hello sent, waiting serverHello...');

    const serverHelloRaw = await readWsMessage(ws);
    try {
        const sh = JSON.parse(serverHelloRaw) as Record<string, unknown>;
        log('serverHello keys:', Object.keys(sh).join(', '));
    } catch {
        log('serverHello (raw):', serverHelloRaw.slice(0, 200));
    }

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    });
    log('RTCPeerConnection created');

    pc.ontrack = (event) => {
        const t = event.track;
        const txMid = event.transceiver?.mid ?? '';
        log('ontrack kind:', t.kind, '| mid:', txMid || '(empty)', '| id:', t.id.slice(0, 8), '| enabled:', t.enabled, '| readyState:', t.readyState, '| streams:', event.streams.length);
        if (t.kind === 'video') {
            const stream = event.streams[0] ?? new MediaStream([t]);
            videoStreams.set(txMid, stream);
            log('Stored video stream for mid:', txMid || '(empty)', '| stream id:', stream.id.slice(0, 8));
            // Log sub-stream resolution when available
            if (txMid === 'video_AB') {
                const tmpVid = document.createElement('video');
                tmpVid.muted = true;
                tmpVid.srcObject = stream;
                const logAndCleanup = () => {
                    log('video_AB resolution:', tmpVid.videoWidth, 'x', tmpVid.videoHeight);
                    tmpVid.srcObject = null;
                };
                tmpVid.addEventListener('loadedmetadata', logAndCleanup, { once: true });
                tmpVid.addEventListener('resize', logAndCleanup, { once: true });
                tmpVid.load();
            }
            // Always set srcObject from the first arriving video track so stale
            // tracks from a previous soft-cleanup connection don't remain visible.
            if (videoStreams.size === 1) {
                log('Setting initial srcObject from first video track');
                video.srcObject = stream;
                video.muted = false;
            }
        } else if (t.kind === 'audio') {
            audioTracks.push(t);
            log('Stored audio track, total:', audioTracks.length);
        }
        t.addEventListener('ended', () => logErr('track ended, kind:', t.kind, '| mid:', txMid));
        t.addEventListener('mute', () => log('track muted, kind:', t.kind, '| mid:', txMid));
        t.addEventListener('unmute', () => log('track unmuted, kind:', t.kind, '| mid:', txMid));
    };

    pc.onicecandidate = (event) => {
        if (!event.candidate) {
            log('ICE gathering complete');
            return;
        }
        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            webrtcIceCandidate: {
                pcSeq: 0,
                target: 'SUBSCRIBER',
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMlineIndex: event.candidate.sdpMLineIndex,
            },
        }));
    };

    const messageLoop = (async () => {
        while (!closed && ws.readyState === WebSocket.OPEN) {
            const raw = await readWsMessage(ws);
            await handleSignalingMessage(raw, pc, ws, pendingCandidates, state, (mid) => {
            if (mid) slotsConfigResolve?.(mid);
        });
        }
    })();

    messageLoop.catch((err) => {
        logErr('messageLoop error:', err);
        doCleanup(ws, pc, true);
    });

    try {
        log('Waiting for peer connection (up to', CONNECTION_TIMEOUT_MS / 1000, 's)...');
        await waitForPeerConnected(pc);
        log('Connected! Sending setSlots...');

        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            setSlots: {
                slots: [{ width: initialQuality.width, height: initialQuality.height }],
                audioSlotsCount: 0,
                key: 1,
                shutdownAllVideo: false,
                withSelfView: false,
                selfViewVisibility: 'ON_LOADING_THEN_HIDE',
                gridConfig: {},
            },
        }));

        // Wait for slotsConfig with a real mid assigned — or actual video frames
        const slotsTimeout = new Promise<string>((_, reject) =>
            window.setTimeout(() => reject(new Error('Сервер не подтвердил настройку слотов')), VIDEO_TIMEOUT_MS));

        const videoFramePromise = waitForVideoFrame(video).then(() => '');

        const assignedMid = await Promise.race([
            slotsConfigPromise,
            videoFramePromise,
            slotsTimeout,
        ]);

        log('Stream confirmed. assignedMid:', assignedMid || '(from video frame)', '| connectionState:', pc.connectionState);

        // Build a combined stream: correct video track + all audio tracks
        {
            let videoTrack: MediaStreamTrack | undefined;
            if (assignedMid) {
                const targetStream = videoStreams.get(assignedMid)
                    ?? [...videoStreams.values()][0];
                if (targetStream) {
                    videoTrack = targetStream.getVideoTracks()[0];
                    log('Using video track from mid:', assignedMid, '| track id:', videoTrack?.id.slice(0, 8));
                } else {
                    log('No stream found for mid:', assignedMid, '— keeping current srcObject');
                }
            } else {
                // Came from video frame — use the first available stream from newly received tracks
                videoTrack = [...videoStreams.values()][0]?.getVideoTracks()[0];
            }

            if (videoTrack) {
                const combined = new MediaStream();
                combined.addTrack(videoTrack);
                for (const at of audioTracks) {
                    combined.addTrack(at);
                    log('Added audio track to combined stream, id:', at.id.slice(0, 8));
                }
                log('Switching srcObject to combined stream: video+', audioTracks.length, 'audio track(s)');
                video.srcObject = combined;
                video.muted = false;
            }
        }

        // Probe all available video streams and pick the highest-resolution one.
        // The server may assign a lower-resolution stream as the "primary" slot.
        const probeVideoWidth = (stream: MediaStream): Promise<number> =>
            new Promise(resolve => {
                const tmp = document.createElement('video');
                tmp.muted = true;
                tmp.srcObject = stream;
                const done = () => { resolve(tmp.videoWidth); tmp.srcObject = null; };
                tmp.addEventListener('loadedmetadata', done, { once: true });
                tmp.addEventListener('resize', done, { once: true });
                tmp.load();
                window.setTimeout(() => { resolve(0); tmp.srcObject = null; }, 3000);
            });

        // Run probing in background after play; switches srcObject if a better stream exists
        const upgradeToHighestQuality = async () => {
            if (closed) return;
            let bestWidth = video.videoWidth;
            let bestTrack: MediaStreamTrack | undefined;
            for (const [mid, stream] of videoStreams) {
                const track = stream.getVideoTracks()[0];
                if (!track || track.readyState !== 'live') continue;
                const w = await probeVideoWidth(stream);
                log('Probed mid:', mid, '→', w, 'x (current best:', bestWidth, ')');
                if (w > bestWidth) { bestWidth = w; bestTrack = track; }
            }
            if (bestTrack && !closed) {
                log('Upgrading to higher quality track, width:', bestWidth);
                const combined = new MediaStream([bestTrack, ...audioTracks]);
                video.srcObject = combined;
                video.muted = false;
                try { await video.play(); } catch { /* ignore */ }
            }
        };

        log('video state BEFORE play:', video.srcObject ? `stream(${(video.srcObject as MediaStream).getTracks().map(t => `${t.kind}:${t.readyState}:enabled=${t.enabled}`).join(',')})` : 'null', '| readyState:', video.readyState, '| videoWidth:', video.videoWidth);

        // Give browser a moment to process SRTP after DTLS
        await new Promise(r => window.setTimeout(r, 500));

        try { await video.play(); } catch { /* ignore AbortError */ }

        log('video state AFTER play: readyState:', video.readyState, '| videoWidth:', video.videoWidth, '| paused:', video.paused);

        if (video.videoWidth === 0) {
            log('videoWidth is 0 — camera may be in privacy mode, DTLS incomplete, or codec unsupported');
        }

        // Auto-upgrade only when high quality was requested (not when user intentionally chose low)
        const isHighQualityRequest = initialQuality.width === 0 || initialQuality.width >= 1920;
        if (isHighQualityRequest) {
            window.setTimeout(() => { void upgradeToHighestQuality(); }, 1000);
        }

        const setQuality = (width: number, height: number) => {
            if (closed || ws.readyState !== WebSocket.OPEN) return;
            log('Changing quality to', width, 'x', height);
            ws.send(JSON.stringify({
                uid: crypto.randomUUID(),
                setSlots: {
                    slots: [{ width, height }],
                    audioSlotsCount: 0,
                    key: Date.now(),
                    shutdownAllVideo: false,
                    withSelfView: false,
                    selfViewVisibility: 'ON_LOADING_THEN_HIDE',
                    gridConfig: {},
                },
            }));
        };

        return {
            cleanup: () => doCleanup(ws, pc),
            cleanupSoft: () => doCleanup(ws, pc, false, true),
            setQuality,
        };
    } catch (err) {
        doCleanup(ws, pc);
        throw err;
    }
};
