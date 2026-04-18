(function () {
  const settingsBtn = document.getElementById("settings-btn");
  const SETTINGS_STORAGE_KEY_NAME = "surecastSettingsV1";
  let settingsFormBound = false;

  const defaultSettings = {
    profile: {
      name: "",
      email: "",
      bio: ""
    },
    appearance: {
      theme: "dark",
      density: "comfortable",
      animations: true
    },
    notifications: {
      weather: true,
      bets: true,
      store: false
    },
    preferences: {
      defaultLocation: "",
      language: "en",
      analytics: false
    }
  };

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(defaultSettings));
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY_NAME) || "{}");
      return {
        profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
        appearance: { ...defaultSettings.appearance, ...(parsed.appearance || {}) },
        notifications: { ...defaultSettings.notifications, ...(parsed.notifications || {}) },
        preferences: { ...defaultSettings.preferences, ...(parsed.preferences || {}) }
      };
    } catch (error) {
      console.warn("Failed to load settings", error);
      return cloneDefaultSettings();
    }
  }

  let settingsState = loadSettings();

  function getSettingsEl(id) {
    return document.getElementById(id);
  }

  function updateSaveStatus(message = "Saved automatically") {
    const statusEl = getSettingsEl("settings-save-status");
    if (!statusEl) return;
    statusEl.textContent = message;
  }

  function applyTheme() {
    document.body.classList.toggle("theme-light", settingsState.appearance.theme === "light");
  }

  function applyDensity() {
    document.body.classList.toggle("density-compact", settingsState.appearance.density === "compact");
  }

  function persistSettings() {
    localStorage.setItem(SETTINGS_STORAGE_KEY_NAME, JSON.stringify(settingsState));
    applyTheme();
    applyDensity();
    updateSaveStatus("Saved");
    setTimeout(() => updateSaveStatus("Saved automatically"), 1500);
  }

  function fillSettingsForm() {
    const settingsPage = getSettingsEl("settings-page");
    if (!settingsPage) return;

    const fields = {
      "settings-name": settingsState.profile.name,
      "settings-email": settingsState.profile.email,
      "settings-bio": settingsState.profile.bio,
      "settings-theme": settingsState.appearance.theme,
      "settings-density": settingsState.appearance.density,
      "settings-default-location": settingsState.preferences.defaultLocation,
      "settings-language": settingsState.preferences.language
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = getSettingsEl(id);
      if (el) el.value = value;
    });

    const checkboxes = {
      "settings-animations": settingsState.appearance.animations,
      "settings-weather-notifications": settingsState.notifications.weather,
      "settings-bet-notifications": settingsState.notifications.bets,
      "settings-store-notifications": settingsState.notifications.store,
      "settings-share-analytics": settingsState.preferences.analytics
    };

    Object.entries(checkboxes).forEach(([id, value]) => {
      const el = getSettingsEl(id);
      if (el) el.checked = Boolean(value);
    });
  }

  function bindSettingsForm() {
    if (settingsFormBound) return;

    const settingsPage = getSettingsEl("settings-page");
    if (!settingsPage) return;

    const textMappings = [
      ["settings-name", ["profile", "name"]],
      ["settings-email", ["profile", "email"]],
      ["settings-bio", ["profile", "bio"]],
      ["settings-theme", ["appearance", "theme"]],
      ["settings-density", ["appearance", "density"]],
      ["settings-default-location", ["preferences", "defaultLocation"]],
      ["settings-language", ["preferences", "language"]]
    ];

    textMappings.forEach(([id, path]) => {
      const el = getSettingsEl(id);
      if (!el) return;
      el.addEventListener("input", () => {
        settingsState[path[0]][path[1]] = el.value;
        persistSettings();
      });
      el.addEventListener("change", () => {
        settingsState[path[0]][path[1]] = el.value;
        persistSettings();
      });
    });

    const checkboxMappings = [
      ["settings-animations", ["appearance", "animations"]],
      ["settings-weather-notifications", ["notifications", "weather"]],
      ["settings-bet-notifications", ["notifications", "bets"]],
      ["settings-store-notifications", ["notifications", "store"]],
      ["settings-share-analytics", ["preferences", "analytics"]]
    ];

    checkboxMappings.forEach(([id, path]) => {
      const el = getSettingsEl(id);
      if (!el) return;
      el.addEventListener("change", () => {
        settingsState[path[0]][path[1]] = el.checked;
        persistSettings();
      });
    });

    settingsFormBound = true;
  }

  function openSettingsPage() {
    if (typeof openPage !== "function") return;
    openPage("settings-page", settingsBtn);
    fillSettingsForm();
    updateSaveStatus("Saved automatically");
  }

  function initializeSettingsPage() {
    applyTheme();
    applyDensity();
    fillSettingsForm();
    bindSettingsForm();

    if (settingsBtn && !settingsBtn.dataset.settingsBound) {
      settingsBtn.addEventListener("click", openSettingsPage);
      settingsBtn.dataset.settingsBound = "true";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSettingsPage);
  } else {
    initializeSettingsPage();
  }

  window.openSettingsPage = openSettingsPage;
})();
