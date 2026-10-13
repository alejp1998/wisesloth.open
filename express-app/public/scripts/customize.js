// LANGUAGES
const STORAGE_KEY_LANG = "selected-lang";
// Choose Spanish as default if user connects from spanish-speaking country
const userLang = navigator.language || navigator.userLanguage;
const DEFAULT_LANG = userLang.startsWith("es") ? "es" : "en";

const stateLang = {
  chosenLang: DEFAULT_LANG,
};

const $langCycle = document.getElementById("selected-lang");
const $enButton = document.getElementById("en-button");
const $esButton = document.getElementById("es-button");

const setLanguage = (lang) => {
  const prevLocalLang = localLang;
  // Modify language buttons and cycle
  if ($enButton) $enButton.classList.remove("is-link");
  if ($esButton) $esButton.classList.remove("is-link");

  if (lang === "en") {
    if ($enButton) $enButton.classList.add("is-link");
  } else {
    if ($esButton) $esButton.classList.add("is-link");
  }

  // Set the language in the HTML tag
  document.documentElement.lang = lang;

  // If the language is the same, do nothing
  if (prevLocalLang === lang) {
    return;
  }

  // Update the state and local storage
  stateLang.chosenLang = lang;
  localLang = lang;
  window.localStorage.setItem(STORAGE_KEY_LANG, lang);

  // Change language in the backend if it's different
  if (prevLocalLang !== lang) {
    fetch(`/lang/${lang}`).catch((err) => {
      console.error("Error changing language: ", err);
    });
  }
};

// Direct toggle: language button switches EN <-> ES (no modal)
const toggleLanguage = () => {
  const next = localLang === "en" ? "es" : "en";
  setLanguage(next);
};

$langCycle.onclick = () => {
  toggleLanguage();
};

if ($enButton) {
  $enButton.onclick = () => {
    setLanguage("en");
  };
}

if ($esButton) {
  $esButton.onclick = () => {
    setLanguage("es");
  };
}

// Set the language to the default one if STORAGE_KEY_LANG is not set
// console.log("Storage key lang: ", window.localStorage.getItem(STORAGE_KEY_LANG));
let selectedLang = window.localStorage.getItem(STORAGE_KEY_LANG) || DEFAULT_LANG;
// console.log("Selected language: ", selectedLang);
setLanguage(selectedLang);

// THEMES
const STORAGE_KEY = "bulma-theme";
const SYSTEM_THEME = "system";
const DEFAULT_THEME = "light";

const state = {
  chosenTheme: SYSTEM_THEME, // light|dark|system
  appliedTheme: DEFAULT_THEME, // light|dark
  OSTheme: null, // light|dark|null
};

const $themeCycle = document.getElementById("selected-theme");
const $themeSwitchers = document.querySelectorAll(".theme-selector");

const updateThemeUI = () => {
  // The custom navbar uses a direct <i> icon inside #selected-theme (no .icon
  // wrapper), so target the <i> and be null-safe.
  const iconEl = $themeCycle ? ($themeCycle.querySelector("i") || $themeCycle.querySelector(".icon")) : null;
  if (!iconEl) return;
  if (state.appliedTheme === "light") {
    iconEl.className = "fas fa-lg fa-sun is-large";
    iconEl.style.color = "darkorange";
    $themeCycle.title = "Light mode";
  } else {
    iconEl.className = "fas fa-lg fa-moon is-large";
    iconEl.style.color = "orchid";
    $themeCycle.title = "Dark mode";
  }
};

// Set the theme and save it to local storage
const setTheme = (theme, save = true) => {
  const prevLocalTheme = localTheme;
  state.chosenTheme = theme;
  state.appliedTheme = theme;
  localTheme = theme;

  if (theme === SYSTEM_THEME) {
    state.appliedTheme = state.OSTheme;
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute("data-theme", theme);

    if (save) {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }

  const navbarLogo = document.getElementById("navbar-logo");
  const footerLogo = document.getElementById("footer-logo");

  if (theme === "dark") {
    // console.log("swal-dark-theme-css was disabled: ", document.getElementById("swal-dark-theme-css").disabled);
    // console.log("swal-light-theme-css was enabled: ", document.getElementById("swal-light-theme-css").disabled);
    document.getElementById("swal-dark-theme-css").disabled = false;
    document.getElementById("swal-light-theme-css").disabled = true;
    if (navbarLogo) navbarLogo.style.filter = "invert(1)";
    if (footerLogo) footerLogo.style.filter = "invert(1)";
  } else {
    // console.log("swal-dark-theme-css was enabled: ", document.getElementById("swal-dark-theme-css").disabled);
    // console.log("swal-light-theme-css was disabled: ", document.getElementById("swal-light-theme-css").disabled);
    document.getElementById("swal-dark-theme-css").disabled = true;
    document.getElementById("swal-light-theme-css").disabled = false;
    if (navbarLogo) navbarLogo.style.filter = "none";
    if (footerLogo) footerLogo.style.filter = "none";
  }

  // Update the UI
  updateThemeUI();

  // Change theme in the backend if it's different
  if (prevLocalTheme !== theme) {
    fetch(`/theme/${theme}`).catch((err) => {
      console.error("Error changing theme: ", err);
    });
  }
};

// Toggle between light and dark theme
const toggleTheme = () => {
  if (state.appliedTheme === "light") {
    setTheme("dark", true);
  } else {
    setTheme("light", true);
  }
};

// Detect the OS theme setting
const detectOSTheme = () => {
  if (!window.matchMedia) {
    // matchMedia method not supported
    return DEFAULT_THEME;
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    // OS theme setting detected as dark
    return "dark";
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return DEFAULT_THEME;
};

// Get the users OS theme preference
state.OSTheme = detectOSTheme();

// Apply the saved theme on page load so it survives FULL page loads.
// The server renders the session theme, but the visitor's local preference
// (localStorage) should always win — otherwise the theme "forgets" on reload.
const wsSavedTheme = window.localStorage.getItem(STORAGE_KEY);
if (wsSavedTheme === "dark" || wsSavedTheme === "light") {
  setTheme(wsSavedTheme, false);
}

// Event listeners
$themeCycle.onclick = () => {
  toggleTheme();
};

if ($themeSwitchers) {
  $themeSwitchers.forEach((el) => {
    el.onclick = () => {
      const theme = el.dataset.scheme;
      setTheme(theme);
    };
  });
}

// Listen for changes in the OS theme
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (event) => {
    const theme = event.matches ? "dark" : "light";
    state.OSTheme = theme;
    setTheme(theme);
  });

// Print the detected and website languages
// document.addEventListener("DOMContentLoaded", () => {
//   const detectedLanguage = navigator.language || navigator.userLanguage;
//   console.log(`Detected language: ${detectedLanguage}`);

//   // Optional: Compare with your website's language
//   const websiteLanguage = document.documentElement.lang;
//   console.log(`Website language: ${websiteLanguage}`);
// });
