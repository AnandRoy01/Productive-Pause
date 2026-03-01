# Productive Pause – Pomodoro Chrome Extension

A Pomodoro timer Chrome extension that helps you manage focus sessions and breaks. Built with React and Vite.

## Features

- **Pomodoro cycles**: 25 min focus → 5 min break (customizable). Long break (15 min) every 4 sessions
- **Reliable timer**: Uses `chrome.alarms` so the timer keeps running when the extension popup is closed or the browser is minimized
- **Pause / Resume**: Pause and resume without losing progress
- **Session stats**: Tracks completed pomodoros per day
- **Custom durations**: Set custom work/break lengths in minutes
- **Settings**: Work, break, long break duration; notification options
- **Keyboard shortcut**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to Start/Pause

## Build & Install

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Build**
   ```bash
   yarn build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `dist` folder

## Development

```bash
yarn dev
```

Then load the extension from the project root (Chrome uses `index.html` and the Vite dev server). For hot reload of the popup, you may need to rebuild and reload the extension.

## Project structure

- `src/App.jsx` – Popup UI (React)
- `src/App.css` – Popup styles
- `public/background.js` – Service worker (timer logic, persistence, alarms)
- `public/manifest.json` – Extension manifest
- `index.html` – Popup entry

## Version

2.0.0
