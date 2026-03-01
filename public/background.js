/* Productive Pause - Background Service Worker
   Uses chrome.alarms for reliability when service worker is suspended.
   Persists state to chrome.storage for recovery on wake.
*/

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const DEFAULT_LONG_BREAK_MIN = 15;
const POMODOROS_BEFORE_LONG_BREAK = 4;
const STORAGE_KEYS = {
  state: "timerState",
  settings: "timerSettings",
  stats: "pomodoroStats",
};
const ALARM_NAME = "pomodoroTick";

let countdownInterval = null;

// --- Initialize ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clearAll();
  initDefaultSettings();
});

// --- Message handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getState") {
    getState().then(sendResponse);
    return true;
  }
  if (message.action === "getPopupData") {
    getPopupData().then(sendResponse);
    return true;
  }
  if (message.action === "startTimer") {
    const minutes = Math.min(120, Math.max(1, parseInt(message.customTime, 10) || DEFAULT_WORK_MIN));
    startTimer(minutes * 60, "work").then(sendResponse);
    return true;
  }
  if (message.action === "stopTimer") {
    stopTimer().then(sendResponse);
    return true;
  }
  if (message.action === "pauseTimer") {
    pauseTimer().then(sendResponse);
    return true;
  }
  if (message.action === "resumeTimer") {
    resumeTimer().then(sendResponse);
    return true;
  }
  if (message.action === "getSettings") {
    getSettings().then(sendResponse);
    return true;
  }
  if (message.action === "saveSettings") {
    saveSettings(message.settings).then(sendResponse);
    return true;
  }
});

// --- Alarms (reliable timer completion) ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    handleAlarmTick();
  }
});

// --- State & persistence ---
async function getState() {
  const { [STORAGE_KEYS.state]: state } = await chrome.storage.local.get(STORAGE_KEYS.state);
  if (!state) {
    const settings = await getSettings();
    const today = new Date().toDateString();
    const { [STORAGE_KEYS.stats]: stats } = await chrome.storage.local.get(STORAGE_KEYS.stats);
    return {
      currentTime: formatTime(settings.workMin * 60),
      totalSeconds: settings.workMin * 60,
      remainingSeconds: settings.workMin * 60,
      timerRunning: false,
      paused: false,
      phase: "work",
      sessionPomodoroCount: 0,
      todayPomodoroCount: stats?.[today] ?? 0,
    };
  }
  const now = Math.floor(Date.now() / 1000);
  let remaining = state.remainingSeconds;
  if (state.timerRunning && !state.paused) {
    const elapsed = now - state.lastUpdateAt;
    remaining = Math.max(0, state.remainingSeconds - elapsed);
  }
  const today = new Date().toDateString();
  const { [STORAGE_KEYS.stats]: stats } = await chrome.storage.local.get(STORAGE_KEYS.stats);
  const todayCount = stats?.[today] ?? 0;
  return {
    currentTime: formatTime(remaining),
    totalSeconds: state.totalSeconds,
    remainingSeconds: remaining,
    timerRunning: state.timerRunning && !state.paused,
    paused: state.paused,
    phase: state.phase,
    sessionPomodoroCount: state.sessionPomodoroCount ?? 0,
    todayPomodoroCount: todayCount,
  };
}

async function saveState(state) {
  state.lastUpdateAt = Math.floor(Date.now() / 1000);
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: state });
}

async function getSettings() {
  const { [STORAGE_KEYS.settings]: s } = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return {
    workMin: s?.workMin ?? DEFAULT_WORK_MIN,
    breakMin: s?.breakMin ?? DEFAULT_BREAK_MIN,
    longBreakMin: s?.longBreakMin ?? DEFAULT_LONG_BREAK_MIN,
    notifyOnComplete: s?.notifyOnComplete !== false,
    notifyOnStop: s?.notifyOnStop === true,
    soundEnabled: s?.soundEnabled !== false,
  };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

function initDefaultSettings() {
  chrome.storage.local.get(STORAGE_KEYS.settings, (result) => {
    if (!result[STORAGE_KEYS.settings]) {
      chrome.storage.local.set({
        [STORAGE_KEYS.settings]: {
          workMin: DEFAULT_WORK_MIN,
          breakMin: DEFAULT_BREAK_MIN,
          longBreakMin: DEFAULT_LONG_BREAK_MIN,
          notifyOnComplete: true,
          notifyOnStop: false,
          soundEnabled: true,
        },
      });
    }
  });
}

// --- Timer logic ---
async function startTimer(durationSeconds, phase = "work", sessionPomodoroCount = 0) {
  clearInterval(countdownInterval);
  const settings = await getSettings();
  const state = {
    totalSeconds: durationSeconds,
    remainingSeconds: durationSeconds,
    timerRunning: true,
    paused: false,
    phase,
    pomodoroCount: 0,
    sessionPomodoroCount: phase === "work" ? sessionPomodoroCount : (await getStoredState())?.sessionPomodoroCount ?? 0,
  };
  await saveState(state);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + durationSeconds * 1000 });
  startCountdown();
  broadcastState(await getState());
  updateBadge(durationSeconds);
  return { ok: true };
}

async function pauseTimer() {
  const state = await getStoredState();
  if (!state?.timerRunning || state?.paused) return { ok: false };
  clearInterval(countdownInterval);
  chrome.alarms.clear(ALARM_NAME);
  state.timerRunning = false;
  state.paused = true;
  state.remainingSeconds = Math.max(0, state.remainingSeconds - (Math.floor(Date.now() / 1000) - state.lastUpdateAt));
  await saveState(state);
  chrome.action.setBadgeText({ text: "⏸" });
  broadcastState(await getState());
  return { ok: true };
}

async function resumeTimer() {
  const state = await getStoredState();
  if (!state?.paused || state.remainingSeconds <= 0) return { ok: false };
  clearInterval(countdownInterval);
  state.timerRunning = true;
  state.paused = false;
  await saveState(state);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + state.remainingSeconds * 1000 });
  startCountdown();
  broadcastState(await getState());
  updateBadge(state.remainingSeconds);
  return { ok: true };
}

async function stopTimer() {
  clearInterval(countdownInterval);
  chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.remove(STORAGE_KEYS.state);
  chrome.action.setBadgeText({ text: "" });
  const settings = await getSettings();
  if (settings.notifyOnStop) {
    showNotification("Timer stopped", "Your timer has been stopped.");
  }
  broadcastState(await getState());
  return { ok: true };
}

async function getStoredState() {
  const { [STORAGE_KEYS.state]: s } = await chrome.storage.local.get(STORAGE_KEYS.state);
  return s;
}

async function getPopupData() {
  const keys = [STORAGE_KEYS.state, STORAGE_KEYS.settings, STORAGE_KEYS.stats];
  const data = await chrome.storage.local.get(keys);
  const state = data[STORAGE_KEYS.state];
  const settings = data[STORAGE_KEYS.settings] ?? {
    workMin: DEFAULT_WORK_MIN,
    breakMin: DEFAULT_BREAK_MIN,
    longBreakMin: DEFAULT_LONG_BREAK_MIN,
    notifyOnComplete: true,
    notifyOnStop: false,
    soundEnabled: true,
  };
  const stats = data[STORAGE_KEYS.stats] ?? {};
  const stateResult = await computeStateFromStorage(state, settings, stats);
  return { state: stateResult, settings };
}

async function computeStateFromStorage(state, settings, stats) {
  const today = new Date().toDateString();
  const todayCount = stats[today] ?? 0;
  if (!state) {
    const workSec = (settings.workMin ?? DEFAULT_WORK_MIN) * 60;
    return {
      currentTime: formatTime(workSec),
      totalSeconds: workSec,
      remainingSeconds: workSec,
      timerRunning: false,
      paused: false,
      phase: "work",
      sessionPomodoroCount: 0,
      todayPomodoroCount: todayCount,
    };
  }
  const now = Math.floor(Date.now() / 1000);
  let remaining = state.remainingSeconds;
  if (state.timerRunning && !state.paused) {
    const elapsed = now - (state.lastUpdateAt ?? now);
    remaining = Math.max(0, state.remainingSeconds - elapsed);
  }
  return {
    currentTime: formatTime(remaining),
    totalSeconds: state.totalSeconds,
    remainingSeconds: remaining,
    timerRunning: state.timerRunning && !state.paused,
    paused: state.paused,
    phase: state.phase,
    sessionPomodoroCount: state.sessionPomodoroCount ?? 0,
    todayPomodoroCount: todayCount,
  };
}

function startCountdown() {
  countdownInterval = setInterval(async () => {
    const state = await getStoredState();
    if (!state?.timerRunning || state?.paused) {
      clearInterval(countdownInterval);
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - state.lastUpdateAt;
    const remaining = Math.max(0, state.remainingSeconds - elapsed);
    state.remainingSeconds = remaining;
    state.lastUpdateAt = now;
    await saveState(state);
    updateBadge(remaining);
    broadcastState(await getState());
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      await handleTimerComplete(state);
    }
  }, 1000);
}

async function handleAlarmTick() {
  const state = await getStoredState();
  if (!state?.timerRunning || state?.paused) return;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - (state.lastUpdateAt ?? now);
  const actualRemaining = Math.max(0, (state.remainingSeconds ?? 0) - elapsed);
  // Only handle if timer actually ended (avoids double-handling when setInterval already ran)
  if (actualRemaining <= 1) {
    await handleTimerComplete({ ...state, remainingSeconds: 0 });
  }
}

async function handleTimerComplete(state) {
  clearInterval(countdownInterval);
  chrome.alarms.clear(ALARM_NAME);
  const settings = await getSettings();

  if (state.phase === "work") {
    const sessionCount = (state.sessionPomodoroCount ?? 0) + 1;
    await incrementPomodoroCount();
    if (settings.notifyOnComplete) {
      showNotification("Time for a break!", "Great focus session. Take a breather.");
    }
    const breakMin = sessionCount % POMODOROS_BEFORE_LONG_BREAK === 0
      ? settings.longBreakMin
      : settings.breakMin;
    await startTimer(breakMin * 60, "break", sessionCount);
    return;
  }

  if (state.phase === "break") {
    if (settings.notifyOnComplete) {
      showNotification("Break over!", "Ready for another focus session?");
    }
    const sessionCount = (state.sessionPomodoroCount ?? 0);
    await startTimer(settings.workMin * 60, "work", sessionCount);
  }
}

async function incrementPomodoroCount() {
  const { [STORAGE_KEYS.stats]: stats } = await chrome.storage.local.get(STORAGE_KEYS.stats);
  const today = new Date().toDateString();
  const next = { ...stats };
  next[today] = (next[today] ?? 0) + 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.stats]: next });
}

function updateBadge(seconds) {
  if (seconds <= 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  chrome.action.setBadgeText({ text: formatTime(seconds) });
  chrome.action.setBadgeBackgroundColor({ color: "#1a1a2e" });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function broadcastState(state) {
  chrome.runtime.sendMessage({ action: "currentTime", ...state }).catch(() => {});
}

function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title,
      message,
    });
  } catch (e) {}
}

// --- Recovery on service worker wake (Chrome restart) ---
chrome.runtime.onStartup.addListener(restoreTimerIfNeeded);

async function restoreTimerIfNeeded() {
  const state = await getStoredState();
  if (!state?.timerRunning || state?.paused) return;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - (state.lastUpdateAt ?? now);
  const remaining = Math.max(0, (state.remainingSeconds ?? 0) - elapsed);
  if (remaining <= 0) {
    await handleTimerComplete({ ...state, remainingSeconds: 0 });
    return;
  }
  state.remainingSeconds = remaining;
  state.lastUpdateAt = now;
  await saveState(state);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + remaining * 1000 });
  startCountdown();
  updateBadge(remaining);
}

// --- Command (keyboard shortcut) ---
chrome.commands?.onCommand?.addListener((command) => {
  if (command === "start-timer") {
    getState().then((s) => {
      if (s.timerRunning) pauseTimer();
      else if (s.paused) resumeTimer();
      else startTimer(s.totalSeconds || 25 * 60, "work");
    });
  }
});
