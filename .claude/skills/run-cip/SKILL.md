---
name: run-cip
description: Run, screenshot, and smoke-test the CIP (Control Interno Presupuestario) Next.js app. Use when asked to run the app, take a screenshot, verify a change works, or confirm the UI looks correct.
---

# CIP — Run & Smoke Test

Next.js 15 web app driven by Playwright against the system Edge browser (`msedge.exe`). The driver at `.claude/skills/run-cip/driver.mjs` launches a headless browser, logs in, and walks the main routes.

## Prerequisites

- Node.js ≥ 18 (project uses v22)
- `.env.local` with `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`
- `playwright` dev dependency (already in `package.json`):
  ```
  npm install
  ```
- System Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` — already present on this machine. No `playwright install` needed when using the system browser.

## Build

```bash
npm install
```

For production build:
```bash
npm run build
```

## Run (agent path)

**1. Start the dev server in the background:**
```bash
npm run dev &
# wait ~5 s, then confirm: curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
```

**2. Run the smoke-test driver (routes + screenshots):**
```bash
node .claude/skills/run-cip/driver.mjs --screenshot
```

Screenshots land in `.claude/skills/run-cip/screenshots/`:
- `01-login.png` — login page (unauthenticated)
- `02-dashboard.png` — fondo rotativo dashboard
- `03-launcher.png` — module selector
- `04-compras.png` — compras module

El driver lee credenciales de `.env.local` (gitignoreado). Agrega estas líneas si aún no las tienes:
```
CIP_EMAIL="tu_usuario@igss.gob.gt"
CIP_PASSWORD="tu_contraseña"
```

Luego simplemente:
```bash
node .claude/skills/run-cip/driver.mjs --screenshot
```

**3. Stop the dev server:**
```bash
# find PID: netstat -ano | findstr :3000
# then: taskkill /PID <pid> /F
```

## Run (human path)

```bash
npm run dev
# open http://localhost:3000
# Ctrl-C to stop
```

## Test

No automated test suite. Use the driver above as the smoke test.

```bash
npm run lint
npm run build   # type-check + build
```

## Gotchas

- **Playwright's bundled Chromium doesn't need to be downloaded** — the driver uses `executablePath` pointing at the system Edge (`msedge.exe`). Running `npx playwright install chromium` is unnecessary on this machine.
- **307 on protected routes without a session** — `/launcher`, `/dashboard`, `/compras` all redirect to `/login` when unauthenticated. The driver logs in first via the form, then navigates.
- **`npm run dev` exits immediately in Git Bash** — use `run_in_background: true` or PowerShell `Start-Process`; the process itself stays alive.
- **`NEXTAUTH_URL` must match the port** — if 3000 is taken the server binds to 3001 and NextAuth callbacks break. Confirm the port before running the driver.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED localhost:3000` | Dev server not running — start it first |
| `page.waitForURL` timeout on `/dashboard` | Wrong credentials or DB unreachable — check `DATABASE_URL` in `.env.local` |
| Driver exits with `msedge.exe not found` | Update `edgePath` in `driver.mjs` to the correct Edge path |
| Login page title still shows `SIGAT` | Cached `.next/` build — delete `.next/` and restart dev server |
