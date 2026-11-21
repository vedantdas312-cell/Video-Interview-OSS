import { useEffect, useRef, useState, type ReactNode } from 'react';
import { captureFrame, CapturedFrame, createStreamRecorder } from '../lib/capture';
import { ANSWER_SECONDS } from '../lib/timing';

export type RecorderResult = {
  blob: Blob;
  /** Recorded answer length in seconds. */
  duration: number;
  frames: CapturedFrame[];
};

type RecorderProps = {
  stream: MediaStream;
  answerSeconds?: number;
  children?: ReactNode;
  onStart?: () => void;
  onComplete: (result: RecorderResult) => void;
  onError: (message: string) => void;
};

type Phase = 'preparing' | 'recording' | 'finishing' | 'complete' | 'error';

const FRAME_INTERVAL_MS = 2_000;
const MAX_FRAMES = 32;

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/**
 * Records from the stream owned by the parent. This component never stops its
 * tracks, so the caller remains responsible for the camera/microphone lifetime.
 */
export default function Recorder({
  stream,
  answerSeconds = ANSWER_SECONDS,
  children, onStart,
  onComplete,
  onError,
}: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const clockIntervalRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('preparing');
  const mountedRef = useRef(false);
  const completedRef = useRef(false);
  const failedRef = useRef(false);
  const startRecordingRef = useRef<() => void>(() => undefined);
  const stopRecordingRef = useRef<() => void>(() => undefined);
  const framesRef = useRef<CapturedFrame[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingEndedAtRef = useRef(0);
  const handlersRef = useRef({ onComplete, onError, onStart });
  handlersRef.current = { onComplete, onError, onStart };

  const [phase, setPhase] = useState<Phase>('preparing');
  const [remainingSeconds, setRemainingSeconds] = useState(answerSeconds);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    completedRef.current = false;
    failedRef.current = false;
    framesRef.current = [];
    chunksRef.current = [];

    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      void video.play().catch(() => {
        // Muted autoplay can be denied; the browser can still show the stream after
        // its normal user-gesture policy is satisfied.
      });
    }

    const clearTimers = () => {
      if (clockIntervalRef.current !== null) { window.clearInterval(clockIntervalRef.current); clockIntervalRef.current = null; }
      if (frameIntervalRef.current !== null) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (autoStopTimeoutRef.current !== null) {
        window.clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
    };

    const fail = (message: string) => {
      if (failedRef.current || completedRef.current) return;
      failedRef.current = true;
      phaseRef.current = 'error';
      clearTimers();
      setPhase('error');
      setErrorMessage(message);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          // Preserve the original failure surfaced to the parent.
        }
      }
      handlersRef.current.onError(message);
    };

    const endedTracks = stream.getTracks();
    const handleTrackEnded = () => {
      fail('The camera or microphone stream ended before the answer was complete.');
    };
    endedTracks.forEach((track) => track.addEventListener('ended', handleTrackEnded));

    const captureCurrentFrame = (timestamp: number): boolean => {
      const currentVideo = videoRef.current;
      if (!currentVideo) return false;
      const frame = captureFrame(currentVideo, timestamp);
      if (!frame) return false;
      framesRef.current.push(frame);
      return true;
    };

    const captureFinalFrame = () => {
      const currentVideo = videoRef.current;
      if (!currentVideo) return;
      const timestamp = Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000);
      const finalFrame = captureFrame(currentVideo, timestamp);
      if (!finalFrame) return;
      const lastFrame = framesRef.current.at(-1);
      if (framesRef.current.length >= MAX_FRAMES) {
        framesRef.current[MAX_FRAMES - 1] = finalFrame;
      } else if (lastFrame && timestamp - lastFrame.timestamp < 0.25) {
        framesRef.current[framesRef.current.length - 1] = finalFrame;
      } else if (timestamp === 0 && framesRef.current.length > 0) {
        framesRef.current[framesRef.current.length - 1] = finalFrame;
      } else {
        framesRef.current.push(finalFrame);
      }
    };

    const stopRecording = () => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive' || phaseRef.current !== 'recording') return;
      try {
        captureFinalFrame();
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Could not capture the final camera frame.');
        return;
      }
      recordingEndedAtRef.current = Date.now();
      phaseRef.current = 'finishing';
      setPhase('finishing');
      clearTimers();
      try {
        recorder.stop();
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Could not finish the recording.');
      }
    };
    stopRecordingRef.current = stopRecording;

    const startRecording = () => {
      if (phaseRef.current !== 'preparing' || failedRef.current || completedRef.current) return;
      clearTimers();
      chunksRef.current = [];
      framesRef.current = [];

      try {
        const recorder = createStreamRecorder(stream);
        recorderRef.current = recorder;
        recordingStartedAtRef.current = Date.now();

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onerror = () => {
          fail('The browser encountered an error while recording.');
        };
        recorder.onstop = () => {
          if (!mountedRef.current || failedRef.current || completedRef.current) return;
          const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'video/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            fail('The browser did not provide any recorded video data. Please try again.');
            return;
          }

          completedRef.current = true;
          phaseRef.current = 'complete';
          setPhase('complete');
          const endedAt = recordingEndedAtRef.current || Date.now();
          const duration = Math.max(0, (endedAt - recordingStartedAtRef.current) / 1000);
          handlersRef.current.onComplete({
            blob,
            duration,
            frames: [...framesRef.current],
          });
        };

        // The upstream recorder starts MediaRecorder with a timeslice so chunks
        // arrive during recording; keep that behavior for browser-safe assembly.
        recorder.start(1_000);
        handlersRef.current.onStart?.();
        recordingStartedAtRef.current = Date.now();
        recordingEndedAtRef.current = 0;
        phaseRef.current = 'recording';
        setPhase('recording');
        const duration = answerSeconds;
        setRemainingSeconds(Math.ceil(duration));

        const sampleIntervalMs = Math.max(
          FRAME_INTERVAL_MS,
          (duration * 1_000) / (MAX_FRAMES - 1),
        );
        const sampleFrame = () => {
          if (framesRef.current.length >= MAX_FRAMES) {
            if (frameIntervalRef.current !== null) window.clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
            return;
          }
          try {
            const timestamp = (Date.now() - recordingStartedAtRef.current) / 1000;
            captureCurrentFrame(timestamp);
          } catch (error) {
            fail(error instanceof Error ? error.message : 'Could not capture a camera frame.');
          }
        };
        const hasInitialFrame = (() => {
          try {
            return captureCurrentFrame(0);
          } catch (error) {
            fail(error instanceof Error ? error.message : 'Could not capture the first camera frame.');
            return false;
          }
        })();
        if (hasInitialFrame) {
          frameIntervalRef.current = window.setInterval(sampleFrame, sampleIntervalMs);
        } else {
          // A live camera can need a short moment before its first decoded frame.
          // Retry until it is ready, then start the regular cadence.
          frameIntervalRef.current = window.setInterval(() => {
            try {
              if (!captureCurrentFrame(0)) return;
              if (frameIntervalRef.current !== null) window.clearInterval(frameIntervalRef.current);
              frameIntervalRef.current = window.setInterval(sampleFrame, sampleIntervalMs);
            } catch (error) {
              fail(error instanceof Error ? error.message : 'Could not capture the first camera frame.');
            }
          }, 100);
        }
        autoStopTimeoutRef.current = window.setTimeout(stopRecording, duration * 1_000);
        clockIntervalRef.current = window.setInterval(() => {
          const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
          setRemainingSeconds(Math.max(0, Math.ceil(duration - elapsed)));
        }, 200);
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Could not start the recording.');
      }
    };
    startRecordingRef.current = startRecording;

    phaseRef.current = 'preparing';
    setPhase('preparing');
    setRemainingSeconds(answerSeconds);

    return () => {
      mountedRef.current = false;
      clearTimers();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        recorder.onerror = null;
        try {
          recorder.stop();
        } catch {
          // Unmount cleanup should not affect the parent-owned stream.
        }
      }
      endedTracks.forEach((track) => track.removeEventListener('ended', handleTrackEnded));
      if (video) video.srcObject = null;
    };
  }, [stream, answerSeconds]);

  const startAnswer = () => startRecordingRef.current();
  const finishEarly = () => stopRecordingRef.current();

  let statusText = '';
  if (phase === 'preparing') {
    statusText = 'Preview · camera and microphone are on';
  } else if (phase === 'recording') {
    statusText = `Time remaining: ${formatClock(remainingSeconds)}`;
  } else if (phase === 'finishing') {
    statusText = 'Saving your answer…';
  } else if (phase === 'complete') {
    statusText = 'Recording complete.';
  }

  return (
    <section className="tcla-recorder" aria-label="Answer recorder">
      <div className="tcla-recorder__preview-frame">
        <video
          ref={videoRef}
          className="tcla-recorder__preview"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
          aria-label="Muted camera preview"
        />
        {phase === 'recording' && <span className="rec-badge">● REC</span>}
        <span className="camera-clock" role="timer" aria-label="Answer time remaining">
          {formatClock(phase === 'preparing' ? answerSeconds : remainingSeconds)}
        </span>
      </div>
      {phase === 'preparing' && children}
      <p className="tcla-recorder__countdown" aria-live="polite">
        {phase === 'error' ? errorMessage : statusText}
      </p>

      <div className="tcla-recorder__controls">
        {phase === 'preparing' && (
          <button className="tcla-recorder__start" type="button" onClick={startAnswer}>
            Start recording
          </button>
        )}
        {phase === 'recording' && (
          <button className="tcla-recorder__finish" type="button" onClick={finishEarly}>
            Stop recording
          </button>
        )}
      </div>
    </section>
  );
}
