# Ezlifz — Life OS

A personal life-management PWA: fitness, nutrition, attendance, tasks, wardrobe, split expenses and rich notes — all in one place, fully offline, with your data stored **only on your device**.

Designed by **Shafin Pathan**.

## Features

- **Dashboard** — activity rings, streaks, daily scores and AI-style insights
- **Nutrition** — meal logging, macro tracking, editable meal presets
- **Workout** — session logging, editable weekly program presets, history
- **Body Metrics** — weight, sleep, water, energy and mood tracking
- **Attendance** — subject-wise tracking with safe-to-skip calculator and PDF reports
- **Tasks** — kanban + list views with XP gamification
- **Wardrobe** — clothing catalog with camera capture, outfits and wear logs
- **Splitwise** — friend balances, expense splitting, printable receipts
- **Notes** — Samsung-Notes-style editor: rich text, drawing canvas, audio notes, folders, tags, favorites, trash, export to PDF/MD/HTML/TXT
- **PWA** — installable, offline-first via service worker

## Security & Privacy

- **All data stays local** — localStorage + IndexedDB; no servers, no analytics, no tracking
- Strict Content-Security-Policy (no external scripts, no eval)
- All user input is HTML-escaped before rendering; rich-text notes are sanitized with DOMPurify

## Tech

Vanilla JS (ES modules) · Vite · Chart.js · jsPDF · DOMPurify

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```
