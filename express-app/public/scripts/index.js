/* ----------------------------------------------------------- */
/* ----------------- OTHER INDEX PAGES ----------------------- */
/* ----------------------------------------------------------- */

// Search function
function search() {
  const searchInputValue = document.getElementById("searchInput").value;

  // Get current url params
  const urlParams = new URLSearchParams(window.location.search);

  // Remove pageno param in case present
  urlParams.delete("pageno");

  // Change search param
  urlParams.set("search", searchInputValue);

  // New url with updated params
  const newUrl = window.location.origin + window.location.pathname + '?' + urlParams.toString();
  // Fetch the body content
  fetchBodyContent(newUrl);
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

  // New url with updated params
  const newUrl = window.location.origin + window.location.pathname + '?' + urlParams.toString();
  // Fetch the body content
  fetchBodyContent(newUrl);
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

  // New url with updated params
  const newUrl = window.location.origin + window.location.pathname + '?' + urlParams.toString();
  // Fetch the body content
  fetchBodyContent(newUrl);
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

  // New url with updated params
  const newUrl = window.location.origin + window.location.pathname + '?' + urlParams.toString();
  // Fetch the body content
  fetchBodyContent(newUrl);
}

// Function to add event listeners for other indexes
function addOtherIndexesEventListeners() {
  // Add event listener for the Enter key press
  const indexMenuEl = document.querySelector(".index-menu");
  if (indexMenuEl) {
    indexMenuEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        // Perform search
        search();
      }
    });
  }

  // Add event listener for changing the search input value when the user stops typing
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(this.timeout);
      // Set a timeout to search tests 800ms after the user stops typing
      this.timeout = setTimeout(() => search(), 800);
    });

    // Put the focus on the search input's last character if the device is not a mobile
    if ( !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ) {
      searchInput.focus();
      const searchInputValue = document.getElementById("searchInput").value;
      searchInput.value = "";
      searchInput.value = searchInputValue;
    }
  }

  // If the search query is not empty, highlight occurrences of the search query
  const searchQuery = new URLSearchParams(window.location.search).get("search");
  if (searchQuery) {
    // Highlight all occurrences of the search query in elements with class: test-name, test-topic, test-desc
    document.querySelectorAll(".user-username, .user-name, .user-desc").forEach(element => {
      element.innerHTML = element.innerHTML.replace(new RegExp(searchQuery, "gi"), "<mark>$&</mark>");
    });
  }

  // Add event listeners for orderby selectors
  const selectOrderByButtons = document.querySelectorAll(".select-order-button");
  selectOrderByButtons.forEach(element => {
    element.onclick = (e) => {
      e.preventDefault();
      selectOrderBy(element.dataset.order);
    };
  });

  // Add event listeners for orderdir button
  const changeOrderDirButtons = document.querySelectorAll(".change-orderdir-button");
  changeOrderDirButtons.forEach(element => {
    element.onclick = (e) => {
      e.preventDefault();
      changeOrderDir();
    }
  });

  // Add event listeners for type selectors
  const selectTypeButtons = document.querySelectorAll(".select-type-button");
  selectTypeButtons.forEach(element => {
    element.onclick = (e) => {
      e.preventDefault();
      selectType(element.dataset.type);
    };
  });

  // Add event listeners for elements with class tag-delete-button
  const tagDeleteButtons = document.querySelectorAll(".tag-delete-button");
  tagDeleteButtons.forEach(element => {
    // Get the data-tag-name attribute value
    const tagName = element.dataset.tagName;
    element.onclick = (e) => {
      e.preventDefault();
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
      // New url with updated params
      const newUrl = window.location.origin + window.location.pathname + '?' + urlParams.toString();
      // Fetch the body content
      fetchBodyContent(newUrl);
    };
  });
}

// Call addEventListeners function after the document has loaded
document.addEventListener("DOMContentLoaded", () => {
  // If the path is exactly /users or /results
  if (window.location.pathname === "/users" || window.location.pathname === "/results") {
    // Call addEventListeners functions
    addOtherIndexesEventListeners();
    // Highlight search results on page load
    const searchQuery = new URLSearchParams(window.location.search).get("search");
    highlightSearchResults(searchQuery);
  }
});
