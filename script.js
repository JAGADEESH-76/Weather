/* =========================================================================
   AETHER — AI Hyperlocal Weather & Decision Support
   100% client-side. Weather + geocoding via Open-Meteo (free, no API key,
   CORS-enabled), which stands in for the GraphCast / NVIDIA Earth-2 style
   AI forecast engine described in the use cases.
   ========================================================================= */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("locationInput"),
  gpsBtn: document.getElementById("gpsBtn"),
  status: document.getElementById("searchStatus"),
  stationLog: document.getElementById("stationLog"),

  place: document.getElementById("readoutPlace"),
  coords: document.getElementById("readoutCoords"),
  temp: document.getElementById("readoutTemp"),
  desc: document.getElementById("readoutDesc"),
  rain: document.getElementById("cellRain"),
  wind: document.getElementById("cellWind"),
  humidity: document.getElementById("cellHumidity"),
  feels: document.getElementById("cellFeels"),

  gaugeFill: document.getElementById("gaugeFill"),
  gaugeNeedle: document.getElementById("gaugeNeedle"),
  gaugeValue: document.getElementById("gaugeValue"),
  explainText: document.getElementById("explainText"),
  riskBadge: document.getElementById("riskBadge"),
  riskLabel: document.getElementById("riskLabel"),

  roleRow: document.getElementById("roleRow"),
  recoRisk: document.getElementById("recoRisk"),
  recoText: document.getElementById("recoText"),
  recoTips: document.getElementById("recoTips"),

  tRain: document.getElementById("tRain"),
  tRainBar: document.getElementById("tRainBar"),
  tWind: document.getElementById("tWind"),
  tWindBar: document.getElementById("tWindBar"),
  tHeat: document.getElementById("tHeat"),
  tHeatBar: document.getElementById("tHeatBar"),
  alertStrip: document.getElementById("alertStrip"),
  alertText: document.getElementById("alertText"),

  forecastStrip: document.getElementById("forecastStrip"),
};

let currentRole = "student";
let currentData = null; // holds the last fetched weather payload

/* ---------------------------------------------------------------------
   WMO weather code -> { label, icon }
   --------------------------------------------------------------------- */
const WEATHER_CODES = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Dense drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  80: ["Light showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Severe thunderstorm, hail", "⛈️"],
};
function describeCode(code){ return WEATHER_CODES[code] || ["Unknown", "🌡️"]; }

/* =========================================================================
   1. LOCATION SEARCH  (geocoding)
   ========================================================================= */
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = els.input.value.trim();
  if (!query) return;
  setStatus("Searching for “" + query + "”…");
  try{
    const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    const data = await res.json();
    if (!data.results || data.results.length === 0){
      setStatus("No location found. Try a nearby city or landmark.");
      return;
    }
    const r = data.results[0];
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    setStatus("");
    await loadWeather(r.latitude, r.longitude, label);
  }catch(err){
    setStatus("Network error while searching. Check your connection.");
  }
});

els.gpsBtn.addEventListener("click", () => {
  if (!navigator.geolocation){
    setStatus("GPS is not available in this browser.");
    return;
  }
  setStatus("Requesting device location…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      setStatus("");
      await loadWeather(latitude, longitude, "Current location");
    },
    () => setStatus("Location permission denied."),
    { enableHighAccuracy:true, timeout:10000 }
  );
});

function setStatus(msg){ els.status.textContent = msg; }

/* =========================================================================
   2. FETCH WEATHER  (AI Forecast Engine stand-in)
   ========================================================================= */
async function loadWeather(lat, lon, label){
  setStatus("Contacting forecast engine…");
  els.stationLog.textContent = "STATION LOG — SYNCING…";
  try{
    const params = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      hourly: "precipitation_probability,temperature_2m,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
      forecast_days: 6,
      timezone: "auto",
    });
    const res = await fetch(`${FORECAST_URL}?${params}`);
    if (!res.ok) throw new Error("forecast fetch failed");
    const data = await res.json();
    currentData = { ...data, label, lat, lon };

    renderReadout(currentData);
    renderConfidenceAndRisk(currentData);
    renderRecommendation(currentData, currentRole);
    renderThresholds(currentData);
    renderForecastStrip(currentData);

    setStatus("");
    els.stationLog.textContent = `STATION LOG — ${new Date().toLocaleTimeString()} · LOCK ACQUIRED`;
  }catch(err){
    setStatus("Forecast service unavailable. Please try again.");
    els.stationLog.textContent = "STATION LOG — SERVICE UNAVAILABLE";
  }
}

/* =========================================================================
   3. RENDER — hero readout
   ========================================================================= */
function renderReadout(data){
  const c = data.current;
  const [label] = describeCode(c.weather_code);
  els.place.textContent = data.label;
  els.coords.textContent = `LAT ${data.lat.toFixed(2)} · LON ${data.lon.toFixed(2)}`;
  els.temp.textContent = `${Math.round(c.temperature_2m)}°`;
  els.desc.textContent = label;

  const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0;
  els.rain.textContent = `${rainProb}%`;
  els.wind.textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  els.humidity.textContent = `${Math.round(c.relative_humidity_2m)}%`;
  els.feels.textContent = `${Math.round(c.apparent_temperature)}°`;
}

/* =========================================================================
   4. CONFIDENCE SCORE + RISK LEVEL (signature gauge)
   Heuristic, explainable score — no proprietary ensemble data is available
   client-side, so confidence is derived from three transparent factors:
   data recency, short-range forecast agreement (hour-to-hour swing), and
   how extreme the current conditions are (extremes are harder to pin down).
   ========================================================================= */
function computeConfidence(data){
  let score = 95;
  const reasons = [];

  // Factor 1: how volatile is precipitation probability in the next 6 hours?
  const probs = (data.hourly?.precipitation_probability || []).slice(0, 6);
  if (probs.length){
    const spread = Math.max(...probs) - Math.min(...probs);
    if (spread > 40){ score -= 18; reasons.push("short-range rain probability is swinging sharply"); }
    else if (spread > 20){ score -= 8; reasons.push("some hour-to-hour variation in rain probability"); }
  }

  // Factor 2: wind volatility
  const winds = (data.hourly?.wind_speed_10m || []).slice(0, 6);
  if (winds.length){
    const wspread = Math.max(...winds) - Math.min(...winds);
    if (wspread > 25){ score -= 10; reasons.push("wind speed is unusually variable nearby"); }
  }

  // Factor 3: extremity of current conditions (heavy rain/storm codes are inherently less certain)
  const code = data.current.weather_code;
  if ([95,96,99,82].includes(code)){ score -= 12; reasons.push("active storm systems reduce short-term certainty"); }
  else if ([65,67,75].includes(code)){ score -= 6; reasons.push("heavy precipitation in progress"); }

  score = Math.max(35, Math.min(97, Math.round(score)));
  if (reasons.length === 0) reasons.push("stable short-range agreement across model hours");
  return { score, reasons };
}

function computeDisasterRisk(data){
  const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0;
  const windSpeed = data.current.wind_speed_10m;
  const temp = data.current.temperature_2m;
  const code = data.current.weather_code;

  let points = 0;
  if (rainProb >= 80) points += 3; else if (rainProb >= 60) points += 2; else if (rainProb >= 40) points += 1;
  if (windSpeed >= 60) points += 3; else if (windSpeed >= 40) points += 2; else if (windSpeed >= 25) points += 1;
  if (temp >= 42) points += 3; else if (temp >= 38) points += 2; else if (temp >= 35) points += 1;
  if ([95,96,99].includes(code)) points += 3; else if ([82,65,67].includes(code)) points += 2;

  if (points >= 7) return "critical";
  if (points >= 5) return "high";
  if (points >= 3) return "medium";
  return "low";
}

const RISK_META = {
  low:      { label:"LOW",      color:"var(--risk-low)" },
  medium:   { label:"MEDIUM",   color:"var(--risk-medium)" },
  high:     { label:"HIGH",     color:"var(--risk-high)" },
  critical: { label:"CRITICAL", color:"var(--risk-critical)" },
};

function renderConfidenceAndRisk(data){
  const { score, reasons } = computeConfidence(data);
  const risk = computeDisasterRisk(data);
  const meta = RISK_META[risk];

  // gauge fill (0-298 dasharray, semicircle)
  const offset = 298 - (298 * score / 100);
  els.gaugeFill.style.strokeDashoffset = offset;
  els.gaugeFill.style.stroke = meta.color;

  // needle: -90deg (0%) to 90deg (100%)
  const angle = -90 + (180 * score / 100);
  els.gaugeNeedle.style.transform = `rotate(${angle}deg)`;

  els.gaugeValue.textContent = `${score}%`;
  els.explainText.textContent =
    `Confidence reflects ${reasons.join(" and ")}. This score is a transparent, rules-based estimate — not a black box — so you can see exactly what moved it.`;

  els.riskLabel.textContent = `RISK LEVEL: ${meta.label}`;
  els.riskBadge.style.borderColor = meta.color;
  els.riskBadge.style.color = meta.color;
  els.riskBadge.querySelector(".risk-dot").style.background = meta.color;
}

/* =========================================================================
   5. PERSONALIZED RECOMMENDATIONS (role-based)
   ========================================================================= */
els.roleRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".role-btn");
  if (!btn) return;
  currentRole = btn.dataset.role;
  [...els.roleRow.children].forEach(b => b.classList.toggle("active", b === btn));
  if (currentData) renderRecommendation(currentData, currentRole);
});

function renderRecommendation(data, role){
  const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0;
  const windSpeed = data.current.wind_speed_10m;
  const temp = data.current.temperature_2m;
  const risk = computeDisasterRisk(data);
  const meta = RISK_META[risk];

  els.recoRisk.textContent = `RISK: ${meta.label}`;
  els.recoRisk.style.borderColor = meta.color;
  els.recoRisk.style.color = meta.color;

  const tips = [];
  let text = "";

  if (role === "student"){
    text = rainProb >= 50
      ? "Rain is likely during typical commute hours — plan for wet conditions on the way to class."
      : "Conditions look manageable for a normal day on campus.";
    tips.push(rainProb >= 40 ? "Carry an umbrella or raincoat." : "No rain gear needed today.");
    tips.push(temp >= 34 ? "Carry water — heat stress risk during outdoor sessions." : "Comfortable temperatures for outdoor activity.");
  } else if (role === "farmer"){
    text = rainProb >= 60
      ? "Significant rainfall probability — irrigation can likely be delayed to conserve water and avoid waterlogging."
      : "Low rainfall probability — irrigation schedules can proceed as planned.";
    tips.push(rainProb >= 60 ? "Delay irrigation for at least 24 hours." : "Proceed with scheduled irrigation.");
    tips.push(windSpeed >= 35 ? "Hold off on spraying — wind will cause drift." : "Wind conditions are suitable for spraying if needed.");
  } else if (role === "commuter"){
    text = risk === "high" || risk === "critical"
      ? "Conditions are severe enough to affect road safety — expect delays and possible flooding on low-lying routes."
      : "Routine commuting conditions expected.";
    tips.push(rainProb >= 60 ? "Avoid known flood-prone underpasses and low-lying routes." : "Normal routes should be clear.");
    tips.push(windSpeed >= 40 ? "Reduce speed on exposed roads and bridges." : "No special wind precautions needed.");
  } else { // organizer
    text = rainProb >= 50 || windSpeed >= 35
      ? "Outdoor plans carry real risk today — line up an indoor backup or covered area."
      : "Conditions currently favor outdoor events.";
    tips.push(rainProb >= 50 ? "Confirm an indoor contingency space." : "Outdoor seating should stay dry.");
    tips.push(windSpeed >= 35 ? "Secure tents, signage, and loose structures." : "No wind bracing required.");
  }

  els.recoText.textContent = text;
  els.recoTips.innerHTML = tips.map(t => `<li>${t}</li>`).join("");
}

/* =========================================================================
   6. DISASTER THRESHOLD MONITORING
   ========================================================================= */
function pct(value, max){ return Math.max(0, Math.min(100, Math.round((value / max) * 100))); }
function barColor(p){
  if (p >= 80) return "var(--risk-critical)";
  if (p >= 60) return "var(--risk-high)";
  if (p >= 35) return "var(--risk-medium)";
  return "var(--risk-low)";
}

function renderThresholds(data){
  const rainProb = data.hourly?.precipitation_probability?.[0] ?? 0;
  const windSpeed = data.current.wind_speed_10m;
  const temp = data.current.temperature_2m;

  els.tRain.textContent = `${rainProb}%`;
  const rainPct = pct(rainProb, 100);
  els.tRainBar.style.width = `${rainPct}%`;
  els.tRainBar.style.background = barColor(rainPct);

  els.tWind.textContent = `${Math.round(windSpeed)} km/h`;
  const windPct = pct(windSpeed, 80);
  els.tWindBar.style.width = `${windPct}%`;
  els.tWindBar.style.background = barColor(windPct);

  els.tHeat.textContent = `${Math.round(temp)}°`;
  const heatPct = pct(temp, 45);
  els.tHeatBar.style.width = `${heatPct}%`;
  els.tHeatBar.style.background = barColor(heatPct);

  const risk = computeDisasterRisk(data);
  const meta = RISK_META[risk];
  els.alertStrip.className = "alert-strip" + (risk !== "low" ? ` state-${risk}` : "");

  const messages = {
    low: "No unusual conditions detected. Monitoring continues.",
    medium: "Elevated conditions detected. Stay aware of updates.",
    high: `Risk level ${meta.label}. Conditions favor flooding, high winds, or heat stress — take precautions.`,
    critical: `Risk level ${meta.label}. Thresholds exceeded for severe weather. Follow official guidance and avoid exposure.`,
  };
  els.alertText.textContent = messages[risk];
}

/* =========================================================================
   7. FIVE-DAY OUTLOOK
   ========================================================================= */
function renderForecastStrip(data){
  const d = data.daily;
  if (!d || !d.time) return;
  const days = d.time.slice(1, 6); // skip today, show next 5
  els.forecastStrip.innerHTML = days.map((dateStr, i) => {
    const idx = i + 1;
    const date = new Date(dateStr);
    const name = date.toLocaleDateString(undefined, { weekday: "short" });
    const [, icon] = describeCode(d.weather_code[idx]);
    const hi = Math.round(d.temperature_2m_max[idx]);
    const lo = Math.round(d.temperature_2m_min[idx]);
    const rain = d.precipitation_probability_max[idx];
    return `
      <div class="forecast-day">
        <span class="fd-name">${name}</span>
        <span class="fd-icon">${icon}</span>
        <span class="fd-hi">${hi}°<span class="fd-lo">/${lo}°</span></span>
        <span class="fd-rain">${rain}% rain</span>
      </div>`;
  }).join("");
}

/* =========================================================================
   INITIAL STATE — try a sensible default (Chennai) so the page isn't empty
   ========================================================================= */
loadWeather(13.0827, 80.2707, "Chennai, Tamil Nadu");