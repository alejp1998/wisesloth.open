// Function to check if the topic is valid
function isValidTopic(topic) {
  // Check if the topic consists of lowercase letters or numbers and hyphens
  const regex = /^[a-z0-9-]+$/;
  const hasValidChars = regex.test(topic);
  // Check if it has hyphens
  const hasHyphens = topic.split("-").length > 1;

  return (
    hasValidChars &&
    hasHyphens &&
    !topic.startsWith("-") &&
    !topic.endsWith("-")
  );
}

// Open a test edit modal window
function openEditTestModal(testToEdit) {
  // Get the modal element
  const modalEditTest = document.getElementById("modal-edit-test");
  const modalTestDiv = modalEditTest.querySelector(".modalTest");

  // Get the input fields
  const modalTestName = document.getElementById("modalTestName");
  const modalTestTopic = document.getElementById("modalTestTopic");
  const modalTestDesc = document.getElementById("modalTestDesc");

  // Get the radio buttons
  const hideAnswersRadios = document.querySelectorAll(
    'input[name="hideAnswers"]'
  );
  const visibilityRadios = document.querySelectorAll(
    'input[name="visibility"]'
  );

  // Set the input field values
  modalEditTest.dataset.testId = testToEdit.id;
  modalTestDiv.id = "test-" + testToEdit.id;
  modalTestName.value = testToEdit.name;
  modalTestTopic.value = testToEdit.topic;
  modalTestDesc.value = testToEdit.desc;

  // Set the radio button values
  for (const radio of hideAnswersRadios) {
    if (
      (testToEdit.hideAnswers && radio.value === "true") ||
      (!testToEdit.hideAnswers && radio.value === "false")
    ) {
      radio.checked = true;
    }
  }
  for (const radio of visibilityRadios) {
    if (radio.value === testToEdit.visibility) {
      radio.checked = true;
    }
  }

  // Open the modal
  modalEditTest.classList.add("is-active");
}

// Edit test
async function editTest() {
  const modalEditTest = document.getElementById("modal-edit-test");
  const testId = modalEditTest.dataset.testId;

  // Get the name value and ensure it is not empty
  const modalTestNameValue = document.getElementById("modalTestName").value;
  const nameValue = modalTestNameValue.trim();
  if (nameValue === "") {
    modalAlert("Please enter a test name.", "danger");
    return;
  }

  // Get the topic value and ensure the topicValue is empty or doesn't follow the rule
  const modalTestTopicValue = document.getElementById("modalTestTopic").value;
  // Replace all / by - and trim the topic value
  let topicValue = modalTestTopicValue.trim().split("/").join("-");
  // Remove first character of the topic value if it is - or /
  if (topicValue.startsWith("-") || topicValue.startsWith("/")) topicValue = topicValue.slice(1);
  if (topicValue === "" || !isValidTopic(topicValue)) {
    modalAlert(
      "Please enter a lowercase /-separated test topic. Example: physics/kinematics", "danger"
    );
    return;
  }

  // Get the question value and ensure it is not empty
  const descValue = document.getElementById("modalTestDesc").value.trim();
  if (descValue === "") {
    modalAlert("Please enter a test description.", "danger");
    return;
  }

  // Get the hideAnswers and visibility selected values (from select input)
  const hideAnswersRadios = document.querySelectorAll(
    'input[name="hideAnswers"]'
  );
  const visibilityRadios = document.querySelectorAll(
    'input[name="visibility"]'
  );

  let hideAnswers = null;
  for (const radio of hideAnswersRadios) {
    if (radio.checked) {
      hideAnswers = radio.value === "true" ? true : false;
      break;
    }
  }

  let visibility = null;
  for (const radio of visibilityRadios) {
    if (radio.checked) {
      visibility = radio.value;
      break;
    }
  }

  // Save changes to DB by sending data to backend as API request
  const response = await fetch("/api/tests/update-details", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: testId,
      name: nameValue,
      topic: topicValue,
      desc: descValue,
      hideAnswers: hideAnswers,
      visibility: visibility,
    }),
  });

  if (!response.ok) {
    modalAlert("There was an error saving your changes. Please try again.");
    return;
  }

  // Unpack the response and check if the test was updated successfully
  const data = await response.json();
  if (!data.success) {
    modalAlert(data.error);
    return;
  }

  // Update the test object
  const testEdited = {
    id: testId,
    name: nameValue,
    topic: topicValue,
    desc: descValue,
    hideAnswers: hideAnswers,
    visibility: visibility,
  };

  // Update the test HTML
  updateTestHTML(testEdited);

  // Close the modal
  closeModal(modalEditTest);
}

// Update the HTML content of the test
function updateTestHTML(testEdited) {
  // Get the test card element
  const testCard = document.getElementById('card-test-' + testEdited.id);

  // Update the test name, topic and description
  const testNameEl = testCard.querySelector(".test-name");
  const testTopicEl = testCard.querySelector(".test-topic");
  const testTopicWordsEl = testCard.querySelector(".test-topic-words");
  const testDescEl = testCard.querySelector(".test-desc");
  const testHideAnswersIcon = testCard.querySelector(".hide-answers-icon");
  const testVisibilityIcon = testCard.querySelector(".visibility-icon");

  // Update the test name, topic and description
  const newTestTopic = testEdited.topic.split("-").join("/");
  testNameEl.innerHTML = testEdited.name;
  testDescEl.innerHTML = testEdited.desc;
  testTopicEl.innerHTML = newTestTopic;

  // Update topic words
  let testTopicWordsInnerHTML = `<span class="icon" style="color: var(--bulma-link);"><i class="fas fa-folder-open fa-xs"></i></span>`;
  let topicWords = newTestTopic.split("/");
  for (let i = 0; i < topicWords.length; i++) {
    testTopicWordsInnerHTML += `<b class="test-topic-${i} is-size-6 is-clickable select-topic-button" data-topic="${topicWords.slice(0, i + 1).join("-")}">${topicWords[i]}</b>`;
    if (i < topicWords.length - 1) {
      testTopicWordsInnerHTML += `<span class="icon is-small" style="color: var(--bulma-link);">/</span>`;
    }
  }
  // Update the innerHTML of the topic words
  testTopicWordsEl.innerHTML = testTopicWordsInnerHTML;

  // Add onclick event to each topic word
  testTopicWordsEl.querySelectorAll(".select-topic-button").forEach((topicWord) => {
    topicWord.onclick = function () {
      const topic = topicWord.dataset.topic;
      // Fetch the body content
      fetchBodyContent(`/tests?topic=${topic}`);
    };
  });

  // Update the data in the open-edit-test-modal-button
  const openEditTestModalButton = testCard.querySelector(".open-edit-test-modal-button");
  openEditTestModalButton.dataset.testHideAnswers = testEdited.hideAnswers;
  openEditTestModalButton.dataset.testVisibility = testEdited.visibility;

  // Update the test hide answers and visibility icons
  testHideAnswersIcon.classList.remove("has-text-link", "has-text-danger");
  testVisibilityIcon.classList.remove(
    "has-text-success",
    "has-text-danger",
    "has-text-warning"
  );
  if (testEdited.hideAnswers) {
    testHideAnswersIcon.classList.add("has-text-danger");
    testHideAnswersIcon.title = "Answers are hidden";
    testHideAnswersIcon.innerHTML = '<i class="fas fa-eye-slash">';
  } else {
    testHideAnswersIcon.classList.add("has-text-link");
    testHideAnswersIcon.title = "Answers are visible";
    testHideAnswersIcon.innerHTML = '<i class="fas fa-eye">';
  }

  if (testEdited.visibility === "public") {
    testVisibilityIcon.classList.add("has-text-success");
    testVisibilityIcon.title = "Public test";
    testVisibilityIcon.innerHTML = "<i class='fas fa-globe-europe'></i>";
  } else if (testEdited.visibility === "private") {
    testVisibilityIcon.classList.add("has-text-danger");
    testVisibilityIcon.title = "Private test";
    testVisibilityIcon.innerHTML = "<i class='fas fa-lock'></i>";
  } else {
    testVisibilityIcon.classList.add("has-text-warning");
    testVisibilityIcon.title = "Followers-only test";
    testVisibilityIcon.innerHTML = "<i class='fas fa-users'></i>";
  }
}

// Function to add event listeners for the edit test modal
function addOpenModalEditTestButtonListeners() {
  // Add event listener for the edit test buttons
  document.getElementById("modal-edit-test-button").onclick = editTest;
  // document.querySelector(".context-edit-button").onclick = openEditTestContextModal;
  document.querySelectorAll(".open-edit-test-modal-button").forEach((button) => {
    button.onclick = function () {
      // Find the parent element of class card
      const card = button.closest(".card");
      // Get the test data (remove any html tags from the innerHTML)
      const testToEdit = {
        id: button.dataset.testId,
        name: card.querySelector(".test-name").innerHTML.replace(/<[^>]*>/g, ""),
        topic: card.querySelector(".test-topic").innerHTML.replace(/<[^>]*>/g, "").split("-").join("/"),
        desc: card.querySelector(".test-desc").innerHTML.replace(/<[^>]*>/g, ""),
        hideAnswers: button.dataset.testHideAnswers === "true" ? true : false,
        visibility: button.dataset.testVisibility,
      };
      openEditTestModal(testToEdit);
    };
  });
}
