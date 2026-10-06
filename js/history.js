const HISTORY_STORAGE_KEY = "aerowise.history";

function getHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && Number.isFinite(Number(entry.temperature)) && Number.isFinite(Number(entry.humidity)) && Number.isFinite(new Date(entry.time).getTime()))
      .slice(-500)
      .map((entry) => ({
        ...entry,
        temperature: Number(entry.temperature),
        humidity: Number(entry.humidity),
        status: getEnvironmentalStatus(Number(entry.temperature), Number(entry.humidity)),
      }));
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-500)));
  } catch (error) {
    return;
  }
}

function replaceHistory(history) {
  const normalized = history
    .filter((entry) => Number.isFinite(Number(entry.temperature)) && Number.isFinite(Number(entry.humidity)) && Number.isFinite(new Date(entry.timestamp || entry.time).getTime()))
    .slice(-500)
    .map((entry) => ({
      id: entry.id ?? `${new Date(entry.timestamp || entry.time).getTime()}-${Math.random().toString(16).slice(2)}`,
      time: entry.timestamp || entry.time,
      temperature: Number(entry.temperature),
      humidity: Number(entry.humidity),
      status: entry.weather_status || entry.status || getEnvironmentalStatus(Number(entry.temperature), Number(entry.humidity)),
    }));

  saveHistory(normalized);
  return normalized;
}

function buildHistoryEntry(reading) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: reading.timestamp,
    temperature: Number(reading.temperature),
    humidity: Number(reading.humidity),
    status: getEnvironmentalStatus(reading.temperature, reading.humidity),
  };
}

function addHistoryEntry(reading) {
  const history = getHistory();
  history.push(buildHistoryEntry(reading));

  if (history.length > 500) {
    history.shift();
  }

  saveHistory(history);
  return history;
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    return [];
  }
  return [];
}

function buildHistoryCSV(history) {
  const header = ["Time", "Temperature", "Humidity", "Status"];
  const rows = history.map((entry) => [
    new Date(entry.time).toLocaleString(),
    `${entry.temperature.toFixed(2)} °C`,
    `${entry.humidity.toFixed(2)} %`,
    entry.status,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function exportHistoryCSV() {
  const history = getHistory();

  if (!history.length) {
    return { status: "empty" };
  }

  const csvContent = buildHistoryCSV(history);

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aerowise-sensor-history.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { status: "downloaded", count: history.length };
}
