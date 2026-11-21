# Video Interview OSS

**Practise your answers. Replay the evidence. Improve the next attempt.**

A local video interview practice app for solicitor training contracts, BlackRock, J.P. Morgan, Goldman Sachs and London private equity. Record a round and jump from feedback to the part of your answer it refers to.

Sign in with Publik, then use your linked account or enter a personal Publik or OpenRouter key. Recordings are stored on the computer.

[Quick start](#quick-start) · [AI agent onboarding](#set-it-up-with-your-ai-agent) · [Architecture](architecture.md) · [Privacy](#your-recordings-and-your-key)

## A look inside

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/session-feedback.jpg" alt="Actual session feedback with overall practice grade and improvement summary" /></td>
    <td width="50%"><img src="docs/screenshots/answer-feedback-blurred.png" alt="Answer replay and individual feedback with the speaker's face fully blurred" /></td>
  </tr>
  <tr><td><strong>Session overview:</strong> Your overall practice score and feedback across all three answers.</td><td><strong>Answer review:</strong> Replay your recording and see how your answer was assessed.</td></tr>
  <tr>
    <td><img src="docs/screenshots/feedback-next-steps.jpg" alt="Three concrete next steps following a completed practice session" /></td>
    <td><img src="docs/screenshots/camera-feedback-blurred.png" alt="Camera coaching with evidence timestamps and fully blurred camera thumbnails" /></td>
  </tr>
  <tr><td><strong>Next steps:</strong> Three suggested improvements for your next practice session.</td><td><strong>Camera feedback:</strong> Timestamped observations on framing and posture, with practical suggestions.</td></tr>
</table>


More product views: [feedback and replay evidence](docs/screenshots/feedback-evidence.jpg) · [session reasoning](docs/screenshots/session-reasoning-evidence.jpg) · [home](docs/screenshots/home.jpg) · [question bank](docs/screenshots/question-bank.jpg) · [settings](docs/screenshots/settings.jpg).

## What it does

- **Choose your round:** 1–6 questions, 1–3 attempts per question and 30, 60, 90, 120 or 180 seconds per answer. The solicitor default draws motivation, experience and personal prompts.
- **Time to think:** read at your own pace, then start a five-second countdown and record until your selected limit.
- **Feedback after the session:** review relevance, examples, reasoning, structure, and supported camera observations.
- **Evidence you can replay:** feedback points to actual transcript segments or sampled camera frames.
- **Local speech transcription:** faster-whisper runs on your computer through Python and ffmpeg.
- **Save and retry:** keep the latest session in the browser, download answers, and retry failed analysis without re-recording.
- **Question library:** 201 TCLA entries plus 24 original finance practice questions. Each finance mode links to its employer’s recruiting material or the BVCA investment syllabus.

## Quick start

You need **Node.js 24**, **Python 3.10+**, **ffmpeg**, and a browser with camera/microphone and MediaRecorder support. The instructions below use a macOS/Linux shell. Windows users need equivalent Python environment and executable paths; Windows setup has not been validated here.

```bash
git clone https://github.com/vedantdas312-cell/Video-Interview-OSS.git
cd Video-Interview-OSS

# If you use nvm:
nvm use
npm ci

python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

# Install ffmpeg with your package manager if needed.
# macOS / Homebrew: brew install ffmpeg
# Ubuntu / Debian: sudo apt install ffmpeg

export TRANSCRIBE_PYTHON="$PWD/.venv/bin/python"
npm run dev
```

Open **[http://127.0.0.1:4310](http://127.0.0.1:4310)**. The local API runs on port 4311. The first transcription may download Whisper's base model weights.

1. Sign in with Publik in your browser. The app links its installation credential to your account.
2. Choose the linked account or enter a personal Publik or OpenRouter key. The key field includes a link to the provider dashboard.
3. Choose an interview mode, question count, answer duration and attempts. Start practice, allow camera and microphone access, then check the preview.
4. Record each answer. With multiple attempts you can keep the current take or replace it. The last permitted take advances automatically.
5. Review the feedback after the final answer, replay the evidence and download any recordings you want to keep.

AI review uses your chosen provider and balance. Publik uses the balanced tier for transcript feedback, camera stills and the round summary. OpenRouter has separate content and vision routes. Both paths transcribe audio locally.

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend and local Express API. |
| `npm test` | Run frontend and backend tests with controlled provider responses. |
| `npm run build` | Check TypeScript and build the frontend. |
| `npm start` | Serve the built app and API at `http://127.0.0.1:4311`. |
| `npm run check:publish` | Scan the Git index for private paths, unapproved binaries/media, and common secret formats. |

Stop the development API before `npm start`; both use port 4311. Production mode here means a local compiled app, not a public multi-user service.

The app reads configuration from the launching shell; it does **not** automatically load `.env`. Set `FFMPEG_PATH` if ffmpeg is not on `PATH`. See [architecture.md](architecture.md) for configuration, request limits, and failure handling.

## Set it up with your AI agent

Copy this into your coding agent:

```text
Set up https://github.com/vedantdas312-cell/Video-Interview-OSS locally for me.
Clone it if needed, then read README.md, architecture.md, AGENTS.md,
and docs/AI_AGENT_ONBOARDING.md before changing anything.

Check Node.js 24, Python, and ffmpeg. Install the locked npm dependencies,
create a local .venv, install requirements.txt, and configure
TRANSCRIBE_PYTHON for this checkout. Run npm test and npm run build,
start the app, and check /api/health. Open the local UI and explain how
I can record my first three-question session.

Keep the service on loopback. Let me enter my personal provider key myself in
Settings; never ask me to paste it into chat or save it in files.
Do not access my camera, microphone, saved sessions, or recordings for
automated tests. Use empty screens or explicitly synthetic fixtures.
Do not publish or deploy anything. Tell me what you verified and what
still needs my input, including any unavailable transcription dependency.
```

For development tasks and acceptance checks, use the [full agent onboarding guide](docs/AI_AGENT_ONBOARDING.md).

## Your recordings and your key

| Data | Where it goes |
|---|---|
| Video/audio recordings | Browser IndexedDB; uploaded only to the local API for transcription. Temporary server files are cleaned up after processing. |
| Transcript | Stored with the browser session; sent to the selected provider for answer and session feedback. |
| Sampled camera stills | Stored with the browser session; sent to the selected provider for visual feedback. |
| Credentials | Publik stores the installation credential under the local OS account. A personal key lives in tab memory and reaches the selected provider through the loopback server. Reloading clears the pasted key. |

Publik sign-in requires internet access. The SDK counts app opens and active sessions with an installation ID. Set DO_NOT_TRACK=1 to disable usage telemetry. Reviews send transcripts and selected camera stills to the chosen AI service and its model provider. Raw audio and video stay on the computer. OpenRouter requests use its deny-data-collection routing option. See the [Publik API documentation](https://publikhq.com/developers) for its provider and retention terms.

Only the latest session is saved, per browser origin. A new session replaces it. Settings lets you delete it; clearing browser data also removes it. Browser storage is not encrypted by this application and may be evicted. Download anything you want to keep before starting again. `localhost`, `127.0.0.1`, and different ports have separate browser storage.

The repository excludes recordings, audio fixtures, private QA screenshots/reviews, original source PDFs, environment files, and local exports. Only individually reviewed product screenshots, including the anonymized feedback views above, are tracked. Ignore rules and the publish check reduce accidental leaks; contributors must still review what they commit.

## Troubleshooting

| Problem | What to check |
|---|---|
| Local transcription unavailable | Run `.venv/bin/python -c "import faster_whisper"` and `ffmpeg -version`; check `TRANSCRIBE_PYTHON` and `FFMPEG_PATH`, then restart. |
| First transcription is slow | Model weights may be downloading; transcription runs on CPU. |
| Camera or microphone is blocked | Use localhost and allow permissions in the browser. Check whether another app holds the device. |
| Key, credits, or routing error | Check the selected provider account, balance, model access, and provider data settings. |
| Partial or rejected feedback | Retry the saved session. Completed components and recordings are preserved; fabricated success is never substituted. |
| Saved session seems missing | Return to the same browser profile, hostname, and port used to record it. |

## Credits and contributing

**A big thank-you to [TCLA, The Corporate Law Academy](https://www.thecorporatelawacademy.com/), for the 200-question practice bank.** The source also includes one unnumbered prompt, so the app contains 201 entries. This is an independent project and is not affiliated with or endorsed by TCLA.

Built with React, TypeScript, Vite, Express, faster-whisper, ffmpeg, Publik, and OpenRouter. Recorder and transcription reuse is documented in [third-party notices](THIRD_PARTY_NOTICES.md).

Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. Original application code is available under the [MIT License](LICENSE). Third-party code keeps its own notices; TCLA question content is separately attributed and is not relicensed by the application license.
