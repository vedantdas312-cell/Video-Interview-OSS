import { useEffect, useState, type ReactNode } from "react";

interface Gate {
  signedIn: boolean;
  screen?: { signInUrl?: string; title: string; body: string; note?: string; buttons: {action: string; label: string}[] };
  link?: string;
}

export default function PublikGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>({ signedIn: false });
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const res = await fetch("/api/publik/status");
        if (!res.ok) throw Error();
        const data: Gate = await res.json();
        if (!active) return;
        setGate(data);
        setError(false);
        if (data.signedIn) return;
      } catch { if (active) setError(true); }
      if (active) timer = setTimeout(refresh, 1000);
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [retry]);
  if (gate.signedIn) return <>{children}</>;
  async function act(action: string) {
    try {
      await fetch("/api/publik/action", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action})});
      setRetry(n => n + 1);
    } catch { setError(true); }
  }
  return <main className="setup-screen gate"><section className="session-card">
    <h1>Sign in with Publik</h1>
    <p>{error ? "Publik is not reachable. Check your connection." : gate.screen?.body ?? "Checking your connection…"}</p>
    {gate.screen?.buttons.map(b => {
      const url = gate.screen?.signInUrl || gate.link;
      return b.action === "sign_in" && url ? <a className="primary" key={b.action} href={url} target="_blank" rel="noreferrer" onClick={() => void act(b.action)}>Sign in with Publik</a> :
        <button key={b.action} className="primary" onClick={() => void act(b.action)}>{b.label}</button>;
    })}
    {gate.screen?.note && <p role="status">{gate.screen.note}</p>}
    {error && <button onClick={() => setRetry(n => n + 1)}>Retry</button>}
  </section></main>;
}
