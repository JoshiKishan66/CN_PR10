const appState = {
  readings: [],
  currentReading: null,
  monitoringPaused: false,
  cloudErrorShown: false,
  realtimeStarted: false,
  realtimeConnected: false,
  insertErrorShown: false,
};

const SUPABASE_LAST_ATTEMPT_KEY = "aerowise.supabase.last-attempt";
const SUPABASE_INSERT_INTERVAL_MS = 15000;

function getLatestReading() {
  return appState.currentReading;
}

function calculateEnvironmentalScore(temperature, humidity) {
  const status = getEnvironmentalStatus(temperature, humidity);
  if (status === "CRITICAL") return 25;
  if (status === "WARNING") return 65;

  const temperatureScore = 100 - Math.abs(temperature - 24) * 2;
  const humidityScore = 100 - Math.abs(humidity - 50) * 0.4;
  return Math.round(Math.min(temperatureScore, humidityScore));
}

function updateClock() {
  const clock = document.getElementById("currentTime");
  if (!clock) return;

  clock.textContent = new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setSection(sectionName) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionName);
  });

  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === `${sectionName}-section`);
  });

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    const labels = {
      dashboard: "Dashboard",
      live: "Live Monitoring",
      alerts: "Alerts",
      history: "Data History",
      system: "System Information",
    };
    pageTitle.textContent = labels[sectionName] || "Dashboard";
  }
}

function renderDashboard(reading) {
  if (!reading) return;

  const score = calculateEnvironmentalScore(reading.temperature, reading.humidity);
  const environmentStatus = getEnvironmentalStatus(reading.temperature, reading.humidity);
  const scoreLabel = score >= 80 ? "GOOD" : score >= 50 ? "FAIR" : "POOR";
  const temperatureStatus = getEnvironmentalStatus(reading.temperature, 40);
  const humidityStatus = getEnvironmentalStatus(24, reading.humidity);
  const setText = (id, text) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  };

  setText("environmentScore", `${score} / 100`);
  setText("envScoreText", scoreLabel);
  setText("environmentStatus", environmentStatus);
  setText("temperatureStatus", temperatureStatus);
  setText("humidityStatus", humidityStatus);
  setText("tempMetricValue", `${reading.temperature.toFixed(1)} °C`);
  setText("humidityMetricValue", `${reading.humidity.toFixed(1)} %`);
  setText("esp32Status", "ONLINE");
  setText("dht22Status", "HEALTHY");
  setText("lastUpdate", new Date(reading.timestamp).toLocaleTimeString());

  const scoreRing = document.getElementById("scoreRing");
  if (scoreRing) scoreRing.style.setProperty("--score-angle", `${score * 3.6}deg`);

  [["temperatureStatus", temperatureStatus], ["humidityStatus", humidityStatus], ["environmentStatus", environmentStatus]].forEach(([id, status]) => {
    const element = document.getElementById(id);
    if (element) element.className = `status-tag ${status.toLowerCase()}`;
  });

  setText("healthTitle", environmentStatus === "NORMAL" ? "Environmental conditions normal" : `${environmentStatus.toLowerCase()} conditions detected`);
  setText("healthMessage", appState.realtimeConnected
    ? "Weather readings are synchronized with Supabase."
    : "Weather readings are simulated locally while Supabase is unavailable.");
}

function renderLiveMonitoring() {
  renderCharts(appState.readings);
}

function renderHistoryTable() {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  const history = getHistory();
  if (!history.length) {
    tableBody.innerHTML = '<tr><td colspan="4" class="empty-state compact">No readings saved yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = history
    .reverse()
    .map((entry) => `
        <tr>
          <td>${new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
          <td>${entry.temperature.toFixed(1)} °C</td>
          <td>${entry.humidity.toFixed(1)} %</td>
          <td><span class="status-tag ${entry.status.toLowerCase()}">${entry.status}</span></td>
        </tr>
      `).join("");
}

function renderDashboardContent() {
  const reading = getLatestReading();
  renderDashboard(reading);
  renderLiveMonitoring();
  renderAlerts(reading);
  renderHistoryTable();
}

function addReading(reading) {
  addHistoryEntry(reading);
  if (!appState.realtimeConnected) appState.currentReading = reading;
  appState.readings = getHistory().map((entry) => ({
    temperature: entry.temperature,
    humidity: entry.humidity,
    timestamp: entry.time,
  }));
  renderDashboardContent();
  void saveSimulatedReadingToSupabase(reading);
}

async function saveSimulatedReadingToSupabase(reading) {
  const store = window.weatherDataStore;
  if (!store?.isConfigured || window.__aeronexSupabaseInsertInFlight) return;

  let lastAttempt = 0;
  try {
    lastAttempt = Number(localStorage.getItem(SUPABASE_LAST_ATTEMPT_KEY)) || 0;
  } catch (error) {
    console.warn("Could not read the Supabase insert cooldown.", error);
  }

  const now = Date.now();
  if (now - lastAttempt < SUPABASE_INSERT_INTERVAL_MS) return;

  window.__aeronexSupabaseInsertInFlight = true;
  try {
    localStorage.setItem(SUPABASE_LAST_ATTEMPT_KEY, String(now));
  } catch (error) {
    console.warn("Could not save the Supabase insert cooldown.", error);
  }

  try {
    await window.weatherDataStore.insertWeatherReading(reading);
    appState.insertErrorShown = false;
    console.info("Simulated weather reading saved to Supabase.", reading);
  } catch (error) {
    console.error("Could not save simulated weather reading to Supabase. Local simulation continues.", error);
    if (!appState.insertErrorShown) {
      showToast("Supabase save failed; local simulation continues.", "warning");
      appState.insertErrorShown = true;
    }
  } finally {
    window.__aeronexSupabaseInsertInFlight = false;
  }
}

function setCloudSyncStatus(message) {
  const status = document.getElementById("cloudSyncStatus");
  if (status) status.textContent = message;
}

async function loadCloudHistory() {
  const store = window.weatherDataStore;
  if (!store?.isConfigured) {
    setCloudSyncStatus("Supabase is not configured. Showing locally saved readings.");
    return;
  }

  setCloudSyncStatus("Loading readings from Supabase...");
  try {
    const [cloudHistory, latestReading] = await Promise.all([
      store.getHistoricalWeatherReadings({ limit: 500 }),
      store.getLatestWeatherReading(),
    ]);

    if (cloudHistory.length) {
      const mergedHistory = new Map(
        [...getHistory(), ...cloudHistory].map((entry) => {
          const timestamp = entry.timestamp || entry.time;
          return [new Date(timestamp).toISOString(), entry];
        })
      );
      replaceHistory([...mergedHistory.values()].sort((left, right) =>
        new Date(left.timestamp || left.time) - new Date(right.timestamp || right.time)
      ));
      appState.readings = getHistory().map((entry) => ({
        temperature: entry.temperature,
        humidity: entry.humidity,
        timestamp: entry.time,
      }));
    }

    if (latestReading && (appState.realtimeConnected || !appState.currentReading || new Date(latestReading.timestamp) > new Date(appState.currentReading.timestamp))) {
      appState.currentReading = latestReading;
    }

    setCloudSyncStatus(appState.realtimeConnected
      ? "Supabase Realtime connected"
      : cloudHistory.length
        ? `Supabase loaded ${cloudHistory.length} historical readings.`
        : "Supabase has no saved readings yet; using local simulation.");
    renderDashboardContent();
  } catch (error) {
    setCloudSyncStatus(appState.realtimeConnected
      ? "Supabase Realtime connected"
      : "Supabase Realtime unavailable - using local simulation");
    if (!appState.cloudErrorShown) {
      showToast("Could not load Supabase history; showing local readings.", "warning");
      appState.cloudErrorShown = true;
    }
  }
}

function handleRealtimeReading(reading) {
  if (!reading || !Number.isFinite(Number(reading.temperature)) || !Number.isFinite(Number(reading.humidity))) return;

  const readingTime = new Date(reading.timestamp);
  if (!Number.isFinite(readingTime.getTime())) return;

  const history = getHistory();
  const timestamp = readingTime.toISOString();
  const alreadyStored = history.some((entry) =>
    entry.id === reading.id || new Date(entry.time).toISOString() === timestamp
  );

  if (!alreadyStored) {
    replaceHistory([...history, reading].sort((left, right) =>
      new Date(left.timestamp || left.time) - new Date(right.timestamp || right.time)
    ));
  }

  if (appState.realtimeConnected || !appState.currentReading || readingTime > new Date(appState.currentReading.timestamp)) {
    appState.currentReading = reading;
  }

  appState.readings = getHistory().map((entry) => ({
    temperature: entry.temperature,
    humidity: entry.humidity,
    timestamp: entry.time,
  }));
  renderDashboardContent();
}

function configureSupabaseRealtime() {
  const store = window.weatherDataStore;
  if (!store?.isConfigured || appState.realtimeStarted) return;

  appState.realtimeStarted = true;
  try {
    store.subscribeToWeatherReadings(
      handleRealtimeReading,
      (status, error) => {
        if (status === "SUBSCRIBED") {
          appState.realtimeConnected = true;
          setCloudSyncStatus("Supabase Realtime connected");
          appState.cloudErrorShown = false;
          renderDashboardContent();
          void loadCloudHistory();
          return;
        }

        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          appState.realtimeConnected = false;
          setCloudSyncStatus("Supabase Realtime unavailable - using local simulation");
          renderDashboardContent();
          if (!appState.cloudErrorShown) {
            console.error("Supabase Realtime subscription failed.", error || status);
            appState.cloudErrorShown = true;
          }
        }
      }
    );
  } catch (error) {
    setCloudSyncStatus(`Live updates unavailable. Local simulation continues. ${error.message}`);
    console.error("Could not start the Supabase Realtime subscription.", error);
  }
}

function configureHistoryActions() {
  document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    clearHistory();
    appState.readings = [];
    renderHistoryTable();
    renderLiveMonitoring();
    showToast("History cleared.", "info");
  });

  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const result = exportHistoryCSV();
    showToast(result.status === "downloaded" ? "CSV downloaded." : "No readings to export yet.", result.status === "downloaded" ? "success" : "warning");
  });
}

function configureMonitoring() {
  const button = document.getElementById("toggleMonitoringBtn");
  button.addEventListener("click", () => {
    appState.monitoringPaused = !appState.monitoringPaused;
    button.textContent = appState.monitoringPaused ? "Resume Monitoring" : "Pause Monitoring";
    button.setAttribute("aria-pressed", String(appState.monitoringPaused));
    showToast(appState.monitoringPaused ? "Monitoring paused." : "Monitoring resumed.", "info");
  });
}

function configureSidebar() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      setSection(button.dataset.section);
      if (["history", "live"].includes(button.dataset.section)) void loadCloudHistory();
    });
  });

  document.getElementById("sidebarToggle").addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    sidebar.classList.toggle("collapsed");
    document.getElementById("sidebarToggle").setAttribute("aria-expanded", String(!sidebar.classList.contains("collapsed")));
  });
}

function configureThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  toggle.addEventListener("click", () => {
    const root = document.body;
    const isDark = root.dataset.theme === "dark";
    root.dataset.theme = isDark ? "light" : "dark";
    toggle.textContent = isDark ? "☀️" : "🌙";
  });
}

function initializeDashboard() {
  const savedHistory = getHistory();
  appState.readings = savedHistory.map((entry) => ({
    temperature: entry.temperature,
    humidity: entry.humidity,
    timestamp: entry.time,
  }));
  appState.currentReading = appState.readings.at(-1) || getSensorData();

  if (!savedHistory.length) {
    addHistoryEntry(appState.currentReading);
    appState.readings = [{ ...appState.currentReading }];
  }

  setSection("dashboard");
  updateClock();
  initCharts();
  renderDashboardContent();
  if (!savedHistory.length) void saveSimulatedReadingToSupabase(appState.currentReading);
  configureSupabaseRealtime();
  void loadCloudHistory();
  configureSidebar();
  configureHistoryActions();
  configureMonitoring();
  configureThemeToggle();

  setInterval(() => {
    updateClock();
    if (appState.monitoringPaused) return;
    addReading(getSensorData());
  }, 3000);
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
