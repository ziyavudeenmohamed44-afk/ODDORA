# ODDORA — Starter Website

A responsive React + Vite starter for ODDORA, a playful entertainment website.

## What is included

- Responsive desktop and mobile homepage
- Play-zone navigation and category filters
- Search experiences
- Working demo experiences: Fake Hacker, Forbidden Button, Endless Loading, Mind Reader, personality quiz, What If, random award and Surprise Me
- Share result using the device share sheet or copy-to-clipboard fallback
- No account, database, AI API or paid service required for this prototype

## Requirements

Install Node.js (LTS) from https://nodejs.org/ and use a modern browser.

## Run locally

1. Extract this ZIP.
2. Open the extracted `oddora-starter` folder in VS Code.
3. Open Terminal > New Terminal.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Vite will show a local address, usually `http://localhost:5173`.
6. Open that address in your browser.

To stop the development server, press `Ctrl + C` in the terminal.

## Create a production build

```bash
npm run build
npm run preview
```

The production-ready website files are generated in `dist/`.

## Important notes

- The language toggle is currently a visual preference placeholder; full Tamil translations are a later task.
- The AI image/video generation feature is intentionally not connected yet. A public website must call AI providers from a secure backend; never put private API keys in browser code.
- This is a prototype, not a finished production service. Before public launch, add a privacy policy, terms, content moderation, rate limits and accessibility checks.
- The Google Fonts import is optional. If you want the site to work without third-party font requests, remove the `@import` line in `src/styles.css`.
- ODDORA is a working brand name only. Check domain and trademark availability before public commercial use.
