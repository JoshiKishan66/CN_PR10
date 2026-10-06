const SENSOR_STORAGE_KEY = "aerowise.sensor.state";
const WEATHER_DEVICE_ID = "esp32-weather-station-01";

const sensorState = {
  temperature: 24,
  humidity: 40,
  pressure: 1013.25,
  timestamp: new Date().toISOString(),
};

function getEnvironmentalStatus(temperature, humidity) {
  const temperatureStatus = temperature > 35 ? "CRITICAL" : temperature > 30 || temperature < 18 ? "WARNING" : "NORMAL";
  const humidityStatus = humidity > 80 ? "CRITICAL" : humidity > 70 || humidity < 30 ? "WARNING" : "NORMAL";

  if (temperatureStatus === "CRITICAL" || humidityStatus === "CRITICAL") {
    return "CRITICAL";
  }

  if (temperatureStatus === "WARNING" || humidityStatus === "WARNING") {
    return "WARNING";
  }

  return "NORMAL";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getStoredSensorState() {
  try {
    const stored = localStorage.getItem(SENSOR_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed.temperature !== "number" || typeof parsed.humidity !== "number") {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

function persistSensorState(nextState) {
  try {
    localStorage.setItem(SENSOR_STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    return;
  }
}

function getSensorData() {
  const storedState = getStoredSensorState();

  if (storedState) {
    sensorState.temperature = storedState.temperature;
    sensorState.humidity = storedState.humidity;
    sensorState.pressure = Number.isFinite(storedState.pressure) ? storedState.pressure : sensorState.pressure;
    sensorState.timestamp = storedState.timestamp || new Date().toISOString();
  }

  const nextTemperature = clamp(
    sensorState.temperature + (Math.random() - 0.5) * 0.4,
    22,
    27
  );
  const nextHumidity = clamp(
    sensorState.humidity + (Math.random() - 0.5) * 1,
    35,
    50
  );
  const nextPressure = clamp(
    sensorState.pressure + (Math.random() - 0.5) * 0.5,
    980,
    1040
  );

  const nextReading = {
    temperature: Number(nextTemperature.toFixed(2)),
    humidity: Number(nextHumidity.toFixed(2)),
    pressure: Number(nextPressure.toFixed(2)),
    weather_status: getEnvironmentalStatus(nextTemperature, nextHumidity),
    device_id: WEATHER_DEVICE_ID,
    timestamp: new Date().toISOString(),
  };

  sensorState.temperature = nextReading.temperature;
  sensorState.humidity = nextReading.humidity;
  sensorState.pressure = nextReading.pressure;
  sensorState.timestamp = nextReading.timestamp;
  persistSensorState(nextReading);

  return nextReading;
}

