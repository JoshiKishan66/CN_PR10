function evaluateAlerts(reading) {
  return [
    {
      status: getEnvironmentalStatus(reading.temperature, reading.humidity),
      sensor: "Temperature",
      value: `${reading.temperature.toFixed(2)} °C`,
      time: reading.timestamp,
    },
    {
      status: getEnvironmentalStatus(reading.temperature, reading.humidity),
      sensor: "Humidity",
      value: `${reading.humidity.toFixed(2)} %`,
      time: reading.timestamp,
    },
  ];
}

function renderAlerts(reading) {
  const container = document.getElementById("alertList");
  if (!container || !reading) return;

  container.innerHTML = evaluateAlerts(reading)
    .map((alert) => `
      <tr>
        <td><span class="status-tag ${alert.status.toLowerCase()}">${alert.status}</span></td>
        <td>${alert.sensor}</td>
        <td>${alert.value}</td>
        <td>${new Date(alert.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
      </tr>
    `)
    .join("");
}

function showToast(message, severity = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${severity}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.remove(), 3200);
}
