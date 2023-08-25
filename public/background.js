chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startTimer") {
    startTimer(25 * 60); // Start the timer when receiving the startTimer message
  }
});

let countdown;
let timerRunning = false;

function startTimer(durationInSeconds) {
  let timer = durationInSeconds;
  countdown = setInterval(() => {
    let minutes = Math.floor(timer / 60);
    let seconds = timer % 60;

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    chrome.action.setBadgeText({ text: `${minutes}:${seconds}` });

    if (--timer < 0) {
      clearInterval(countdown);
      timerRunning = false;
      chrome.action.setBadgeText({ text: "" });

      // Timer is over, show a notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "Time's Up!",
        message: "Take a break.",
      });
    }
  }, 1000);
}
