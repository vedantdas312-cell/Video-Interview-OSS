# Working on Video Interview OSS

Read README.md and architecture.md before changing the app. See docs/AI_AGENT_ONBOARDING.md for setup and task prompts.

- Use Node.js 24 and the existing React/TypeScript/Express/Python stack. Preserve unrelated edits.
- Preserve the default three-question, 60-second round and the configured mode, duration, question count and attempts. Reading is untimed and the countdown is five seconds.
- Keep services on loopback. Public hosting requires a separate security and product design.
- Manually pasted keys belong in tab memory. The Publik install credential belongs to the local server. Do not ask for keys in chat, store them, log them, or embed them in screenshots.
- Do not inspect, copy, commit, or upload personal recordings, frames, transcripts, saved browser sessions, or private QA notes for automated testing. Use empty screens or clearly synthetic inputs.
- Preserve server-owned rubrics, strict validation, deterministic evidence timestamps/quotes, explicit failures, and successful partial results. Do not add fake feedback, hidden fallbacks, or a model repair pass.
- Maintain the TCLA question-bank credit and existing third-party code licenses. Do not imply official TCLA scoring or endorsement.
- Run relevant tests and npm run build. Distinguish unit-test fixtures from actual local/provider runs in your report.
- Before an authorized commit or push, inspect the exact staged files and run npm run check:publish. Never use git add -f to bypass private-file exclusions. Only the individually reviewed product screenshots under docs/screenshots are approved binary assets, including the existing anonymized feedback views. Do not expand that exception to raw recordings or other personal content.


## Publik API

The local server runs the Publik sign-in gate before practice. The SDK provisions an install credential, checks its wallet, and counts signed-in usage subject to telemetry preferences. Keep install and user credentials out of logs, browser responses and Git. The distributable app token in publik-app-token.txt only provisions credentials for this app.

Use the Publik chat endpoint at https://publikhq.com/api/v1 with a published tier. On HTTP 402 display the provider message, its plan link and the personal-key option. See [Publik’s API guide](https://publikhq.com/skills/api.md).
