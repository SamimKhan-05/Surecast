const predictionBtn = document.getElementById("prediction-btn");
const leaderboardEl = document.getElementById("leaderboard");
const predictionLocationEl = document.getElementById("prediction-location");
const predictionHelpEl = document.getElementById("prediction-help");
const predictionDaysStrip = document.getElementById("prediction-days-strip");
const tempDaySelect = document.getElementById("temp-game-day");
const tempValueInput = document.getElementById("temp-game-value");
const tempResultEl = document.getElementById("temp-game-result");
const tempSubmitBtn = document.getElementById("temp-game-submit");
const rainDaySelect = document.getElementById("rain-game-day");
const rainChoiceSelect = document.getElementById("rain-game-rain");
const rainPrecipInput = document.getElementById("rain-game-precip");
const rainResultEl = document.getElementById("rain-game-result");
const rainSubmitBtn = document.getElementById("rain-game-submit");
const refreshResultsBtn = document.getElementById("prediction-refresh-results");
const betsListEl = document.getElementById("prediction-bets-list");

const PREDICTION_STORAGE_KEY = "surecastPredictionBetsV2";
const TEMP_BET_STAKE = 12;
const RAIN_BET_STAKE = 10;
let isSettlingBets = false;
let predictionBets = loadPredictionBets();

const names = [
  "Aaron", "Diya", "Muzammil", "Saptak", "Aneek",
  "Ayushi", "Samim", "Waterboy"
];

function loadPredictionBets() {
  try {
    return JSON.parse(localStorage.getItem(PREDICTION_STORAGE_KEY) || "[]");
  } catch (error) {
    console.warn("prediction bet storage parse failed", error);
    return [];
  }
}

function savePredictionBets() {
  localStorage.setItem(PREDICTION_STORAGE_KEY, JSON.stringify(predictionBets));
}

function generateLeaderboard() {
  if (!leaderboardEl) return;

  leaderboardEl.innerHTML = "";

  const players = names
    .sort(() => 0.5 - Math.random())
    .slice(0, 8)
    .map((name) => ({
      name,
      points: Math.floor(Math.random() * 900) + 100
    }));

  players.sort((a, b) => b.points - a.points);

  players.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "store-item";
    div.innerHTML = `
      <h3>#${index + 1} ${player.name}</h3>
      <p>${player.points} points</p>
    `;
    leaderboardEl.appendChild(div);
  });
}

function getCurrentState() {
  return window.sureCastState || {};
}

function getPredictionDays() {
  const forecast = getCurrentState().forecast;
  const daily = forecast?.daily;
  if (!daily?.time?.length) return [];

  return daily.time.slice(0, 7).map((isoDate, index) => {
    const maxC = Number(daily.temperature_2m_max?.[index] ?? 0);
    const minC = Number(daily.temperature_2m_min?.[index] ?? 0);
    const precipMm = Number(daily.precipitation_sum?.[index] ?? 0);
    const averageC = (maxC + minC) / 2;

    return {
      index,
      isoDate,
      date: new Date(isoDate),
      maxC,
      minC,
      averageC,
      precipMm,
      willRain: precipMm > 0.5
    };
  });
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

function convertTemperatureFromCelsius(tempC, units) {
  return units === "imperial" ? (tempC * 9) / 5 + 32 : tempC;
}

function formatTemperature(tempC, unitsOverride) {
  const activeUnits = unitsOverride || getCurrentState().units || localStorage.getItem("units") || "metric";
  const value = convertTemperatureFromCelsius(tempC, activeUnits);
  return `${Math.round(value)}${activeUnits === "imperial" ? "°F" : "°C"}`;
}

function formatDateKeyInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function setResult(el, message, tone) {
  if (!el) return;
  el.textContent = message;
  el.className = `prediction-result${tone ? ` ${tone}` : ""}`;
}

function renderPredictionOptions() {
  const days = getPredictionDays();
  const locationName = getCurrentState().locationName || "-";

  if (predictionLocationEl) predictionLocationEl.textContent = locationName;

  if (!days.length) {
    if (predictionHelpEl) predictionHelpEl.textContent = "Forecast data is still loading. Open a forecast on the map, then try again.";
    if (predictionDaysStrip) predictionDaysStrip.innerHTML = "";
    if (tempDaySelect) tempDaySelect.innerHTML = '<option value="">No forecast loaded</option>';
    if (rainDaySelect) rainDaySelect.innerHTML = '<option value="">No forecast loaded</option>';
    return;
  }

  if (predictionHelpEl) {
    predictionHelpEl.textContent = "Place a bet for one of the next 7 days. The stake is deducted immediately and the result settles after that date is over.";
  }

  if (predictionDaysStrip) {
    predictionDaysStrip.innerHTML = "";
    days.forEach((day) => {
      const card = document.createElement("div");
      card.className = "store-item prediction-day-card";
      card.innerHTML = `
        <h3>${formatDateLabel(day.date)}</h3>
        <p>Avg forecast: ${formatTemperature(day.averageC)}</p>
        <p>High / Low: ${formatTemperature(day.maxC)} / ${formatTemperature(day.minC)}</p>
        <div class="prediction-meta">Forecast rain: ${day.willRain ? "Yes" : "No"} | ${day.precipMm.toFixed(1)} mm</div>
      `;
      predictionDaysStrip.appendChild(card);
    });
  }

  const optionMarkup = days
    .map((day) => `<option value="${day.index}">${formatDateLabel(day.date)} (${day.isoDate})</option>`)
    .join("");

  if (tempDaySelect) tempDaySelect.innerHTML = optionMarkup;
  if (rainDaySelect) rainDaySelect.innerHTML = optionMarkup;
}

function getSelectedDay(selectEl) {
  const days = getPredictionDays();
  const index = Number(selectEl?.value);
  if (!Number.isInteger(index) || !days[index]) return null;
  return days[index];
}

function getBetLocation() {
  const state = getCurrentState();
  if (typeof state.latitude !== "number" || typeof state.longitude !== "number") return null;

  return {
    latitude: state.latitude,
    longitude: state.longitude,
    timezone: state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    locationName: state.locationName || "-",
    units: state.units || "metric"
  };
}

function rewardCoins(amount) {
  if (typeof updateCoins === "function") updateCoins(amount, "Prediction payout");
  if (typeof showToast === "function") showToast(`+${amount} coins earned!`);
}

function canAffordStake(stake) {
  if (typeof window.getCurrentCoins === "function") return window.getCurrentCoins() >= stake;
  return Number(localStorage.getItem("coins") || "0") >= stake;
}

function addPredictionBet(bet) {
  predictionBets.unshift(bet);
  savePredictionBets();
  renderPredictionBets();
}

function createBaseBet(type, day) {
  const location = getBetLocation();
  if (!location) return null;

  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    targetDate: day.isoDate,
    targetLabel: formatDateLabel(day.date),
    locationName: location.locationName,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    units: location.units,
    status: "pending",
    createdAt: new Date().toISOString(),
    settledAt: null,
    stakeCoins: 0,
    coinsAwarded: 0,
    resultSummary: "",
    actual: null
  };
}

function submitTemperatureGuess() {
  const day = getSelectedDay(tempDaySelect);
  const guessedValue = Number(tempValueInput?.value);

  if (!day || Number.isNaN(guessedValue)) {
    setResult(tempResultEl, "Select a forecast day and enter a temperature guess first.", "error");
    return;
  }

  const bet = createBaseBet("temperature", day);
  if (!bet) {
    setResult(tempResultEl, "Pick a place on the map or search for a location before placing a bet.", "error");
    return;
  }
  if (!canAffordStake(TEMP_BET_STAKE)) {
    setResult(tempResultEl, `You need ${TEMP_BET_STAKE} coins to place this bet.`, "error");
    return;
  }

  bet.guessedTemperature = guessedValue;
  bet.stakeCoins = TEMP_BET_STAKE;
  if (typeof updateCoins === "function") updateCoins(-TEMP_BET_STAKE, "Temperature bet stake");
  addPredictionBet(bet);
  if (tempValueInput) tempValueInput.value = "";

  setResult(
    tempResultEl,
    `Temperature bet placed for ${bet.targetLabel}. ${TEMP_BET_STAKE} coins were deducted now and the result will appear after ${bet.targetDate} has passed in ${bet.timezone}.`,
    "success"
  );
}

function submitRainGuess() {
  const day = getSelectedDay(rainDaySelect);
  const guessedRain = rainChoiceSelect?.value;
  const guessedPrecip = Number(rainPrecipInput?.value);

  if (!day || !guessedRain || Number.isNaN(guessedPrecip)) {
    setResult(rainResultEl, "Choose a day, pick rain or no rain, and enter a precipitation guess.", "error");
    return;
  }

  const bet = createBaseBet("rain", day);
  if (!bet) {
    setResult(rainResultEl, "Pick a place on the map or search for a location before placing a bet.", "error");
    return;
  }
  if (!canAffordStake(RAIN_BET_STAKE)) {
    setResult(rainResultEl, `You need ${RAIN_BET_STAKE} coins to place this bet.`, "error");
    return;
  }

  bet.guessedRain = guessedRain;
  bet.guessedPrecipitation = guessedPrecip;
  bet.stakeCoins = RAIN_BET_STAKE;
  if (typeof updateCoins === "function") updateCoins(-RAIN_BET_STAKE, "Rain bet stake");
  addPredictionBet(bet);
  if (rainPrecipInput) rainPrecipInput.value = "";

  setResult(
    rainResultEl,
    `Rain bet placed for ${bet.targetLabel}. ${RAIN_BET_STAKE} coins were deducted now and it will settle after ${bet.targetDate} has passed in ${bet.timezone}.`,
    "success"
  );
}

function isBetReadyToSettle(bet) {
  if (!bet || bet.status === "settled") return false;
  const currentDateKey = formatDateKeyInTimeZone(new Date(), bet.timezone);
  return currentDateKey > bet.targetDate;
}

async function fetchActualDailyWeather(bet) {
  const params = new URLSearchParams({
    latitude: String(bet.latitude),
    longitude: String(bet.longitude),
    start_date: bet.targetDate,
    end_date: bet.targetDate,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: bet.timezone || "UTC"
  });

  const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
  if (!response.ok) throw new Error(`Historical weather fetch failed: ${response.status}`);

  const json = await response.json();
  return {
    temperatureMeanC: Number(json.daily?.temperature_2m_mean?.[0] ?? 0),
    precipitationSumMm: Number(json.daily?.precipitation_sum?.[0] ?? 0)
  };
}

function settleTemperatureBet(bet, actual) {
  const actualValue = convertTemperatureFromCelsius(actual.temperatureMeanC, bet.units);
  const diff = Math.abs(bet.guessedTemperature - actualValue);

  let coinsAwarded = 6;
  if (diff <= 1) coinsAwarded = 40;
  else if (diff <= 3) coinsAwarded = 22;
  else if (diff <= 5) coinsAwarded = 12;

  bet.status = "settled";
  bet.coinsAwarded = coinsAwarded;
  bet.settledAt = new Date().toISOString();
  bet.actual = actual;
  bet.resultSummary = `Stake: ${bet.stakeCoins || 0} coins. Actual average temperature: ${formatTemperature(actual.temperatureMeanC, bet.units)}. Your guess: ${Math.round(bet.guessedTemperature)}${bet.units === "imperial" ? "°F" : "°C"}.`;

  rewardCoins(coinsAwarded);
}

function settleRainBet(bet, actual) {
  const actualRain = actual.precipitationSumMm > 0.5 ? "yes" : "no";
  const rainMatch = bet.guessedRain === actualRain;
  const precipDiff = Math.abs((bet.guessedPrecipitation || 0) - actual.precipitationSumMm);

  let coinsAwarded = rainMatch ? 18 : 4;
  if (precipDiff <= 1) coinsAwarded += 20;
  else if (precipDiff <= 3) coinsAwarded += 10;
  else if (precipDiff <= 5) coinsAwarded += 4;

  bet.status = "settled";
  bet.coinsAwarded = coinsAwarded;
  bet.settledAt = new Date().toISOString();
  bet.actual = actual;
  bet.resultSummary = `Stake: ${bet.stakeCoins || 0} coins. Actual rainfall: ${actualRain === "yes" ? "Rain" : "No rain"} with ${actual.precipitationSumMm.toFixed(1)} mm. Your guess: ${bet.guessedRain === "yes" ? "Rain" : "No rain"} and ${Number(bet.guessedPrecipitation).toFixed(1)} mm.`;

  rewardCoins(coinsAwarded);
}

async function settleReadyBets() {
  if (isSettlingBets) return;
  isSettlingBets = true;

  let settledCount = 0;

  try {
    for (const bet of predictionBets) {
      if (!isBetReadyToSettle(bet)) continue;

      try {
        const actual = await fetchActualDailyWeather(bet);
        if (bet.type === "temperature") settleTemperatureBet(bet, actual);
        if (bet.type === "rain") settleRainBet(bet, actual);
        settledCount += 1;
      } catch (error) {
        console.error("prediction bet settlement failed", error);
      }
    }
  } finally {
    isSettlingBets = false;
    savePredictionBets();
    renderPredictionBets();
    if (settledCount && typeof showToast === "function") {
      showToast(`${settledCount} bet${settledCount === 1 ? "" : "s"} settled`);
    }
  }
}

function renderPredictionBets() {
  if (!betsListEl) return;

  if (!predictionBets.length) {
    betsListEl.innerHTML = '<div class="prediction-bet-item"><strong>No bets yet.</strong><div class="prediction-bet-meta">Place a temperature or rain bet above and it will stay here until the chosen day is over.</div></div>';
    return;
  }

  betsListEl.innerHTML = "";

  predictionBets.forEach((bet) => {
    const ready = isBetReadyToSettle(bet);
    const card = document.createElement("div");
    const statusClass = bet.status === "settled" ? "settled" : ready ? "ready" : "pending";
    const statusText = bet.status === "settled"
      ? `Settled: +${bet.coinsAwarded} coins`
      : ready
        ? "Ready to settle now"
        : `Pending until ${bet.targetDate} passes`;

    const guessText = bet.type === "temperature"
      ? `Temperature bet: ${Math.round(bet.guessedTemperature)}${bet.units === "imperial" ? "°F" : "°C"} | Stake: ${bet.stakeCoins || 0} coins`
      : `Rain bet: ${bet.guessedRain === "yes" ? "Rain" : "No rain"}, ${Number(bet.guessedPrecipitation).toFixed(1)} mm | Stake: ${bet.stakeCoins || 0} coins`;

    const summaryText = bet.status === "settled"
      ? bet.resultSummary
      : `Location: ${bet.locationName}. Result appears after the date is over in ${bet.timezone}.`;

    card.className = `prediction-bet-item ${statusClass}`;
    card.innerHTML = `
      <div class="prediction-bet-top">
        <div>
          <strong>${bet.type === "temperature" ? "Temperature Challenge" : "Rain / No Rain Challenge"}</strong>
          <div class="prediction-bet-meta">${bet.targetLabel} (${bet.targetDate})</div>
        </div>
        <div class="prediction-bet-status">${statusText}</div>
      </div>
      <div class="prediction-bet-meta">${guessText}</div>
      <div class="prediction-bet-meta">${summaryText}</div>
    `;
    betsListEl.appendChild(card);
  });
}

async function openPredictionPage() {
  openPage("prediction-page", predictionBtn);
  generateLeaderboard();
  renderPredictionOptions();
  renderPredictionBets();
  setResult(tempResultEl, `Place a temperature bet for a future date. Each bet costs ${TEMP_BET_STAKE} coins.`, "");
  setResult(rainResultEl, `Place a rain bet and come back after that day has passed. Each bet costs ${RAIN_BET_STAKE} coins.`, "");
  await settleReadyBets();
}

document.addEventListener("DOMContentLoaded", () => {
  if (predictionBtn) {
    predictionBtn.addEventListener("click", () => {
      void openPredictionPage();
    });
  }

  if (tempSubmitBtn) tempSubmitBtn.addEventListener("click", submitTemperatureGuess);
  if (rainSubmitBtn) rainSubmitBtn.addEventListener("click", submitRainGuess);
  if (refreshResultsBtn) {
    refreshResultsBtn.addEventListener("click", () => {
      void settleReadyBets();
    });
  }

  renderPredictionOptions();
  renderPredictionBets();
});

window.addEventListener("surecast:forecast-updated", renderPredictionOptions);
