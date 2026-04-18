const alertsBtn = document.getElementById("alerts-btn");
const USER_ALERTS_STORAGE_KEY = "userAlertsV2";
const SETTINGS_STORAGE_KEY = "surecastSettingsV1";
let userAlerts = loadUserAlerts();
let latestSystemAlerts = [];

function getEl(id) {
  return document.getElementById(id);
}

function openAlertsPage() {
  openPage("alerts-page", alertsBtn);
}

function getCurrentProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    const profile = parsed.profile || {};
    return {
      name: String(profile.name || "").trim(),
      email: String(profile.email || "").trim()
    };
  } catch (error) {
    console.warn("Failed to read profile for alerts", error);
    return { name: "", email: "" };
  }
}

function getAlertAuthorLabel(alertItem) {
  const name = String(alertItem.authorName || "").trim();
  const email = String(alertItem.authorEmail || "").trim();
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return "Anonymous profile";
}

function loadUserAlerts() {
  try {
    const rawAlerts = JSON.parse(localStorage.getItem(USER_ALERTS_STORAGE_KEY) || localStorage.getItem("userAlerts") || "[]");
    return Array.isArray(rawAlerts) ? rawAlerts.map(normalizeUserAlert).filter(Boolean) : [];
  } catch (error) {
    console.warn("Failed to parse stored user alerts", error);
    return [];
  }
}

function normalizeUserAlert(alertItem) {
  if (!alertItem || typeof alertItem !== "object") return null;

  return {
    id: alertItem.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    location: String(alertItem.location || "").trim(),
    text: String(alertItem.text || "").trim(),
    image: alertItem.image || null,
    authorName: String(alertItem.authorName || "").trim(),
    authorEmail: String(alertItem.authorEmail || "").trim(),
    createdAt: alertItem.createdAt || new Date().toISOString(),
    expiresAt: alertItem.expiresAt || null
  };
}

function persistUserAlerts() {
  localStorage.setItem(USER_ALERTS_STORAGE_KEY, JSON.stringify(userAlerts));
}

function pruneExpiredAlerts() {
  const now = Date.now();
  const beforeCount = userAlerts.length;
  userAlerts = userAlerts.filter((alertItem) => !alertItem.expiresAt || new Date(alertItem.expiresAt).getTime() > now);

  if (userAlerts.length !== beforeCount) {
    persistUserAlerts();
  }
}

function formatDateTime(value) {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return date.toLocaleString();
}

function getExpiryDurationMs(value, unit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return unit === "days" ? numericValue * 24 * 60 * 60 * 1000 : numericValue * 60 * 60 * 1000;
}

function getUserAlertsContainer() {
  return getEl("user-alerts-container");
}

function getSystemAlertsContainer() {
  return getEl("system-alerts-container");
}

function buildSystemAlerts(weatherData) {
  if (!weatherData?.current) return [];

  const alerts = [];
  const temp = Number(weatherData.current.temp_c);
  const wind = Number(weatherData.current.wind_kph);
  const rain = Number(weatherData.current.precip_mm);
  const condition = String(weatherData.current.condition?.text || "").toLowerCase();
  const location = String(weatherData.location?.name || window.sureCastState?.locationName || "your area").trim();
  const createdAt = weatherData.current.last_updated || new Date().toISOString();

  if (temp > 35) {
    alerts.push({
      id: `system-heat-${location}`,
      title: "Heatwave",
      text: `${location} is running hot at around ${Math.round(temp)}°C. Stay hydrated and avoid peak afternoon sun.`,
      location,
      severity: "high",
      createdAt,
      source: "System"
    });
  }

  if (temp < 5) {
    alerts.push({
      id: `system-cold-${location}`,
      title: "Cold wave",
      text: `Cold conditions are active in ${location}, with temperatures near ${Math.round(temp)}°C.`,
      location,
      severity: "medium",
      createdAt,
      source: "System"
    });
  }

  if (wind > 40) {
    alerts.push({
      id: `system-wind-${location}`,
      title: "High wind",
      text: `Strong winds near ${Math.round(wind)} km/h are being detected in ${location}.`,
      location,
      severity: "medium",
      createdAt,
      source: "System"
    });
  }

  if (rain > 20) {
    alerts.push({
      id: `system-rain-${location}`,
      title: "Heavy rain",
      text: `${location} is seeing intense rain with precipitation around ${rain.toFixed(1)} mm.`,
      location,
      severity: "high",
      createdAt,
      source: "System"
    });
  }

  if (condition.includes("thunder")) {
    alerts.push({
      id: `system-thunder-${location}`,
      title: "Thunderstorm",
      text: `Thunderstorm conditions are active in ${location}. Indoor shelter is recommended.`,
      location,
      severity: "high",
      createdAt,
      source: "System"
    });
  }

  return alerts;
}

function getAlertsSnapshot() {
  pruneExpiredAlerts();
  return {
    system: latestSystemAlerts.map((alertItem) => ({ ...alertItem })),
    user: userAlerts.map((alertItem) => ({ ...alertItem, source: "User" }))
  };
}

function publishAlertsUpdate() {
  window.dispatchEvent(new CustomEvent("surecast:alerts-updated", { detail: getAlertsSnapshot() }));
}

function generateAlerts(weatherData) {
  const container = getSystemAlertsContainer();
  if (!container || !weatherData?.current) return;

  container.innerHTML = "";
  latestSystemAlerts = buildSystemAlerts(weatherData);

  if (latestSystemAlerts.length === 0) {
    container.innerHTML = '<div class="store-item alerts-empty-card">No system alerts right now.</div>';
    publishAlertsUpdate();
    return;
  }

  latestSystemAlerts.forEach((alertItem) => {
    const div = document.createElement("div");
    div.className = "store-item";
    div.innerHTML = `
      <h3>${escapeHtml(alertItem.title)}</h3>
      <p>${escapeHtml(alertItem.text)}</p>
      <div class="alert-card-meta">Updated: ${formatDateTime(alertItem.createdAt)}</div>
    `;
    container.appendChild(div);
  });

  publishAlertsUpdate();
}

function renderUserAlerts() {
  pruneExpiredAlerts();

  const container = getUserAlertsContainer();
  if (!container) return;

  container.innerHTML = "";

  if (!userAlerts.length) {
    container.innerHTML = '<div class="store-item alerts-empty-card">No uploaded alerts yet.</div>';
    publishAlertsUpdate();
    return;
  }

  userAlerts.forEach((alertItem) => {
    const div = document.createElement("div");
    div.className = "store-item user-alert";
    div.innerHTML = `
      <div class="alert-card-header">
        <div>
          <h3>${escapeHtml(alertItem.location)}</h3>
          <div class="alert-card-meta">Posted by: ${escapeHtml(getAlertAuthorLabel(alertItem))}</div>
          <div class="alert-card-meta">Created: ${formatDateTime(alertItem.createdAt)}</div>
          <div class="alert-card-meta">Removes: ${formatDateTime(alertItem.expiresAt)}</div>
        </div>
        <button class="alert-delete-btn" data-alert-id="${alertItem.id}">Remove</button>
      </div>
      <p>${escapeHtml(alertItem.text)}</p>
      ${alertItem.image ? `<img src="${alertItem.image}" alt="Alert upload for ${escapeHtml(alertItem.location)}" class="alert-user-image">` : ""}
    `;
    container.appendChild(div);
  });

  publishAlertsUpdate();
}

function resetAlertForm() {
  if (getEl("alert-location")) getEl("alert-location").value = "";
  if (getEl("alert-text")) getEl("alert-text").value = "";
  if (getEl("alert-image")) getEl("alert-image").value = "";
  if (getEl("alert-expiry-value")) getEl("alert-expiry-value").value = "24";
  if (getEl("alert-expiry-unit")) getEl("alert-expiry-unit").value = "hours";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function deleteAlert(alertId) {
  userAlerts = userAlerts.filter((alertItem) => alertItem.id !== alertId);
  persistUserAlerts();
  renderUserAlerts();
  if (typeof showToast === "function") showToast("Alert removed");
}

function setupAlertDeleteHandler() {
  const container = getUserAlertsContainer();
  if (!container) return;

  container.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".alert-delete-btn");
    if (!deleteButton) return;
    deleteAlert(deleteButton.getAttribute("data-alert-id"));
  });
}

function resizeImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image file could not be read"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => resolve(typeof reader.result === "string" ? reader.result : null);
      image.onload = () => {
        const maxDimension = 1400;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(typeof reader.result === "string" ? reader.result : null);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

async function saveAlert(location, text, image, expiryValue, expiryUnit) {
  const expiryMs = getExpiryDurationMs(expiryValue, expiryUnit);
  if (!expiryMs) {
    alert("Enter a valid number of hours or days");
    return;
  }

  const now = Date.now();
  const profile = getCurrentProfile();
  const alertItem = {
    id: `alert-${now}-${Math.random().toString(36).slice(2, 8)}`,
    location,
    text,
    image,
    authorName: profile.name,
    authorEmail: profile.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiryMs).toISOString()
  };

  userAlerts.unshift(alertItem);

  try {
    persistUserAlerts();
  } catch (error) {
    console.error("Failed to persist alert", error);
    userAlerts.shift();
    alert("That image is too large to store. Try a smaller photo.");
    return;
  }

  renderUserAlerts();
  resetAlertForm();
  if (typeof showToast === "function") showToast("Alert added");
}

function setupAlertForm() {
  const btn = getEl("submit-alert");
  if (!btn) return;

  btn.onclick = async () => {
    const location = getEl("alert-location")?.value.trim();
    const text = getEl("alert-text")?.value.trim();
    const fileInput = getEl("alert-image");
    const expiryValue = getEl("alert-expiry-value")?.value;
    const expiryUnit = getEl("alert-expiry-unit")?.value || "hours";

    if (!location || !text) {
      alert("Fill all fields");
      return;
    }

    let image = null;
    const file = fileInput?.files?.[0];

    if (file) {
      try {
        image = await resizeImageDataUrl(file);
      } catch (error) {
        console.error("Alert image processing failed", error);
        alert("Image upload failed. Try a different photo.");
        return;
      }
    }

    await saveAlert(location, text, image, expiryValue, expiryUnit);
  };
}

function refreshAlertsPage() {
  renderUserAlerts();
  publishAlertsUpdate();
}

document.addEventListener("DOMContentLoaded", () => {
  setupAlertForm();
  setupAlertDeleteHandler();
  pruneExpiredAlerts();
  renderUserAlerts();

  setInterval(() => {
    const before = userAlerts.length;
    pruneExpiredAlerts();
    if (userAlerts.length !== before) {
      renderUserAlerts();
    } else {
      publishAlertsUpdate();
    }
  }, 60 * 1000);

  if (!alertsBtn) return;

  alertsBtn.addEventListener("click", () => {
    openAlertsPage();
    refreshAlertsPage();
  });
});

window.generateWeatherAlerts = generateAlerts;
window.getSureCastAlerts = getAlertsSnapshot;
