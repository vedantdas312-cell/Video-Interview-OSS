import { createApp } from './app.ts';
import { createPublikGate } from './publik-gate.ts';

const gate = createPublikGate();
if (process.env.PUBLIK_SELF_TEST) await gate.ready;
const app = createApp({gate: gate.middleware});
const server = app.listen(4311, '127.0.0.1', () => {
  console.info('TCLA analysis service: http://127.0.0.1:4311');
});
server.requestTimeout = 360_000;
server.headersTimeout = 15_000;
