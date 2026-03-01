import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [state, setState] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  const defaultState = {
    currentTime: "25:00",
    totalSeconds: 1500,
    remainingSeconds: 1500,
    timerRunning: false,
    paused: false,
    phase: "work",
    sessionPomodoroCount: 0,
    todayPomodoroCount: 0,
  };

  const defaultSettings = {
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    notifyOnComplete: true,
    notifyOnStop: false,
    soundEnabled: true,
  };

  const displayState = state ?? defaultState;
  const displaySettings = settings ?? defaultSettings;

  // Fetch once on mount; listen for broadcasts (no polling)
  useEffect(() => {
    const fetchAll = () => {
      chrome.runtime?.sendMessage({ action: "getPopupData" }, (response) => {
        if (response?.state) setState(response.state);
        if (response?.settings) setSettings(response.settings);
      });
    };

    fetchAll();

    const listener = (message) => {
      if (message?.action === "currentTime") {
        setState({
          currentTime: message.currentTime,
          totalSeconds: message.totalSeconds,
          remainingSeconds: message.remainingSeconds,
          timerRunning: message.timerRunning,
          paused: message.paused,
          phase: message.phase,
          sessionPomodoroCount: message.sessionPomodoroCount ?? 0,
          todayPomodoroCount: message.todayPomodoroCount ?? 0,
        });
      }
    };

    chrome.runtime?.onMessage.addListener(listener);
    return () => chrome.runtime?.onMessage.removeListener(listener);
  }, []);

  const handleStart = () => {
    setError("");
    const minutes = parseInt(customMinutes, 10);
    const workMin = displaySettings.workMin;
    const value = Number.isNaN(minutes) || customMinutes === "" ? workMin : minutes;
    if (value < 1 || value > 120) {
      setError("Enter 1–120 minutes");
      return;
    }
    const usedCustom = customMinutes !== "" && !Number.isNaN(minutes);
    chrome.runtime?.sendMessage({ action: "startTimer", customTime: value }, () => {
      setCustomMinutes("");
      if (usedCustom) {
        const newSettings = { ...displaySettings, workMin: value };
        chrome.runtime?.sendMessage({ action: "saveSettings", settings: newSettings }, () => {
          setSettings(newSettings);
        });
      }
    });
  };

  const handlePause = () => {
    chrome.runtime?.sendMessage({ action: "pauseTimer" });
  };

  const handleResume = () => {
    chrome.runtime?.sendMessage({ action: "resumeTimer" });
  };

  const handleStop = () => {
    chrome.runtime?.sendMessage({ action: "stopTimer" });
  };

  const handleSaveSettings = (newSettings) => {
    chrome.runtime?.sendMessage({ action: "saveSettings", settings: newSettings }, () => {
      setSettings(newSettings);
      setShowSettings(false);
    });
  };

  const handleResetDefaults = () => {
    chrome.runtime?.sendMessage({ action: "saveSettings", settings: defaultSettings }, () => {
      setSettings(defaultSettings);
    });
  };

  const progress =
    displayState.totalSeconds > 0
      ? 1 - displayState.remainingSeconds / displayState.totalSeconds
      : 0;

  return (
    <div className="popup">
      <header className="header">
        <h1>Productive Pause</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙
        </button>
      </header>

      {showSettings && (
        <section className="settings-panel">
          <div className="settings-row">
            <label>Work (min)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={displaySettings.workMin}
              onChange={(e) =>
                setSettings((s) => ({ ...(s ?? defaultSettings), workMin: parseInt(e.target.value, 10) || 25 }))
              }
            />
          </div>
          <div className="settings-row">
            <label>Break (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={displaySettings.breakMin}
              onChange={(e) =>
                setSettings((s) => ({ ...(s ?? defaultSettings), breakMin: parseInt(e.target.value, 10) || 5 }))
              }
            />
          </div>
          <div className="settings-row">
            <label>Long break (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={displaySettings.longBreakMin}
              onChange={(e) =>
                setSettings((s) => ({ ...(s ?? defaultSettings), longBreakMin: parseInt(e.target.value, 10) || 15 }))
              }
            />
          </div>
          <div className="settings-row checkbox-row">
            <label>Notify on completion</label>
            <input
              type="checkbox"
              checked={displaySettings.notifyOnComplete}
              onChange={(e) =>
                setSettings((s) => ({ ...(s ?? defaultSettings), notifyOnComplete: e.target.checked }))
              }
            />
          </div>
          <div className="settings-row checkbox-row">
            <label>Notify when stopped</label>
            <input
              type="checkbox"
              checked={displaySettings.notifyOnStop}
              onChange={(e) =>
                setSettings((s) => ({ ...(s ?? defaultSettings), notifyOnStop: e.target.checked }))
              }
            />
          </div>
          <div className="settings-buttons">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSaveSettings(settings ?? displaySettings)}
            >
              Save settings
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetDefaults}
              title="Reset to 25 min work, 5 min break"
            >
              Reset to default
            </button>
          </div>
        </section>
      )}

      <div className={`phase-badge phase-${displayState.phase}`}>
        {displayState.phase === "work" ? "Focus" : "Break"}
      </div>

      <div className="timer-container">
        <div className="progress-ring">
          <svg viewBox="0 0 120 120">
            <circle
              className="progress-ring-bg"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
            />
            <circle
              className="progress-ring-fill"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
              strokeDasharray={339.3}
              strokeDashoffset={339.3 * (1 - progress)}
            />
          </svg>
        </div>
        <p className="counter">{displayState.currentTime}</p>
      </div>

      <p className="stats">
        Today: <strong>{displayState.todayPomodoroCount ?? 0}</strong> pomodoros
      </p>

      {displayState.timerRunning ? (
        <div className="controls">
          <button type="button" className="btn btn-secondary" onClick={handlePause}>
            Pause
          </button>
          <button type="button" className="btn btn-danger" onClick={handleStop}>
            Stop
          </button>
        </div>
      ) : displayState.paused ? (
        <div className="controls">
          <button type="button" className="btn btn-primary" onClick={handleResume}>
            Resume
          </button>
          <button type="button" className="btn btn-danger" onClick={handleStop}>
            Stop
          </button>
        </div>
      ) : (
        <div className="start-section">
          <input
            type="number"
            min={1}
            max={120}
            placeholder={`Custom minutes (default: ${displaySettings.workMin})`}
            value={customMinutes}
            onChange={(e) => {
              setCustomMinutes(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={handleStart}>
            Start focus
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
