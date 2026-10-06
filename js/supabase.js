import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.startsWith("YOUR_") &&
  !supabasePublishableKey.startsWith("YOUR_")
);

// Only the browser-safe publishable key belongs in this frontend client.
const supabase = isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key to .env.");
  }

  return supabase;
}

function mapReading(row) {
  return {
    ...row,
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    timestamp: row.created_at,
  };
}

export async function insertWeatherReading(reading) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("weather_readings")
    .insert({
      temperature: reading.temperature,
      humidity: reading.humidity,
      pressure: reading.pressure ?? null,
      weather_status: reading.weather_status ?? reading.status ?? null,
      device_id: reading.device_id ?? "aeronex-web-simulation",
      created_at: reading.timestamp,
    })
    .select()
    .single();

  if (error) throw error;
  return mapReading(data);
}

export async function getRecentWeatherReadings(limit = 60) {
  return getHistoricalWeatherReadings({ limit });
}

export async function getHistoricalWeatherReadings({ from, to, limit = 500 } = {}) {
  const client = requireSupabase();
  let query = client
    .from("weather_readings")
    .select("id, temperature, humidity, pressure, weather_status, device_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapReading).reverse();
}

export async function getLatestWeatherReading() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("weather_readings")
    .select("id, temperature, humidity, pressure, weather_status, device_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapReading(data) : null;
}

export function subscribeToWeatherReadings(onInsert, onStatus) {
  const client = requireSupabase();
  return client
    .channel("weather-readings-dashboard")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "weather_readings" },
      (payload) => onInsert(mapReading(payload.new))
    )
    .subscribe(onStatus);
}

window.weatherDataStore = {
  isConfigured,
  insertWeatherReading,
  getRecentWeatherReadings,
  getHistoricalWeatherReadings,
  getLatestWeatherReading,
  subscribeToWeatherReadings,
};