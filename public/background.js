let countdown;
let timerRunning = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "startTimer") {
    startTimer(25 * 60); // Start the timer when receiving the startTimer message
    timerRunning = true;
  }
  if (timerRunning && message.action === "stopTimer") {
    sendStoppedNotification();
    resetDefault();
  }
});

function startTimer(durationInSeconds) {
  let timer = durationInSeconds;
  countdown = setInterval(() => {
    let minutes = Math.floor(timer / 60);
    let seconds = timer % 60;

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    chrome.action.setBadgeText({ text: `${minutes}:${seconds}` });
    chrome.runtime.sendMessage({
      action: "currentTime",
      data: `${minutes}:${seconds}`,
      timerRunning: timerRunning,
    });

    if (--timer < 0) {
      resetDefault();
      sendCompletedNotification();
    }
  }, 1000);
}
function resetDefault() {
  clearInterval(countdown);
  timerRunning = false;
  chrome.action.setBadgeText({ text: "" });
}

function sendCompletedNotification() {
  // Timer is over, show a notification
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon48.png",
    title: "Time's Up!",
    message: "Take a break.",
  });
}

function sendStoppedNotification() {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon48.png",
    title: "Timer is Stopped",
    message: "Timer is Stopped.",
  });
}
