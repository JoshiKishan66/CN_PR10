const chartState = {
  temperature: null,
  humidity: null,
  temperatureFallback: null,
  humidityFallback: null,
};

function createChartConfig(label, color, values) {
  return {
    labels: values.map((entry) => new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })),
    datasets: [
      {
        label,
        data: values.map((entry) => Number(entry.value)),
        borderColor: color,
        backgroundColor: color + "22",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.35,
        fill: false,
      },
    ],
  };
}

function createLineChartOptions(legendVisible = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: legendVisible, position: "bottom" } },
    scales: {
      y: { beginAtZero: false, grid: { color: "rgba(148, 163, 184, 0.15)" } },
      x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
    },
  };
}

function renderFallbackChart(container, data, color, label) {
  if (!container) {
    return;
  }

  const width = 640;
  const height = 260;
  const values = data.length ? data : [0];
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 24) - 12;
      return `${x} ${y}`;
    })
    .join(",");
  let svg = container.querySelector("svg");

  if (!svg) {
    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img"><polyline fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline><circle r="4"></circle></svg>`;
    svg = container.querySelector("svg");
  }

  svg.setAttribute("aria-label", label);
  svg.querySelector("polyline").setAttribute("points", points);
  svg.querySelector("polyline").setAttribute("stroke", color);
  const [lastX, lastY] = points.split(",").at(-1).split(" ");
  svg.querySelector("circle").setAttribute("cx", lastX);
  svg.querySelector("circle").setAttribute("cy", lastY);
  svg.querySelector("circle").setAttribute("fill", color);
}

function initCharts() {
  const temperatureChart = document.getElementById("temperatureChart");
  const humidityChart = document.getElementById("humidityChart");

  if (!temperatureChart || !humidityChart) {
    return;
  }

  if (typeof Chart === "undefined") {
    chartState.temperatureFallback = temperatureChart.parentElement;
    chartState.humidityFallback = humidityChart.parentElement;
    return;
  }

  chartState.temperature = new Chart(temperatureChart, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: createLineChartOptions(false),
  });

  chartState.humidity = new Chart(humidityChart, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: createLineChartOptions(false),
  });
}

function renderCharts(readings) {
  const recentReadings = readings.slice(-60).map((reading) => ({
    ...reading,
    timestamp: reading.timestamp || reading.time,
  }));

  if (typeof Chart === "undefined") {
    renderFallbackChart(chartState.temperatureFallback, recentReadings.map((reading) => reading.temperature), "#087f8c", "Temperature graph");
    renderFallbackChart(chartState.humidityFallback, recentReadings.map((reading) => reading.humidity), "#4878a8", "Humidity graph");
    return;
  }

  if (!chartState.temperature || !chartState.humidity) {
    return;
  }

  const temperatureSeries = recentReadings.map((reading) => ({
    time: reading.timestamp,
    value: reading.temperature,
  }));

  const humiditySeries = recentReadings.map((reading) => ({
    time: reading.timestamp,
    value: reading.humidity,
  }));

  chartState.temperature.data = createChartConfig("Temperature", "#087f8c", temperatureSeries);
  chartState.humidity.data = createChartConfig("Humidity", "#4878a8", humiditySeries);

  chartState.temperature.update();
  chartState.humidity.update();
}
