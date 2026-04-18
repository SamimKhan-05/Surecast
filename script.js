/* script.js
   Map + weather + locate + store coin UI + search marker
   (store content unchanged except demo items removed)
*/
/* ===== GLOBAL PAGE NAVIGATION SYSTEM ===== */

function setPageVisibility(page, isVisible) {
  if (!page) return;
  page.classList.toggle("hidden", !isVisible);
  page.setAttribute("aria-hidden", String(!isVisible));
}

function hideAllPages() {
  const mainArea = document.querySelector(".main-area");
  const rightSidebar = document.querySelector(".right-sidebar");

  const storePage = document.getElementById("store-page");
  const predictionPage = document.getElementById("prediction-page");
  const alertsPage = document.getElementById("alerts-page");
  const settingsPage = document.getElementById("settings-page");

  if (mainArea) mainArea.style.display = "none";
  if (rightSidebar) rightSidebar.style.display = "none";

  setPageVisibility(storePage, false);
  setPageVisibility(predictionPage, false);
  setPageVisibility(alertsPage, false);
  setPageVisibility(settingsPage, false);
}

function openPage(pageId, button) {
  const page = document.getElementById(pageId);
  if (!page) return;

  hideAllPages();
  setPageVisibility(page, true);

  document.querySelectorAll(".menu-item").forEach(btn =>
    btn.classList.remove("active")
  );

  if (button) button.classList.add("active");
}

function goHome() {
  const mainArea = document.querySelector(".main-area");
  const rightSidebar = document.querySelector(".right-sidebar");

  hideAllPages();

  if (mainArea) mainArea.style.display = "block";
  if (rightSidebar) rightSidebar.style.display = "flex";

  document.querySelectorAll(".menu-item").forEach(btn =>
    btn.classList.remove("active")
  );

  const homeBtn = document.getElementById("home-btn");
  if (homeBtn) homeBtn.classList.add("active");
  setTimeout(() => fixMapSize(), 80);
}
/* DOM */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const locateBtn = document.getElementById('locate-btn');
const shareBtn = document.getElementById('share-btn');
const unitToggle = document.getElementById('unit-toggle');

const infoLoc = document.getElementById('info-loc');
const infoTemp = document.getElementById('info-temp');
const infoCond = document.getElementById('info-cond');
const infoFeels = document.getElementById('info-feels');
const infoPrec = document.getElementById('info-prec');
const infoWind = document.getElementById('info-wind');
const infoHum = document.getElementById('info-hum');
const infoCloud = document.getElementById('info-cloud');
const infoPres = document.getElementById('info-pres');
const infoSunrise = document.getElementById('info-sunrise');
const infoSunset = document.getElementById('info-sunset');
const infoUpdated = document.getElementById('info-updated');
const infoAccuracy = document.getElementById('info-accuracy');

const hourlyStrip = document.getElementById('hourly-strip');
const weeklyStrip = document.getElementById('weekly-strip');
const overlayContainer = document.getElementById('weather-overlay');
const timelineEl = document.getElementById('timeline');
const timelineDate = document.getElementById('timeline-date');
const feedAllBtn = document.getElementById('feed-all-btn');
const feedAlertsBtn = document.getElementById('feed-alerts-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const forecastCity = document.getElementById('forecast-city');
const chatPanel = document.getElementById('chat-panel');
const chatMessagesEl = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatCloseBtn = document.getElementById('chat-close-btn');

const homeBtn = document.getElementById("home-btn");
const storeBtn = document.getElementById("store-btn");
const storePage = document.getElementById("store-page");
const mainArea = document.querySelector(".main-area");
const rightSidebar = document.querySelector(".right-sidebar");

const HOME_CHAT_STORAGE_KEY = "surecastHomeChatV1";
const HOME_ALERTS_STORAGE_KEY = "userAlertsV2";
const HOME_SETTINGS_STORAGE_KEY = "surecastSettingsV1";

/* coin elements */
const coinCountTopEl = document.getElementById("coin-count-top");
const coinCountBannerEl = document.getElementById("coin-count-banner");
const coinPill = document.getElementById("coin-pill");
const coinPillBanner = document.getElementById("coin-pill-banner");

let units = localStorage.getItem('units') || 'metric';
let map, markersLayer, labelTileLayer;
let userMarker = null;
let accuracyCircle = null;
let searchMarker = null;
let homeFeedFilter = 'all';
let homeTimelineItems = [];
let homeAlertsState = loadInitialHomeAlerts();
let homeChatHistory = loadChatHistory();
window.sureCastState = {
  units,
  currentWeather: null,
  forecast: null,
  locationName: '—',
  latitude: null,
  longitude: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
};

/* defaults */
const defaultCenter = [22.5726, 88.3639];

function readStoredJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function loadInitialHomeAlerts() {
  if (typeof window.getSureCastAlerts === 'function') {
    return normalizeHomeAlertsState(window.getSureCastAlerts());
  }

  const storedUserAlerts = readStoredJson(HOME_ALERTS_STORAGE_KEY, readStoredJson('userAlerts', []));
  return normalizeHomeAlertsState({ system: [], user: storedUserAlerts });
}

function normalizeHomeAlertsState(alertsState) {
  const rawState = alertsState && typeof alertsState === 'object' ? alertsState : {};
  return {
    system: Array.isArray(rawState.system) ? rawState.system : [],
    user: Array.isArray(rawState.user) ? rawState.user : []
  };
}

function loadChatHistory() {
  const parsed = readStoredJson(HOME_CHAT_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function persistChatHistory() {
  localStorage.setItem(HOME_CHAT_STORAGE_KEY, JSON.stringify(homeChatHistory.slice(-24)));
}

function getProfileName() {
  const settingsState = readStoredJson(HOME_SETTINGS_STORAGE_KEY, {});
  const name = String(settingsState?.profile?.name || '').trim();
  return name || 'there';
}

function getCurrentLocationName() {
  const locationName = String(window.sureCastState?.locationName || '').trim();
  return locationName && locationName !== '—' ? locationName : 'your selected location';
}

function convertTemperature(valueInCelsius) {
  if (!Number.isFinite(Number(valueInCelsius))) return null;
  const numericValue = Number(valueInCelsius);
  return units === 'metric' ? numericValue : (numericValue * 9 / 5) + 32;
}

function formatTemperature(valueInCelsius) {
  const converted = convertTemperature(valueInCelsius);
  if (converted === null) return '--';
  return `${Math.round(converted)}${units === 'metric' ? '°C' : '°F'}`;
}

function formatFeedTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createTimelineItem(item) {
  return {
    ...item,
    sortTime: new Date(item.sortTime || item.timestamp || Date.now()).getTime()
  };
}

function getAlertFeedItems() {
  const systemItems = homeAlertsState.system.map((alertItem) => createTimelineItem({
    kind: 'alert',
    tone: alertItem.severity === 'high' ? 'danger' : 'warning',
    label: alertItem.source || 'System',
    title: alertItem.title || 'Weather alert',
    body: alertItem.text || 'Stay prepared for changing conditions.',
    timestamp: alertItem.createdAt,
    meta: alertItem.location || getCurrentLocationName()
  }));

  const userItems = homeAlertsState.user.map((alertItem) => createTimelineItem({
    kind: 'alert',
    tone: 'info',
    label: alertItem.source || 'User',
    title: alertItem.location || 'Community alert',
    body: alertItem.text || 'New community alert posted.',
    timestamp: alertItem.createdAt,
    meta: alertItem.authorName || alertItem.authorEmail || 'Anonymous profile'
  }));

  return [...systemItems, ...userItems].sort((a, b) => b.sortTime - a.sortTime);
}

function setHomeFeedFilter(filterName) {
  homeFeedFilter = filterName === 'alerts' ? 'alerts' : 'all';
  if (feedAllBtn) feedAllBtn.classList.toggle('active', homeFeedFilter === 'all');
  if (feedAlertsBtn) feedAlertsBtn.classList.toggle('active', homeFeedFilter === 'alerts');
  if (chatPanel && !chatPanel.classList.contains('hidden')) {
    toggleChatPanel(false);
    return;
  }
  renderHomeFeed();
}

function renderHomeFeed() {
  if (!timelineEl) return;

  const alertItems = getAlertFeedItems();
  const feedItems = homeFeedFilter === 'alerts'
    ? alertItems
    : [...homeTimelineItems, ...alertItems].sort((a, b) => b.sortTime - a.sortTime);

  timelineEl.innerHTML = '';

  if (!feedItems.length) {
    timelineEl.innerHTML = `<div class="timeline-empty">${homeFeedFilter === 'alerts' ? 'No live alerts right now.' : 'Search for a place or use Locate to populate the home feed.'}</div>`;
    return;
  }

  feedItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = `timeline-item${item.kind === 'alert' ? ' timeline-item--alert' : ''}${item.tone ? ` is-${item.tone}` : ''}`;
    card.innerHTML = `
      <div class="timeline-item-top">
        <span class="timeline-tag">${escapeHtml(item.label || 'Update')}</span>
        <small>${escapeHtml(formatFeedTime(item.timestamp || item.sortTime))}</small>
      </div>
      <strong>${escapeHtml(item.title || 'Update')}</strong>
      <div class="timeline-body">${escapeHtml(item.body || '')}</div>
      ${item.meta ? `<div class="timeline-meta">${escapeHtml(item.meta)}</div>` : ''}
    `;
    timelineEl.appendChild(card);
  });
}

function getCurrentRainSummary() {
  const daily = window.sureCastState?.forecast?.daily;
  if (!daily?.time?.length) return 'I need a loaded forecast before I can check rain trends.';

  const rainyIndex = daily.precipitation_sum?.findIndex((value) => Number(value) > 0.5);
  if (rainyIndex === -1 || rainyIndex === undefined) {
    return `No significant rain is showing in the next 7 days for ${getCurrentLocationName()}.`;
  }

  const rainyDate = new Date(daily.time[rainyIndex]);
  const rainyAmount = Number(daily.precipitation_sum?.[rainyIndex] || 0);
  return `The next notable rain signal for ${getCurrentLocationName()} is ${rainyDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, with about ${rainyAmount.toFixed(1)} mm forecast.`;
}

function getWeeklySummary() {
  const daily = window.sureCastState?.forecast?.daily;
  if (!daily?.time?.length) {
    return 'Search for a city or tap the map and I can summarize the next week.';
  }

  const summary = daily.time.slice(0, 3).map((dateValue, index) => {
    const weekday = new Date(dateValue).toLocaleDateString(undefined, { weekday: 'short' });
    const high = formatTemperature(daily.temperature_2m_max?.[index]);
    const low = formatTemperature(daily.temperature_2m_min?.[index]);
    return `${weekday}: ${high} / ${low}`;
  });

  return `Here is the short forecast for ${getCurrentLocationName()}: ${summary.join(', ')}.`;
}

function summarizeAlertsForChat() {
  const alertItems = getAlertFeedItems();
  if (!alertItems.length) {
    return `There are no active system or community alerts for ${getCurrentLocationName()} right now.`;
  }

  const preview = alertItems.slice(0, 3).map((item) => `${item.title}: ${item.body}`);
  return `Active alerts for ${getCurrentLocationName()}: ${preview.join(' | ')}`;
}

function buildChatReply(userMessage) {
  const current = window.sureCastState?.currentWeather?.current;
  const forecast = window.sureCastState?.forecast;
  const locationName = getCurrentLocationName();
  const normalizedMessage = String(userMessage || '').trim().toLowerCase();

  if (!normalizedMessage) {
    return 'Ask me about temperature, rain, the week ahead, or any active alerts.';
  }

  if (!current || !forecast) {
    return 'Pick a location on the map or use Search first, then I can answer weather questions here.';
  }

  if (/(hello|hi|hey)/.test(normalizedMessage)) {
    return `Hi ${getProfileName()}! Right now in ${locationName} it is ${formatTemperature(current.temp_c)} with ${current.condition?.text || 'current conditions available'}.`;
  }

  if (/(alert|warning|danger|safe)/.test(normalizedMessage)) {
    return summarizeAlertsForChat();
  }

  if (/(rain|umbrella|precip|wet)/.test(normalizedMessage)) {
    const nowRain = Number(current.precip_mm || 0);
    return `Current precipitation in ${locationName} is about ${nowRain.toFixed(1)} mm. ${getCurrentRainSummary()}`;
  }

  if (/(wind|storm|thunder)/.test(normalizedMessage)) {
    const wind = Number(current.wind_kph || 0);
    return `Winds in ${locationName} are around ${Math.round(wind)} km/h, with ${current.condition?.text || 'current conditions'} right now. ${summarizeAlertsForChat()}`;
  }

  if (/(temp|temperature|hot|cold|wear|jacket)/.test(normalizedMessage)) {
    const currentTemp = formatTemperature(current.temp_c);
    const feelsLike = formatTemperature(current.feelslike_c);
    const advice = convertTemperature(current.temp_c) <= (units === 'metric' ? 18 : 64)
      ? 'A light jacket is a good idea.'
      : 'You should be comfortable in light clothing.';
    return `In ${locationName}, it is ${currentTemp} right now and feels like ${feelsLike}. ${advice}`;
  }

  if (/(week|forecast|tomorrow|next)/.test(normalizedMessage)) {
    return getWeeklySummary();
  }

  return `I can help with rain, temperature, wind, alerts, or a quick weekly forecast for ${locationName}. Right now it is ${formatTemperature(current.temp_c)} with ${current.condition?.text || 'current conditions'}.`;
}

function createChatMessage(role, text) {
  return {
    role,
    text,
    timestamp: new Date().toISOString()
  };
}

function ensureChatGreeting() {
  if (homeChatHistory.length) return;
  homeChatHistory.push(createChatMessage('assistant', `Hi ${getProfileName()}! I can help with the current weather, upcoming rain, and active alerts for ${getCurrentLocationName()}.`));
  persistChatHistory();
}

function renderChatMessages() {
  if (!chatMessagesEl) return;
  ensureChatGreeting();
  chatMessagesEl.innerHTML = '';

  homeChatHistory.forEach((message) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-message ${message.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'}`;
    bubble.innerHTML = `
      <div class="chat-message-role">${message.role === 'user' ? escapeHtml(getProfileName()) : 'SureCast'}</div>
      <div class="chat-message-text">${escapeHtml(message.text)}</div>
    `;
    chatMessagesEl.appendChild(bubble);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function toggleChatPanel(forceOpen) {
  if (!chatPanel || !timelineEl) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : chatPanel.classList.contains('hidden');
  chatPanel.classList.toggle('hidden', !shouldOpen);
  chatPanel.setAttribute('aria-hidden', String(!shouldOpen));
  timelineEl.classList.toggle('hidden', shouldOpen);

  if (chatToggleBtn) {
    chatToggleBtn.textContent = shouldOpen ? 'Close Chat' : 'Chat';
  }

  if (shouldOpen) {
    renderChatMessages();
    if (chatInput) chatInput.focus();
  } else {
    renderHomeFeed();
  }
}

/* weather codes map (icons/text) */
const weatherCodeMap = {
  0:{text:'Clear',icon:'☀️'},1:{text:'Mainly clear',icon:'🌤️'},2:{text:'Partly cloudy',icon:'⛅'},3:{text:'Overcast',icon:'☁️'},
  45:{text:'Fog',icon:'🌫️'},48:{text:'Rime fog',icon:'🌫️'},51:{text:'Light drizzle',icon:'🌦️'},53:{text:'Moderate drizzle',icon:'🌦️'},
  55:{text:'Dense drizzle',icon:'🌧️'},61:{text:'Light rain',icon:'🌧️'},63:{text:'Moderate rain',icon:'🌧️'},65:{text:'Heavy rain',icon:'🌧️'},
  71:{text:'Light snow',icon:'❄️'},73:{text:'Moderate snow',icon:'❄️'},75:{text:'Heavy snow',icon:'❄️'},80:{text:'Slight rain showers',icon:'🌧️'},
  81:{text:'Moderate rain showers',icon:'🌧️'},82:{text:'Violent rain showers',icon:'⛈️'},95:{text:'Thunderstorm',icon:'⛈️'},99:{text:'Thunderstorm with hail',icon:'⛈️'}
};

/* coins persistent: default 100 for demo */
let coins = parseInt(localStorage.getItem("coins") || "100", 10);
let storePurchases = JSON.parse(localStorage.getItem("storePurchases") || "{}");

window.addEventListener('surecast:alerts-updated', (event) => {
  homeAlertsState = normalizeHomeAlertsState(event.detail);
  renderHomeFeed();
});

/* startup */
window.addEventListener('DOMContentLoaded', () => {
  setUnitButton();
  setupListeners();
  initMap();
  setTimeout(()=>{ if (map) map.setView(defaultCenter, 9); }, 120);
  fetchAndShowWeather(defaultCenter[0], defaultCenter[1]);
  window.addEventListener('resize', ()=>fixMapSize());
  window.addEventListener('orientationchange', () => setTimeout(() => fixMapSize(), 180));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => setTimeout(() => fixMapSize(), 80));
  }
  initStore();
  updateCoinUI();
  renderHomeFeed();
});

/* listeners */
function setupListeners(){
  if (searchBtn) searchBtn.onclick = ()=>geocodeAndShow(searchInput.value.trim());
  if (searchInput) searchInput.addEventListener('keypress', (e)=>{ if (e.key==='Enter') geocodeAndShow(searchInput.value.trim());});
  if (locateBtn) locateBtn.onclick = ()=>geolocate();
  if (shareBtn) shareBtn.onclick = ()=>shareView();
  if (unitToggle) unitToggle.onclick = ()=>toggleUnits();
  if (zoomInBtn) zoomInBtn.onclick = ()=>map && map.setZoom(map.getZoom()+1);
  if (zoomOutBtn) zoomOutBtn.onclick = ()=>map && map.setZoom(map.getZoom()-1);

  if (storeBtn) storeBtn.onclick = () => { openStore(); };
  if (homeBtn) homeBtn.onclick = () => { goHome(); };
  if (feedAllBtn) feedAllBtn.addEventListener('click', () => setHomeFeedFilter('all'));
  if (feedAlertsBtn) feedAlertsBtn.addEventListener('click', () => setHomeFeedFilter('alerts'));

  if (coinPill) coinPill.addEventListener('click', ()=>openStore());
  if (coinPillBanner) coinPillBanner && coinPillBanner.addEventListener('click', ()=>openStore());
  if (chatToggleBtn) chatToggleBtn.addEventListener('click', () => toggleChatPanel());
  if (chatCloseBtn) chatCloseBtn.addEventListener('click', () => toggleChatPanel(false));
  if (chatForm) {
    chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = String(chatInput?.value || '').trim();
      if (!message) return;

      homeChatHistory.push(createChatMessage('user', message));
      homeChatHistory.push(createChatMessage('assistant', buildChatReply(message)));
      homeChatHistory = homeChatHistory.slice(-24);
      persistChatHistory();
      renderChatMessages();

      if (chatInput) chatInput.value = '';
    });
  }
}

function setUnitButton(){ if (unitToggle) unitToggle.textContent = units==='metric'?'°C':'°F'; }
function toggleUnits(){ units = units==='metric'?'imperial':'metric'; localStorage.setItem('units', units); window.sureCastState.units = units; setUnitButton(); const c = map.getCenter(); fetchAndShowWeather(c.lat, c.lng); }
function showToast(msg, time=2000){ const t = document.createElement('div'); t.textContent = msg; t.className = 'toast'; document.body.appendChild(t); setTimeout(()=>t.remove(), time); }
function showError(msg){ showToast(msg, 3200); }
function getCurrentCoins(){ return coins; }
window.getCurrentCoins = getCurrentCoins;

/* Map init */
function initMap(){
  try {
    map = L.map('map', { zoomControl: false }).setView(defaultCenter, 9);
    const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution:'&copy; OSM & CARTO', maxZoom:19 }).addTo(map);
    const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution:'Tiles &copy; Esri', maxZoom:19 });

    map.createPane('labelsPane');
    map.getPane('labelsPane').style.zIndex = 650;
    map.getPane('labelsPane').style.pointerEvents = 'none';

    labelTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', { attribution:'&copy; CARTO Labels', maxZoom:19, opacity:0.95, pane: 'labelsPane' });

    markersLayer = L.layerGroup().addTo(map);
    L.control.layers({ 'Voyager': voyager, 'Satellite': esriSat }).addTo(map);
    map.whenReady(()=>{ fixMapSize(); setTimeout(()=>fixMapSize(), 300); });
    if (map.hasLayer(labelTileLayer)) map.removeLayer(labelTileLayer);


    /* ⭐⭐⭐ ADDED: Enable labels when Satellite is selected ⭐⭐⭐ */
    map.on("baselayerchange", function (e) {
      if (e.name === "Satellite") {
        if (!map.hasLayer(labelTileLayer)) map.addLayer(labelTileLayer);
      } else {
        if (map.hasLayer(labelTileLayer)) map.removeLayer(labelTileLayer);
      }
    });
    /* ⭐⭐⭐ END FIX ⭐⭐⭐ */


    map.on('click', (e)=> {
      showSearchMarker(e.latlng.lat, e.latlng.lng, `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
      fetchAndShowWeather(e.latlng.lat, e.latlng.lng);
    });
  } catch (err) {
    console.error('initMap err', err);
    showError('Map init failed — see console');
  }
}

function fixMapSize(){ if (!map) return; try { map.invalidateSize(false); } catch(e){} }

/* Open-Meteo and helpers (unchanged) */
async function fetchOpenMeteoCurrent(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OpenMeteo current failed ' + res.status);
  const json = await res.json();
  return json.current_weather;
}
async function fetchOpenMeteoForecast(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation,weathercode,relativehumidity_2m,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset&current_weather=true&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OpenMeteo forecast failed ' + res.status);
  return res.json();
}
async function reverseGeocode(lat, lon){
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SureCast/1.0 (example@example.com)'}});
    if (!res.ok) throw new Error('Nominatim failed ' + res.status);
    return res.json();
  } catch (err) { console.warn('reverseGeocode err', err); return null; }
}
async function fetchAndShowWeather(lat, lon){
  try {
    showToast('Loading weather...', 700);
    const [curRes, fcRes, placeRes] = await Promise.allSettled([
      fetchOpenMeteoCurrent(lat, lon),
      fetchOpenMeteoForecast(lat, lon),
      reverseGeocode(lat, lon)
    ]);

    if (curRes.status !== 'fulfilled' || fcRes.status !== 'fulfilled') {
      const demoNow = await mockCurrentWeather();
      const demoFc = await mockForecast();
      syncSureCastState(demoNow, demoFc, demoNow.location?.name || 'Demo City', { latitude: lat, longitude: lon });
      displayCurrentWeather(demoNow);
      displayForecast(demoFc, demoNow.location?.name || 'Demo City');
      displayWeekly(demoFc);
      renderTimelineSample(demoNow, demoFc);
      fixMapSize();
      return;
    }

    const cur = curRes.value;
    const fc = fcRes.value;
    const place = (placeRes.status === 'fulfilled') ? placeRes.value : null;

    const wc = weatherCodeMap[cur.weathercode] || { text:'Unknown', icon:'❔' };
    const current = {
      location: { name: place?.address?.city || place?.address?.town || place?.address?.village || place?.display_name?.split(',')[0] || `${lat.toFixed(2)},${lon.toFixed(2)}`, country: place?.address?.country || '' },
      current: {
        temp_c: cur.temperature,
        temp_f: Math.round(cur.temperature * 9/5 + 32),
        feelslike_c: fc.hourly?.apparent_temperature ? fc.hourly.apparent_temperature[0] : cur.temperature,
        feelslike_f: Math.round((fc.hourly?.apparent_temperature ? fc.hourly.apparent_temperature[0] : cur.temperature) * 9/5 + 32),
        humidity: fc.hourly?.relativehumidity_2m ? fc.hourly.relativehumidity_2m[0] : '--',
        wind_kph: cur.windspeed,
        precip_mm: fc.hourly?.precipitation ? fc.hourly.precipitation[0] : 0,
        pressure_mb: '--',
        condition: { text: wc.text, icon: wc.icon },
        last_updated: cur.time
      },
      forecast: fc
    };

    syncSureCastState(current, fc, current.location.name, { latitude: lat, longitude: lon });
    displayCurrentWeather(current);
    displayForecast(fc, current.location.name);
    displayWeekly(fc);
    renderTimelineSample(current, fc);
    fixMapSize();
  } catch (err) {
    console.error('fetchAndShowWeather err', err);
    showError('Weather fetch error; see console');
  }
}

function syncSureCastState(currentWeather, forecastData, locationName, coords = {}){
  window.sureCastState = {
    units,
    currentWeather,
    forecast: forecastData,
    locationName: locationName || currentWeather?.location?.name || '—',
    latitude: coords.latitude ?? forecastData?.latitude ?? null,
    longitude: coords.longitude ?? forecastData?.longitude ?? null,
    timezone: forecastData?.timezone || coords.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  };
  window.dispatchEvent(new CustomEvent('surecast:forecast-updated', { detail: window.sureCastState }));
}

/* display helpers (unchanged) */
function displayCurrentWeather(data){
  try {
    infoLoc && (infoLoc.textContent = `${data.location.name || '--'}${data.location.country ? ', ' + data.location.country : ''}`);
    const t = units === 'metric' ? data.current.temp_c : data.current.temp_f;
    infoTemp && (infoTemp.textContent = `${Math.round(t)}${units==='metric'?'°C':'°F'}`);
    infoCond && (infoCond.textContent = data.current.condition.text || '--');
    infoFeels && (infoFeels.textContent = `${units==='metric'?Math.round(data.current.feelslike_c):Math.round(data.current.feelslike_f)}${units==='metric'?'°C':'°F'}`);
    infoPrec && (infoPrec.textContent = `${data.current.precip_mm ?? '--'} mm`);
    infoWind && (infoWind.textContent = `${data.current.wind_kph ?? '--'} km/h`);
    infoHum && (infoHum.textContent = `${data.current.humidity ?? '--'}%`);
    infoCloud && (infoCloud.textContent = `${data.current.cloud ?? '--'}%`);
    infoPres && (infoPres.textContent = `${data.current.pressure_mb ?? '--'} hPa`);
    if (data.current.last_updated) { const d = new Date(data.current.last_updated); infoUpdated && (infoUpdated.textContent = `Updated: ${d.toLocaleString()}`); } else infoUpdated && (infoUpdated.textContent = `Updated: --`);
    infoAccuracy && (infoAccuracy.textContent = 'Accuracy: ±1°C • Source: Open-Meteo');
    const miniTemp = document.getElementById('mini-temp'); const miniIco = document.getElementById('mini-ico');
    if (miniTemp) miniTemp.textContent = `${Math.round(t)}${units==='metric'?'°C':'°F'}`;
    if (miniIco) miniIco.textContent = data.current.condition.icon || '';
  } catch (err) { console.error('displayCurrentWeather err', err); }
  if (window.generateWeatherAlerts) {
  window.generateWeatherAlerts(data);
}
}

function displayForecast(openMeteoForecast, placeName){
  try {
    hourlyStrip.innerHTML = '';
    if (forecastCity) forecastCity.textContent = placeName || '—';
    const hourly = openMeteoForecast.hourly;
    if (!hourly || !hourly.time) return;
    const now = new Date();
    for (let i = 0; i < hourly.time.length; i++){
      const dt = new Date(hourly.time[i]);
      const diffH = (dt - now) / (1000*3600);
      if (diffH < -0.5) continue;
      if (diffH > 24.5) break;
      const hr = dt.getHours();
      const tempC = hourly.temperature_2m[i];
      const wcode = hourly.weathercode[i];
      const wc = weatherCodeMap[wcode] || { text:'Unknown', icon:'❔' };
      const temp = units==='metric'?tempC:Math.round(tempC*9/5+32);
      const card = document.createElement('div'); card.className = 'hour-card';
      card.innerHTML = `<div class="time">${String(hr).padStart(2,'0')}:00</div><div class="ico">${wc.icon}</div><div class="temp">${Math.round(temp)}${units==='metric'?'°C':'°F'}</div><div style="color:#9fb2c6;margin-top:6px">${wc.text}</div>`;
      hourlyStrip.appendChild(card);
    }
  } catch (err) { console.error('displayForecast err', err); }
}

function displayWeekly(openMeteoForecast){
  try {
    weeklyStrip.innerHTML = '';
    const daily = openMeteoForecast.daily;
    if (!daily || !daily.time) return;
    for (let i=0;i<daily.time.length;i++){
      const date = new Date(daily.time[i]);
      const weekday = date.toLocaleDateString(undefined,{weekday:'short'});
      const wcode = daily.weathercode[i];
      const wc = weatherCodeMap[wcode] || { text:'Unknown', icon:'❔' };
      const tmax = daily.temperature_2m_max[i];
      const tmin = daily.temperature_2m_min[i];
      const card = document.createElement('div'); card.className='day-card';
      card.innerHTML = `<div class="day">${weekday} ${date.getDate()}</div><div class="ico">${wc.icon}</div><div class="desc" style="margin-top:6px;color:#9fb2c6">${wc.text}</div><div class="range">${Math.round(tmax)}° / ${Math.round(tmin)}°</div>`;
      weeklyStrip.appendChild(card);
    }
  } catch (err) { console.error('displayWeekly err', err); }
}

/* timeline */
function renderTimelineSample(current, forecast){
  try {
    const now = new Date();
    if (timelineDate) timelineDate.textContent = now.toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'});
    const items = [];
    items.push(createTimelineItem({
      kind: 'weather',
      tone: 'info',
      label: 'Now',
      title: `Current in ${current.location.name}`,
      body: `${current.current.condition.text || 'Weather update'} ${formatTemperature(current.current.temp_c)}`,
      timestamp: current.current.last_updated || now.toISOString(),
      meta: `Feels like ${formatTemperature(current.current.feelslike_c)}`
    }));
    const hours = (forecast && forecast.hourly && forecast.hourly.time) || [];
    for (let i=0;i<Math.min(4, hours.length); i++){
      const t = new Date(hours[i]);
      items.push(createTimelineItem({
        kind: 'weather',
        tone: 'neutral',
        label: 'Forecast',
        title: `Forecast ${t.getHours()}:00`,
        body: `${formatTemperature(forecast.hourly.temperature_2m[i])} and ${(weatherCodeMap[forecast.hourly.weathercode[i]] || { text:'unknown conditions' }).text}`,
        timestamp: hours[i],
        meta: `${Number(forecast.hourly.precipitation?.[i] || 0).toFixed(1)} mm precipitation`
      }));
    }
    homeTimelineItems = items;
    renderHomeFeed();
  } catch (err) { console.error('renderTimelineSample err', err); }
}

/* geocode & locate (unchanged) */
async function geocodeAndShow(q){
  if (!q) return;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'SureCast/1.0 (example@example.com)'}});
    if (!res.ok) throw new Error('Geocode failed ' + res.status);
    const json = await res.json();
    if (!json || !json.length) { showError('Location not found'); return; }
    const item = json[0];
    const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
    const displayName = item.display_name || item.name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    showSearchMarker(lat, lon, displayName);
    setTimeout(()=>fixMapSize(), 120);
    fetchAndShowWeather(lat, lon);
  } catch (err) { console.error('geocodeAndShow err', err); showError('Search failed'); }
}

function disableLocateUI(disabled = true) {
  if (!locateBtn) return;
  locateBtn.disabled = disabled;
  locateBtn.style.opacity = disabled ? '0.6' : '1';
  locateBtn.style.pointerEvents = disabled ? 'none' : 'auto';
}

async function geolocate(){
  if (!map) { showError('Map not initialized'); return; }
  if (storePage && !storePage.classList.contains('hidden')) { closeStore(); await new Promise(r=>setTimeout(r,80)); }
  showToast('Locating… (please allow location permission)', 2500);
  disableLocateUI(true);

  const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  const onSuccess = async (pos) => {
    try {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const acc = pos.coords.accuracy || 0;
      if (userMarker) { try { map.removeLayer(userMarker); } catch(e){} userMarker = null; }
      if (accuracyCircle) { try { map.removeLayer(accuracyCircle); } catch(e){} accuracyCircle = null; }
      userMarker = L.circleMarker([lat, lon], { radius: 8, color: '#2b9cff', fillColor: '#2b9cff', fillOpacity: 0.95, weight: 1 }).addTo(map);
      accuracyCircle = L.circle([lat, lon], { radius: acc, color: '#2b9cff33', fillColor: '#2b9cff11', weight: 1 }).addTo(map);
      userMarker.bindPopup(`You are here<br>${lat.toFixed(5)}, ${lon.toFixed(5)}<br>Accuracy: ${Math.round(acc)} m`).openPopup();
      const zoomLevel = Math.max(9, Math.min(15, map.getZoom() + 1));
      map.setView([lat, lon], zoomLevel);
      fetchAndShowWeather(lat, lon);
      showToast('Location found', 1400);
    } catch (err) {
      console.error('geolocate onSuccess err', err);
      showError('Location processing failed');
    } finally {
      disableLocateUI(false);
    }
  };

  const onError = async (err) => {
    console.warn('navigator.geolocation error', err);
    try {
      showToast('Unable to get precise location — trying IP lookup', 2400);
      const ipPos = await ipGeolocationFallback();
      if (ipPos && ipPos.latitude && ipPos.longitude) {
        onSuccess({ coords: { latitude: Number(ipPos.latitude), longitude: Number(ipPos.longitude), accuracy: ipPos.accuracy || 50000 }});
        return;
      } else {
        showError('IP location failed');
      }
    } catch (fallbackErr) {
      console.error('IP fallback err', fallbackErr);
      showError('Location unavailable');
    } finally {
      disableLocateUI(false);
    }
  };

  if (navigator.geolocation) {
    const geoPromise = new Promise((resolve, reject) => {
      let called = false;
      const success = (pos) => { if (!called) { called = true; resolve(pos); } };
      const failure = (e) => { if (!called) { called = true; reject(e); } };
      navigator.geolocation.getCurrentPosition(success, failure, geoOptions);
      setTimeout(()=>{ if (!called) { called = true; reject(new Error('Geolocation timeout')); } }, geoOptions.timeout + 1200);
    });

    try {
      const pos = await geoPromise;
      await onSuccess(pos);
    } catch (e) {
      await onError(e);
    }
  } else {
    await onError(new Error('Geolocation API unsupported'));
  }
}

/* ip fallback */
async function ipGeolocationFallback(){
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('IP lookup failed ' + res.status);
    const json = await res.json();
    return {
      latitude: json.latitude || json.lat || json.latitude,
      longitude: json.longitude || json.lon || json.longitude,
      accuracy: 50000
    };
  } catch (err) {
    console.warn('ipGeolocationFallback err', err);
    return null;
  }
}

function shareView(){
  const c = map.getCenter();
  const url = `${location.origin}${location.pathname}?lat=${c.lat.toFixed(4)}&lon=${c.lng.toFixed(4)}`;
  navigator.clipboard?.writeText(url).then(()=>showToast('Link copied')).catch(()=>showToast(url));
}

/* demo fallback */
function mockCurrentWeather(){ const now=new Date(); return Promise.resolve({ location:{name:'Demo City',country:'Demo'}, current:{temp_c:21.5,temp_f:70.7,feelslike_c:22,feelslike_f:71,humidity:64,wind_kph:12,condition:{text:'Partly cloudy',icon:'⛅'},precip_mm:0,pressure_mb:1014,last_updated:now.toISOString()} });}
function mockForecast(){ const base=new Date(); const hours={time:[],temperature_2m:[],apparent_temperature:[],precipitation:[],weathercode:[],relativehumidity_2m:[],windspeed_10m:[]}; for(let h=0;h<48;h++){ const dt=new Date(base.getTime()+h*3600*1e3); hours.time.push(dt.toISOString()); hours.temperature_2m.push(18+Math.sin(h/24*Math.PI)*6); hours.apparent_temperature.push(17+Math.sin(h/24*Math.PI)*6); hours.precipitation.push(h%6===0?0.4:0); hours.weathercode.push(h%6===0?61:3); hours.relativehumidity_2m.push(70); hours.windspeed_10m.push(8);} const daily={time:[],weathercode:[],temperature_2m_max:[],temperature_2m_min:[],precipitation_sum:[],sunrise:[],sunset:[]}; for(let d=0;d<7;d++){ const date=new Date(base.getTime()+d*864e5); daily.time.push(date.toISOString().split('T')[0]); daily.weathercode.push(d%2===0?1:61); daily.temperature_2m_max.push(24-d); daily.temperature_2m_min.push(15-d); daily.precipitation_sum.push(d%2===0?0.5:8.2); daily.sunrise.push('06:00'); daily.sunset.push('18:00'); } return Promise.resolve({hourly:hours,daily:daily});}

/* STORE + COINS (unchanged except demo items removed) */
function initStore(){
  updateCoinUI();
  const buyButtons = document.querySelectorAll("#store-page .store-coin-btn[data-cost]");
  const rupeeButtons = document.querySelectorAll("#store-page .store-rupee-btn[data-price-inr]");
  buyButtons.forEach(btn => {
    btn.removeEventListener('click', onBuyClick);
    btn.addEventListener("click", onBuyClick);
  });
  rupeeButtons.forEach(btn => {
    btn.removeEventListener('click', onBuyWithRupeesClick);
    btn.addEventListener('click', onBuyWithRupeesClick);
  });
  refreshStorePurchaseUI();
}

function onBuyClick(e){
  const btn = e.currentTarget;
  const productId = btn.getAttribute("data-product-id");
  const price = parseInt(btn.getAttribute("data-cost") || "0", 10);
  if (Number.isNaN(price)) return;
  if (productId && storePurchases[productId]) {
    showToast("Item already purchased");
    return;
  }
  if (coins >= price) {
    updateCoins(-price, `Bought ${productId || 'item'} with coins`);
    if (productId) markStorePurchase(productId, "coins");
    showToast("Coin purchase successful!");
  } else {
    showToast("Not enough coins!");
  }
}

function onBuyWithRupeesClick(e){
  const btn = e.currentTarget;
  const productId = btn.getAttribute("data-product-id");
  const priceInr = parseInt(btn.getAttribute("data-price-inr") || "0", 10);
  if (!productId || Number.isNaN(priceInr)) return;
  if (storePurchases[productId]) {
    showToast("Item already purchased");
    return;
  }

  const confirmed = window.confirm(`Buy this item separately for ₹${priceInr}?`);
  if (!confirmed) return;

  markStorePurchase(productId, "rupees");
  showToast(`Rupee purchase confirmed for ₹${priceInr}`);
}

function markStorePurchase(productId, method){
  storePurchases[productId] = method;
  localStorage.setItem("storePurchases", JSON.stringify(storePurchases));
  refreshStorePurchaseUI();
}

function refreshStorePurchaseUI(){
  document.querySelectorAll("#store-page .product-card").forEach(card => {
    const productId = card.getAttribute("data-product-id");
    if (!productId) return;
    const purchaseMethod = storePurchases[productId];
    const coinBtn = card.querySelector(".store-coin-btn");
    const rupeeBtn = card.querySelector(".store-rupee-btn");

    if (!purchaseMethod) {
      if (coinBtn) {
        coinBtn.disabled = false;
        coinBtn.classList.remove("purchased");
        coinBtn.textContent = "Buy with Coins";
      }
      if (rupeeBtn) {
        rupeeBtn.disabled = false;
        rupeeBtn.classList.remove("purchased");
        rupeeBtn.textContent = "Buy with ₹";
      }
      return;
    }

    if (coinBtn) {
      coinBtn.disabled = true;
      coinBtn.classList.add("purchased");
      coinBtn.textContent = purchaseMethod === "coins" ? "Bought with Coins" : "Unavailable";
    }
    if (rupeeBtn) {
      rupeeBtn.disabled = true;
      rupeeBtn.classList.add("purchased");
      rupeeBtn.textContent = purchaseMethod === "rupees" ? "Bought with ₹" : "Unavailable";
    }
  });
}

function updateCoins(delta, reason = ""){
  coins = (coins || 0) + Number(delta || 0);
  if (coins < 0) coins = 0;
  localStorage.setItem("coins", String(coins));
  updateCoinUI();
  window.dispatchEvent(new CustomEvent('surecast:coins-updated', { detail: { coins, delta: Number(delta || 0), reason } }));
}

function updateCoinUI(){
  const text = String(coins);
  if (coinCountTopEl) coinCountTopEl.textContent = text;
  if (coinCountBannerEl) coinCountBannerEl.textContent = text;
}

/* open/close store UI */
function openStore(){
  const storeBtn = document.getElementById("store-btn");
  openPage("store-page", storeBtn);
  initStore();
}


function closeStore(){
  goHome();
}

/* search marker utilities */
function showSearchMarker(lat, lon, label) {
  try {
    if (searchMarker) {
      try { map.removeLayer(searchMarker); } catch(e){ console.warn(e); }
      searchMarker = null;
    }

    searchMarker = L.circleMarker([lat, lon], {
      radius: 9,
      color: '#ff8c00',
      weight: 2,
      fillColor: '#ffd580',
      fillOpacity: 0.95
    }).addTo(map);

    const popupText = label ? `<strong>${escapeHtml(label)}</strong>` : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    searchMarker.bindPopup(popupText).openPopup();

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(9, Math.min(13, currentZoom < 9 ? 9 : currentZoom));
    map.setView([lat, lon], targetZoom);

  } catch (err) {
    console.error('showSearchMarker err', err);
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}
