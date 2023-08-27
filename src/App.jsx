import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [currentTime, setCurrentTime] = useState("25:00");
  const [timerRunning, setTimerRunning] = useState(false);

  const [customTime, setCustomTime] = useState();
  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "currentTime") {
        setCurrentTime(message.data);
        setTimerRunning(message.timerRunning);
      }
    });
  }, []);

  const startTimer = () => {
    setTimerRunning(true);
    chrome.runtime.sendMessage({ action: "startTimer", customTime }); // Send a message to the background script
  };

  const stopTimer = () => {
    setTimerRunning(false);
    chrome.runtime.sendMessage({ action: "stopTimer" });
  };

  return (
    <div className="popup">
      <h1>Productive Pause !</h1>
      <p className="counter">{currentTime}</p>
      {timerRunning ? (
        <button onClick={stopTimer}>Stop</button>
      ) : (
        <>
          <p>OR</p>
          <input
            onChange={(e) => {
              setCustomTime(e.target.value);
            }}
            placeholder="please add custom time in minutes"
          ></input>
          <button onClick={startTimer}>Start</button>
        </>
      )}
    </div>
  );
}

export default App;
