// Print loaded frontend variables
// console.log("liveBattleHost: " + liveBattleHost);
// console.log("liveBattleTest: " + liveBattleTest);
// console.log("liveBattleQuizzes: " + liveBattleQuizzes);

// Function to wait for a number of milliseconds
function wait(milliseconds) {
  if (milliseconds < 0) milliseconds = 0;
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// AUXILIARY VARIABLES
var currentTime = null;
var currentQuizIndex = -1;
var currentQuizId = null;
var currentQuizStartsAt = null;
var currentQuizEndsAt = null;
var timeRemainingForStart = null;
var timeRemainingForEnd = null;
var timeOutForQuizAnswer = null;
var updateTimeRemainingForStartKey = "update-time-remaining-for-start";
var updateTimeRemainingForEndKey = "update-time-remaining-for-end";
var checkIfEveryoneAnsweredKey = "check-if-everyone-answered";

/* AUXILIARY CONSTANTS */
const MAX_N_FAILED_STATUS_CHECKS = 1;
const MAX_N_STATUS_CHECKS = 100;

/* AUXILIARY FUNCTIONS */

// Hide the live battle info
function hideLiveBattleInfo() {
  // Hide the battle ID box
  const battleIdBox = document.getElementById("battle-id-box");
  if (battleIdBox) battleIdBox.classList.add("is-hidden");

  // Hide the join-as-player-button el
  const joinAsPlayerButtonEl = document.getElementById("join-as-player-button");
  if (joinAsPlayerButtonEl) joinAsPlayerButtonEl.classList.add("is-hidden");

  // Hide the waiting-message-button el
  const waitingMessageButtonEl = document.getElementById("waiting-message-button");
  if (waitingMessageButtonEl) waitingMessageButtonEl.classList.add("is-hidden");

  // Hide the live-battle-info el
  const liveBattleInfoEl = document.getElementById("live-battle-info");
  if (liveBattleInfoEl) liveBattleInfoEl.classList.add("is-hidden");

  // Hide the players info el
  const playersInfoEl = document.getElementById("players-info");
  if (playersInfoEl) playersInfoEl.classList.add("is-hidden");
}

// Show the timer bar
function showTimerBar() {
  const timerBar = document.getElementById("livebattle-timer-bar");
  if (timerBar) timerBar.classList.remove("is-hidden");
}

// Hide the timer bar
function hideTimerBar() {
  const timerBar = document.getElementById("livebattle-timer-bar");
  const answerTimerEl = document.getElementById("time-remaining-for-end-div");
  if (timerBar) {
    timerBar.classList.add("is-hidden");
  }
  if (answerTimerEl) {
    answerTimerEl.classList.remove("urgent");
  }
}

// Show the countdown
function showCountdown() {
  showTimerBar();
  // Show the countdown el
  const countdownEl = document.getElementById("countdown");
  if (countdownEl) countdownEl.classList.remove("is-hidden");
  // Hide the answer timer and reset urgent class
  const answerEl = document.getElementById("time-remaining-for-end-div");
  if (answerEl) {
    answerEl.classList.add("is-hidden");
    answerEl.classList.remove("urgent");
  }
}

// Show the answer timer
function showAnswerTimer() {
  showTimerBar();
  // Hide the countdown
  const countdownEl = document.getElementById("countdown");
  if (countdownEl) countdownEl.classList.add("is-hidden");
  // Show the answer timer
  const answerEl = document.getElementById("time-remaining-for-end-div");
  if (answerEl) answerEl.classList.remove("is-hidden");
}

// Show updated user scores
function showUpdatedUserScores() {
  // Get the player-score el
  const playerScoreEl = document.getElementById("player-score");
  // If playername is in liveBattle.players name attributes
  if (liveBattle.players.find((player) => player.name === playername)) {
    // Update the player-score el
    playerScoreEl.innerHTML = liveBattle.players.find((player) => player.name === playername).totalScore;
  } else {
    // Set the player-score el to info text
    playerScoreEl.innerHTML = `
      <span lang="en">spectator</span>
      <span lang="es">espectador</span>
    `;
  }

  // Hide all quiz els
  const quizEls = document.querySelectorAll(".quiz");
  for (const quizEl of quizEls) {
    quizEl.classList.add("is-hidden");
  }

  // Get the element to update
  const liveBattlePlayersInfoEl = document.getElementById("players-info");

  // Check if liveBattlePlayersInfoEl exists
  if (!liveBattlePlayersInfoEl) {
    return;
  }

  // Initialize new players info innerHTML
  let newPlayersInfoInnerHTML = "";

  // Start by showing the number of players
  const nPlayers = liveBattle.players.length;
  newPlayersInfoInnerHTML += `
    <p class="is-size-5" id="n-players-info">
      <span lang="en"># Players: </span>
      <span lang="es"># Jugadores: </span>
      ${nPlayers}
      <span lang="en"> (showing Top 10)</span>
      <span lang="es"> (mostrando Top 10)</span>
    </p>
  `;

  // Get copy of liveBattle players
  let players = JSON.parse(JSON.stringify(liveBattle.players));
  // Order players by totalScore
  players.sort((a, b) => b.totalScore - a.totalScore);
  // Add an attribute position to each player
  players.forEach((player, index) => {
    player.position = index + 1;
  });
  // Limit to first 10 players
  players = players.slice(0, 10);

  // Iterate over the players
  const borderColors = ['golden', 'silver', 'bronze', 'fourth-fifth', 'fourth-fifth'];

  // Generate Bulma Table for rest of players
  let playersHTML = `<div class="table-container">
    <table class="table is-fullwidth is-hoverable is-striped">
      <thead>
        <tr>
          <th class="" data-type="text"><span lang="en">Pos</span><span lang="es">Pos</span></th>
          <th class="has-text-right" data-type="text"><span lang="en">Name</span><span lang="es">Nombre</span></th>
          <th class="has-text-right" data-type="number"><span lang="en">Score</span><span lang="es">Score</span></th>
        </tr>
      </thead>
  `;

  playersHTML += `<tbody>`
  for (const player of players) {
    // Assign a badge to each position
    let badgeHTML = "";
    let borderClass = "";
    if (player.position === 1) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal" style="color: var(--gold-color);" title="1st Place"></i></span>`;
      borderClass = borderColors[0];
    } else if (player.position === 2) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal" style="color: var(--silver-color);" title="2nd Place"></i></span>`;
      borderClass = borderColors[1];
    } else if (player.position === 3) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal" style="color: var(--bronze-color);" title="3rd Place"></i></span>`;
      borderClass = borderColors[2];
    } else if (player.position === 4) {
      badgeHTML = `<b class="icon has-text-grey-light">4th</b>`;
      borderClass = borderColors[3];
    } else if (player.position === 5) {
      badgeHTML = `<b class="icon has-text-grey-light">5th</b>`;
      borderClass = borderColors[4];
    }

    playersHTML += `
      <tr>
        <td class="is-size-6" data-value="${player.position}">${badgeHTML ? badgeHTML : player.position}</td>
        <td class="has-text-right is-size-6" data-value="${player.name}">${player.name}</td>
        <td class="has-text-right is-size-6" data-value="${player.totalScore}">${player.totalScore} pts</td>
      </tr>
    `;
  }
  playersHTML += `</tbody></table></div>`

  // Add playersHTML to newPlayersInfoInnerHTML
  newPlayersInfoInnerHTML += playersHTML;

  // Set the new players info innerHTML
  liveBattlePlayersInfoEl.innerHTML = newPlayersInfoInnerHTML;

  // Show the players info el
  liveBattlePlayersInfoEl.classList.remove("is-hidden");
}

// Show the final results
function showFinalResults() {
  // Get the player-score el
  const playerScoreEl = document.getElementById("player-score");
  // If playername is in liveBattle.players name attributes
  if (liveBattle.players.find((player) => player.name === playername)) {
    // Update the player-score el
    playerScoreEl.innerHTML = liveBattle.players.find((player) => player.name === playername).totalScore;
  } else {
    // Set the player-score el to info text
    playerScoreEl.innerHTML = `
      <span lang="en">spectator</span>
      <span lang="es">espectador</span>
    `;
  }

  // Hide all quiz els
  const quizEls = document.querySelectorAll(".quiz");
  for (const quizEl of quizEls) {
    quizEl.classList.add("is-hidden");
  }

  // Hide timer bar
  hideTimerBar();

  // Hide waiting for others message (waiting-for-others-message)
  const waitingForOthersMessageEl = document.getElementById("waiting-for-others-message");
  waitingForOthersMessageEl.classList.add("is-hidden");

  // Get the element to update
  const liveBattlePlayersInfoEl = document.getElementById("players-info");
  if (!liveBattlePlayersInfoEl) return;

  // Get copy of liveBattle players
  let players = JSON.parse(JSON.stringify(liveBattle.players));
  // Order players by totalScore
  players.sort((a, b) => b.totalScore - a.totalScore);
  // Add an attribute position to each player
  players.forEach((player, index) => {
    player.position = index + 1;
  });

  // Get top 3 players
  const top3Players = players.slice(0, 3);
  // console.log('top3Players', top3Players);

  // Get rest of players
  const restPlayers = players; //players.slice(3);
  // console.log('restPlayers', restPlayers);

  // Initialize new players info innerHTML
  let newPlayersInfoInnerHTML = `
    <p class="title is-6 has-text-centered">
      <span class="icon"><i class="fas fa-trophy"></i></span>
      <span lang="en">Final Results</span>
      <span lang="es">Resultados Finales</span>
    </p>

    <p class="subtitle is-6 has-text-centered">
      <span lang="en">Won't be saved, take a screenshot ;)</span>
      <span lang="es">No se guardará, toma una captura de pantalla ;)</span>
    </p>
  `;

  // Generate HTML for top 3 players
  let top3PlayersHTML = `<div class="columns is-multiline">`;

  // Iterate over top 3 players
  const borderColors = ['golden', 'silver', 'bronze', 'fourth-fifth', 'fourth-fifth'];
  for (const player of top3Players) {
    // Assign a badge to each position
    let badgeHTML = "";
    let borderClass = "";
    if (player.position === 1) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal fa-2x" style="color: var(--gold-color);" title="1st Place"></i></span>`;
      borderClass = borderColors[0];
    } else if (player.position === 2) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal fa-2x" style="color: var(--silver-color);" title="2nd Place"></i></span>`;
      borderClass = borderColors[1];
    } else if (player.position === 3) {
      badgeHTML = `<span class="icon"><i class="fas fa-medal fa-2x" style="color: var(--bronze-color);" title="3rd Place"></i></span>`;
      borderClass = borderColors[2];
    }

    top3PlayersHTML += `
      <div class="column is-one-third-desktop">
        <div class="box equal-height-as-sibling ${borderClass}" style="position: relative;">
          <p class="is-size-4 has-text-centered">${badgeHTML}</p>
          <p class="title is-5 has-text-centered player-name">
            ${player.name}
          </p>
          <p class="subtitle is-5 has-text-centered player-score">
            ${player.totalScore} pts
          </p>
        </div>
      </div>
    `;
  }

  // Close top 3 players HTML
  top3PlayersHTML += `</div>`;

  // Append top 3 players HTML to new players info innerHTML
  newPlayersInfoInnerHTML += top3PlayersHTML;

  // Generate Bulma Table for rest of players
  let restPlayersHTML = `<div class="table-container">
    <table class="table is-fullwidth is-hoverable is-striped">
      <thead>
        <tr>
          <th class="" data-type="text"><span lang="en">Pos</span><span lang="es">Pos</span></th>
          <th class="has-text-right" data-type="text"><span lang="en">Name</span><span lang="es">Nombre</span></th>
          <th class="has-text-right" data-type="number"><span lang="en">Score</span><span lang="es">Score</span></th>
        </tr>
      </thead>
  `;

  restPlayersHTML += `<tbody>`
  for (const player of restPlayers) {
    restPlayersHTML += `
      <tr>
        <td class="is-size-6" data-value="${player.position}">${player.position}</td>
        <td class="has-text-right is-size-6" data-value="${player.name}">${player.name}</td>
        <td class="has-text-right is-size-6" data-value="${player.totalScore}">${player.totalScore} pts</td>
      </tr>
    `;
  }
  restPlayersHTML += `</tbody></table></div>`

  // Append rest of players HTML to new players info innerHTML
  newPlayersInfoInnerHTML += restPlayersHTML;

  // Set the new players info innerHTML
  liveBattlePlayersInfoEl.innerHTML = newPlayersInfoInnerHTML;

  // Show the players info el
  liveBattlePlayersInfoEl.classList.remove("is-hidden");
}

// Show the current quiz
function showCurrentQuiz() {
  // Hide the countdown
  const countdownEl = document.getElementById("countdown");
  countdownEl.classList.add("is-hidden");

  // Hide the players info
  const playersInfoEl = document.getElementById("players-info");
  playersInfoEl.classList.add("is-hidden");

  // Hide all quiz elements
  const liveBattleQuizEls = document.querySelectorAll(".quiz");
  liveBattleQuizEls.forEach((quiz) => {
    quiz.classList.add("is-hidden");
  });

  // Show the current quiz
  const liveBattleQuizLinksEl = document.getElementById("livebattle-quiz-links");
  const liveBattleQuizzesEl = document.getElementById("livebattle-quizzes");
  const liveBattleCurrentQuizEl = document.getElementById(`quiz-${currentQuizId}`);
  liveBattleCurrentQuizEl.classList.remove("is-hidden");
  liveBattleQuizLinksEl.classList.remove("is-hidden");
  liveBattleQuizzesEl.classList.remove("is-hidden");

  // Remove the "quiz-send-answer-button" if playername === liveBattleHostusername and liveBattleStatus.hostIsPlayer === false
  if ((playername === liveBattleHost.username) && (liveBattle.hostIsPlayer === false)) {
    const quizSendAnswerButton = liveBattleCurrentQuizEl.querySelector(".quiz-send-answer-button");
    quizSendAnswerButton.remove();
  }

  // Unhover all quiz links
  const quizLinks = document.querySelectorAll(".flex-item-quiz-link");
  quizLinks.forEach((quizLink) => {
    quizLink.classList.remove("is-hovered");
  });

  // Hover quiz link of the current quiz
  const currentQuizLinkEl = document.getElementById(`quiz-link-${currentQuizId}`);
  currentQuizLinkEl.classList.add("is-hovered");

  // Scroll horizontally smoothly to the clicked quiz link
  currentQuizLinkEl.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center",
  });

  // Show the answer timer
  showAnswerTimer();

  // Reset submit button state (disabled until option selected, but visible)
  const submitBtn = document.getElementById("livebattle-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.remove("is-hidden");
  }
}

// Show the result to sent answer
function showResult(result, score) {
  // Get the quiz, button and quiz link el
  const quizEl = document.getElementById(`quiz-${currentQuizId}`);
  const quizLinkEl = document.getElementById(`quiz-link-${currentQuizId}`);
  const button = quizEl.querySelector(".quiz-send-answer-button");
  const quizOptionsEl = quizEl.querySelector(".quiz-options");
  const livebattleSubmitBtn = document.getElementById("livebattle-submit-btn");

  // Hide the quiz options
  quizOptionsEl.classList.add("is-hidden");

  // Hide and disable the livebattle submit button
  if (livebattleSubmitBtn) {
    livebattleSubmitBtn.disabled = true;
    livebattleSubmitBtn.classList.add("is-hidden");
  }

  // Modify the send answer button and quiz link (if button exists)
  if (button) {
    button.onclick = {};
    button.style.display = "none";
  }
  quizLinkEl.classList.remove("marked");
  if (button) {
    button.classList.remove("is-primary");
    button.classList.add("is-rounded");
  }
  if (result === "correct") {
    if (button) button.title = "Correct!";
    quizLinkEl.classList.add("correct");
    if (button) {
      button.classList.add("is-success");
      button.classList.add("is-outlined");
      button.innerHTML = '<span class="icon"><i class="fas fa-check fa-lg"></i></span>';
    }
  } else if (result === "incorrect") {
    if (button) button.title = "Incorrect!";
    quizLinkEl.classList.add("incorrect");
    if (button) {
      button.classList.add("is-danger");
      button.classList.add("is-outlined");
      button.innerHTML = '<span class="icon"><i class="fas fa-times fa-lg"></i></span>';
    }
  } else {
    if (button) button.title = "Question not answered";
    if (button) button.classList.add("is-grey");
    quizLinkEl.classList.add("omitted");
    if (button) button.innerHTML = '<span class="icon"><i class="fas fa-fast-forward"></i></span>';
  }

  // Show an alert message on the quiz
  const quizAlertEl = quizEl.querySelector(".quiz-alert");
  // Change classes of quiz alert el from "is-6" "is-4"
  quizAlertEl.classList.remove("is-6");
  quizAlertEl.classList.add("is-4");
  if (result === "correct") {
    quizAlertEl.classList.add("has-text-success");
    quizAlertEl.innerHTML = `
      <span lang="en">Correct! &#128526;</span>
      <span lang="es">¡Correcto! &#128526;</span>
      <span> [+${score}]</span>
    `;
  } else if (result === "incorrect") {
    quizAlertEl.classList.add("has-text-danger");
    quizAlertEl.innerHTML = `
      <span lang="en">Incorrect! &#128542;</span>
      <span lang="es">¡Incorrecto! &#128542;</span>
      <span> [+${score}]</span>
    `;
  } else {
    quizAlertEl.classList.add("has-text-grey");
    quizAlertEl.innerHTML = `
      <span lang="en">Not answered &#129296;</span>
      <span lang="es">No contestada &#129296;</span>
      <span> [+${score}]</span>
    `;
  }

  // Remove hidden class from the quiz alert
  quizAlertEl.classList.remove("is-hidden");

  // Show waiting for others message (waiting-for-others-message)
  const waitingForOthersMessageEl = document.getElementById("waiting-for-others-message");
  waitingForOthersMessageEl.classList.remove("is-hidden");
}

// Function to update the live battle players info HTML
function updateLiveBattlePlayersInfoHTML() {
  // Get the element to update
  const liveBattlePlayersInfoEl = document.getElementById("players-info");

  // Check if liveBattlePlayersInfoEl exists
  if (!liveBattlePlayersInfoEl) {
    return;
  }

  // Initialize new players info innerHTML
  let newPlayersInfoInnerHTML = "";

  // Start by showing the number of players
  const nPlayers = liveBattle.players.length;
  newPlayersInfoInnerHTML += `
    <p class="is-size-5" id="n-players-info">
      <span lang="en"># Players: </span>
      <span lang="es"># Jugadores: </span>
      ${nPlayers}
    </p>
  `;

  // Start quiz-links div
  newPlayersInfoInnerHTML += `<div class="quiz-links flex-container">`;

  // Iterate over the players
  newPlayersInfoInnerHTML += liveBattle.players
    .map((player) => {
      // Get icon html depending on player being host or myself
      let iconHTML = "";
      if (player.name === liveBattleHost.username) {
        iconHTML = `<span class="icon has-text-danger"><i class="fas fa-crown"></i></span>`;
      } else if (player.name === playername) {
        iconHTML = `<span class="icon has-text-success"><i class="fas fa-user-astronaut"></i></span>`;
      } else {
        iconHTML = `<span class="icon"><i class="fas fa-user"></i></span>`;
      }

      return `
        <div class="player-info flex-item-quiz-link">
          ${iconHTML}
          <span class="player-name">${player.name}</span>
        </div>
      `;
    })
    .join("");

  // Close the quiz-links div
  newPlayersInfoInnerHTML += `</div>`;

  // Set the new players info innerHTML
  liveBattlePlayersInfoEl.innerHTML = newPlayersInfoInnerHTML;
}

// Function to check what players joined the live battle and check the status is still "waiting"
// In case the status changes to "ongoing" -> Get list of startsAt and endsAt times for each quiz
function updateLiveBattleStatus() {

  // Check that the current url contains the word "livebattle"
  if (!window.location.href.includes("livebattle")) {
    // console.log("Not a live battle page, stopping interval");
    // If it doesn't, stop the intervals and return
    clearIntervalByKey(updateLiveBattleStatusIntervalKey);
    clearIntervalByKey(updateTimeRemainingForStartKey);
    clearIntervalByKey(updateTimeRemainingForEndKey);
    return;
  }

  // Fetch the latest liveBattle status from the server
  fetch("/api/livebattle/" + liveBattleId + "/status?pn=" + playername + "&n=" + nLiveBattleStatusChecks)
    .then((response) => response.json())
    .then((data) => {
      // Check the response is successful
      if (data.success) {
        // Increment the number of live battle status checks
        nFailedLiveBattleStatusChecks = 0;
        nLiveBattleStatusChecks++;
        liveBattle = data.liveBattle;
        liveBattleStatus = liveBattle.status;
        // console.log("liveBattle: ", liveBattle);
        console.log("[" + liveBattleId + "] Status Check #" + nLiveBattleStatusChecks + " for '" + playername + "': '" + liveBattleStatus + "'");
        // console.log("Current quiz index: " + liveBattle.currentQuizIndex + " vs " + currentQuizIndex);
        // If the number of status checks is over the maximum, stop the interval
        if (nLiveBattleStatusChecks > MAX_N_STATUS_CHECKS) {
          clearIntervalByKey(updateLiveBattleStatusIntervalKey);
          return;
        }

        // Handle depending on current and new status
        if (liveBattleStatus === "waiting") {
          // Set the current quiz index to -1
          currentQuizIndex = -1;
          // Disable the start button if the number of players is less than 2
          const startButton = document.getElementById("start-live-battle-button");
          const startLiveBattleMsg = document.getElementById("start-live-battle-message");
          if (startButton) {
            if (liveBattle.players.length < 2) {
              startButton.disabled = true;
              startLiveBattleMsg.classList.remove("is-hidden");
            } else {
              startButton.disabled = false;
              startLiveBattleMsg.classList.add("is-hidden");
            }
          }
          // Update the live battle players info
          updateLiveBattlePlayersInfoHTML();
        } else if ((liveBattleStatus === "ongoing") && (liveBattle.currentQuizIndex > currentQuizIndex)) {
          // Clear the interval
          clearIntervalByKey(updateLiveBattleStatusIntervalKey);
          // Run ongoing live battle function
          ongoingLiveBattle();
        } else if (liveBattleStatus === "finished") {
          // Clear the interval
          clearIntervalByKey(updateLiveBattleStatusIntervalKey);
          // Show the final results
          showFinalResults();
          // Show SweetAlert
          // showSweetAlert("The live battle has finished.", "info");
        }
      } else {
        // Throw error
        throw new Error(data.error);
      }
    })
    .catch((error) => {
      // Print error
      // console.error(error);
      // Increment nFailedLiveBattleStatusChecks
      nFailedLiveBattleStatusChecks++;
      if (nFailedLiveBattleStatusChecks > MAX_N_FAILED_STATUS_CHECKS) {
        // Stop the interval
        clearIntervalByKey(updateLiveBattleStatusIntervalKey);
        // Show SweetAlert
        showSweetAlert("The live battle has expired or is no longer available.", "error");
        // Fetch body content of live battle page
        const nextUrl = "/livebattle/" + liveBattleId + "?pn=" + playername;
        fetchBodyContent(nextUrl);
      }
    });
}

// Function to start the live battle
function startLiveBattle() {
  // Send a request to the server to start the live battle
  fetch("/api/livebattle/" + liveBattleId + "/start", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      // Check the response is successful
      if (data.success) {
        // Print the success message
        // console.log(data.message);
        // Show SweetAlert
        showSweetAlert("The live battle has started!", "success");
        // Update live battle object
        liveBattle = data.liveBattle;
        // Clear the interval
        clearIntervalByKey(updateLiveBattleStatusIntervalKey);
        // Run ongoing live battle function
        ongoingLiveBattle();
      } else {
        // Throw error
        throw new Error(data.error);
      }
    })
    .catch((error) => {
      // Print the error
      // console.error(error);
      // Show SweetAlert
      showSweetAlert(error.message, "error");
    });
}

// Countdown total seconds (for progress bar calculation)
var countdownTotalSeconds = 10; // Default, will be updated

// Function to update time remaining for start
function updateTimeRemainingForStart(currentTime = null) {
  // If the current time is null, set it to the current time
  if (currentTime === null) {
    currentTime = Date.now();
  }
  // Calculate time remaining for start
  timeRemainingForStart = currentQuizStartsAt - Date.now();
  // If the time remaining for the current quiz to start is less than 0, undefined or null -> Set it to 0
  if (timeRemainingForStart < 0 || timeRemainingForStart === undefined || timeRemainingForStart === null) {
    timeRemainingForStart = 0;
  }
  // Get element with id="time-remaining-for-start" and update its innerHTML
  const timeRemainingForStartEl = document.getElementById("time-remaining-for-start");
  const progressEl = document.getElementById("countdown-progress");

  if (timeRemainingForStartEl) {
    const secondsLeft = Math.floor(timeRemainingForStart / 1000);
    timeRemainingForStartEl.innerHTML = secondsLeft;

    // Update progress bar (countdown is typically 10 seconds)
    if (progressEl) {
      const totalMs = countdownTotalSeconds * 1000;
      const progress = Math.max(0, (timeRemainingForStart / totalMs) * 100);
      progressEl.style.width = progress + "%";
    }
  }
}

// Function to update time remaining for end
function updateTimeRemainingForEnd(currentTime = null) {
  // If the current time is null, set it to the current time
  if (currentTime === null) {
    currentTime = Date.now();
  }
  // Calculate time remaining for end
  timeRemainingForEnd = currentQuizEndsAt - Date.now();
  // If the time remaining for the current quiz to end is less than 0, undefined or null -> Set it to 0
  if (timeRemainingForEnd < 0 || timeRemainingForEnd === undefined || timeRemainingForEnd === null) {
    timeRemainingForEnd = 0;
  }
  // Get element with id="time-remaining-for-end" and update its innerHTML
  const timeRemainingForEndEl = document.getElementById("time-remaining-for-end");
  const progressEl = document.getElementById("answer-progress");
  const answerTimerEl = document.getElementById("time-remaining-for-end-div");

  if (timeRemainingForEndEl) {
    const secondsLeft = Math.floor(timeRemainingForEnd / 1000);
    timeRemainingForEndEl.innerHTML = secondsLeft;

    // Add urgent class when 5 seconds or less remaining
    // Keep urgent class until we switch away from the answer timer
    if (answerTimerEl) {
      if (secondsLeft <= 5) {
        answerTimerEl.classList.add("urgent");
      } else {
        answerTimerEl.classList.remove("urgent");
      }
    }

    // Update progress bar
    if (progressEl && liveBattle && liveBattle.secondsPerQuestion) {
      const totalMs = liveBattle.secondsPerQuestion * 1000;
      const progress = Math.max(0, (timeRemainingForEnd / totalMs) * 100);
      progressEl.style.width = progress + "%";
    }
  }
}

// Function to handle ongoing live battle
async function ongoingLiveBattle() {
  // Get the current quiz information
  currentTime = liveBattle.currentTime;
  currentQuizIndex = liveBattle.currentQuizIndex;
  currentQuizId = liveBattle.currentQuizId;
  currentQuizStartsAt = liveBattle.currentQuizStartsAt;
  currentQuizEndsAt = liveBattle.currentQuizEndsAt;
  // console.log("currentQuizIndex: " + currentQuizIndex);
  // console.log("currentQuizId: " + currentQuizId);

  // Update time remaining for start and end
  updateTimeRemainingForStart(currentTime);
  updateTimeRemainingForEnd(currentTime);

  // Print the time remaining for start and end
  // console.log("timeRemainingForStart: " + timeRemainingForStart/1000 + "s");
  // console.log("timeRemainingForEnd: " + timeRemainingForEnd/1000 + "s");

  // Calculate currentQuizStartsAt and currentQuizEndsAt
  currentQuizStartsAt = Date.now() + timeRemainingForStart;
  currentQuizEndsAt = Date.now() + timeRemainingForEnd;

  // Interval to update time remaining for start (100ms for smooth progress bar)
  startInterval(updateTimeRemainingForStart, 100, updateTimeRemainingForStartKey);
  // Interval to update time remaining for end (100ms for smooth progress bar)
  startInterval(updateTimeRemainingForEnd, 100, "update-time-remaining-for-end");

  // Hide the start div and remove the event listener
  const startDiv = document.getElementById("start-live-battle-div");
  const startButton = document.getElementById("start-live-battle-button");
  if (startDiv && startButton) {
    // Hide the start div
    startDiv.classList.add("is-hidden");
    // Remove the event listener
    startButton.onclick = null;
  }

  // Hide waiting for others message (waiting-for-others-message)
  const waitingForOthersMessageEl = document.getElementById("waiting-for-others-message");
  waitingForOthersMessageEl.classList.add("is-hidden");

  // Hide live battle info
  hideLiveBattleInfo();

  // Scroll live-battle-box smoothly to the center
  const liveBattleBox = document.getElementById("live-battle-box");
  if (liveBattleBox) {
    liveBattleBox.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  // Show the countdown
  showCountdown();

  // Show the updated user scores
  showUpdatedUserScores();

  // Wait for time remaining for the current quiz to start
  await wait(timeRemainingForStart);

  // Check that the current url contains the word "livebattle"
  if (!window.location.href.includes("livebattle")) {
    // console.log("Not a live battle page, stopping interval");
    // If it doesn't, stop the intervals and return
    clearIntervalByKey(updateLiveBattleStatusIntervalKey);
    clearIntervalByKey(updateTimeRemainingForStartKey);
    clearIntervalByKey(updateTimeRemainingForEndKey);
    return;
  }

  // Show the current quiz
  showCurrentQuiz();

  // Start interval to update the live battle status
  if ((playername === liveBattleHost.username) && (liveBattle.hostIsPlayer === false)) {
    // Update the live battle status
    startInterval(updateLiveBattleStatus, 5000, "update-live-battle-status");
  } else {
    startInterval(() => {
      // Mark quiz link as omitted
      const quizLinkEl = document.getElementById(`quiz-link-${currentQuizId}`);
      if (quizLinkEl) {
        quizLinkEl.classList.add("omitted");
      }

      // Update the live battle status
      updateLiveBattleStatus();
    }, timeRemainingForEnd + 1000, "update-live-battle-status");
  }
}

// Function to send quiz answer
function sendAnswer() {
  console.log("Sending answer for quiz index: " + currentQuizIndex);
  const quizId = currentQuizId;
  const quizEl = document.getElementById("quiz-" + quizId);
  const submitBtn = document.getElementById("livebattle-submit-btn");

  // Disable submit button while sending
  if (submitBtn) submitBtn.disabled = true;

  // Build the form data for the quiz depending on the selected options
  const [formDict, formData] = createCheckQuizFormData(quizId);


  // Get chosen opts from the form data
  const chosenOpts = formDict["chosenOpts-"+quizId];

  // Set remainingMs to timeRemainingForEnd
  const remainingMs = timeRemainingForEnd;

  // Do a get request to the backend with the form data /api/livebattle/:liveBattleId/answer?pn=:playername&qi=:currentQuizIndex&rms:=remainingMs&co:=chosenOpts
  const href = "/api/livebattle/" + liveBattleId + "/answer?pn=" + playername + "&qi=" + currentQuizIndex + "&rms=" + remainingMs + "&co=" + chosenOpts;
  fetch(href, { method: "POST" })
    .then((response) => {
      // Check if response was successful and get the result id from the response
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    }).then((response) => {
      if (response.success) {
        nFailedLiveBattleStatusChecks = 0;
        // Show if the answer is correct and its score
        const result = response.result;
        const score = response.score;
        showResult(result, score);
        // Check if it was already answered
        const alreadyAnswered = response.alreadyAnswered;
        if (alreadyAnswered) {
          // Show an alert indicating that the answer was already sent for this playername
          showSweetAlert("The answer was already sent for this playername. You can only send the answer once per playername.", "info");
          // Take the user to the live battle page
          const nextUrl = "/livebattle/" + liveBattleId;
          fetchBodyContent(nextUrl);
        } else {
          // Start interval to check live battle status
          startInterval(updateLiveBattleStatus, 5000, updateLiveBattleStatusIntervalKey);
        }
      } else {
        // Throw an error if the response was not successful
        throw new Error("Error sending answer for quiz " + currentQuizId);
      }
    }).catch((error) => {
      // Log the error
      // console.error(error);
      // Increment failed live battle status checks
      nFailedLiveBattleStatusChecks++;
      if (nFailedLiveBattleStatusChecks > MAX_N_FAILED_STATUS_CHECKS) {
        // Stop the interval
        clearIntervalByKey(updateLiveBattleStatusIntervalKey);
        // Show SweetAlert
        showSweetAlert("There was an error sending the answer as the live battle is no longer available.", "error");
        // Fetch body content of live battle page
        const nextUrl = "/livebattle/" + liveBattleId + "?playername=" + playername;
        fetchBodyContent(nextUrl);
      } else {
        // Re-enable submit button on error
        if (submitBtn) submitBtn.disabled = false;
        // Show SweetAlert
        showSweetAlert("There was an error sending the answer, please try again.", "error");
      }
    });
}

// Function to add event listeners to the start button (id=start-live-battle-button)
function addStartButtonEventListeners() {
  const startButton = document.getElementById("start-live-battle-button");
  if (!startButton) {
    return;
  }
  startButton.onclick = () => {
    startLiveBattle();
  };
}

// Function to add event listener for the livebattle submit button in timer bar
function addLivebattleSubmitButtonEventListener() {
  const submitBtn = document.getElementById("livebattle-submit-btn");
  if (!submitBtn) return;

  submitBtn.onclick = () => {
    // Disable the button to prevent double clicks
    submitBtn.disabled = true;
    // Send the answer
    sendAnswer();
  };
}

// Function to update submit button state based on selected options
function updateSubmitButtonState() {
  const submitBtn = document.getElementById("livebattle-submit-btn");
  if (!submitBtn) return;

  // Check if any option is selected in the current quiz (excluding omit option)
  const currentQuizEl = document.getElementById(`quiz-${currentQuizId}`);
  if (!currentQuizEl) return;

  const selectedOption = currentQuizEl.querySelector('input[name^="chosenOpts"]:checked:not([value="0"])');
  submitBtn.disabled = !selectedOption;
}

// Function to add event listener for quiz send answer button (id=quiz-send-answer-button)
function addQuizSendAnswerButtonEventListeners() {
  // Get all quiz send answer buttons
  const quizSendAnswerButtons = document.querySelectorAll(".quiz-send-answer-button");
  if (!quizSendAnswerButtons) {
    return;
  }
  // Add event listener to all quiz send answer buttons
  quizSendAnswerButtons.forEach((quizSendAnswerButton) => {
    quizSendAnswerButton.onclick = () => {
      // Disable the button to prevent double clicks
      quizSendAnswerButton.disabled = true;
      // Hide the quiz send answer button
      quizSendAnswerButton.classList.add("is-hidden");
      // Send the answer
      sendAnswer();
    };
  });
}

// Function to add event listeners to the join as player button (id=join-as-player-button)
function addJoinAsPlayerButtonEventListeners() {
  const joinAsPlayerButton = document.getElementById("join-as-player-button");
  const joinAsPlayerButtonIcon = document.getElementById("join-as-player-button-icon");
  if (!joinAsPlayerButton) {
    return;
  }
  joinAsPlayerButton.onclick = () => {
    // Get the hostIsPlayer data from button
    const hostIsPlayer = joinAsPlayerButton.getAttribute("data-host-is-player");
    let newHostIsPlayerValue = "true";
    if (hostIsPlayer === "true") {
      newHostIsPlayerValue = "false";
    }

    // Send a get request to unjoin as player
    fetch("/livebattle/" + liveBattleId + "?pn=" + playername + "&hip=" + newHostIsPlayerValue, {
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          // Throw an error
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Check if data.success is true
        if (data.success) {
          // Set hostIsPlayer to new value
          joinAsPlayerButton.setAttribute("data-host-is-player", newHostIsPlayerValue);
          // Show SweetAlert
          if (newHostIsPlayerValue === "true") {
            showSweetAlert("You joined as player.", "success");
            // Change icon innnerHTML to <i class="fas fa-toggle-on"></i>
            joinAsPlayerButtonIcon.innerHTML = `<i class="fas fa-toggle-on"></i>`;
          } else {
            showSweetAlert("You unjoined as player.", "success");
            // Change icon innnerHTML to <i class="fas fa-toggle-off"></i>
            joinAsPlayerButtonIcon.innerHTML = `<i class="fas fa-toggle-off"></i>`;
          }
          // Update the live battle status
          updateLiveBattleStatus();
        } else {
          // Throw an error
          throw new Error("Network response was not ok");
        }
      })
      .catch((error) => {
        // Print the error
        // console.error(error);
        // Show SweetAlert
        showSweetAlert("There was an error joining as player.", "error");
      });
  };
}

// Function to add all live battle event listeners
async function initializeLiveBattle() {
  // Mark as initialized immediately to prevent double-initialization
  isLiveBattleInitialized = true;

  addStartButtonEventListeners(); // Add event listeners to the start button
  addJoinAsPlayerButtonEventListeners(); // Add event listeners to the join as player button
  addQuizSendAnswerButtonEventListeners(); // Add event listeners to the quiz send answer button
  addLivebattleSubmitButtonEventListener(); // Add event listener to the livebattle submit button

  // Change the url to the live battle url
  const liveBattleUrl = '/livebattle/' + liveBattleId;
  window.history.replaceState(null, null, liveBattleUrl);

  // Set nLiveBattleStatusChecks to 0
  nLiveBattleStatusChecks = 0;

  // Debug: log the current playername
  console.log("[LiveBattle] initializeLiveBattle called with playername: '" + playername + "'");

  // If the playername is "", show the modal to join
  if (playername === "") {
    await wait(1000);
    console.log("Playername is empty, showing join modal.");
    // Open the modal live battle modal
    const modalLiveBattle = document.getElementById("modal-livebattle");
    const liveBattleIdInput = document.getElementById("liveBattleId-input");
    const playernameInput = document.getElementById("playername-input");
    // Change the input value to current live battle id
    liveBattleIdInput.value = liveBattleId;
    // Clear live battle name input
    playernameInput.value = "";
    // Open the modal
    modalLiveBattle.classList.add("is-active");
    // Put the cursor on the live battle name input
    playernameInput.focus();
    return;
  } else {
    // Wait for 3 seconds
    await wait(3000);

    // Start interval to check live battle status
    startInterval(updateLiveBattleStatus, 5000, updateLiveBattleStatusIntervalKey);
  }
}

// Initialize the live battle if it isn't already initialized
if (typeof isLiveBattleInitialized === 'undefined' || !isLiveBattleInitialized) {
  initializeLiveBattle();
}
