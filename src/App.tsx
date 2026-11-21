import FeedbackAccount, {type Account} from "./components/FeedbackAccount";
import { modes, financeQuestions, MAX_QUESTIONS, type Mode } from "./data/modes";
import { ANSWER_SECONDS } from './lib/timing';
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Camera,
  Settings2,
  ShieldCheck,
  BookOpen,
  CircleHelp,
  X,
  LoaderCircle,
  Video,
  Sparkles,
  Search,
} from "lucide-react";
import Recorder from "./components/Recorder";
import AnswerReview from "./components/AnswerReview";
import SessionReview from "./components/SessionReview";
import { assessmentComplete, mergeAssessment } from "./lib/feedback";
import { questions, selectSessionQuestions } from "./data/questions";
import {
  loadSession,
  saveSession,
  deleteSavedSession,
  clockTime,
  jsonResponse,
  type Session,
  type Transcript,
  type Assessment,
  type Answer,
  PaymentRequired,
  type SessionAssessment,
} from "./lib/session";

type Screen = "home" | "setup" | "interview" | "review" | "library";
const testCamera = import.meta.env.DEV && new URLSearchParams(location.search).get('testCamera') === '1';
type Health = {
  transcription: { available: boolean; reason?: string };
  defaultModel: string;
};
const labels: Record<string, string> = {
  "Motivation for Commercial Law": "Your motivation",
  "Competency Interview Questions": "Your experience",
  "Character and Personality": "About you",
};
const shortCategory = (c: string) => labels[c] || c;

function AudioMeter({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    const timer = setInterval(() => {
      analyser.getByteFrequencyData(values);
      setLevel(
        Math.min(1, values.reduce((a, b) => a + b, 0) / values.length / 55),
      );
    }, 100);
    return () => {
      clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream]);
  return (
    <span
      className="audio-meter"
      aria-label={`Microphone input ${Math.round(level * 100)} percent`}
    >
      {Array.from({ length: 12 }, (_, i) => (
        <i key={i} className={i / 12 < level ? "lit" : ""} />
      ))}
    </span>
  );
}


export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [savedSession, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<Session | null>(null);
  const [pool, setPool] = useState<Session["questions"]>([]);
  const session = draft ?? savedSession;
  const cameraRequest = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [account, setAccount] = useState<Account>(() => {
    try {
      const saved = sessionStorage.getItem("interview-feedback-account");
      if (saved === "publik" || saved === "openrouter") return saved;
    } catch { /* Storage can be unavailable in a private window. */ }
    return "publik-linked";
  });
  useEffect(() => {
    try { sessionStorage.setItem("interview-feedback-account", account); } catch { /* Tab memory is sufficient. */ }
  }, [account]);
  const [mode, setMode] = useState<Mode>("solicitor");
  const [questionCount, setQuestionCount] = useState(3);
  const [answerSeconds, setAnswerSeconds] = useState(ANSWER_SECONDS);
  const [attempts, setAttempts] = useState(1);
  const [retaking, setRetaking] = useState(false);
  const [payment, setPayment] = useState<{message: string; url: string} | null>(null);
  const hasAccount = account === "publik-linked" || (account === "publik" ? /^pk_[A-Za-z0-9_-]+$/ : /^sk-[A-Za-z0-9_-]+$/).test(apiKey.trim());
  const auth = account === "publik-linked" ? {provider: account} : {provider: account, apiKey: apiKey.trim()};
  const accountFields = <FeedbackAccount account={account} apiKey={apiKey} onKey={setApiKey}
    onAccount={value => { setAccount(value); setApiKey(""); setPayment(null); }} />;
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState(0);
  const [evidenceTarget, setEvidenceTarget] = useState<{answerIndex: number; timestamp: number; nonce: number} | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const busy = useRef(false);
  const analysisAbort = useRef<AbortController | null>(null);
  const pendingReview = useRef<{ kind: 'session' } | { kind: 'answers'; onlyIndex?: number; refreshAll: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    loadSession()
      .then((s) => {
        if (active && s) {
          setSession(s);
        }
      })
      .catch(() => {
        if (active)
          setStorageWarning(
            "Browser storage is unavailable. Keep this tab open and download recordings before leaving.",
          );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    fetch("/api/health")
      .then(jsonResponse<Health>)
      .then((h) => {
        if (active) setHealth(h);
      })
      .catch(() => {
        if (active) setHealthError(true);
      });
    return () => {
      active = false;
      cameraRequest.current++;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      analysisAbort.current?.abort();
    };
  }, []);
  const persist = async (s: Session) => {
    setSession(s);
    setDraft(null);
    try {
      await saveSession(s);
    } catch {
      setStorageWarning(
        "This session could not be saved to browser storage. Keep this tab open and download your recordings.",
      );
    }
  };
  const deleteCurrentSession = async () => {
    if (!session || working || screen === "interview" || deletingSession) return;
    setDeletingSession(true);
    setStorageWarning("");
    try {
      await deleteSavedSession();
      release();
      setSession(null);
      setScreen("home");
      setSelectedAnswer(0);
      setError("");
      setConfirmDelete(false);
      setSettingsOpen(false);
    } catch {
      setStorageWarning("The saved session could not be deleted from this browser.");
    } finally {
      setDeletingSession(false);
    }
  };
  const release = () => {
    cameraRequest.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  };
  const openRound = (resume: boolean) => {
    setError("");
    setRetaking(false);
    if (!resume) {
      const choices = selectSessionQuestions(mode, MAX_QUESTIONS);
      setPool(choices);
      setDraft({id: crypto.randomUUID(), createdAt: new Date().toISOString(), questions: choices.slice(0, questionCount),
        mode, attempts, answers: [], prepSeconds: 0, answerSeconds});
    }
    setScreen("setup");
  };
  const enableCamera = async () => {
    const request = ++cameraRequest.current;
    if (busy.current) return;
    busy.current = true;
    setConnecting(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera recording needs a supported browser on localhost or HTTPS.",
        );
      const media = import.meta.env.DEV && testCamera ? await (await import('./lib/test-camera')).createTestCamera() : await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (request !== cameraRequest.current) { media.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = media;
      setStream(media);
      setScreen("interview");
    } catch (e) {
      release();
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Camera or microphone access was declined. Allow access in your browser, then try again."
          : e instanceof Error
            ? e.message
            : "Could not start the camera.",
      );
    } finally {
      busy.current = false;
      setConnecting(false);
    }
  };
  const acceptTake = async (answer: Answer) => {
    if (!session || busy.current) return;
    busy.current = true;
    setRetaking(false);
    const next = { ...session, pendingTake: undefined, answers: [...session.answers, answer] };
    const complete = next.answers.length === next.questions.length;
    if (complete) { setScreen("review"); setSelectedAnswer(0); release(); }
    await persist(next);
    busy.current = false;
    if (complete && hasAccount) void analyse(next);
  };
  const recorded = async (result: Pick<Answer, "blob" | "duration" | "frames">) => {
    if (!session || busy.current) return;
    const answer = { ...result, question: session.questions[session.answers.length] };
    const used = (session.pendingTake?.used ?? 0) + 1;
    if (used >= (session.attempts ?? 1)) return acceptTake(answer);
    busy.current = true;
    setRetaking(false);
    await persist({ ...session, pendingTake: { answer, used } });
    busy.current = false;
  };
  const reviewWholeSession = async (current: Session, signal: AbortSignal): Promise<Session> => {
    setProgress("Putting your whole-session feedback together");
    try {
      const sessionAssessment = await fetch('/api/session-assess', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
        body: JSON.stringify({ ...auth, questionCount: current.questions.length, answers: current.answers.map(a => ({
          question: { id: a.question.id, text: a.question.text, category: a.question.category },
          assessment: a.assessment, transcript: a.transcript,
        })) }),
      }).then(jsonResponse<SessionAssessment>);
      return { ...current, sessionAssessment, sessionReviewError: undefined };
    } catch (e) {
      if (signal.aborted) throw e;
      if (e instanceof PaymentRequired) setPayment(e.payment);
      return { ...current, sessionReviewError: e instanceof Error ? e.message : 'The session review could not be completed.' };
    }
  };
  const gradeSession = async () => {
    if (!session || busy.current) return;
    if (!hasAccount) { pendingReview.current = { kind: 'session' }; setSettingsOpen(true); return; }
    busy.current = true; setWorking(true); setError('');
    const controller = new AbortController(); analysisAbort.current = controller;
    try { await persist(await reviewWholeSession(session, controller.signal)); }
    catch { setError('Session review stopped. Your individual answer feedback is saved.'); }
    finally { busy.current = false; setWorking(false); setProgress(''); analysisAbort.current = null; }
  };
  const analyse = async (current: Session, onlyIndex?: number, refreshAll = false) => {
    if (busy.current || current.answers.length !== current.questions.length) return;
    if (!hasAccount) {
      pendingReview.current = { kind: 'answers', onlyIndex, refreshAll };
      setSettingsOpen(true);
      return;
    }
    busy.current = true;
    setWorking(true);
    setError("");
    const controller = new AbortController();
    analysisAbort.current = controller;
    let next: Session = {
      ...current,
      answers: current.answers.map((a, i) => ({ ...a, error: (onlyIndex !== undefined ? i === onlyIndex : refreshAll || !assessmentComplete(a.assessment)) ? undefined : a.error })),
    };
    try {
      await persist(next);
      for (let i = 0; i < next.answers.length; i++) {
        const answer = next.answers[i];
        if (onlyIndex !== undefined ? i !== onlyIndex : !refreshAll && assessmentComplete(answer.assessment)) continue;
        try {
          if (!answer.transcript) {
            setProgress(`Transcribing answer ${i + 1} of ${next.questions.length}`);
            const body = new FormData();
            body.append(
              "recording",
              answer.blob,
              `answer-${i + 1}.${answer.blob.type.includes("mp4") ? "mp4" : "webm"}`,
            );
            answer.transcript = await fetch("/api/transcribe", {
              method: "POST",
              body,
              signal: controller.signal,
            }).then(jsonResponse<Transcript>);
            await persist({ ...next, answers: [...next.answers] });
          }
          setProgress(`Reviewing answer ${i + 1} of ${next.questions.length}`);
          const reviewed = await fetch("/api/assess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...auth,
              question: {
                id: answer.question.id,
                text: answer.question.text,
                category: answer.question.category,
              },
              transcript: answer.transcript,
              // Capture uses a browser clock; decoded media is authoritative.
              // Omit any trailing still outside the playable audio timeline.
              frames: answer.frames.filter((frame) => frame.timestamp <= answer.transcript!.duration),
            }),
            signal: controller.signal,
          }).then(jsonResponse<Assessment>);
          if (reviewed.payment) setPayment(reviewed.payment);
          delete reviewed.payment;
          answer.assessment = mergeAssessment(answer.assessment, reviewed);
          answer.error = [reviewed.contentError, reviewed.visualError].filter(Boolean).join(' ') || undefined;
          next.sessionAssessment = undefined;
          next.sessionReviewError = undefined;
        } catch (e) {
          if (controller.signal.aborted) throw e;
          if (e instanceof PaymentRequired) setPayment(e.payment);
          answer.error =
            e instanceof Error
              ? e.message
              : "This answer could not be reviewed.";
        }
        await persist({ ...next, answers: [...next.answers] });
      }
      if (next.answers.every(a => assessmentComplete(a.assessment))) {
        next = await reviewWholeSession(next, controller.signal);
        await persist(next);
      }
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "Review stopped. Your recordings and completed feedback are saved."
          : e instanceof Error
            ? e.message
            : "Review failed.",
      );
    } finally {
      busy.current = false;
      setWorking(false);
      setProgress("");
      analysisAbort.current = null;
    }
  };
  const completed = session?.answers.filter((a) => assessmentComplete(a.assessment)).length || 0;
  const unfinished =
    !!session && (session.answers.length > 0 || !!session.pendingTake) && session.answers.length < session.questions.length;
  const nav = (next: Screen) => {
    if (working || screen === "interview") return;
    release();
    setDraft(null);
    setScreen(next);
    setError("");
  };
  const bank = [...questions, ...financeQuestions] as typeof questions;
  const filtered = bank.filter(
    (q) =>
      (category === "All categories" || q.category === category) &&
      q.text.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = [...new Set(bank.map((q) => q.category))];
  return (
    <div className="app-shell">
      <header className="site-header">
        <button
          className="wordmark"
          onClick={() => nav("home")}
          disabled={screen === "interview" || working}
          aria-label="Video - Interview OSS home"
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>Video - Interview OSS</span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={screen !== "library" ? "active" : ""}
            disabled={screen === "interview" || working}
            onClick={() => nav("home")}
          >
            Practice
          </button>
          <button
            className={screen === "library" ? "active" : ""}
            disabled={screen === "interview" || working}
            onClick={() => nav("library")}
          >
            Question bank <span>201</span>
          </button>
        </nav>
        <button
          className="settings-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Practice settings"
          disabled={screen === "interview" || working}
        >
          <Settings2 size={17} />
          <span>Settings</span>
        </button>
      </header>
      <main>
        {testCamera && <div className="notice warning" role="status">Development test camera: generated video and synthetic speech. No real camera or microphone. Separate test storage.</div>}
        {storageWarning && (
          <div className="notice warning" role="status">
            {storageWarning}
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {payment && <section role="alert" className="review-status"><p>{payment.message}</p><a href={payment.url} target="_blank" rel="noreferrer">Get a plan</a>
          <button className="text-button" onClick={() => {setAccount("publik"); setApiKey(""); setSettingsOpen(true); setPayment(null);}}>Use my own key</button></section>}
        {screen === "home" && (
          <>
            <div className="home-heading">
              <div className="eyebrow">
                <span className="tiny-dot" /> VIDEO INTERVIEW PRACTICE
              </div>
              <h1>
                Find your words.
                <br />
                <em>Make them yours.</em>
              </h1>
              <p>
                Choose a field, preview your camera, and practise with
                <br className="desktop-break" /> feedback
                you can actually use.
              </p>
            </div>
            <div className="home-grid">
              <section className="session-card">
                {unfinished && session ? <><h2>Continue your round</h2>
                  <p>{modes[session.mode ?? "solicitor"].name} · {session.questions.length} questions · {session.answerSeconds}s per answer</p></> :
                  <>
                    <h2>Choose your field</h2>
                    <div className="practice-fields"><label>Interview mode
                      <select aria-label="Interview mode" value={mode} onChange={e => setMode(e.target.value as Mode)}>
                        {Object.entries(modes).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
                      </select></label>
                      <p>{mode === "solicitor" ? "Questions from the TCLA practice bank." : mode === "pe" ? "Practise questions adapted from London candidate reports and published private equity interview banks." : "Original practice prompts based on public preparation material. Actual interview questions vary."} <a href={modes[mode].url} target="_blank" rel="noreferrer">{modes[mode].source}</a></p>
                    </div>
                  </>}
                <button
                  className="primary start-button"
                  disabled={!loaded}
                  onClick={() => openRound(unfinished)}
                >
                  {unfinished ? "Continue your session" : "See first question"}
                  <ArrowRight size={18} />
                </button>
                {unfinished && session && <p className="small centered">{session.answers.length} of {session.questions.length} answers saved on this device.</p>}
                {session && session.answers.length === session.questions.length && (
                  <>
                  <button
                    className="text-button previous-session"
                    onClick={() => {
                      setScreen("review");
                      setSelectedAnswer(0);
                    }}
                  >
                    Open your last session <ArrowUpRight size={15} />
                  </button>
                  <p className="small centered">Starting again replaces this saved session. Download recordings you want to keep.</p>
                  </>
                )}
              </section>
              <aside className="coaching-card">
                <div className="coaching-top">
                  <span className="eyebrow">A NOTE BEFORE YOU BEGIN</span>
                  <span className="line-star">✳</span>
                </div>
                <blockquote>
                  Sound like
                  <br />a person.
                  <br />
                  <em>
                    Not an
                    <br />
                    interviewee.
                  </em>
                </blockquote>
                <div className="coaching-bottom">
                  <span className="quote-rule" />
                  <p>
                    Bring a real example. Tell us why it matters.
                    <br />
                    You don’t need a perfect script.
                  </p>
                  <span className="source-note">
                    Clear reasons. Concrete examples. Your own words.
                  </span>
                </div>
              </aside>
            </div>
            <section className="how-it-works" aria-label="How practice works">
              <div>
                <span className="feature-icon">
                  <Video size={20} />
                </span>
                <h3>Set your own round.</h3>
                <p>
                  Prepare, record, and move to the next.
                  <br />
                  Stay in the rhythm of a real interview.
                </p>
              </div>
              <div>
                <span className="feature-icon">
                  <BookOpen size={20} />
                </span>
                <h3>Feedback with a reason.</h3>
                <p>
                  Understand what worked, what to change,
                  <br />
                  and where it happened in your answer.
                </p>
              </div>
              <div>
                <span className="feature-icon">
                  <ShieldCheck size={20} />
                </span>
                <h3>Your practice, your space.</h3>
                <p>
                  Recordings stay in this browser.
                  <br />
                  AI review shares transcripts and selected frames.
                </p>
              </div>
            </section>
          </>
        )}
        {screen === "setup" && session && (
          <section className="setup-screen">
            <button className="text-button" onClick={() => nav("home")}>
              ← Back to practice
            </button>
            <div className="question-heading">
              <span className="eyebrow">{modes[session.mode ?? "solicitor"].name} · Question {session.answers.length + 1}</span>
              <h1>{session.questions[session.answers.length].text}</h1>
              {session.questions[session.answers.length].source && <p className="small">Adapted from <a href={session.questions[session.answers.length].source!.url} target="_blank" rel="noreferrer">{session.questions[session.answers.length].source!.label}</a></p>}
            </div>
            <p className="small">{hasAccount
              ? `After your round, ${account === "openrouter" ? "OpenRouter" : "Publik"} and its AI provider review your transcript and selected camera images. This uses your ${account === "openrouter" ? "OpenRouter" : "Publik"} credits.`
              : "You can record now. To get AI feedback, add your key in Settings."}</p>
            <section className="camera-off"><Camera size={32}/><p>Camera is off</p></section>
            <button className="primary start-button" disabled={connecting} onClick={() => void enableCamera()}>{connecting ? "Connecting camera…" : "Enable camera and microphone"}</button>
          </section>
        )}
        {screen === "interview" && session && stream && (
          <section className="interview-screen">
            <div className="session-progress">
              <span className="eyebrow">YOUR PRACTICE SESSION</span>
              <div>
                {session.questions.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < session.answers.length
                        ? "done"
                        : i === session.answers.length
                          ? "current"
                          : ""
                    }
                  >
                    {i < session.answers.length ? <Check size={13} /> : i + 1}
                  </span>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => {
                  release();
                  setDraft(null);
                  setScreen("home");
                }}
              >
                Leave session
              </button>
            </div>
            <div className="question-heading">
              <span className="eyebrow">
                QUESTION {session.answers.length + 1} OF {session.questions.length} ·{" "}
                {shortCategory(
                  session.questions[session.answers.length].category,
                )}
              </span>
              <h1>{session.questions[session.answers.length].text}</h1>
              {session.questions[session.answers.length].source && <p className="small">Adapted from <a href={session.questions[session.answers.length].source!.url} target="_blank" rel="noreferrer">{session.questions[session.answers.length].source!.label}</a></p>}
            </div>
            {session.pendingTake && !retaking ? <section className="session-card"><h2>Keep this take?</h2>
              <p>Attempt {session.pendingTake.used} of {session.attempts} recorded. A new take replaces this one when it finishes.</p>
              <button className="primary" onClick={() => void acceptTake(session.pendingTake!.answer)}>Use this take</button>
              <button className="text-button" onClick={() => setRetaking(true)}>Try again</button>
            </section> : <Recorder
              onStart={() => { if (draft) { setSession(draft); setDraft(null); } }}
              answerSeconds={session.answerSeconds}
              key={`${session.id}-${session.answers.length}`}
              stream={stream}
              onComplete={recorded}
              onError={(message) => {
                setError(message);
                release();
                setDraft(null);
                setScreen("home");
              }}
            >
              <div className="preview-mic"><span>Microphone level</span><AudioMeter stream={stream} /></div>
              {draft && <div className="round-controls practice-fields">
                <fieldset><legend>Recording duration</legend><div className="duration-options">
                  {[30,60,90,120,180].map(seconds => <button type="button" key={seconds} aria-pressed={draft.answerSeconds === seconds}
                    onClick={() => {setAnswerSeconds(seconds); setDraft({...draft, answerSeconds:seconds});}}>{seconds}s</button>)}
                </div></fieldset>
                <label>Questions per round<select aria-label="Questions per round" value={draft.questions.length} onChange={event => {
                  const n = Number(event.target.value); setQuestionCount(n); setDraft({...draft, questions:pool.slice(0,n)});
                }}>{Array.from({length:MAX_QUESTIONS},(_,i) => <option key={i+1}>{i+1}</option>)}</select></label>
                <label>Attempts per question<select aria-label="Attempts per question" value={draft.attempts} onChange={event => {
                  const n = Number(event.target.value); setAttempts(n); setDraft({...draft, attempts:n});
                }}>{[1,2,3].map(n => <option key={n}>{n}</option>)}</select></label>
              </div>}
            </Recorder>}
            <p className="interview-footnote">
              <ShieldCheck size={14} /> No feedback between questions. Take this
              one at a time. Leaving keeps completed answers and discards the current recording.
            </p>
          </section>
        )}
        {screen === "review" && session && (
          <section className="review-screen">
            <div className="page-heading review-heading">
              <div>
                <span className="eyebrow">
                  YOUR SESSION ·{" "}
                  {new Date(session.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <h1>
                  {working
                    ? "A moment for reflection."
                    : completed === session.questions.length
                      ? "Your next step, a little clearer."
                      : "Your round is recorded."}
                </h1>
                <p>
                  {working
                    ? "We’re reviewing the content and presentation of each answer."
                    : completed === session.questions.length
                      ? "Here’s what to keep, what to work on, and where to begin."
                      : completed > 0 ? `${completed} of ${session.questions.length} answers reviewed. The remaining answers need another review; your recordings are saved.` : "Your recordings are saved. Get a detailed review when you’re ready."}
                </p>
              </div>
              {!working && (
                <button
                  className="secondary"
                  onClick={() => {
                    nav("home");
                  }}
                >
                  Back to practice
                  <ArrowUpRight size={16} />
                </button>
              )}
            </div>
            {working ? (
              <div className="review-status" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={22} />
                <div>
                  <strong>{progress}</strong>
                  <p>Your recordings stay available if you need to retry.</p>
                </div>
                <span>{completed} / {session.questions.length} reviewed</span>
                <button
                  className="text-button"
                  onClick={() => analysisAbort.current?.abort()}
                >
                  Stop review
                </button>
              </div>
            ) : (
              completed < session.questions.length && (
                <div className="review-status">
                  <Sparkles size={24} />
                  <div>
                    <strong>
                      {completed
                        ? "Finish your session review"
                        : "Ready for a closer look?"}
                    </strong>
                    <p>
                      {healthError
                        ? "The local review service is not connected."
                        : !health
                          ? "Checking local transcription availability."
                          : !health.transcription.available
                            ? health.transcription.reason ||
                              "Local transcription is unavailable, so review cannot start."
                            : "AI review sends your transcript and selected frames to your selected AI provider. Your key stays in memory."}
                    </p>
                  </div>
                  <button
                    className="primary"
                    disabled={
                      healthError || health?.transcription.available === false
                    }
                    onClick={() => analyse(session)}
                  >
                    {hasAccount
                      ? completed
                        ? "Retry remaining answers"
                        : "Review my answers"
                      : "Add key & review"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )
            )}
            {!working && completed === session.questions.length && session.answers.some(a => a.assessment?.score === undefined) && <div className="review-status">
              <div><strong>Your saved feedback can now include grades.</strong><p>Update all answers for a clear grade, what worked, what needs work and how to improve.</p></div>
              <button className="primary" onClick={() => void analyse(session, undefined, true)}>Update all feedback <ArrowRight size={16} /></button>
            </div>}
            {!working && completed === session.questions.length && session.sessionAssessment && <button className="text-button rereview-session" onClick={() => void analyse(session, undefined, true)}>Review all answers again</button>}
            {session.sessionAssessment && <SessionReview review={session.sessionAssessment} onEvidence={(answerIndex, timestamp) => {
              setSelectedAnswer(answerIndex);
              setEvidenceTarget({ answerIndex, timestamp, nonce: Date.now() });
            }} />}
            {completed === session.questions.length && !working && !session.sessionAssessment && <div className="review-status">
              <div><strong>How did the whole session go?</strong><p>Get your overall answer grade, strengths and priorities for your next practice round.</p>
              {session.sessionReviewError && <p className="status-warning">{session.sessionReviewError}</p>}</div>
              <button className="primary" onClick={() => void gradeSession()}>Review whole session <ArrowRight size={16} /></button>
            </div>}
            <div className="session-overview" aria-label="Session feedback status">
              {session.answers.map((answer, i) => (
                <button key={i} onClick={() => { setSelectedAnswer(i); setEvidenceTarget(null); }} className={selectedAnswer === i ? "active" : ""}>
                  <span className="eyebrow">ANSWER {i + 1}</span>
                  <strong>{shortCategory(answer.question.category)}</strong>
                  <span className={answer.error || answer.assessment?.contentStatus === 'failed' || answer.assessment?.visualStatus === 'failed' ? 'status-warning' : 'muted'}>
                    {assessmentComplete(answer.assessment) ? "Feedback ready" : answer.assessment ? "Partial feedback · retry available" : answer.error ? "Review failed · recording saved" : "Waiting for review"}
                  </span>
                </button>
              ))}
            </div>
            <div
              className="answer-tabs"
              role="tablist"
              aria-label="Review an answer"
            >
              {session.answers.map((a, i) => (
                <button
                  role="tab"
                  aria-selected={selectedAnswer === i}
                  className={selectedAnswer === i ? "selected" : ""}
                  key={i}
                  onClick={() => { setSelectedAnswer(i); setEvidenceTarget(null); }}
                >
                  Answer {i + 1}
                  <span>{shortCategory(a.question.category)}</span>
                  {assessmentComplete(a.assessment) ? <Check size={14} /> : a.error ? <CircleHelp size={14} /> : null}
                </button>
              ))}
            </div>
            {session.answers[selectedAnswer] && (
              <AnswerReview
                key={selectedAnswer}
                seekTarget={evidenceTarget?.answerIndex === selectedAnswer ? evidenceTarget : undefined}
                reviewing={working}
                onReview={() => analyse(session, selectedAnswer)}
                answer={session.answers[selectedAnswer]}
                index={selectedAnswer}
              />
            )}
            <p className="review-disclaimer">
              Practice feedback, not a hiring prediction. Review the evidence
              and decide what helps you.
            </p>
          </section>
        )}
        {screen === "library" && (
          <section className="library-screen">
            <div className="page-heading">
              <span className="eyebrow">THE QUESTION BANK</span>
              <h1>A little less unexpected.</h1>
              <p>
                Solicitor questions come from TCLA. Private equity questions are adapted from published interview banks and London candidate reports. The other finance modes use original prompts based on employer guidance.
              </p>
            </div>
            <div className="library-filters">
              <label className="search-box">
                <Search size={18} />
                <input
                  placeholder="Search questions…"
                  aria-label="Search questions"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Question category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="library-count">
              {filtered.length} questions · Original source numbering preserved
            </div>
            <div className="question-list">
              {filtered.map((q) => (
                <article key={q.id}>
                  <span className="library-number">
                    {q.id.padStart(2, "0")}
                  </span>
                  <div>
                    <span className="eyebrow">{q.category}</span>
                    <h3>{q.text}</h3>
                    <p>
                      {q.source ? <a href={q.source.url} target="_blank" rel="noreferrer">Adapted from {q.source.label}</a> : q.mode ? <a href={modes[q.mode].url} target="_blank" rel="noreferrer">{modes[q.mode].source}</a> : `TCLA · page ${q.sourcePage}`}
                      {!q.defaultEligible
                        ? " · Explore independently; not in the default session pool"
                        : ""}
                    </p>
                  </div>
                </article>
              ))}
              {filtered.length === 0 && (
                <p className="empty-search">
                  No questions match that search. Try a shorter phrase.
                </p>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>Small steps. Better answers.</span>
        <span>
          Built on open source{" "}
          <a
            href="/credits.html"
            target="_blank"
            rel="noreferrer"
          >
            Credits <ArrowUpRight size={12} />
          </a>
        </span>
      </footer>
      <Dialog.Root
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) { setConfirmDelete(false); pendingReview.current = null; }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="settings-dialog">
            <Dialog.Title>Practice settings</Dialog.Title>
            <Dialog.Description>
              Manage your saved round and choose which account pays for AI feedback.
            </Dialog.Description>
            <Dialog.Close className="close-modal" aria-label="Close settings">
              <X size={20} />
            </Dialog.Close>
            <p className="small">Choose the answer limit before each round. Read at your own pace, then press Start recording.</p>
            <p className="small">
              Only your latest session is saved on this device. Starting a new
              session replaces the previous one.
            </p>
            <div className="setup-divider" />
            {accountFields}
            <div
              className={`service-status ${health?.transcription.available ? "ready" : ""}`}
            >
              <span className="tiny-dot" />
              {health?.transcription.available
                ? "Local transcription ready"
                : healthError
                  ? "Review service unavailable"
                  : health
                    ? "Local transcription unavailable"
                    : "Checking local transcription…"}
            </div>
            {health && !health.transcription.available && (
              <p className="small">
                {health.transcription.reason ||
                  "Local transcription is unavailable, so answer review is disabled."}
              </p>
            )}
            {session && (
              <>
                <div className="setup-divider" />
                {confirmDelete ? (
                  <div role="group" aria-label="Confirm session deletion">
                    <p className="small">
                      Delete the saved recordings, camera frames, transcripts,
                      and feedback from this browser? This cannot be undone.
                    </p>
                    <button
                      className="secondary"
                      type="button"
                      disabled={working || screen === "interview" || deletingSession}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep session
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={working || screen === "interview" || deletingSession}
                      onClick={() => void deleteCurrentSession()}
                    >
                      {deletingSession ? "Deleting…" : "Delete permanently"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="secondary"
                    type="button"
                    disabled={working || screen === "interview" || deletingSession}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete saved session
                  </button>
                )}
              </>
            )}
            <button
              className="primary"
              onClick={() => {
                const pending = pendingReview.current;
                pendingReview.current = null;
                setSettingsOpen(false);
                if (screen === "review" && session && hasAccount && pending) {
                  if (pending.kind === 'session') void gradeSession();
                  else void analyse(session, pending.onlyIndex, pending.refreshAll);
                }
              }}
            >
              {pendingReview.current ? "Save & review answers" : "Done"}
              <Check size={17} />
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
