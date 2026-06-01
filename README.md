# LocalTube

LocalTube is a self-hosted media server that serves a local folder of videos through a responsive web UI. This repo includes a CI workflow and safe defaults for publishing to GitHub.

Prerequisites
- FFmpeg installed and on PATH
- Node.js 22+

Quick start
1. Copy `.env.example` to `.env` and set VIDEOS_DIR to your videos folder.
2. npm install
3. npm run dev
4. Open http://localhost:5173

Security & GitHub
- DO NOT commit `.env` or any secret files. `.gitignore` excludes environment files and common local databases.
- To publish: create a GitHub repo, add it as `origin`, then push your branch. Use GitHub Settings → Secrets to store CI secrets (if any).
- CI: .github/workflows/ci.yml runs install → build → test on Node 22.

Contributing
- Please open issues or PRs. Keep secrets out of commits.

README last updated: 2026-06-01
