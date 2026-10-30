# AI Square IT Solutions (v2) — iOS & Android AI Evaluation Platform

Standalone full-stack web platform combining:
1. **Public Vision & Evaluator Careers Website (`/`, `/about`, `/careers`, `/contact`)** — Pure Vesper `#000000` & liquid-metal design showcasing AI Square's iOS & Android AI Evaluation tracks (*Generative Image & Video Grader, Search Engine Evaluator, Online Ads Assessor, Media Search Analyst, Audio Transcriber & Grader, POI Validator, Local Search Map Evaluator*).
2. **Aurora Split-Screen Sign-In Gateways (`/login` & `/admin/login`)** — Two-column unfiltered motion gateway + `#1A1A1A` form architecture.
3. **Employee (`/portal`) & Admin (`/admin`) Workspaces** — Dual-theme workspace with **Obsidian Dark** and **Calm Cream Daylight** modes, Guidelines PDF library, Question Bank, Timed Assessments, Project Readiness, Bulk Onboarding, and Interactive Company Map/Contact settings.

## Deploy as a Brand-New GitHub + Render Project
1. Create a new repository on GitHub (e.g. `aisquare-v2`).
2. Upload the contents of this project folder (so `Dockerfile`, `package.json`, `src`, `server` sit at the root of the repository) and click **Commit changes**.
3. On **Render.com** -> **New +** -> **Web Service** -> select your new `aisquare-v2` repository:
   - **Language**: `Docker` (auto-detected)
   - **Environment Variable**: `ADMIN_BOOTSTRAP_TOKEN` = `<your chosen one-time setup token>`
4. Deploy and visit `https://<your-new-service>.onrender.com/admin/login` to initialize your primary administrator!
