/* ----------------------------------------------------------- */
/* ----------------------- TESTS INDEX ----------------------- */
var isTestIndexJSLoaded = false;

/* ----------------------------------------------- */
/* ------------ LOADING ANIMATION ---------------- */
/* ----------------------------------------------- */

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ------------------------------------------------ */
/* ------------ HIGHLIGHT SEARCH RESULTS ---------- */
/* ------------------------------------------------ */

function highlightSearchResults(searchQuery) {
  try {
    if (searchQuery && searchQuery.length > 0) {
      // Get the words in the search query
      let searchWords = searchQuery.split(" ");
      // Remove empty strings from the searchWords array
      searchWords = searchWords.filter(word => word.length > 0);

      // Highlight all occurrences of the search query in elements with class: test-name, test-topic
      document.querySelectorAll(".test-name, .test-topic").forEach(element => {
        searchWords.forEach(word => {
          element.innerHTML = element.innerHTML.replace(new RegExp(word, "gi"), "<mark>$&</mark>");
        });
      });

      // Highlight all occurrences of the search query in elements with class: test-desc
      // Also find their closest parent with class: test-card and click its child with class: card-hide-button
      document.querySelectorAll(".test-desc").forEach(element => {
        searchWords.forEach(word => {
          element.innerHTML = element.innerHTML.replace(new RegExp(word, "gi"), "<mark>$&</mark>");
        });
        const isContentHidden = element.closest(".card-hideable-content").classList.contains("is-hidden");
        if (isContentHidden && searchQuery.length > 5) {
          element.closest(".test-card").querySelector(".card-hide-button").click();
        }
        if (!isContentHidden && searchQuery.length <= 5) {
          element.closest(".test-card").querySelector(".card-hide-button").click();
        }
      });
    }
  } catch (error) {
    // Log the error
    // console.error("Error highlighting search results:", error);
  }
}

function removeHighlightSearchResults() {
  // Remove all highlights
  document.querySelectorAll("mark").forEach(element => {
    element.outerHTML = element.innerHTML;
  });
}


/* ----------------------------------------------- */
/* ---------- FILTERING AND SORTING -------------- */
/* ----------------------------------------------- */

// Search function
function searchTests() {
  const searchInputValue = document.getElementById("searchInput").value;

  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change search param
  urlParams.set("search", searchInputValue);

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Select language
function selectLang(lang) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change lang param
  urlParams.set("lang", lang);

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Select orderby
function selectOrderBy(orderby) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change orderby param
  urlParams.set("orderby", orderby);

  // Change orderdir param
  urlParams.set("orderdir", "desc");

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Change orderdir
function changeOrderDir() {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change orderdir param
  if (urlParams.get("orderdir") === "asc") {
    urlParams.set("orderdir", "desc");
  } else {
    urlParams.set("orderdir", "asc");
  }

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Select type
function selectType(type) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change type param
  urlParams.set("type", type);

  // Remove username param
  urlParams.delete("username");

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Select topic
function selectTopic(topic) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change topic param
  urlParams.set("topic", topic);

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}

// Remove tag
function removeTag(tagName) {
  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Remove tag param
  urlParams.delete(tagName);

  // Remove also orderdir if tagname is orderby
  if (tagName === "orderby") {
    urlParams.delete("orderdir");
  }

  // Remove also type if tagname is username and type is mine
  if (tagName === "username" && urlParams.get("type") === "mine") {
    urlParams.delete("type");
  }

  // Fetch tests from the server that match the params
  fetchTestsByParams(urlParams);
}


/* ----------------------------------------------- */
/* ------------ FETCH TESTS FUNCTION ------------- */
/* ----------------------------------------------- */

// Fetch tests from the server that match the params
async function fetchTestsByParams(urlParams) {
  // Get the url params string
  const newUrl = "/tests?" + urlParams.toString();

  // Get userContent element
  const userContentEl = document.getElementById("usercontent");
  const paginationContainerEl = document.getElementById("pagination-container");

  // Get the current test ids
  const testCards = document.querySelectorAll(".test-card");
  const testIds = Array.from(testCards).map(testCard => testCard.dataset.testId);
  const oldSearch = new URLSearchParams(window.location.search).get("search");
  const newSearch = urlParams.get("search");

  fetch(newUrl + "&ajax=true")
    .then(response => response.json())
    .then(data => {
      // Get the renderedHTML
      const renderedHTML = data.renderedHTML;
      const contextualFragment = document.createRange().createContextualFragment(renderedHTML);
      // Get the section with id usercontent and replace all its content with the same section in the renderedHTML
      const renderedUserContentEl = contextualFragment.querySelector("#usercontent");
      const renderedPaginationContainerEl = contextualFragment.querySelector("#pagination-container");
      // New test cards
      const newTestCards = Array.from(document.createRange().createContextualFragment(renderedHTML).querySelectorAll(".test-card"));
      const newTestIds = newTestCards.map(testCard => testCard.dataset.testId);
      // If they are the same ids in the same order, and search changed, do nothing
      if ((testIds.join() === newTestIds.join()) && (oldSearch !== newSearch)) {
        // Remove the highlight of the search results
        removeHighlightSearchResults();
        // Highlight search results
        highlightSearchResults(newSearch);
        // Current content
        const currentContent = document.getElementById('body-content').innerHTML;
        // Replace the url without adding it to the history
        history.replaceState({ path: newUrl, content: currentContent}, "", newUrl);
        return;
      }
      // Get the section with id usercontent and replace all its content with the renderedHTML
      userContentEl.outerHTML = renderedUserContentEl.outerHTML;
      paginationContainerEl.outerHTML = renderedPaginationContainerEl.outerHTML;
      // Call addEventListeners functions
      addAllEventListeners();
      addTestsIndexEventListeners();
      // Highlight search results
      removeHighlightSearchResults();
      highlightSearchResults(newSearch);
      // Execute any script tags in the renderedHTML (with class chart-js or tables-js)
      Array.from(document.querySelectorAll("script.chart-js")).forEach(script => {
        const newScript = document.createElement("script");
        Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(script.innerHTML));
        script.parentNode.replaceChild(newScript, script);
      });
      // Replace the url without pushing it to the history
      const bodyContent = document.getElementById("body-content");
      window.history.replaceState({ content: bodyContent.innerHTML }, "", newUrl);
      // Scroll instantly to the top of the page
      const testsIndexMenuEl = document.getElementById("tests-index-menu");
      const navbarEl = document.getElementById("main-navbar");
      const navbarHeight = navbarEl.getBoundingClientRect().height;
      const testsIndexMenuTop = testsIndexMenuEl.getBoundingClientRect().top;
      window.scrollBy({ top: testsIndexMenuTop - navbarHeight, behavior: "instant" });
    }).catch(error => console.error(error));
}

/* ----------------------------------------------- */
/* -------------- EVENT LISTENERS ---------------- */
/* ----------------------------------------------- */

function addTestsIndexEventListeners() {
  // Add event listeners for language selectors
  const selectLangButtons = document.querySelectorAll(".select-lang-button");
  if (selectLangButtons) {
    selectLangButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        selectLang(element.dataset.lang);
      };
    });
  }

  // Add event listeners for orderby selectors
  const selectOrderButtons = document.querySelectorAll(".select-order-button");
  if (selectOrderButtons) {
    selectOrderButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        selectOrderBy(element.dataset.order);
      };
    });
  }

  // Add event listeners for orderdir button
  const changeOrderDirButtons = document.querySelectorAll(".change-orderdir-button");
  if (changeOrderDirButtons) {
    changeOrderDirButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        changeOrderDir();
      }
    });
  }

  // Add event listeners for type selectors
  const selectTypeButtons = document.querySelectorAll(".select-type-button");
  if (selectTypeButtons) {
    selectTypeButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        selectType(element.dataset.type);
      };
    });
  }

  // Add event listeners for topic selectors
  const selectTopicButtons = document.querySelectorAll(".select-topic-button");
  if (selectTopicButtons) {
    selectTopicButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        selectTopic(element.dataset.topic);
      };
    });
  }

  // Add event listeners for elements with class tag-delete-button
  const tagDeleteButtons = document.querySelectorAll(".tag-delete-button");
  if (tagDeleteButtons) {
    tagDeleteButtons.forEach(element => {
      element.onclick = (e) => {
        e.preventDefault();
        removeTag(element.dataset.tagName);
      };
    });
  }

  // Hide search input in navbar container (only relevant when actually on the /tests page,
  // since this script and its DOMContentLoaded handler load globally on every page)
  if (window.location.pathname === "/tests") {
    hideSearchInputNavbarContainer();
  }

  // Add event listener for changing the search input value when the user stops typing
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    // Add an input event listener to the search input
    searchInput.addEventListener("input", function() {
      clearTimeout(this.timeout);
      // Set a timeout to search 800 milliseconds after the user stops typing
      this.timeout = setTimeout(() => searchTests(), 800);
    });

    // Put the focus on the search input's last character if the device is not a mobile
    if ( !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ) {
      searchInput.focus();
      const searchInputValue = document.getElementById("searchInput").value;
      searchInput.value = "";
      searchInput.value = searchInputValue;
    }
  }
}

// Call addEventListeners function after the document has loaded
document.addEventListener("DOMContentLoaded", () => {
  // Call addEventListeners functions
  addTestsIndexEventListeners();
  // Highlight search results on page load
  const searchQuery = new URLSearchParams(window.location.search).get("search");
  highlightSearchResults(searchQuery);
});
