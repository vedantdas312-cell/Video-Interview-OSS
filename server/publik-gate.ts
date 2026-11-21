import type { RequestHandler } from "express";
import { ensureSignedIn, type GateAction, type GateScreen, type GateUI } from "./publik.ts";

export function createPublikGate(signIn: (ui: GateUI) => Promise<{key: string}> = ensureSignedIn) {
  let screen: GateScreen | null = null;
  let action: ((a: GateAction) => void) | undefined;
  let linkedKey = "";
  let link: string | null = null;

  const ready = signIn({
    show(next, signal) {
      screen = next;
      return new Promise(resolve => {
        action = resolve;
        signal.addEventListener("abort", () => { action = undefined; }, { once: true });
      });
    },
    openUrl(url) {
      if (new URL(url).origin === "https://publikhq.com") link = url;
    },
  }).then(result => { linkedKey = result.key; screen = null; });

  const middleware: RequestHandler = (req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/+$/, "");
    if (path === "/api/publik/status" && req.method === "GET") {
      res.json({ signedIn: Boolean(linkedKey), screen, link: linkedKey ? null : link });
      return;
    }
    if (path === "/api/publik/action" && req.method === "POST") {
      if (!action || !screen?.buttons.some(b => b.action === req.body?.action)) {
        res.sendStatus(409); return;
      }
      action(req.body.action);
      res.sendStatus(204); return;
    }
    if (path.startsWith("/api/") && path !== "/api/health") {
      if (!linkedKey) { res.status(401).json({error:{message:"Sign in with Publik to start."}}); return; }
      if (path === "/api/assess" || path === "/api/session-assess") {
        if (req.body?.provider === "publik-linked") {
          req.body.apiKey = linkedKey;
          req.body.provider = "publik";
        }
      }
    }
    next();
  };
  return { middleware, ready };
}
