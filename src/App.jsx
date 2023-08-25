import React from "react";
import "./App.css";

function App() {
  const startTimer = () => {
    chrome.runtime.sendMessage({ action: "startTimer" }); // Send a message to the background script
  };

  return (
    <div className="popup">
      <h1>Productive Pause !</h1>
      <button onClick={startTimer}>Start</button>
    </div>
  );
}

export default App;
