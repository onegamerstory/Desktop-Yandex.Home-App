/** Default playback gain (~400%) — camera mics are often very quiet. */
export const CAMERA_AUDIO_GAIN = 4.0;

export interface VideoAudioBoost {
  setGain: (value: number) => void;
  /** Restore boost gain and ensure AudioContext is running. */
  resume: () => void;
  release: () => void;
  readonly contextState: AudioContextState;
}

const attached = new WeakMap<HTMLVideoElement, VideoAudioBoost>();

/**
 * Route <video> audio through a GainNode so volume can exceed HTMLMediaElement's 1.0 cap.
 * Safe to call repeatedly on the same element — createMediaElementSource runs once.
 *
 * IMPORTANT: HTMLMediaElement may only have createMediaElementSource() called once
 * for its lifetime. Releasing must NOT tear down the MediaElementSource graph, or the
 * next attach on the same <video> throws InvalidStateError and can crash the React tree.
 * Also do NOT suspend the AudioContext on release — effect cleanup + re-attach would leave
 * playback silent (setGain alone does not wake a suspended context).
 */
export const attachVideoAudioBoost = (
  video: HTMLVideoElement,
  initialGain = CAMERA_AUDIO_GAIN,
): VideoAudioBoost => {
  const existing = attached.get(video);
  if (existing) {
    existing.resume();
    existing.setGain(initialGain);
    return existing;
  }

  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(video);
  const gainNode = ctx.createGain();
  gainNode.gain.value = initialGain;
  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  const resumeCtx = () => { void ctx.resume(); };
  video.addEventListener('play', resumeCtx);
  void ctx.resume();

  const boost: VideoAudioBoost = {
    get contextState() { return ctx.state; },
    setGain: (value) => {
      gainNode.gain.value = value;
      void ctx.resume();
    },
    resume: () => {
      void ctx.resume();
    },
    release: () => {
      // Keep MediaElementSource + WeakMap entry + play→resume listener.
      // Only drop the boost gain; never disconnect/close/suspend the graph.
      // (suspend() previously left the camera silent after cleanupPlayer:
      //  boost effect did not re-run, so the context never resumed.)
      gainNode.gain.value = 1;
    },
  };

  attached.set(video, boost);
  return boost;
};
