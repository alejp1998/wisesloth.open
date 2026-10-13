/**
 * Configure marked.js for safe rendering with MathJax support
 * Renders Markdown while preserving math expressions for MathJax
 */
const markedOptions = {
  breaks: false,       // Don't convert \n to <br>
  gfm: true,          // GitHub flavored markdown
};

/**
 * Render Markdown content to HTML, preserving MathJax expressions
 * @param {string} text - The text to render
 * @returns {string} - HTML string with rendered Markdown
 */
function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return text;
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    return text.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character]));
  }

  // Auto-wrap bare LaTeX that lacks $ delimiters (e.g. options stored as
  // \text{H}_2\text{O} instead of $\text{H}_2\text{O}$). Some AI-generated
  // quizzes stored LaTeX commands without dollar signs, so MathJax never
  // typeset them and marked's escape handling mangled the \_ subscripts.
  // Detect common LaTeX commands and wrap the whole expression so MathJax
  // renders it (same pattern as the >25 escape below — defensive).
  if (!text.includes('$') && !text.includes('\\(')) {
    const LATEX_CMD = /\\(?:text|frac|sqrt|mathrm|mathbf|mathit|textrm|ce|chem|times|cdot|rightarrow|leftarrow|approx|le|ge|neq|ne|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|sum|int|infty|pm|mp|div|circ|degree|quad|qquad|operatorname)[a-zA-Z]*(\{| |$)/;
    const LATEX_SUBSUP = /[A-Za-z0-9\)\]\}\]]_\{[A-Za-z0-9\-]+\}|[A-Za-z0-9\)\]\}\]]\^\{[A-Za-z0-9\-]+\}/;
    if (LATEX_CMD.test(text) || LATEX_SUBSUP.test(text)) {
      text = '$' + text.trim() + '$';
    }
  }

  // Preserve MathJax expressions by temporarily replacing them
  const mathExpressions = [];

  // Preserve display math ($$...$$)
  let processed = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    mathExpressions.push(match);
    return `@@MATH_DISPLAY_${mathExpressions.length - 1}@@`;
  });

  // Preserve inline math ($...$)
  processed = processed.replace(/\$([^\$]+?)\$/g, (match) => {
    mathExpressions.push(match);
    return `@@MATH_INLINE_${mathExpressions.length - 1}@@`;
  });

  // Normalize literal "\n" (backslash + n) sequences to real line breaks.
  // Some AI generations double-escaped newlines and stored the 2-char "\n"
  // Math is placeholder-protected here, so $...$ content
  // (e.g. \nu, \nabla, \neq) is never touched.
  processed = processed.replace(/\\n/g, "\n");

  // Escape leading numbers followed by period to prevent ordered list interpretation
  // e.g., "22. Question" should not become an <ol><li>
  processed = processed.replace(/^(\d+)\. /, '$1\\. ');

  // Escape leading ">" not followed by a space: quiz options like ">25 cells"
  // mean "greater than 25", not a Markdown blockquote. Marked only treats
  // "> text" (with space) as a quote; ">25" should stay literal.
  processed = processed.replace(/^>([^\s>])/gm, '\\>$1');

  // Configure and render Markdown
  marked.setOptions(markedOptions);
  let html = marked.parse(processed);

  // Restore math expressions
  mathExpressions.forEach((expr, i) => {
    html = html.replace(`@@MATH_DISPLAY_${i}@@`, expr);
    html = html.replace(`@@MATH_INLINE_${i}@@`, expr);
  });

  // Clean up: Remove wrapping <p> tags for inline content
  html = html.replace(/^<p>([\s\S]*)<\/p>\n?$/, '$1');

  return DOMPurify.sanitize(html);
}

/**
 * Render Markdown in all quiz elements on the page
 * Call this after dynamic content is loaded
 */
function renderQuizMarkdown() {
  if (typeof marked === 'undefined') return;

  // Render markdown in quiz question text (not the number)
  document.querySelectorAll('.quiz-question-text').forEach(el => {
    if (!el.dataset.markdownRendered) {
      el.innerHTML = renderMarkdown(el.textContent);
      el.dataset.markdownRendered = 'true';
    }
  });

  // Render markdown in quiz options (the text after the letter)
  document.querySelectorAll('.quiz-option').forEach(el => {
    // Get the option text span if it exists, otherwise the text after the bold letter
    const optionText = el.querySelector('.option-text');
    if (optionText && !optionText.dataset.markdownRendered) {
      optionText.innerHTML = renderMarkdown(optionText.textContent);
      optionText.dataset.markdownRendered = 'true';
    }
  });

  // Render markdown in quiz explanations
  document.querySelectorAll('.quiz-explanation span').forEach(el => {
    if (!el.dataset.markdownRendered) {
      el.innerHTML = renderMarkdown(el.textContent);
      el.dataset.markdownRendered = 'true';
    }
  });

  // Trigger MathJax to re-render after Markdown processing
  if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
    MathJax.typesetPromise().catch((err) => console.warn('MathJax typeset error:', err));
  }
}

/**
 * Setup polling to repeatedly check for unrendered markdown content
 * This ensures markdown is rendered even if content loads asynchronously
 */
let markdownPollingInterval = null;
function setupQuizMarkdownPolling() {
  if (typeof marked === 'undefined') return;

  let pollCount = 0;
  const maxPolls = 20; // Poll for up to 4 seconds (20 * 200ms)

  // Clear any existing polling
  if (markdownPollingInterval) {
    clearInterval(markdownPollingInterval);
  }

  markdownPollingInterval = setInterval(() => {
    pollCount++;

    // Check if there's any unrendered markdown content
    const unrenderedElements = document.querySelectorAll(
      '.quiz-question-text:not([data-markdown-rendered]), ' +
      '.quiz-option .option-text:not([data-markdown-rendered]), ' +
      '.quiz-explanation span:not([data-markdown-rendered])'
    );

    if (unrenderedElements.length > 0) {
      console.log(`Found ${unrenderedElements.length} unrendered markdown elements, rendering...`);
      renderQuizMarkdown();
    }

    // Stop polling after max attempts or if no unrendered content
    if (pollCount >= maxPolls || unrenderedElements.length === 0) {
      clearInterval(markdownPollingInterval);
      markdownPollingInterval = null;
    }
  }, 200); // Check every 200ms
}

/* ------------------------------------------ */
/* -------------- INTERVALS JS -------------- */
/* ------------------------------------------ */

const namedIntervals = {};

// Function to start an interval with an optional name
function startInterval(callback, delay, name = null) {
  // Clear any existing interval with the same name
  clearIntervalByKey(name);

  // Start the interval
  const intervalId = setInterval(callback, delay);

  // Use the provided name as the key or fall back to the interval ID
  const key = name || intervalId;
  namedIntervals[key] = intervalId;
  return key; // Return the key used to store the interval
}

// Function to clear an interval by its name or ID
function clearIntervalByKey(key) {
  if (namedIntervals[key]) {
    clearInterval(namedIntervals[key]);
    delete namedIntervals[key];
  }
}

// Function to clear all intervals
function clearAllIntervals() {
  for (const key in namedIntervals) {
    clearInterval(namedIntervals[key]);
  }
  // Clear the object after all intervals are stopped
  for (const key in namedIntervals) {
    delete namedIntervals[key];
  }
}

// Clear all intervals
// clearAllIntervals();

/* ------------------------------------------ */
/* ----------- TEST EDIT MODAL JS ----------- */
/* ------------------------------------------ */

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

  // Configure the "Edit with AI" box for this test (not available for personality
  // tests) and reset any leftover state from a previous time the modal was opened
  const aiBox = document.getElementById("modal-edit-test-ai-box");
  if (aiBox) {
    aiBox.dataset.testId = testToEdit.id;
    aiBox.dataset.testType = testToEdit.type || "";
    aiBox.classList.toggle("is-hidden", testToEdit.type === "personality");
    if (typeof resetGeneralAiEditBox === "function") resetGeneralAiEditBox(aiBox);
  }

  // Open the modal
  openModal(modalEditTest);
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
    // Get response status and error message from the response
    const data = await response.json();
    modalAlert("There was an error saving your changes. " + response.status + ": " + data.error);
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
      // Get the test id from the button dataset
      const testId = button.dataset.testId;
      // Find the parent element of class card
      let card = button.closest(".card");
      // If the card is not found, find the element with id card-test-{testId}
      if (!card) {
        card = document.getElementById("card-test-" + testId);
      }
      // Get the test data (remove any html tags from the innerHTML)
      const testToEdit = {
        id: button.dataset.testId,
        type: button.dataset.testType,
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


/* ------------------------------------------ */
/* --------- NAVBAR SEARCH TESTS ------------ */
/* ------------------------------------------ */

// Function to hide the search input navbar container
function hideSearchInputNavbarContainer() {
  const searchInputNavbarContainer = document.getElementById("search-input-navbar-container");
  if (!searchInputNavbarContainer) return;
  searchInputNavbarContainer.style.display = "none";
}

// Function to show the search input navbar container
function showSearchInputNavbarContainer() {
  const searchInputNavbarContainer = document.getElementById("search-input-navbar-container");
  if (!searchInputNavbarContainer) return;
  // Hide it on /tests since that page already has its own inline search bar
  if (window.location.pathname === "/tests") {
    hideSearchInputNavbarContainer();
    return;
  }
  // Use "flex" (not "block") so it stays vertically centered via the .nav__search flex layout
  searchInputNavbarContainer.style.display = "flex";
}

if (document.getElementById("search-input-navbar-container")) {
  // Function to search tests
  function searchTestsFromNavbar() {
    // Get the search input value
    const searchInputValue = document.getElementById("search-input-navbar").value;
    // Fetch the tests index content
    const skipConfirmation = !((window.location.href.includes("/try") || window.location.href.includes("/edit")) && unsavedChanges);
    fetchBodyContent("/tests?search=" + searchInputValue, skipConfirmation);
  }

  // Trigger the searchTestsFromNavbar function when the search button is clicked
  document.getElementById("search-button-navbar").addEventListener("click", searchTestsFromNavbar);

  // Trigger the searchTestsFromNavbar function when the Enter key is pressed
  document.getElementById("search-input-navbar").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      searchTestsFromNavbar();
    }
  });

  // Add event listener for changing the search input value when the user stops typing
  document.getElementById("search-input-navbar").addEventListener("input", function() {
    clearTimeout(this.timeout);
    // Set a timeout to search tests 800ms after the user stops typing
    this.timeout = setTimeout(() => searchTestsFromNavbar(), 800);
  });
}

/* ------------------------------------------ */
/* ----------- LAZY LOAD IMAGES ------------- */
/* ------------------------------------------ */

// Lazy load images function
function lazyLoadImages() {
  // Get all images with class "lazy"
  const lazyImages = document.querySelectorAll("img.lazy");
  // Check if IntersectionObserver is supported
  if ("IntersectionObserver" in window) {
    // Create a new IntersectionObserver
    let lazyImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Get the image element
          const lazyImage = entry.target;
          // Set the src attribute to load the image
          lazyImage.src = lazyImage.dataset.src;
          // Set the srcset attribute to load the image
          lazyImage.srcset = lazyImage.dataset.srcset;
          // Remove the "lazy" class
          lazyImage.classList.remove("lazy");
          // Unobserve the image
          lazyImageObserver.unobserve(lazyImage);
        }
      });
    });

    // Observe all lazy images
    lazyImages.forEach((lazyImage) => {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    // Fallback for older browsers
    lazyImages.forEach((lazyImage) => {
      lazyImage.src = lazyImage.dataset.src;
      lazyImage.srcset = lazyImage.dataset.srcset;
      lazyImage.classList.remove("lazy");
    });
  }
}

// Lazy load images
// lazyLoadImages();

/* ------------------------------------------ */
/* ----------- IS-CLICKABLE HREFs ----------- */
/* ------------------------------------------ */

function addIsClickableEventListeners() {
  // Get all elements with class "is-clickable"
  const isClickableEls = document.querySelectorAll(".is-clickable");

  // Add event listeners to all elements with class "is-clickable"
  isClickableEls.forEach((el) => {
    // Check if the element has a data-href attribute
    if (!el.hasAttribute("data-href")) {
      return;
    }

    // Add a click event listener to the element only if it has a data-href attribute
    el.onclick = (() => {
      // Get the data-href attribute value
      const href = el.getAttribute("data-href");
      // Redirect to the href value
      window.location.href = href;
    });
  });
}

/* ------------------------------------------------- */
/* ----------- TEMPORARY ACCOUNT BANNER ------------ */
/* ------------------------------------------------- */



/* ----------------------------------------- */
/* ----------- BULMA HELPERS --------------- */
/* ----------------------------------------- */

// Select the burger icon and the corresponding navigation menu.
// Deferred to DOMContentLoaded (instead of running at script-parse time) so this
// never races with the navbar HTML actually being present in the DOM.
var burger;
var navbarMenu;
document.addEventListener("DOMContentLoaded", () => {
  burger = document.querySelector(".nav-burger");
  navbarMenu = document.querySelector(".nav-menu");
  if (burger && navbarMenu) {
    // Open/close the mobile menu (full-screen overlay) and lock body scroll while open
    const setMenuOpen = (open) => {
      burger.classList.toggle("is-active", open);
      navbarMenu.classList.toggle("is-active", open);
      document.documentElement.style.overflow = open ? "hidden" : "";
      document.body.style.overflow = open ? "hidden" : "";
    };
    // Toggle on burger click
    burger.onclick = () => setMenuOpen(!navbarMenu.classList.contains("is-active"));
    // Close after tapping any item/link/button inside the menu
    navbarMenu.addEventListener("click", (e) => {
      const target = e.target;
      // Never close on the Google sign-in control: closing the menu sets
      // display:none on this subtree, which tears down the GSI iframe and
      // aborts the sign-in request it just started.
      if (target && target.closest && target.closest(".nav__google-wrap")) return;
      const trigger = target && target.closest ? target.closest("a, button, .open-modal-livebattle-button") : null;
      if (trigger) setMenuOpen(false);
    });
    // Close with the Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    });
  }
}, { once: true });

// Delete button for notifications and messages
function addDeleteNotificationOrMessageEventListeners() {
  // Remove existing listeners first to prevent duplicates
  document.querySelectorAll(".notification .delete").forEach($delete => {
    $delete.replaceWith($delete.cloneNode(true));
  });
  document.querySelectorAll(".message-header .delete").forEach($delete => {
    $delete.replaceWith($delete.cloneNode(true));
  });

  // Iterate over all elements with class 'notification' and their 'delete' buttons
  (document.querySelectorAll(".notification .delete") || []).forEach(
    ($delete) => {
      // Get the parent notification element
      const $notification = $delete.parentNode;

      // Add a click event listener to the 'delete' button
      $delete.onclick = () => {
        // Store notification dismissal in sessionStorage
        const notificationId = $notification.id || generateNotificationId($notification);
        const dismissedNotifications = JSON.parse(sessionStorage.getItem('dismissedNotifications') || '[]');
        if (!dismissedNotifications.includes(notificationId)) {
          dismissedNotifications.push(notificationId);
          sessionStorage.setItem('dismissedNotifications', JSON.stringify(dismissedNotifications));
        }

        // Remove the entire notification element when the 'delete' button is clicked
        $notification.parentNode.removeChild($notification);
      };
    }
  );
  // Iterate over all elements with class 'message-header' and their 'delete' buttons
  (document.querySelectorAll(".message-header .delete") || []).forEach(
    ($delete) => {
      // Get the parent message element
      const $message = $delete.parentNode.parentNode;

      // Add a click event listener to the 'delete' button
      $delete.onclick = () => {
        // Remove the entire message element when the 'delete' button is clicked
        $message.parentNode.removeChild($message);
      };
    }
  );
}

// Generate a unique ID for notifications that don't have one
function generateNotificationId($notification) {
  // Try to use class-based ID first for more stability
  const classes = $notification.className.replace(/\s+/g, '-');

  // Look for unique text content that doesn't change with language
  const textElements = $notification.querySelectorAll('p, span:not([lang])');
  let stableText = '';

  for (let element of textElements) {
    const text = element.textContent.trim();
    if (text && !text.match(/^(Create|Crea|Quiz|Test|AI|IA)$/)) {
      stableText = text.substring(0, 30);
      break;
    }
  }

  // Fallback to position if no stable text found
  if (!stableText) {
    const allNotifications = document.querySelectorAll('.notification');
    stableText = 'pos-' + Array.from(allNotifications).indexOf($notification);
  }

  // Create a simple hash
  let hash = 0;
  const str = classes + stableText;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return 'notification_' + Math.abs(hash).toString(36);
}

// Show notifications that weren't dismissed in this session with smooth animation
function showSessionAllowedNotifications() {
  const dismissedNotifications = JSON.parse(sessionStorage.getItem('dismissedNotifications') || '[]');

  document.querySelectorAll('.notification').forEach(($notification) => {
    const notificationId = $notification.id || generateNotificationId($notification);

    // Check if this notification was dismissed in this session
    if (dismissedNotifications.includes(notificationId)) {
      // Keep it hidden (it already has display: none from CSS)
      $notification.style.display = 'none';
      $notification.classList.remove('notification-show');
      return;
    }

    // If not dismissed and not already shown
    if (!$notification.classList.contains('notification-show')) {
      // Show the notification with smooth animation
      $notification.style.display = 'block';
      setTimeout(() => {
        $notification.classList.add('notification-show');
      }, Math.random() * 200); // Random delay up to 200ms for natural feel
    }
  });
}

// Make the function globally available for AJAX calls
window.showSessionAllowedNotifications = showSessionAllowedNotifications;

// Add event listeners to all delete buttons for notifications and messages
// addDeleteNotificationOrMessageEventListeners();

/* ------------------------------------------------------ */
/* ------ TEXTAREA AUTO RESIZE + CHARACTER COUNTER ------ */
/* ------------------------------------------------------ */

// Function to auto resize textareas and add a character counter
function addTextareaAutoResizeAndCounter() {
  // Get all textareas
  const textareas = document.querySelectorAll(".textarea");

  // Add a counter to all textareas
  textareas.forEach((textarea) => {
    const counter = document.createElement("div");
    counter.classList.add("textarea-counter");
    textarea.insertAdjacentElement("afterend", counter);
  });

  // Function to auto resize textarea
  function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  // Function to count characters in textarea
  function countCharacters(textarea) {
    const counter = textarea.parentElement.querySelector(".textarea-counter");
    const maxLength = textarea.maxLength;
    const currentLength = textarea.value.length;

    // Reset classes
    counter.classList.remove("warning", "danger");

    if (maxLength !== -1) {
      const percentage = (currentLength / maxLength) * 100;

      if (currentLength > maxLength) {
        counter.classList.add("danger");
      } else if (percentage >= 90) {
        counter.classList.add("warning");
      }

      counter.textContent = `${currentLength}/${maxLength}`;
    } else {
      counter.textContent = currentLength;
    }
  }

  // Add event listeners to all textareas
  textareas.forEach((textarea) => {
    textarea.addEventListener("input", () => {
      autoResizeTextarea(textarea);
      countCharacters(textarea);
    });
  });
}

// Add textarea auto resize and character counter
// addTextareaAutoResizeAndCounter();

/* ------------------------------------ */
/* ----------- HANDLE TABS ------------ */
/* ------------------------------------ */

// Handle tabs
function showTabContent(tabToggleId, tabContentId) {
  // Get tab toggle
  const tabToggle = document.getElementById(tabToggleId);

  // Deactivate all sibling tab toggles
  const tabToggles = tabToggle.parentElement.children;
  for (let i = 0; i < tabToggles.length; i++) {
    tabToggles[i].classList.remove("is-active");
  }

  // Activate the selected tab toggle
  tabToggle.classList.add("is-active");

  // Get the tab content
  const tabContent = document.getElementById(tabContentId);

  if(!tabContent) return;

  // Hide all tab content siblings with class = tab-content
  const tabContents = tabContent.parentElement.children;
  for (let i = 0; i < tabContents.length; i++) {
    if (tabContents[i].classList.contains("tab-content")) {
      tabContents[i].classList.add("is-hidden");
    }
  }

  // Show the selected tab content
  tabContent.classList.remove("is-hidden");
}

// Add event listeners to all tab toggles starting with "tab-toggle-"
function addTabToggleEventListeners() {
  // Get all els whose id starts with "tab-toggle-"
  const tabToggles = document.querySelectorAll('[id^="tab-toggle-"]');
  tabToggles.forEach((toggle) => {
    const tabToggleId = toggle.id;
    const tabName = tabToggleId.split("-").slice(2).join("-");
    const tabContentId = "tab-content-" + tabName;
    toggle.onclick = () => showTabContent(tabToggleId, tabContentId);
  });
}

// Add event listeners to all tab toggles
// addTabToggleEventListeners();

/* ------------------------------------------- */
/* ----------- PREVIEW IMAGE MODAL ----------- */
/* ------------------------------------------- */

// Open the modal
function addPreviewImagesEventListeners() {
  const previewImages = document.querySelectorAll(".preview-image");
  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  previewImages.forEach(image => {
    image.addEventListener('click', () => {
      modal.classList.add('is-active');
      modalImage.src = image.src;
    });
  });
}

// Add preview images event listeners
// addPreviewImagesEventListeners();

/* ------------------------------------------ */
/* ----------- SCROLL TO QUIZ --------------- */
/* ------------------------------------------ */

// JavaScript to handle scrolling to the clicked question
function scrollToQuiz(quizLink,quizId) {
  const quizEl = document.getElementById(`quiz-${quizId}`);
  // Scroll to the quiz element
  if (quizEl) {
    quizEl.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
  }
  // Scroll to the quiz link when scrolling to the quiz element is done
  if (quizLink) {
    // Wait for the scroll to finish
    setTimeout(() => {
      quizLink.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    }, 1000);
  }
}

// Add event listeners to all quiz links
function addScrollToQuizEventListeners() {
  const buttons = document.querySelectorAll(".scroll-to-quiz-button");
  buttons.forEach((button) => {
    const quizId = button.dataset.quizId;
    button.onclick = () => {
      scrollToQuiz(button,quizId);
    };
  });
}

// Add event listeners to all quiz links
// addScrollToQuizEventListeners();

/* ---------------------------------------------------- */
/* ----------- SHOW HIDDEN CARD CONTENT --------------- */
/* ---------------------------------------------------- */

// Add event listeners to all card hide buttons
function addCardHideEventListeners() {
  // Get all els whose id starts with "card-hide-button-"
  const cardHideButtons = document.querySelectorAll('[id^="card-hide-button-"]');
  cardHideButtons.forEach((button) => {
    const cardId = button.id.split("-").slice(3).join("-");
    button.onclick = () => toggleCardHiddenContent(cardId);
  });
}

// Add event listeners to all card hide buttons
// addCardHideEventListeners();

// Show / hide card descriptions
function toggleCardHiddenContent(cardId) {
  const cardHideButton = document.getElementById("card-hide-button-" + cardId);
  const cardHiddenContent = document.getElementById("card-hidden-" + cardId);
  if (cardHiddenContent.classList.contains("is-hidden")) {
    cardHideButton.innerHTML =
      '<i class="fas fa-angle-up" aria-hidden="false"></i>';
    cardHiddenContent.classList.remove("is-hidden");
  } else {
    cardHideButton.innerHTML =
      '<i class="fas fa-angle-down" aria-hidden="true"></i>';
    cardHiddenContent.classList.add("is-hidden");
  }
}

/* -------------------------------------- */
/* ----------- SHARE ITEMS -------------- */
/* -------------------------------------- */

// Share a user
function shareUser(username) {
  const userShowUrl = window.location.origin + "/users/" + username;
  // Modify the message depending on language
  if (localLang === "en") {
    var message = "Check out this profile in WiseSloth.open! - " + username;
  } else if (localLang === "es") {
    var message = "¡Mira este perfil en WiseSloth.open! - " + username;
  }
  // Share user with Web Share API (modern browsers only)
  if (navigator.share) {
    navigator
      .share({
        title: "User: " + username,
        text: message,
        url: userShowUrl,
      })
      .then(() => console.log("User shared successfully"))
      .catch((error) => console.error("Error sharing user:", error));
  } else {
    // Fallback for browsers that don't support the Web Share API
    alert(
      "Sharing is not supported in your browser. You can manually copy and share this link: " +
        userShowUrl
    );
  }
}

// Add event listeners to all share user buttons
function addShareUserEventListeners() {
  const shareUserButtons = document.querySelectorAll('.share-user-button');
  shareUserButtons.forEach((button) => {
    const username = button.dataset.userUsername;
    button.onclick = () => shareUser(username);
  });
}

// Add event listeners to all share user buttons
// addShareUserEventListeners();

// Share a test
function shareTest(testUUID, testName) {
  const testShowUrl = window.location.origin + "/tests/" + testUUID;
  // Modify the message depending on language
  if (localLang === "en") {
    var message = "I challenge you to take this test! - " + testName;
  } else if (localLang === "es") {
    var message = "¡Te reto a hacer este test! - " + testName;
  }
  // Share test with Web Share API (modern browsers only)
  if (navigator.share) {
    navigator
      .share({
        title: testName,
        text: message,
        url: testShowUrl,
      })
      .then(() => console.log("Test shared successfully"))
      .catch((error) => console.error("Error sharing test:", error));
  } else {
    // Fallback for browsers that don't support the Web Share API
    alert(
      "Sharing is not supported in your browser. You can manually copy and share this link: " +
        testShowUrl
    );
  }
}

// Add event listeners to all share test buttons
function addShareTestEventListeners() {
  const shareTestButtons = document.querySelectorAll('.share-test-button');
  shareTestButtons.forEach((button) => {
    const testUUID = button.dataset.testId;
    const testName = button.dataset.testName;
    button.onclick = () => shareTest(testUUID, testName);
  });
}

// Add event listeners to all share test buttons
// addShareTestEventListeners();

// Share a result
function shareResult(resultUUID, testName) {
  const resultShowUrl = window.location.origin + "/results/" + resultUUID;
  // Modify the message depending on language
  if (localLang === "en") {
    var message = "Check out my result at this test! Bet you cannot beat it! - " + testName;
  } else if (localLang === "es") {
    var message = "¡Mira mi resultado en este test! Apuesto a que no puedes superarlo! - " + testName;
  }
  // Share with Web Share API (modern browsers only)
  if (navigator.share) {
    navigator
      .share({
        title: "Result: " + testName,
        text: message,
        url: resultShowUrl,
      })
      .then(() => console.log("Result shared successfully"))
      .catch((error) => console.error("Error sharing result:", error));
  } else {
    // Fallback for browsers that don't support the Web Share API
    alert(
      "Sharing is not supported in your browser. You can manually copy and share this link: " +
        resultShowUrl
    );
  }
}

// Add event listeners to all share result buttons
function addShareResultEventListeners() {
  const shareResultButtons = document.querySelectorAll('.share-result-button');
  shareResultButtons.forEach((button) => {
    const testName = button.dataset.testName;
    const resultUUID = button.dataset.resultId;
    button.onclick = () => shareResult(resultUUID, testName);
  });
}

// Add event listeners to all share result buttons
// addShareResultEventListeners();

/* ---------------------------------------- */
/* ----------- MODAL ALERTS --------------- */
/* ---------------------------------------- */

// Show an alert message on the active modal
function modalAlert(message, type = "info") {
  // Get active modal elements
  const activeModals = document.querySelectorAll(".modal.is-active");

  // Check if there is an active modal with a modal alert inside
  activeModals.forEach((activeModal) => {
    const modalAlert = activeModal.querySelector(".modal-alert");
    if (modalAlert) {
      modalAlert.innerHTML = '<br><p class="is-size-6 has-text-' + type + '">' + message + '</p>';
    }
  });
}

/* ----------------------------------------------- */
/* ----------- SWEET CONFIRM/ALERT --------------- */
/* ----------------------------------------------- */

// Replace window.confirm with a sweet confirmation dialog
async function showSweetConfirm(message) {
  // Assuming SweetAlert2 library is included
  const result = await Swal.fire({
      title: 'Confirm',
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
  });

  return result.isConfirmed;
}

// Replace window.alert with a sweet alert dialog
function showSweetAlert(message, type = "info") {
  let title = "";
  if (type === "error") {
    title = "Error";
  } else if (type === "warning") {
    if (localLang === "en") {
      title = "Warning";
    } else if (localLang === "es") {
      title = "Alerta";
    }
  } else {
    title = "Info";
  }

  // Assuming SweetAlert2 library is included
  Swal.fire({
    title: title,
    text: message,
    icon: type,
    confirmButtonColor: "#3085d6",
    confirmButtonText: "OK",
  });
}


/* ---------------------------------------- */
/* -------- TEMP USER WARNINGS ------------ */
/* ---------------------------------------- */



/* ---------------------------------------- */
/* ----------- DELETE ITEMS --------------- */
/* ---------------------------------------- */

// Delete items
async function deleteItem(itemId, deleteType, deleteMsg) {
  // Show a sweet confirmation dialog
  const isConfirmed = await showSweetConfirm(deleteMsg);

  if (isConfirmed) {
    // Perform the delete action
    const url = `/${deleteType}s/${itemId}`;
    const method = "DELETE";

    // Perform delete action
    fetch(url, { method })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok. " + response.status + ": " + response.error);
        }

        // If the current url is /tests
        if (window.location.pathname === "/tests") {
          // Find the test card with the same testId
          const testCard = document.getElementById(`card-test-${itemId}`);
          // Remove the test card
          testCard.remove();
        } else if (window.location.pathname === "/users") {
          // Find the user card with the same userId
          const userCard = document.getElementById(`card-user-${itemId}`);
          // Remove the user card
          userCard.remove();
        } else if (window.location.pathname === "/results") {
          // Find the result card with the same resultId
          const resultCard = document.getElementById(`card-result-${itemId}`);
          // Remove the result card
          resultCard.remove();
        } else {
          // If current url includes tests
          if (window.location.href.includes("/tests")) {
            // Fetch tests index content
            fetchBodyContent("/tests");
          } else if (window.location.href.includes("/users")) {
            // Fetch users index content
            fetchBodyContent("/");
          } else if (window.location.href.includes("/results")) {
            // Fetch results index content
            fetchBodyContent("/results");
          }
        }

        // Show a success alert
        if (localLang === "en") {
          showSweetAlert(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully.`, "success");
        } else if (localLang === "es") {
          showSweetAlert(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} eliminado correctamente.`, "success");
        }
      })
      .catch((error) => {
        console.error(error);
        if (localLang === "en") {
          showSweetAlert("An error occurred. Please try again.", "error");
        } else if (localLang === "es") {
          showSweetAlert("Ocurrió un error. Por favor, inténtalo de nuevo.", "error");
        }
      });
  }
}

// Add event listeners to all delete buttons
function addDeleteItemEventListeners() {
  const deleteButtons = document.querySelectorAll(".delete-item-button");
  deleteButtons.forEach((button) => {
    const itemId = button.dataset.itemId;
    const deleteType = button.dataset.deleteType;
    let deleteMsg = button.dataset.deleteMsg;
    deleteMsg += " This action cannot be undone.";
    button.onclick = () => deleteItem(itemId, deleteType, deleteMsg);
  });
}

// Add event listeners to all delete buttons
// addDeleteItemEventListeners();

/* ------------------------------------------------- */
/* ----------- FOLLOW / ADD FAVORITE --------------- */
/* ------------------------------------------------- */

// Follow user function
function followUser(button) {
  const username = button.dataset.userUsername;
  const isFollowed = button.dataset.isFollowed === "true"; // Convert string to boolean

  const url = isFollowed
    ? "/api/users/" + username + "/unfollow"
    : "/api/users/" + username + "/follow";
  const method = isFollowed ? "DELETE" : "POST";

  fetch(url, { method })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok. " + response.status + ": " + response.error);
      }
      // Get all follow buttons with the same username
      const followButtons = document.querySelectorAll(`.follow-button[data-user-username="${username}"]`);
      // Update button icons
      if (isFollowed) {
        followButtons.forEach((button) => {
          const icon = button.querySelector("i");
          icon.classList.remove("fa-user-minus");
          icon.classList.add("fa-user-plus");
          icon.style.color = "var(--success-color)";
          button.dataset.isFollowed = "false";
        });
      } else {
        followButtons.forEach((button) => {
          const icon = button.querySelector("i");
          icon.classList.remove("fa-user-plus");
          icon.classList.add("fa-user-minus");
          icon.style.color = "var(--danger-color)";
          button.dataset.isFollowed = "true";
        });
      }
    })
    .catch((error) => {
      console.error(error);
      if (localLang === "en") {
        showSweetAlert("An error occurred trying to follow/unfollow the user.");
      } else if (localLang === "es") {
        showSweetAlert("Ocurrió un error al intentar seguir/dejar de seguir al usuario.");
      }
    });
}

// Add event listeners to all follow buttons
function addFollowButtonEventListeners() {
  const followButtons = document.querySelectorAll(".follow-button");
  followButtons.forEach((button) => {
    button.onclick = () => followUser(button);
  });
}

// Add event listeners to all follow buttons
// addFollowButtonEventListeners();

// Like test button function
function likeTest(button) {
  const testId = button.dataset.testId;
  const isFavorite = button.dataset.isFavorite === "true";

  // Check if user is logged in
  if (!isLoggedIn) {
    if (localLang === "en") {
      showSweetAlert("You must be logged in to favorite a test.", "info");
    } else if (localLang === "es") {
      showSweetAlert("Debes iniciar sesión para marcar un test como favorito.", "info");
    }
    return;
  }

  const url = isFavorite
    ? "/api/tests/" + testId + "/unfavorite"
    : "/api/tests/" + testId + "/favorite";
  const method = isFavorite ? "DELETE" : "POST";

  fetch(url, { method })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok. " + response.status + ": " + response.error);
      }

      // Get all favorite buttons with the same testId
      const favoriteButtons = document.querySelectorAll(`.favorite-button[data-test-id="${testId}"]`);

      if (isFavorite) {
        // Update all favorite buttons with the same testId
        favoriteButtons.forEach((favButton) => {
          favButton.dataset.isFavorite = "false";
          favButton.querySelector(".heart-icon").innerHTML = '<i class="far fa-heart" style="color: red;"></i>';
          // Check if it has a counter icon class and update the counter
          const counterIcon = favButton.querySelector(".counter-icon");
          if (counterIcon) {
            const counterValue = parseInt(counterIcon.textContent);
            if (counterValue > 0) {
              counterIcon.textContent = counterValue - 1;
            } else {
              counterIcon.textContent = 0;
            }
          }
        });
      } else {
        // Update all favorite buttons with the same testId
        favoriteButtons.forEach((favButton) => {
          favButton.dataset.isFavorite = "true";
          favButton.querySelector(".heart-icon").innerHTML = '<i class="fas fa-heart" style="color: red;"></i>';
          // Check if it has a counter icon class and update the counter
          const counterIcon = favButton.querySelector(".counter-icon");
          if (counterIcon) {
            const counterValue = parseInt(counterIcon.textContent);
            if (counterValue > 0) {
              counterIcon.textContent = counterValue + 1;
            } else {
              counterIcon.classList.remove("is-hidden");
              counterIcon.textContent = 1;
            }
          }
        });
      }
    })
    .catch((error) => {
      console.error(error);
      if (localLang === "en") {
        showSweetAlert("An error occurred trying to favorite/unfavorite the test.", "error");
      } else if (localLang === "es") {
        showSweetAlert("Ocurrió un error al intentar marcar/desmarcar el test como favorito.", "error");
      }
    });
}

// Add event listeners to all favorite buttons
function addFavoriteButtonEventListeners() {
  const favoriteButtons = document.querySelectorAll(".favorite-button");
  favoriteButtons.forEach((button) => {
    button.onclick = () => likeTest(button);
  });
}

// Add event listeners to all favorite buttons
// addFavoriteButtonEventListeners();

/* ---------------------------------------- */
/* ----------- SHOW ANSWERS --------------- */
/* ---------------------------------------- */

// Function hide correct answers and get the marked quiz options
var markedQuizOptions = [];
var quizExplanations = [];
function getAndHideMarkedQuizOptions() {
  // Get quiz options and hide marked border if present
  const quizOptions = document.querySelectorAll(".flex-opt");
  markedQuizOptions = [];

  quizOptions.forEach((option) => {
    if (option.classList.contains("marked")) {
      markedQuizOptions.push(option);
    }
    option.classList.remove("marked");
  });

  // Get quiz explanations and hide them (but NOT in edit mode)
  // Edit mode is identified by presence of .is-edit options in the same quiz
  quizExplanations = document.querySelectorAll(".quiz-explanation");
  quizExplanations.forEach((explanation) => {
    // Check if this explanation is inside an edit view (sibling has .is-edit)
    const parent = explanation.closest('.flex-container');
    const isInEditMode = parent && parent.querySelector('.flex-opt-clickable.is-edit');
    if (!isInEditMode) {
      explanation.classList.add("is-hidden");
    }
  });
}

// Function to restore the marked quiz options
function unmarkQuizOptions() {
  // Restore the marked elements
  markedQuizOptions.forEach((element) => {
    element.classList.add("marked");
  });

  // Show the quiz explanations
  quizExplanations.forEach((explanation) => {
    explanation.classList.remove("is-hidden");
  });
}

// Show correct answers
function toggleCorrectAnswers(toggleEl) {
  // Get all switch elements with class "toggle-correct-answers-switch"
  const toggleEls = document.querySelectorAll(".toggle-correct-answers-switch");

  // Toggle the checked class on all switch elements
  toggleEls.forEach((el) => {
    el.classList.toggle("checked");
    // Find inner element with class "icon has-color-link"
    const iconEl = el.querySelector(".icon.has-color-link");
    if (el.classList.contains("checked")) {
      // Change the icon to toggle on
      iconEl.innerHTML = '<i class="fas fa-toggle-on"></i>';
    } else {
      // Change the icon to toggle off
      iconEl.innerHTML = '<i class="fas fa-toggle-off"></i>';
    }
  });

  if (toggleEl.classList.contains("checked")) {
    // Restore the marked elements
    unmarkQuizOptions();
  } else {
    // Save the marked elements
    getAndHideMarkedQuizOptions();
  }
}

// Add event listeners to all toggle correct answer switches
function addToggleCorrectAnswersEventListeners() {
  const toggleCorrectAnswersButtons = document.querySelectorAll(".toggle-correct-answers-switch");
  toggleCorrectAnswersButtons.forEach((button) => {
    button.onclick = () => toggleCorrectAnswers(button);
  });
}

// Add event listeners to all toggle correct answer switches
// addToggleCorrectAnswersEventListeners();

/* ---------------------------------------- */
/* ----------- SORT TABLES ---------------- */
/* ---------------------------------------- */
function addSortTableEventListeners() {
  const tables = document.querySelectorAll('.table');
  if (tables.length > 0) {
    tables.forEach(table => {
      const headers = table.querySelectorAll('th.sortable');
      headers.forEach(header => {
        header.addEventListener('click', () => {
          const headerIcon = header.querySelector('.sort-icon');
          const tableBody = table.querySelector('tbody');
          const rows = Array.from(tableBody.querySelectorAll('tr'));
          const columnIndex = Array.from(header.parentNode.children).indexOf(header);
          let sortOrder = header.classList.contains('descending') ? 'ascending' : 'descending';

          // Give black color to all other headers
          headers.forEach(h => {
            if (h !== header) {
              h.style.color = '';
              h.classList.remove('ascending');
              h.classList.remove('descending');
              h.classList.add('descending');
              h.querySelector('.sort-icon').innerHTML = `<i class="fas fa-angle-down"></i>`;
            }
          });

          // Give blue color to clicked header
          header.style.color = 'var(--link-color)';

          // Get row data type
          const dataType = header.getAttribute('data-type'); // text, number, date

          // Sorting magic - adjust this based on data types in each column
          rows.sort((a, b) => {
            const cellA = a.querySelectorAll('td')[columnIndex].getAttribute('data-value');
            const cellB = b.querySelectorAll('td')[columnIndex].getAttribute('data-value');

            if (dataType === 'date') {
              return sortOrder === 'ascending' ? new Date(cellA) - new Date(cellB) : new Date(cellB) - new Date(cellA);
            } else if (dataType === 'number') {
              return sortOrder === 'ascending' ? Number(cellA) - Number(cellB) : Number(cellB) - Number(cellA);
            } else {
              return sortOrder === 'ascending' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            }
          });

          // Update order of the rows within the table body
          rows.forEach(row => tableBody.appendChild(row));

          // Toggle ascending/descending classes on the header
          if (header.classList.contains('ascending')) {
            header.classList.remove('ascending');
            header.classList.add('descending');
            headerIcon.innerHTML = `<i class="fas fa-angle-down"></i>`;
          } else {
            header.classList.remove('descending');
            header.classList.add('ascending');
            headerIcon.innerHTML = `<i class="fas fa-angle-up"></i>`;
          }
        });
      });
    });
  }
}


/* ----------------------------------------- */
/* ----------- SHOW QUIZ BY ID ------------- */
/* ----------------------------------------- */

// Function to show the quiz with the number clicked
function showQuizById(quizId) {
  if (!quizId) return;
  const currentQuiz = document.querySelector(".quiz:not(.is-hidden)");
  const quizEl = document.getElementById(`quiz-${quizId}`);
  const prevQuizEl = quizEl.previousElementSibling;
  const nextQuizEl = quizEl.nextElementSibling;

  const showPrevQuizButton = document.getElementById("show-prev-quiz-button");
  const showNextQuizButton = document.getElementById("show-next-quiz-button");
  const checkButton = document.getElementById("check-button");
  const navFinishButton = document.getElementById("nav-finish-button");

  // Remove the "hovered" class from the current quiz link
  const currentQuizId = currentQuiz.id.split("-").slice(1).join("-");
  const currentQuizLinkEl = document.getElementById(`quiz-link-${currentQuizId}`);
  currentQuizLinkEl.classList.remove("is-hovered");

  // Add the "hovered" class to the clicked quiz link
  const quizLinkEl = document.getElementById(`quiz-link-${quizId}`);
  quizLinkEl.classList.add("is-hovered");

  // Scroll horizontally smoothly to the clicked quiz link
  quizLinkEl.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center",
  });

  // If the clicked quiz is not the current one, hide the current quiz and show the clicked one
  if (currentQuiz !== quizEl) {
    currentQuiz.classList.add("is-hidden");
    quizEl.classList.remove("is-hidden");
  }

  // If there is a previous quiz, show the "Show previous quiz" button
  if (prevQuizEl && prevQuizEl.classList.contains("quiz")) {
    const prevQuizId = prevQuizEl.id.split("-").slice(1).join("-");
    showPrevQuizButton.classList.remove("is-hidden");
    showPrevQuizButton.onclick = () => showQuizById(prevQuizId);
  } else {
    showPrevQuizButton.classList.add("is-hidden");
  }

  // If there is a next quiz, show the "Show next quiz" button
  if (nextQuizEl && nextQuizEl.classList.contains("quiz")) {
    const nextQuizId = nextQuizEl.id.split("-").slice(1).join("-");
    if (showNextQuizButton) {
      showNextQuizButton.dataset.quizId = "";
      showNextQuizButton.classList.remove("is-hidden");
      showNextQuizButton.onclick = () => showQuizById(nextQuizId);
    }
    if (checkButton) checkButton.classList.add("is-hidden");
    if (navFinishButton) navFinishButton.classList.add("is-hidden");
  // Otherwise hide it and show the "Finish" button in navigation
  } else {
    if (showNextQuizButton) showNextQuizButton.classList.add("is-hidden");
    if (checkButton) checkButton.classList.remove("is-hidden");
    if (navFinishButton) navFinishButton.classList.remove("is-hidden");
  }
}

// Add event listeners to all show-quiz-by-id buttons
function addShowQuizByIdEventListeners() {
  const showQuizByIdButtons = document.querySelectorAll(".show-quiz-by-id-button");
  showQuizByIdButtons.forEach((button) => {
    const quizId = button.dataset.quizId;
    button.onclick = () => showQuizById(quizId);
  });
}

// Add event listeners to all show-quiz-by-id buttons
// addShowQuizByIdEventListeners();

/* ---------------------------------------- */
/* ----------- MODAL TRY ------------------ */
/* ---------------------------------------- */

// Open modal-try
function openModalTry(testId, testType, testName, nQuestions, testAuthor) {
  // Modal try elements
  const modalEl = document.getElementById("modal-try");
  const modalTabs = document.getElementById("modal-try-tabs");
  const tabToggleTry = document.getElementById("tab-toggle-try");
  const tabToggleLiveBattle = document.getElementById("tab-toggle-livebattle");
  const modalTitle = document.getElementById("modal-try-title");
  const modalTryTestName = document.getElementById("modal-try-test-name");
  const modalTryTestAuthor = document.getElementById("modal-try-test-author");
  const nQuestionsFields = document.querySelectorAll(".nquestions-field");

  // Try tab elements
  const trySettingsForm = document.getElementById("trySettingsForm");
  const nQuestionsRangeSpan = document.getElementById("nQuestionsRange");
  const nQuestionsInput = document.getElementById("nQuestions");

  // Live battle tab elements
  const livebattleSettingsForm = document.getElementById("livebattleSettingsForm");
  const nQuestionsRangeSpanLiveBattle = document.getElementById("nQuestionsRange-livebattle");
  const nQuestionsInputLiveBattle = document.getElementById("nQuestions-livebattle");

  // Set the modal title
  if (testType === "knowledge") {
    modalTitle.innerHTML = `
      <span lang="en">Test your knowledge!</span>
      <span lang="es">¡Pon a prueba tus conocimientos!</span>
    `;
  } else if (testType === "personality") {
    modalTitle.innerHTML = `
      <span lang="en">Discover your personality!</span>
      <span lang="es">¡Descubre tu personalidad!</span>
    `;
  }

  // If the user is not logged in or the test is of type personality
  if (!isLoggedIn || testType === "personality") {
    // Hide modalTabs and click the tabToggleTry
    modalTabs.classList.add("is-hidden");
    tabToggleTry.click();
  } else {
    // Show the modalTabs
    modalTabs.classList.remove("is-hidden");
  }

  // Set the test name, test id, and form action
  modalTryTestName.innerText = testName;
  // Set author name (matching try view style)
  modalTryTestAuthor.innerText = testAuthor || 'Anonymous';
  trySettingsForm.dataset.testId = testId;
  livebattleSettingsForm.dataset.testId = testId;
  trySettingsForm.action = `/tests/${testId}/try`;
  livebattleSettingsForm.action = `/tests/${testId}/livebattle`;
  nQuestionsRangeSpan.innerHTML = `(1-${nQuestions})`;
  nQuestionsRangeSpanLiveBattle.innerHTML = `(1-${nQuestions})`;
  nQuestionsInput.min = 1;
  nQuestionsInput.max = nQuestions;
  nQuestionsInput.value = nQuestions;
  nQuestionsInputLiveBattle.min = 1;
  nQuestionsInputLiveBattle.max = nQuestions;
  nQuestionsInputLiveBattle.value = Math.min(nQuestions, 10);


  // Hide the # of questions input if the test has only 1 question
  // or if the test is a personality test
  if (nQuestions <= 1 || testType === "personality") {
    nQuestionsFields.forEach((field) => {
      field.classList.add("is-hidden");
    });
  } else {
    nQuestionsFields.forEach((field) => {
      field.classList.remove("is-hidden");
    });
  }

  // Display the modal
  openModal(modalEl);
}

// Add an event listener to the "Try" button
function addModalTryButtonEventListener() {
  const modalTryButton = document.getElementById("modal-try-button");
  modalTryButton.onclick = () => {
    const trySettingsForm = document.getElementById("trySettingsForm");
    const testId = trySettingsForm.dataset.testId;

    // Get number of questions input value
    const nQuestionsInput = document.getElementById("nQuestions");
    const nQuestions = nQuestionsInput.value;

    // Get the randomizeQuestions checkbox value
    const randomizeQuestionsInput = document.getElementById("randomizeQuestions");
    const randomizeQuestions = randomizeQuestionsInput.checked;

    // Get the randomizeOptions checkbox value
    const randomizeOptionsInput = document.getElementById("randomizeOptions");
    const randomizeOptions = randomizeOptionsInput.checked;

    // Get the sequentialQuestions checkbox value
    const sequentialQuestionsInput = document.getElementById("sequentialQuestions");
    const sequentialQuestions = sequentialQuestionsInput.checked;

    // Build query url to try test with the selected settings
    const urlBase = '/tests/' + testId + '/try';
    const urlParams = new URLSearchParams();
    urlParams.append('n', nQuestions);
    urlParams.append('rQs', randomizeQuestions);
    urlParams.append('rOpts', randomizeOptions);
    urlParams.append('seq', sequentialQuestions);
    const url = urlBase + "?" + urlParams.toString();

    // Fetch the test try content
    fetchBodyContent(url);

    // Close the modal (also removes is-clipped so the page stays scrollable)
    const modalEl = document.getElementById("modal-try");
    closeModal(modalEl);
  };
}

// Add event listeners to the "Live Battle" button
function addModalLiveBattleButtonEventListener() {
  const modalLiveBattleButton = document.getElementById("modal-live-battle-button");
  if (!modalLiveBattleButton) return;
  modalLiveBattleButton.onclick = () => {
    const livebattleSettingsForm = document.getElementById("livebattleSettingsForm");
    const testId = livebattleSettingsForm.dataset.testId;

    // Get number of questions input value
    const nQuestionsInput = document.getElementById("nQuestions-livebattle");
    const nQuestions = nQuestionsInput.value;

    // Get number of seconds input value
    const nSecondsInput = document.getElementById("nSeconds-livebattle");
    const nSeconds = nSecondsInput.value;

    // Get the randomizeQuestions checkbox value
    const randomizeQuestionsInput = document.getElementById("randomizeQuestions-livebattle");
    const randomizeQuestions = randomizeQuestionsInput.checked;

    // Get the randomizeOptions checkbox value
    const randomizeOptionsInput = document.getElementById("randomizeOptions-livebattle");
    const randomizeOptions = randomizeOptionsInput.checked;

    // Build query url to try test with the selected settings
    const urlBase = '/tests/' + testId + '/livebattle';
    const urlParams = new URLSearchParams();
    urlParams.append('n', nQuestions);
    urlParams.append('s', nSeconds);
    urlParams.append('rQs', randomizeQuestions);
    urlParams.append('rOpts', randomizeOptions);
    const url = urlBase + "?" + urlParams.toString();

    // Fetch the test try content
    fetchBodyContent(url);

    // Close the modal (also removes is-clipped so the page stays scrollable)
    const modalEl = document.getElementById("modal-try");
    closeModal(modalEl);

    // Wait for 3s for the body content to be loaded
    setTimeout(() => {
      // Get the "live-battle-id" element
      const liveBattleIdEl = document.getElementById("live-battle-id");
      // If it exists, get the live battle id and update the url
      if (liveBattleIdEl) {
        // Initialize the live battle
        initializeLiveBattle()
      }
    }, 3000);
  };
}

// Add event listeners to all open modal try buttons
function addOpenModalTryButtonEventListeners() {
  // Get all the open modal try buttons
  const openModalTryButtons = document.querySelectorAll(".open-modal-try-button");
  openModalTryButtons.forEach(button => {
    button.onclick = () => {
      // Click the tab-toggle-try
      const tabToggleTry = document.getElementById("tab-toggle-try");
      tabToggleTry.click();
      // Get the values from the clicked button
      const testId = button.getAttribute("data-test-id");
      const testType = button.getAttribute("data-test-type");
      const testName = button.getAttribute("data-test-name");
      const nQuestions = button.getAttribute("data-n-quizzes");
      const testAuthor = button.getAttribute("data-test-author");
      openModalTry(testId, testType, testName, nQuestions, testAuthor);
    };
  });

  // Get all the open modal live battle buttons
  const openModalLiveBattleButtons = document.querySelectorAll(".open-modal-trylive-button");
  openModalLiveBattleButtons.forEach(button => {
    button.onclick = () => {
      // Click the tab-toggle-livebattle
      const tabToggleLiveBattle = document.getElementById("tab-toggle-livebattle");
      tabToggleLiveBattle.click();
      // Get the values from the clicked button
      const testId = button.getAttribute("data-test-id");
      const testType = button.getAttribute("data-test-type");
      const testName = button.getAttribute("data-test-name");
      const nQuestions = button.getAttribute("data-n-quizzes");
      const testAuthor = button.getAttribute("data-test-author");
      openModalTry(testId, testType, testName, nQuestions, testAuthor);
    };
  });
}

// Add event listeners to all open modal live battle buttons (open-modal-livebattle-button)
// When clicking on them, modal "modal-livebattle" must be opened
function addOpenModalLiveBattleButtonEventListeners() {
  const modalLiveBattle = document.getElementById("modal-livebattle");
  const modalLiveBattleAlert = modalLiveBattle.querySelector(".modal-alert");
  const openModalLiveBattleButtons = document.querySelectorAll(".open-modal-livebattle-button");
  openModalLiveBattleButtons.forEach(button => {
    button.onclick = () => {
      // Open the modal
      openModal(modalLiveBattle);
      // Put the cursor on the live battle id input
      const liveBattleIdInput = document.getElementById("liveBattleId-input");
      liveBattleIdInput.focus();
    };
  });

  // Also add event listeners for modal-livebattle-button
  const modalLiveBattleButton = document.getElementById("modal-livebattle-button");
  modalLiveBattleButton.onclick = () => {
    // Get the values of the inputs (liveBattleId-input and playername-input)
    const liveBattleIdInput = document.getElementById("liveBattleId-input");
    let liveBattleIdValue = liveBattleIdInput.value;
    const playernameInput = document.getElementById("playername-input");
    const playernameValue = playernameInput.value;

    // Cleanse the id value removing spaces and uppercasing it
    liveBattleIdValue = liveBattleIdValue.trim().toUpperCase();

    // Validate the fields (liveBattleId must be 6 uppercase letters and playername must be between 5 and 20 characters long)
    let modalAlertMsg = "";
    if (liveBattleIdValue.length !== 6 || !liveBattleIdValue.match(/^[A-Z]+$/)) {
      modalAlertMsg += `
        <span lang="en">Live Battle ID must be 6 uppercase letters. </span>
        <span lang="es">El ID de Batalla en Vivo debe tener 6 letras mayúsculas. </span>
      `;
    }
    if (playernameValue.length < 5 || playernameValue.length > 20) {
      modalAlertMsg += `
        <span lang="en">Playername must be between 5 and 20 characters long. </span>
        <span lang="es">El nombre de jugador debe estar entre 5 y 20 caracteres. </span>
      `;
    }
    // Show modal alert msg
    if (modalAlertMsg) {
      modalLiveBattleAlert.innerHTML = '<p class="is-size-6 has-text-danger">' + modalAlertMsg + '</p>';
      return;
    }


    // Build the url
    const liveBattleUrl = '/livebattle/' + liveBattleIdValue + '?pn=' + playernameValue;

    // Save playername to localStorage for auto-rejoin on reload
    try {
      localStorage.setItem('livebattle_' + liveBattleIdValue + '_playername', playernameValue);
    } catch (e) {
      console.log('Could not save playername to localStorage');
    }

    // Close the modal
    modalLiveBattle.classList.remove("is-active");

    // Check if we're already on a livebattle page (user came directly via URL)
    // In this case, do a full page navigation to avoid AJAX timing issues
    if (window.location.pathname.includes('/livebattle/')) {
      window.location.href = liveBattleUrl;
      return;
    }

    // Otherwise use AJAX navigation
    // Fetch new body content
    fetchBodyContent(liveBattleUrl);
    // Wait for 3s for the body content to be loaded
    setTimeout(() => {
      // Get the "live-battle-id" element
      const liveBattleIdEl = document.getElementById("live-battle-id");
      // If it exists, get the live battle id and update the url
      if (liveBattleIdEl) {
        // Reset initialization flag so the new playername is used
        if (typeof isLiveBattleInitialized !== 'undefined') {
          isLiveBattleInitialized = false;
        }
        // Initialize the live battle
        initializeLiveBattle()
      }
    }, 3000);
  };
}

// Function to add help modal listeners for modal-try
function addModalTryHelpListeners() {
  const modals = {
    '.try-mode-help': 'try-mode-help-modal',
    '.livebattle-mode-help': 'livebattle-mode-help-modal'
  };

  Object.entries(modals).forEach(([selector, modalId]) => {
    document.querySelectorAll(selector).forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation(); // Prevent tab from being selected
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('is-active');
      };
    });
  });
}

// Function to add event listeners to all modal try buttons
function addModalTryEventListeners() {
  // Add event listener to the modal try button
  addModalTryButtonEventListener();

  // Add event listener to open modal try buttons
  addOpenModalTryButtonEventListeners();

  // Add event listener to the modal live battle button
  addModalLiveBattleButtonEventListener();

  // Add event listeners for help modals
  addModalTryHelpListeners();
}


/* ---------------------------------------- */
/* ----------- OPEN/CLOSE MODALS ---------- */
/* ---------------------------------------- */

// Modal triggers
function openContextModal() {
  const modal = document.getElementById("modal-context");
  openModal(modal);
}

// Add event listeners to all modal context trigger
document.querySelectorAll(".modal-context-trigger").forEach((trigger) => {
  trigger.onclick = () => openContextModal();
});

// Close a modal window
function closeModal(modal) {
  modal.classList.remove("is-active");
  // Clear the modal alert message if present
  const modalAlert = modal.querySelector(".modal-alert");
  if (modalAlert) modalAlert.innerHTML = "";
  // Re-enable body scroll if no modals are active
  if (!document.querySelector(".modal.is-active")) {
    document.documentElement.classList.remove("is-clipped");
  }
}

// Open a modal and disable body scroll
function openModal(modal) {
  modal.classList.add("is-active");
  document.documentElement.classList.add("is-clipped");
}

// Close all modal windows
function closeAllModals() {
  (document.querySelectorAll(".modal") || []).forEach(($modal) => {
    $modal.classList.remove("is-active");
    const modalAlert = $modal.querySelector(".modal-alert");
    if (modalAlert) modalAlert.innerHTML = "";
  });
  document.documentElement.classList.remove("is-clipped");
}

// Add event listeners to all modal close buttons
function addModalCloseEventListeners() {
  // Add a click event on various child elements to close the parent modal
  (
    document.querySelectorAll(
      ".modal-background, .modal-close, .modal-cancel, .modal-delete"
    ) || []
  ).forEach(($close) => {
    const $target = $close.closest(".modal");

    $close.onclick = () => closeModal($target);
  });

  // Add a keyboard event to close all modals
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });
}

// Add close modals event listeners
// addModalCloseEventListeners();

// Effect making it seem like cards and boxes are appearing one by one
function staggerAnimation() {
  // Select all elements with class : "flex-card", "flex-box" or "box"
  const elements = document.querySelectorAll('.flex-card, .flex-box, .leftbar, .bottombar');
  elements.forEach((element, index) => {
    setTimeout(() => {
      element.classList.add('visible');
    }, index * 100); // stagger the animation for each element
  });
}

/* ---------------------------------------- */
/* ----------- CONTROL PANEL -------------- */
/* ---------------------------------------- */

// Function to toggle the control panel
function toggleControlPanel() {
  const controlPanelContent = document.getElementById('control-panel-content');
  const controlPanelToggle = document.getElementById('control-panel-toggle');
  if (controlPanelContent.classList.contains("is-hidden")) {
    controlPanelContent.classList.remove("is-hidden");
    controlPanelToggle.innerHTML = '<span class="icon is-large"><i class="fas fa-angle-down"></i></span>';
  } else {
    controlPanelContent.classList.add("is-hidden");
    controlPanelToggle.innerHTML = '<span class="icon is-large"><i class="fas fa-angle-up"></i></span></i>';
  }
}


// Variable to remember the latest inserted ad
var wasDesktopDetected = false;
// Function to update the control panel class
function updateControlPanelClass() {
  const controlPanel = document.getElementById('control-panel');
  if (!controlPanel) return;

  const controlPanelContent = document.getElementById('control-panel-content');
  const controlPanelLeftbarMenu = document.getElementById('leftbar-menu');
  const controlPanelBottombarMenu = document.getElementById('bottombar-menu');
  const controlPanelToggle = document.getElementById('control-panel-toggle');

  // Switch between desktop and mobile view of the control panel
  if (window.innerWidth <= 1200) {
    if (!wasDesktopDetected) return;
    wasDesktopDetected = false;
    controlPanelBottombarMenu.classList.remove("is-hidden");
    controlPanelLeftbarMenu.classList.add("is-hidden");
    controlPanel.classList.remove('leftbar');
    controlPanel.classList.add('bottombar');

  } else {
    if (wasDesktopDetected) return;
    wasDesktopDetected = true;
    controlPanelContent.classList.remove("is-hidden");
    controlPanelBottombarMenu.classList.add("is-hidden");
    controlPanelLeftbarMenu.classList.remove("is-hidden");
    controlPanel.classList.remove('bottombar');
    controlPanel.classList.add('leftbar');


  }
}

// Function to add control panel event listeners
function initControlPanel() {
  // Add click event listener to the control panel toggle button
  const controlPanelToggle = document.getElementById('control-panel-toggle');
  if (controlPanelToggle) {
    controlPanelToggle.onclick = () => toggleControlPanel();
  }

  // Add click event listener to the collapse button
  const controlPanelCollapseBtn = document.getElementById('control-panel-collapse-btn');
  if (controlPanelCollapseBtn) {
    controlPanelCollapseBtn.onclick = () => {
      const controlPanel = document.getElementById('control-panel');
      if (controlPanel) {
        controlPanel.classList.toggle('collapsed');
      }
    };
  }

  // Add event listener to window resize
  window.addEventListener('resize', updateControlPanelClass);

  // Initial update of control panel class
  if (window.innerWidth <= 1200) {
    wasDesktopDetected = true;
  } else {
    wasDesktopDetected = false;
  }
  updateControlPanelClass();
}


/* ---------------------------------------- */
/* ----------- USER EDIT JS --------------- */
/* ---------------------------------------- */

// Open a user edit modal window
function openEditUserModal() {
  // Get the modal element
  const modalEditUser = document.getElementById("modal-edit-user");

  // Open the modal
  openModal(modalEditUser);
}

// Edit user
function editUser() {
  const modalEditUser = document.getElementById("modal-edit-user");
  const oldUsernameValue = modalEditUser
    .querySelector(".modalUser")
    .id.slice(5);

  // Get the role value if present
  const roleSelect = document.getElementById("modalUserRole");
  let roleValue = "user";
  if (roleSelect) {
    roleValue = roleSelect.options[roleSelect.selectedIndex].value;
  }

  // Get the name value and ensure it is not empty
  const usernameValue = document
    .getElementById("modalUserUsername")
    .value.trim();
  if (usernameValue.includes(" ")) {
    modalAlert("Please enter a username without spaces.");
    return;
  }
  if (usernameValue.length < 3 || usernameValue.length > 20) {
    modalAlert("Please enter a username between 3 and 20 characters.");
    return;
  }

  // Get rest of values
  const nameValue = document.getElementById("modalUserName").value.trim();
  //const birthDateValue = document.getElementById("modalUserBirthDate").value.trim();
  const descValue = document.getElementById("modalUserDesc").value.trim();

  // Send POST request to backend to update values
  const url = "/api/users/update";
  const method = "PUT";
  const data = {
    role: roleValue,
    oldUsername: oldUsernameValue,
    username: usernameValue,
    name: nameValue,
    desc: descValue,
  };

  // Send request to update user to backend: in case request is successful, reload the page, otherwise show error message as modal alert
  fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (response.ok) {
        // Load response and check if it was successful
        return response.json();
      } else {
        throw new Error("Error updating user. Please try again later.");
      }
    })
    .then((response) => {
      if (response.success) {
        // Fetch the updated user page
        fetchBodyContent("/users/" + usernameValue);
      } else {
        // Show validation error message as modal alert
        modalAlert(response.error);
      }
    })
    .catch((error) => {
      // Show error message as modal alert
      modalAlert(error.message);
    });
}

// Add event listeners
function addEditUserEventListeners() {
  // Add event listener to edit user button
  const editUserButtons = document.querySelectorAll(".edit-user-button");
  if (editUserButtons) {
    editUserButtons.forEach((button) => {
      button.onclick = openEditUserModal;
    });
  }

  // Add event listener to edit user modal button
  const modalEditUserButton = document.getElementById("modal-edit-user-button");
  if (modalEditUserButton) {
    modalEditUserButton.onclick = editUser;
  }
}

/* ---------------------------------------- */
/* ------- PUSH TEST CARD ADS ------------- */
/* ---------------------------------------- */
// Function to push test card ads
// COMMENTED OUT - Test card ads disabled
// function pushTestCardAds() {
//   // Handle ad insertion of elements with id="testCardAd-box"
//   const testCardAdBox = document.getElementById('testCardAd-box');
//   // If the box is present and the ad has not been inserted yet

//   if (testCardAdBox && testCardAdBox.innerHTML === "") {
//     // Insert the ads script and ins element
//     // Wait for 0.5 seconds before inserting the ad
//     setTimeout(() => {
//       try {
//         // console.log('Trying to insert test card ad');
//         if (testCardAdBox) {
//           testCardAdBox.innerHTML = testCardAdHTML;
//         }
//       } catch (error) {
//         console.error(error);
//       }
//     }, 500);
//   }
// }


/* ---------------------------------------- */
/* ----------- PAGINATION JS -------------- */
/* ---------------------------------------- */

// Select page number
function selectPage(pageno) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Change pageno param
  urlParams.set("pageno", pageno);

  // Fetch tests from the server that match the params
  fetchBodyContent(window.location.pathname + "?" + urlParams.toString());
}

// Add event listener for the pagination buttons
function addPaginationEventListeners() {
  document.querySelectorAll(".pagination-button").forEach(element => {
    element.onclick = (e) => {
      e.preventDefault();
      selectPage(Number(element.dataset.pageno));
    };
  });
}


/* ---------------------------------------- */
/* ----------- TEST TRY JS ---------------- */
/* ---------------------------------------- */

// Add the following variable to keep track of elapsed time
var elapsedTime = 0;
var stopwatchIntervalKey = "stopwatch";
// Function to update the stopwatch display
function updateStopwatch() {
  const stopwatchValue = document.getElementById("stopwatch-value");
  if (!stopwatchValue) {
    // Clear interval if the stopwatch element is not present
    clearIntervalByKey(stopwatchIntervalKey);
    return;
  }
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const formattedTime = `${minutes ? minutes.toString()+"m" : ""} ${seconds.toString()}s`;
  stopwatchValue.textContent = formattedTime;
  const nSecondsEl = document.getElementById("nSeconds");
  if (nSecondsEl) nSecondsEl.value = elapsedTime;
  elapsedTime++;
}

// Function to restart the stopwatch
function restartStopwatch() {
  elapsedTime = 0;

  // Check if the stopwatch is present in the page
  const stopwatchValue = document.getElementById("stopwatch-value");

  // If the stopwatch is present, start it
  if (stopwatchValue) {
    stopwatchValue.textContent = "0s";
    stopwatchIntervalKey = startInterval(updateStopwatch, 1000, stopwatchIntervalKey);
  }
}

// Function to display a confirmation dialog
function confirmSubmit(resultId) {
  if (localLang === "en") {
    title = "Confirmation";
    text = "Are you sure you want to finish the test and check your answers? This cannot be undone.";
    confirmButtonText = "Yes, submit!";
    cancelButtonText = "No, cancel";
  } else if (localLang === "es") {
    title = "Confirmación";
    text = "¿Estás seguro de que quieres terminar el test y revisar tus respuestas? Esto no se puede deshacer.";
    confirmButtonText = "¡Sí, enviar!";
    cancelButtonText = "No, cancelar";
  }
  Swal.fire({
    title: title,
    text: text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmButtonText,
    cancelButtonText: cancelButtonText,
    reverseButtons: true
  }).then((result) => {
    if (result.value) {
      // Stop the timer
      clearIntervalByKey(stopwatchIntervalKey);

      // Create a new form dict to store the form data
      let formDict = {};

      // Get elapsed time
      formDict["nSeconds"] = elapsedTime;

      // Get quiz chosen options - check all possible quiz containers (edit, results, try sequential, try non-sequential)
      const quizElements = document.querySelectorAll("#quiz-els .quiz, #try-quiz-box .quiz, #try-quiz-container .quiz");
      quizElements.forEach(quiz => {
        const inputs = quiz.querySelectorAll("input[type='checkbox']");
        inputs.forEach(input => {
          if (input.checked) {
            if (!formDict[input.name]) {
              formDict[input.name] = [input.value];
            } else {
              formDict[input.name].push(input.value);
            }
          }
        });
      });

      // Create a form data object from the form dict
      const formData = new FormData();
      for (const key in formDict) {
        formData.append(key, formDict[key]);
      }

      // Do a post request to the backend with the form data /api/results/:resultId/check
      const href = "/api/results/" + resultId + "/check";
      fetch(href, {
        method: "POST",
        body: formData
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok. " + response.status + ": " + response.error);
          }
          // If the response was successful, get result id from the response
          return response.json();
        }).then((response) => {
          if (response.success) {
            // Fetch the new body content
            fetchBodyContent(response.href);
          }
        })
        .catch((error) => {
          console.error(error);
          if (localLang === "en") {
            showSweetAlert("An error occurred. Please try again.", "error");
          } else if (localLang === "es") {
            showSweetAlert("Ocurrió un error. Por favor, inténtalo de nuevo.", "error");
          }
        });
    }
  });
}

// Function to create check quiz form data
function createCheckQuizFormData(quizId) {
  // Get the quiz element
  const quizEl = document.getElementById("quiz-" + quizId);
  // Get the quiz checkboxes
  const quizCheckboxes = quizEl.querySelectorAll("input[type='checkbox']");
  // Build the form data for the quiz depending on the selected options
  const formDict = {};

  // Get elapsed time
  formDict["quizId"] = quizId;
  formDict["nSeconds"] = elapsedTime;

  // Iterate over the quiz checkboxes and add the checked ones to the form dict
  quizCheckboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      if (!formDict[checkbox.name]) {
        formDict[checkbox.name] = [checkbox.value];
      } else {
        formDict[checkbox.name].push(checkbox.value);
      }
    }
  });

  // Create a form data object from the form dict
  const formData = new FormData();
  for (const key in formDict) {
    formData.append(key, formDict[key]);
  }

  // Log the form dict and data

  return [formDict, formData]
}

// Function to modify HTML on quiz check
function modifyQuizHTMLOnCheck(button, quizId, result, hideAnswers, isAuthor, correctOpts, chosenOpts) {
  // Get the quiz element
  const quizEl = document.getElementById("quiz-" + quizId);
  // Get the quiz link element
  const quizLinkEl = document.getElementById("quiz-link-" + quizId);
  // Get the quiz checkboxes
  const quizCheckboxes = quizEl.querySelectorAll("input[type='checkbox']");

  // Turn all .flex-opt-clickable elements into .flex-opt elements
  const flexOptClickables = quizEl.querySelectorAll(".flex-opt-clickable");
  flexOptClickables.forEach((element) => {
    element.classList.remove("flex-opt-clickable");
    element.classList.add("flex-opt");
  });

  // Iterate over elements with ids in ["opt1", "opt2", "opt3", "opt4", "opt5", "opt6"]
  const optionIds = ["opt1", "opt2", "opt3", "opt4", "opt5", "opt6"];
  optionIds.forEach((id) => {
    const n = id.slice(-1);
    const element = quizEl.querySelector("#" + id);
    if (element) {
      // Remove the selected class from all options
      element.classList.remove("selected");
      // If the option is correct and answers are not hidden
      if ((isAuthor || !hideAnswers) && correctOpts.includes(n)) {
        element.classList.add("marked");
      }
      // If the option is incorrect and chosen
      if (chosenOpts.includes(n) && !correctOpts.includes(n)) {
        element.classList.remove("marked");
        element.classList.add("incorrect");
      }
      // If the option is correct and chosen
      if (chosenOpts.includes(n) && correctOpts.includes(n)) {
        element.classList.remove("marked");
        element.classList.add("correct");
      }
    }
  });

  // Disable all checkboxes
  quizCheckboxes.forEach((checkbox) => {
    checkbox.disabled = true;
  });

  // Get the quiz-explanation element
  const quizExplanation = quizEl.querySelector(".quiz-explanation");
  // Show the quiz explanation if it is present
  if (quizExplanation) quizExplanation.classList.remove("is-hidden");

  // Get the show next quiz button
  const showNextQuizButton = document.getElementById("show-next-quiz-button");

  // Modify the check button and quiz link
  button.onclick = {};
  button.style.display = "none";
  quizLinkEl.classList.remove("is-primary");
  button.classList.remove("is-primary");
  button.classList.add("is-rounded");
  if (result === "correct") {
    button.title = "Correct!";
    quizLinkEl.classList.add("correct");
    button.classList.add("is-success");
    button.classList.add("is-outlined");
    button.innerHTML = '<span class="icon"><i class="fas fa-check fa-lg"></i></span>';
  } else if (result === "incorrect") {
    button.title = "Incorrect!";
    quizLinkEl.classList.add("incorrect");
    button.classList.add("is-danger");
    button.classList.add("is-outlined");
    button.innerHTML = '<span class="icon"><i class="fas fa-times fa-lg"></i></span>';
  } else {
    button.title = "Question not answered";
    button.classList.add("is-grey");
    quizLinkEl.classList.add("omitted");
    button.innerHTML = '<span class="icon"><i class="fas fa-fast-forward"></i></span>';
  }

  // Show an alert message on the quiz
  const quizAlertEl = quizEl.querySelector(".quiz-alert");
  // Set the text and color of the alert
  if (result === "correct") {
    quizAlertEl.classList.add("has-text-success");
    quizAlertEl.innerHTML = `
      <span lang="en">Correct! &#128526;</span>
      <span lang="es">¡Correcto! &#128526;</span>
    `;
  } else if (result === "incorrect") {
    quizAlertEl.classList.add("has-text-danger");
    if (isAuthor || !hideAnswers) {
      quizAlertEl.innerHTML = `
        <span lang="en">Incorrect! &#128542;</span>
        <span lang="es">¡Incorrecto! &#128542;</span>
      `;
    } else {
      quizAlertEl.innerHTML = `
        <span lang="en">Incorrect! (Hidden answers) &#129300;</span>
        <span lang="es">¡Incorrecto! (Respuestas ocultas) &#129300;</span>
      `;
    }
  } else {
    quizAlertEl.classList.add("has-text-grey");
    quizAlertEl.innerHTML = `
      <span lang="en">Not answered &#129296;</span>
      <span lang="es">No contestada &#129296;</span>
    `;
  }
  // Remove hidden class from the quiz alert
  quizAlertEl.classList.remove("is-hidden");
}

// Function to check the answer of a quiz
function checkQuiz(button, resultId, quizId, hideAnswers, correctOpts, isAuthor) {
  // Lock to prevent double click checking the same quiz twice
  button.onclick = {};

  // Build the form data for the quiz depending on the selected options
  const [formDict, formData] = createCheckQuizFormData(quizId);
  // Do a post request to the backend with the form data /api/results/:resultId/checkquiz
  // const href = "/api/results/" + resultId + "/checkquiz";
  // fetch(href, {
  //   method: "POST",
  //   body: formData
  // }).then((response) => {
  //   // Check if response was successful and get the result id from the response
  //   if (!response.ok) {
  //     throw new Error("Network response was not ok");
  //   }
  //   return response.json();
  // }).then((response) => {
  //   if (response.success) {
  //     // Get the result from the response
  //     const result = response.result;
  //     // Turn chosenOpts and correctOpts into arrays
  //     const chosenOpts = response.chosenOpts.split(",");
  //     const correctOpts = response.correctOpts.split(",");

  //     // Modify the HTML on the quiz check
  //     modifyQuizHTMLOnCheck(button, quizId, result, hideAnswers, isAuthor, correctOpts, chosenOpts);
  //   } else {
  //     // Throw an error if the response was not successful
  //     throw new Error("Error checking quiz with id " + quizId + ". Checking quiz offline.");
  //   }
  // }).catch((error) => {
  //   console.error(error);

  //   // Get the key value of the key starting with "chosenOpts-quizId"
  //   const chosenOptsArray = formDict["chosenOpts-" + quizId];
  //   const chosenOpts = chosenOptsArray ? chosenOptsArray.join(",") : "";

  //   // Instead check it offline
  //   const correctOptsArray = correctOpts.split(",");

  //   // Result is omitted if chosenOptsArray is empty or contains 0
  //   let result = "omitted";
  //   if (chosenOptsArray.length > 0 && chosenOptsArray[0] !== "0") {
  //     // Result is correct if length of chosenOptsArray and correctOptsArray is the same and all elements are the same
  //     const isSameLength = chosenOptsArray.length === correctOptsArray.length;
  //     let isSameElements = true;
  //     for (let i = 0; i < chosenOptsArray.length; i++) {
  //       if (!correctOptsArray.includes(chosenOptsArray[i])) {
  //         isSameElements = false;
  //         break;
  //       }
  //     }
  //     result = isSameLength && isSameElements ? "correct" : "incorrect";
  //   }

  //   // Modify the HTML on the quiz check
  //   modifyQuizHTMLOnCheck(button, quizId, result, hideAnswers, isAuthor, correctOptsArray, chosenOptsArray);
  // });

  // Check it offline
  // Get the key value of the key starting with "chosenOpts-quizId"
  const chosenOptsArray = formDict["chosenOpts-" + quizId];
  const chosenOpts = chosenOptsArray ? chosenOptsArray.join(",") : "";

  // Instead check it offline
  const correctOptsArray = correctOpts.split(",");

  // Result is omitted if chosenOptsArray is empty or contains 0
  let result = "omitted";
  if (chosenOptsArray.length > 0 && chosenOptsArray[0] !== "0") {
    // Result is correct if length of chosenOptsArray and correctOptsArray is the same and all elements are the same
    const isSameLength = chosenOptsArray.length === correctOptsArray.length;
    let isSameElements = true;
    for (let i = 0; i < chosenOptsArray.length; i++) {
      if (!correctOptsArray.includes(chosenOptsArray[i])) {
        isSameElements = false;
        break;
      }
    }
    result = isSameLength && isSameElements ? "correct" : "incorrect";
  }

  // Modify the HTML on the quiz check
  modifyQuizHTMLOnCheck(button, quizId, result, hideAnswers, isAuthor, correctOptsArray, chosenOptsArray);
}

// Add event listeners to all quiz check buttons
function addCheckQuizEventListeners() {
  const checkQuizButtons = document.querySelectorAll(".quiz-check-button");
  checkQuizButtons.forEach((button) => {
    button.onclick = () => {
      const resultId = button.dataset.resultId;
      const quizId = button.dataset.quizId;
      const hideAnswers = button.dataset.hideAnswers === "true";
      const correctOpts = button.dataset.correctOpts;
      const isAuthor = button.dataset.isAuthor === "true";
      checkQuiz(button, resultId, quizId, hideAnswers, correctOpts, isAuthor);
    };
  });
}

// Function to display a test try cancellation dialog that takes user back to the test view
function cancelTry() {
  if (localLang === "en") {
    title = "Stop taking the test?";
    text = "Are you sure you want to stop taking the test? Your progress will be lost.";
    confirmButtonText = "Yes, stop!";
    cancelButtonText = "No, continue";
  } else if (localLang === "es") {
    title = "¿Detener el test?";
    text = "¿Estás seguro de que quieres detener el test? Tu progreso se perderá.";
    confirmButtonText = "¡Sí, detener!";
    cancelButtonText = "No, continuar";
  }
  Swal.fire({
    title: title,
    text: text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmButtonText,
    cancelButtonText: cancelButtonText,
    reverseButtons: true
  }).then((result) => {
    if (result.value) {
      // Get the test id from the current URL (/tests/:testId/try)
      let testId = window.location.pathname.split("/")[2];
      // Redirect to the test view with fetchBodyContent if the user confirms
      fetchBodyContent("/tests/" + testId);
    }
  });
}

function selectOptionTry(element) {
  // Find the checkbox input within the clicked flex-item
  const quizEl = element.closest(".quiz");
  const quizId = quizEl.id.split("-").slice(1).join("-");
  const checkboxInput = element.querySelector('input[type="checkbox"]');
  const quizLink = document.getElementById("quiz-link-" + quizId);

  // Check if it has multiple correct answers by looking for the "multiple-choice-alert" element
  const multipleChoiceAlert = quizEl.querySelector(".multiple-choice-alert");
  const isMultipleChoice = multipleChoiceAlert ? true : false;

  // Button class name depends on window url including "try" -> "quiz-check-button" or "livebattle" -> "quiz-send-answer-button"
  let buttonClassName = "";
  let optionClass = "";
  if (window.location.href.includes("try")) {
    buttonClassName = "quiz-check-button";
    optionClass = "selected";
  } else if (window.location.href.includes("livebattle")) {
    buttonClassName = "quiz-send-answer-button";
    optionClass = "marked";
  }

  // If the checkbox is for omitting the question
  if (checkboxInput.value === "0") {
    // Remove the "selected" class from flex-items within the same box
    const otherFlexItems = quizEl.querySelectorAll(".flex-opt-clickable.is-try");
    otherFlexItems.forEach((item) => item.classList.remove("selected"));

    // Uncheck all option checkboxes within the same box
    const optionCheckboxes = quizEl.querySelectorAll(
      'input[name^="chosenOpts"]'
    );
    optionCheckboxes.forEach((optCheckbox) => (optCheckbox.checked = false));

    // Mark omit as selected option
    checkboxInput.checked = true;
    element.classList.add(optionClass);

    // Mark quiz link as unselected (if it exists - not present in non-sequential mode)
    if (quizLink) quizLink.classList.remove(optionClass);
  } else {
    // Unselect "omit" if an option is chosen
    const omitCheckbox = quizEl.querySelector(`input[value="0"]`);
    const omitFlexItem = omitCheckbox.closest(".flex-opt-clickable.is-try");
    omitCheckbox.checked = false;
    omitFlexItem.classList.remove(optionClass);

    // If it's not a multiple choice question, unselect all other options
    if (!isMultipleChoice) {
      // Check or uncheck the selected option depending on its previous state
      if (checkboxInput.checked) {
        checkboxInput.checked = false;
        element.classList.remove(optionClass);
      } else {
        checkboxInput.checked = true;
        element.classList.add(optionClass);
      }

      // Unselect all other options
      const otherFlexItems = quizEl.querySelectorAll(".flex-opt-clickable.is-try");
      otherFlexItems.forEach((item) => {
        if (item !== element) {
          item.classList.remove(optionClass);
          item.querySelector('input[type="checkbox"]').checked = false;
        }
      });
    } else {
      // Check or uncheck the selected option depending on its previous state
      if (checkboxInput.checked) {
        checkboxInput.checked = false;
        element.classList.remove(optionClass);
      } else {
        checkboxInput.checked = true;
        element.classList.add(optionClass);
      }
    }

    // Mark quiz link as selected (if it exists - not present in non-sequential mode)
    if (quizLink) quizLink.classList.add(optionClass);

    // Set unsavedChanges to true
    unsavedChanges = true;
  }

  // Check if any option within the same box is selected
  const anyOptionSelected = quizEl.querySelector(
    'input[name^="chosenOpts"]:checked'
  );

  // If no option is selected, mark the "omit" option as chosen
  let checkButton = null;
  if (!anyOptionSelected) {
    const omitCheckbox = quizEl.querySelector(`input[value="0"]`);
    omitCheckbox.checked = true;
    const omitFlexItem = omitCheckbox.closest(".flex-opt-clickable.is-try");
    omitFlexItem.classList.add(optionClass);
    if (quizLink) quizLink.classList.remove(optionClass);

    // If no option is chosen hide the check button
    checkButton = quizEl.querySelector("." + buttonClassName);
    if (checkButton) checkButton.classList.add("is-hidden");
  } else {
    // If an option is chosen set the check button as visible
    checkButton = quizEl.querySelector("." + buttonClassName);
    if (checkButton) checkButton.classList.remove("is-hidden");
  }

  // Update livebattle submit button state if on livebattle page
  if (window.location.href.includes("livebattle") && typeof updateSubmitButtonState === 'function') {
    updateSubmitButtonState();
  }
}

// Function to add try event listeners and restart the timer
function addTryEventListeners() {
  // Add event listener to the submit button
  document.querySelectorAll(".confirm-submit-button").forEach((element) => {
    const resultId = element.dataset.resultId;
    element.onclick = () => confirmSubmit(resultId);
  });

  // Add event listener to the cancel button
  document.querySelectorAll(".cancel-try-button").forEach((element) => {
    element.onclick = cancelTry;
  });

  // Add event listeners to all clickable flex-items
  document.querySelectorAll(".flex-opt-clickable.is-try").forEach((element) => {
    element.onclick = () => selectOptionTry(element);
  });

  // Add event listeners to all quiz check buttons
  addCheckQuizEventListeners();

  // Restart the stopwatch
  restartStopwatch();
}

/* ----------------------------------------- */
/* -------- FETCH TEST CONTENT AJAX -------- */
/* ----------------------------------------- */

// Already loaded scripts
const loadedScripts = [];
const loadedStyles = [];

// Function to handle the current state
function handleCurrentState() {
  window.wsBrowserAI?.updateStatus();
  // Get the element with id is-logged-in-html
  const isLoggedInHtml = document.getElementById("is-logged-in-html");
  if (isLoggedInHtml) {
    // Refresh account state after AJAX navigation.
    isLoggedIn = isLoggedInHtml.dataset.isLoggedIn === "true";
    username = isLoggedInHtml.dataset.username;
    isAdmin = isLoggedInHtml.dataset.isAdmin === "true";
    // If the user is logged in
    if (isLoggedIn) {
      // Hide login-modal if user is logged in
      const loginModal = document.getElementById("modal-login");
      if (loginModal) loginModal.classList.remove("is-active");
    }
    // Note: Navbar is rendered by server, no need to update it on AJAX navigation
  }

  // Call addEventListeners functions
  addAllEventListeners();

  // Find all scripts to load
  const scriptsToLoad = Array.from(document.querySelectorAll(
    "script.chart-js, script.title-metadata-js, script.test-edit-js, script.test-new-js, script.test-show-js, script.live-battle-js, script.user-skills-js, script.home-js"
  ));

  // Order by data-n attribute if present
  scriptsToLoad.sort((a, b) => {
    const aOrder = a.dataset.n || 0;
    const bOrder = b.dataset.n || 0;
    return aOrder - bOrder;
  });

  // Load any needed scripts. Chart.js inline scripts (class="chart-js") call
  // new Chart() synchronously — if the initial page didn't include Chart.js,
  // lazy-load it first, then execute those scripts.
  var pendingChartScripts = scriptsToLoad.filter(s => s.classList.contains('chart-js'));
  var otherScripts = scriptsToLoad.filter(s => !s.classList.contains('chart-js'));

  function runScript(script) {
    if (loadedScripts.includes(script.id)) return;
    if (script.id) loadedScripts.push(script.id);
    const newScript = document.createElement("script");
    Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.appendChild(document.createTextNode(script.innerHTML));
    script.parentNode.replaceChild(newScript, script);
  }

  function runAll(scripts) {
    scripts.forEach(runScript);
  }

  if (pendingChartScripts.length && typeof Chart === 'undefined') {
    ensureChartJsLoaded(function () {
      runAll(pendingChartScripts);
    });
  } else {
    runAll(pendingChartScripts);
  }
  runAll(otherScripts);

  // Load any needed stylesheets
  Array.from(document.querySelectorAll("link.test-edit-css, link.test-new-css")).forEach(link => {
    if (loadedStyles.includes(link.id)) return;
    loadedStyles.push(link.id);
    const newLink = document.createElement("link");
    Array.from(link.attributes).forEach(attr => newLink.setAttribute(attr.name, attr.value));
    link.parentNode.replaceChild(newLink, link);
  });

  // In case burguer menu is open, close it (and unlock body scroll)
  if (burger) burger.classList.remove("is-active");
  if (navbarMenu) {
    navbarMenu.classList.remove("is-active");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  // Scroll instantly to the top of the page
  window.scrollTo(0, 0);

  // If the path is /tests, add the event listeners for the test index
  if (window.location.pathname === "/tests") {
    // Get search query param from url
    const searchQuery = new URLSearchParams(window.location.search).get("search");
    addTestsIndexEventListeners();
    highlightSearchResults(searchQuery);
  } else if (window.location.pathname === "/users" || window.location.pathname === "/results") {
    // Get search query param from url
    const searchQuery = new URLSearchParams(window.location.search).get("search");
    addOtherIndexesEventListeners();
    highlightSearchResults(searchQuery);
  } else if (window.location.pathname === "/") {
    // Re-initialize home page scroll animations when returning home via AJAX
    if (typeof window.initHomeAnimations === "function") {
      window.initHomeAnimations();
    }
  }

  // Initialize flashcards study view when present (re-runs on every AJAX navigation)
  if (document.getElementById("flashcard-deck") && typeof initFlashcardsView === "function") {
    initFlashcardsView();
  }

  // Initialize flashcards editor when present (re-runs on every AJAX navigation)
  if ((document.getElementById("flashcards-els") || document.getElementById("modal-edit-flashcard-single")) && typeof addAllEditFlashcardsEventListeners === "function") {
    addAllEditFlashcardsEventListeners();
  }

  // Re-select the creation tab + consume any pending flashcards→notes prefill
  // when returning to /tests/new via AJAX
  if (window.location.pathname === "/tests/new" && typeof window.initNewTestView === "function") {
    window.initNewTestView();
  }
}

// Lazy-load MathJax / Chart.js when the user AJAX-navigates to a page that
// renders math or charts but the initial page didn't need them (keeps home,
// community, help etc. free of ~1.3 MB of scripts).
var pageAssetLocks = {};
function ensurePageAsset(kind, src, id, onload) {
  if (window[kind] && (kind !== 'MathJax' || window.MathJax.typesetPromise)) { if (onload) onload(); return; }
  if (pageAssetLocks[id]) { if (onload) pageAssetLocks[id].push(onload); return; }
  pageAssetLocks[id] = onload ? [onload] : [];
  var existing = document.getElementById(id);
  var script;
  if (existing && existing.src) {
    script = existing;
  } else {
    // Remove any empty placeholder with the same id, then create a real script
    if (existing) existing.remove();
    script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }
  script.addEventListener('load', function () {
    var cbs = pageAssetLocks[id] || [];
    pageAssetLocks[id] = [];
    if (kind === 'MathJax' && window.MathJax && window.MathJax.startup) {
      window.MathJax.startup.promise.then(function () {
        cbs.forEach(function (cb) { cb(); });
      });
    } else {
      cbs.forEach(function (cb) { cb(); });
    }
  });
}

function ensureMathJaxLoaded(cb) {
  if (window.MathJax && window.MathJax.typesetPromise) { cb(); return; }
  // Set config BEFORE loading the script (merge with any existing config so
  // displayMath and svg options from head.ejs are preserved)
  var base = (window.MathJax && typeof window.MathJax === 'object') ? window.MathJax : {};
  window.MathJax = Object.assign({}, base, {
    tex: Object.assign({}, base.tex, {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      processEscapes: true
    }),
    svg: Object.assign({}, base.svg, { fontCache: 'global' })
  });
  ensurePageAsset('MathJax', 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js', 'MathJax-script', cb);
}

function ensureChartJsLoaded(cb) {
  if (window.Chart) { cb(); return; }
  ensurePageAsset('Chart', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js', 'chart-js-script', cb);
}

// Update content and URL
var prevUrl = window.location.href;
var nUpdates = 0;
function updateContentAndURL(content, url) {
  nUpdates++;

  // NOTE: The full-page reload branches that existed here were added "for ads
  // insertion" (forcing a browser reload so AdSense would re-render). Ads are
  // gone, so we ALWAYS replace content via AJAX for the fastest, smoothest
  // experience.

  let currentContent = document.getElementById('body-content').innerHTML;
  // Update the content of the element with id "body-content"
  document.getElementById('body-content').innerHTML = content;

  // Render quiz markdown (incl. math source) to HTML synchronously FIRST. Quiz
  // question/option/explanation text is raw Markdown containing math delimiters
  // ($...$); MathJax must only typeset it AFTER marked.js has converted it to
  // HTML. Calling MathJax.typeset() first (as this used to) raced ahead of that
  // conversion: MathJax would typeset the raw, un-rendered source, then
  // renderQuizMarkdown() would read the now MathJax-mutated .textContent (with
  // math replaced by SVG/assistive-MathML) and overwrite it, corrupting the
  // formulas. Keep polling too, as a safety net for content added asynchronously.
  if (typeof renderQuizMarkdown === 'function') renderQuizMarkdown();
  setupQuizMarkdownPolling();

  // Call MathJax to re-render the math (content is real HTML by now, not markdown source).
  // If MathJax wasn't loaded on the initial page, lazy-load it first.
  if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
    MathJax.typesetPromise().catch((err) => console.warn('MathJax typeset error:', err));
  } else if (typeof MathJax !== 'undefined') {
    MathJax.typeset();
  } else if (/\$[^$]+\$|\\\(|\\\)/.test(document.getElementById('body-content').textContent)) {
    ensureMathJaxLoaded(function () {
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise().catch((err) => console.warn('MathJax typeset error:', err));
      }
    });
  }
  const prevUrlWithoutQuery = prevUrl.split("?")[0];
  const urlWithoutQuery = url.split("?")[0];
  const prevUrlIncludesTryTestOrEdit = prevUrlWithoutQuery.includes("/try") || prevUrlWithoutQuery.includes("/edit") || prevUrlWithoutQuery.includes("/new");
  if ((prevUrlWithoutQuery !== urlWithoutQuery) && !prevUrlIncludesTryTestOrEdit) {
    // Replace the current state with the current content
    history.replaceState({ content: currentContent }, '', prevUrl);
    // Push the new state to the history stack
    history.pushState({ content: content }, '', url);
  } else {
    // Replace the current state with the new content
    history.replaceState({ content: content }, '', url);
  }

  // If the current URL includes "/try", "/edit", or "/results/ , or "/livebattle/" , hide the #body-background div
  if (url.includes("/try") || url.includes("/edit") || url.includes("/results/") || url.includes("/livebattle")) {
    document.getElementById("body-background").classList.add("is-hidden");
  }
  // Also hide it if the url is the "/" home route
  else if (url === "/") {
    document.getElementById("body-background").classList.add("is-hidden");
  } else {
    document.getElementById("body-background").classList.remove("is-hidden");
  }

  // Update the prevUrl
  prevUrl = url;
  // Handle current state
  handleCurrentState();
}

// Handle popstate event
function handlePopState(event) {
  // Restore the content from the state when navigating back or forward
  if (event.state && event.state.content) {
    document.getElementById('body-content').innerHTML = event.state.content;
    // Handle current state
    handleCurrentState();
  } else {
    document.getElementById('body-content').innerHTML = `
      <div class="container is-max-desktop has-text-centered">
        <h1 class="title is-1">404 Not Found</h1>
        <p class="subtitle is-3">The page you are looking for does not exist.</p>
        <a href="/" class="button is-primary">Go back home</a>
      </div>
    `;
  }
  // Set the prevUrl to the current url
  prevUrl = window.location.href;
}

// Hide reload button if the page doesnt contain "/tests", "/users" or "/results"
function showOrHideReloadButton() {
  // Forbidden strs
  const allowedStrs = ["/tests", "/users", "/results"];
  const forbiddenStrs = ["/new", "/edit", "/try"];
  if (
    allowedStrs.some(str => window.location.pathname.includes(str)) &&
    !forbiddenStrs.some(str => window.location.pathname.includes(str))
  ) {
    // reloadButton.classList.remove("is-hidden");
  } else {
    // reloadButton.classList.add("is-hidden");
  }
}

// Add event listener to popstate event
window.onpopstate = handlePopState;

// Add event listeners to all ajax-link elements
window.onload = function() {
  // Get body content element
  const content = document.getElementById('body-content').innerHTML;
  // Initialize the first state with the current content
  history.replaceState({ content: content }, '', window.location.href);
};


// Function to fetch the new body content from the href
// and replace the current content with the fetched content
let fetchBodyContentLocked = false;
async function fetchBodyContent(href, skipConfirmation = true) {
  // If fetchBodyContent is locked, return
  if (fetchBodyContentLocked) return;
  // Lock fetchBodyContent
  fetchBodyContentLocked = true;
  // Show a loading message
  var reloadButton = document.getElementById("reload-button");
  var prevInnerHTML = "";
  if (reloadButton) {
    prevInnerHTML = reloadButton.innerHTML;
    // Show a reloading message for 0.5 seconds
    if (localLang === "en") reloadButton.innerHTML = "Loading...";
    if (localLang === "es") reloadButton.innerHTML = "Cargando...";
  }
  // Add a query param ajax=true to the href
  const ajaxHref = href + (href.includes("?") ? "&" : "?") + "ajax=true";
  let changePage = true;
  // If not skipConfirmation
  if (!skipConfirmation) {
    let title, text, confirmButtonText, cancelButtonText;
    if (localLang === "en") {
      title = "Change page?";
      text = "Are you sure you want to change the page? Your progress might be lost.";
      confirmButtonText = "Yes, leave!";
      cancelButtonText = "No, stay";
    } else if (localLang === "es") {
      title = "¿Cambiar de página?";
      text = "¿Estás seguro de que quieres cambiar de página? Tu progreso se podría perder.";
      confirmButtonText = "¡Sí, salir!";
      cancelButtonText = "No, quedarse";
    }
    await Swal.fire({
      title: title,
      text: text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
      reverseButtons: true
    }).then((result) => {
      // If the user confirms do nothing
      if (!result.isConfirmed) {
        changePage = false;
      }
    });
  }

  // Fetch the content
  if (!changePage) {
    fetchBodyContentLocked = false;
    if (reloadButton) reloadButton.innerHTML = prevInnerHTML;
    return;
  }
  // Reset unsavedChanges to false
  unsavedChanges = false;
  fetch(ajaxHref)
    .then(response => {
      // Handle 401 (Unauthorized) - server returns login-required HTML
      if (response.status === 401) {
        return response.json().then(data => {
          // Load the login-required content
          updateContentAndURL(data.renderedHTML, href);
          fetchBodyContentLocked = false;
          if (reloadButton) reloadButton.innerHTML = prevInnerHTML;
          return null; // Signal that we've handled this
        });
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // If data is null, we already handled the response (e.g., 401)
      if (data === null) return;

      // Load the new body content
      updateContentAndURL(data.renderedHTML, href);

      // Unlock fetchBodyContent
      fetchBodyContentLocked = false;
      // Hide the loading message
      if (reloadButton) reloadButton.innerHTML = prevInnerHTML;
    })
    .catch((error) => {
      console.error("AJAX navigation error:", error);
      // If an error occurs, show a sweet alert
      if (localLang === "en") showSweetAlert("An error occurred trying to load the content. Please try again in a few seconds.", "error");
      if (localLang === "es") showSweetAlert("Ocurrió un error al intentar cargar el contenido. Por favor, inténtalo de nuevo en unos segundos.", "error");

      // Unlock fetchBodyContent
      fetchBodyContentLocked = false;
      // Hide the loading message
      if (reloadButton) reloadButton.innerHTML = prevInnerHTML;
    });
}

/* ----------------------------------------- */
/* -------------- AJAX LINKS --------------- */
/* ----------------------------------------- */

// Function to handle the AJAX request when clicking an ajax-link
function ajaxLinkOnClick(event, link) {
  // Get the closest parent of the clicked element with an href or data-href attribute
  const closestParentLinkEl = event.target.closest("[href], [data-href]");
  // Get the closest parent href or data-href value
  const closestParentHref = closestParentLinkEl.href || closestParentLinkEl.dataset.href;
  // If the links dont match, dont trigger the fetchBodyContent function
  if (closestParentHref !== link.dataset.href) return;
  const skipConfirmation = !((window.location.href.includes("/try") || window.location.href.includes("/edit")) && unsavedChanges);
  fetchBodyContent(link.dataset.href, skipConfirmation);
}

// Add onclick event listener to all ajax-link elements
function addAjaxLinkEventListeners() {
  const ajaxLinks = document.querySelectorAll(".ajax-link");
  ajaxLinks.forEach((link) => {
    link.onclick = (event) => ajaxLinkOnClick(event, link);
  });
}

/* ----------------------------------------- */
/* ------ REPLACE TEST LINKS BY SPANS ------ */
/* ----------------------------------------- */

// Funtion to replace these elements by spans with class="ajax-link"
// Clicking these elements must trigger an AJAX request to get the test content
function replaceTestLinksByOnClickEventListeners() {
  // Get all the links to replace
  const pathsToReplace = [
    "='/'",
    "='/from-old-exam'",
    "='/from-notes-or-text'",
    "='/from-instructions'",
    "='/about'",
    "='/premium'",
    "='/support'",
    "='/help'",
    "='/tips'",
    "='/faq'",
    "='/privacy-policy'",
    "='/terms-of-use'",
    "='/community'",
    "^='/tests'",
    "^='/users'",
    "^='/results'",
    "^='/livebattle'",
  ];

  // Query selector to get all the links to replace
  let querySelectorStr = "";
  for (const pathToReplace of pathsToReplace) {
    querySelectorStr += `[href${pathToReplace}], `;
    querySelectorStr += `[data-href${pathToReplace}], `;
  }

  // Get all the links to replace
  const nonAjaxLinks = Array.from(document.querySelectorAll(querySelectorStr.slice(0, -2)));

  // Modify the links to trigger an AJAX request
  nonAjaxLinks.forEach((link) => {
    // if(link.href && link.href.includes("/users")) console.log(link);
    // Remove is clickable class
    link.classList.remove("is-clickable");
    // Set the data-href attribute
    link.dataset.href = link.href || link.dataset.href;
    // Remove newEl href attribute
    // link.removeAttribute("href");
    // Add the ajax-link class
    link.classList.add("ajax-link");
    // Add the click event listener
    link.onclick = (event) => {
      // Prevent the default behavior
      event.preventDefault();
      // Trigger the fetchBodyContent function
      ajaxLinkOnClick(event, link);
    }
  });
}

/* ---------------------------------------------------- */
/* ------ ADD TIPS AND FAQ MODAL EVENT LISTENERS ------ */
/* ---------------------------------------------------- */
// Show the tips | faq modal when navbar button is clicked
function addTipsFAQModalEventListeners() {
  // Get help trigger buttons
  const modalTipsButton = document.getElementById("modal-tips-button");
  const modalFAQButton = document.getElementById("modal-faq-button");

  // If the button are present, add event listeners to activate modal
  if (modalTipsButton) {
    modalTipsButton.onclick = () => {
      openModal(document.getElementById("modal-tips"));
    };
  }
  if (modalFAQButton) {
    modalFAQButton.onclick = () => {
      openModal(document.getElementById("modal-faq"));
    };
  }
}

// Add event listeners to show / hide answers of FAQs
function addFAQAnswersEventListeners() {
  // Get all faq-item elements
  const faqItems = document.querySelectorAll('.faq-item');

  // If they exist, add event listeners
  if (faqItems) {
    // Add event listener to the faq-item
    faqItems.forEach(item => {
      // Get the faq-answer element
      const answer = item.querySelector('.faq-answer');
      // Get the faq-show-answer element
      const showAnswer = item.querySelector('.faq-show-answer');

      // Add event listener to the faq-item to show/hide the faq-answer
      // and change the faq-show-answer icon
      item.onclick = () => {
        if (answer.style.display === 'none' || answer.style.display === '') {
          answer.style.display = 'block';
          showAnswer.querySelector('i').classList.replace('fa-angle-down', 'fa-angle-up');
        } else {
          answer.style.display = 'none';
          showAnswer.querySelector('i').classList.replace('fa-angle-up', 'fa-angle-down');
        }
      }
    });
  }
}

// Add event listeners to show / hide details of changelog items
function addChangelogItemsEventListeners() {
  // Get all changelog-item elements
  const changelogItems = document.querySelectorAll('.changelog-item');

  // If they exist, add event listeners
  if (changelogItems) {
    changelogItems.forEach(item => {
      // Get the changelog-item-details element
      const details = item.querySelector('.changelog-item-details');
      // Get the changelog-item-header and changelog-item-toggle elements
      const header = item.querySelector('.changelog-item-header');
      const toggle = item.querySelector('.changelog-item-toggle');

      if (!details || !header || !toggle) return;

      // Add event listener to the header to show/hide the details
      // and change the toggle icon
      header.onclick = () => {
        if (details.style.display === 'none' || details.style.display === '') {
          details.style.display = 'block';
          toggle.querySelector('i').classList.replace('fa-angle-down', 'fa-angle-up');
        } else {
          details.style.display = 'none';
          toggle.querySelector('i').classList.replace('fa-angle-up', 'fa-angle-down');
        }
      }
    });
  }

  // Get all changelog-item-try elements with a data-scroll-to attribute
  // and scroll to the target element within the modal when clicked
  const scrollTryButtons = document.querySelectorAll('.changelog-item-try[data-scroll-to]');
  scrollTryButtons.forEach(button => {
    button.onclick = (event) => {
      event.preventDefault();
      const target = document.querySelector(button.getAttribute('data-scroll-to'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  });
}

/* ---------------------------------------- */
/* ------ LOAD ALL EVENT LISTENERS -------- */
/* ---------------------------------------- */

// Changelog modal version - update this when you want to show the modal again
const CHANGELOG_VERSION = "2026-08-v1";

// Function to add changelog modal event listeners
function addChangelogModalEventListeners() {
  const modalChangelog = document.getElementById("modal-changelog");
  if (!modalChangelog) return;

  const openModalChangelogButtons = document.querySelectorAll(".open-modal-changelog-button");

  // Add click handlers to all open buttons
  openModalChangelogButtons.forEach(button => {
    button.onclick = () => {
      openModal(modalChangelog);
      // Mark as seen
      localStorage.setItem("changelog-seen", CHANGELOG_VERSION);
      // Remove pulse animation
      button.classList.remove("has-update");
    };
  });

  // Check if user has seen this version of changelog
  const seenVersion = localStorage.getItem("changelog-seen");
  if (seenVersion !== CHANGELOG_VERSION) {
    // Show pulse animation on button to indicate new updates
    openModalChangelogButtons.forEach(button => {
      button.classList.add("has-update");
    });

    // Auto-show modal on first visit — delayed well past LCP (6s) so it never
    // steals the largest-contentful-paint element or delays hero render.
    setTimeout(() => {
      // Only show if not already showing another modal
      const activeModals = document.querySelectorAll(".modal.is-active");
      if (activeModals.length === 0) {
        openModal(modalChangelog);
        localStorage.setItem("changelog-seen", CHANGELOG_VERSION);
        openModalChangelogButtons.forEach(button => {
          button.classList.remove("has-update");
        });
      }
    }, 6000);
  }
}

// Function to add all event listeners
function addAllEventListeners () {
  staggerAnimation(); // Stagger animation
  showOrHideReloadButton(); // Show or hide reload button
  addTipsFAQModalEventListeners(); // Tips and FAQ modal
  addFAQAnswersEventListeners(); // Show or hide answers of FAQs
  initControlPanel(); // Control panel
  showSessionAllowedNotifications(); // Show notifications not dismissed in this session
  addDeleteNotificationOrMessageEventListeners(); // Delete notifications and messages
  addOpenModalLiveBattleButtonEventListeners(); // Open modal live battle
  addChangelogModalEventListeners(); // Changelog modal
  addChangelogItemsEventListeners(); // Show or hide details of changelog items
  addTabToggleEventListeners(); // Handle tabs
  addPaginationEventListeners(); // Pagination
  addPreviewImagesEventListeners(); // Preview images
  getAndHideMarkedQuizOptions(); // Get and hide marked quiz options
  addScrollToQuizEventListeners(); // Scroll to quiz
  addModalTryEventListeners(); // Modal try
  showSearchInputNavbarContainer(); // Show search input in navbar
  addTryEventListeners(); // Try test
  addModalCloseEventListeners(); // Close modals
  addOpenModalEditTestButtonListeners(); // Open modal edit test
  addTextareaAutoResizeAndCounter(); // Textarea auto resize and counter
  addAjaxLinkEventListeners(); // AJAX links
  addIsClickableEventListeners(); // Is clickable hrefs
  addSortTableEventListeners(); // Sort tables
  addShareUserEventListeners(); // Share user
  addShareTestEventListeners(); // Share test
  addShareResultEventListeners(); // Share result
  addCardHideEventListeners(); // Show hidden card content
  addDeleteItemEventListeners(); // Delete items
  addFollowButtonEventListeners(); // Follow user
  addFavoriteButtonEventListeners(); // Favorite test
  addToggleCorrectAnswersEventListeners(); // Show correct answers
  addShowQuizByIdEventListeners(); // Show quiz by id
  addEditUserEventListeners(); // Edit user
  replaceTestLinksByOnClickEventListeners(); // Replace test links by onclick event listeners
  lazyLoadImages(); // Lazy load images

}

// Load all event listeners when document is ready
document.addEventListener("DOMContentLoaded", () => {
  addAllEventListeners();

  // Make index-menu dropdowns (language/sort filters) toggle on click too,
  // not just hover: trackpads/touch devices and some browsers never fire
  // :hover reliably, and hover-only leaves the menu clipped/dead.
  document.querySelectorAll(".index-menu .dropdown").forEach((dd) => {
    const trigger = dd.querySelector(".dropdown-trigger");
    if (!trigger) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasActive = dd.classList.contains("is-active");
      // Close sibling dropdowns
      dd.parentElement.querySelectorAll(".dropdown.is-active").forEach((other) => {
        if (other !== dd) other.classList.remove("is-active");
      });
      dd.classList.toggle("is-active", !wasActive);
    });
  });
  document.addEventListener("click", (e) => {
    document.querySelectorAll(".index-menu .dropdown.is-active").forEach((dd) => {
      if (!dd.contains(e.target)) dd.classList.remove("is-active");
    });
  });

  // Start polling to render markdown in quiz content
  setupQuizMarkdownPolling();

  // Add loaded scripts to the loadedScripts array
  document.querySelectorAll("script").forEach(script => {
    if (script.id) {
      loadedScripts.push(script.id);
    }
  });

  // Add loaded styles to the loadedStyles array
  document.querySelectorAll("link").forEach(link => {
    if (link.id) {
      loadedStyles.push(link.id);
    }
  });
});
