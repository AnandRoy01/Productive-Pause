import React from "react";

function App() {
  const startTimer = () => {
    chrome.runtime.sendMessage({ action: "startTimer" }); // Send a message to the background script
  };

  return (
    <div className="popup">
      <h1>Work-Break Timer</h1>
      <button onClick={startTimer}>Start</button>
    </div>
  );
}

export default App;
