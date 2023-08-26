import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [currentTime, setCurrentTime] = useState("25:00");
  const [timerRunning, setTimerRunning] = useState(false);
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
    chrome.runtime.sendMessage({ action: "startTimer" }); // Send a message to the background script
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
        <button onClick={startTimer}>Start</button>
      )}
    </div>
  );
}

export default App;
