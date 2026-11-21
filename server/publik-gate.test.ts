import { describe, expect, it, vi } from "vitest";
import type { GateUI } from "./publik.ts";
import { createPublikGate } from "./publik-gate.ts";
import { createApp } from "./app.ts";
import type { AddressInfo } from "node:net";

describe("local Publik sign-in", () => {
  it("gates analysis and only supplies the install credential to a linked Publik request", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    const gate = createPublikGate(async (_ui: GateUI) => {
      await waiting;
      return {key:"pk_synthetic_install"};
    });
    const assess = vi.fn().mockResolvedValue({});
    const server = createApp({gate:gate.middleware, assess}).listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const review = (body: object) => fetch(base + "/api/assess", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    try {
      expect((await review({provider:"publik-linked"})).status).toBe(401);
      expect(assess).not.toHaveBeenCalled();
      finish(); await gate.ready;
      const status = await fetch(base + "/api/publik/status").then(r => r.json());
      expect(status.signedIn).toBe(true);
      expect(JSON.stringify(status)).not.toContain("pk_synthetic_install");
      expect((await review({provider:"publik-linked"})).status).toBe(200);
      expect(assess.mock.calls[0][0]).toEqual({provider:"publik", apiKey:"pk_synthetic_install"});
      await review({provider:"openrouter",apiKey:"sk-synthetic-personal"});
      expect(assess.mock.calls[1][0].apiKey).toBe("sk-synthetic-personal");
    } finally { server.closeAllConnections(); server.close(); }
  });
});
