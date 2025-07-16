import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper: Normalize region name with OpenAI
async function getNormalizedRegionName(region) {
  console.log("Normalizing region name with OpenAI for input:", region);
  const prompt = `Given the input region name: "${region}", return only the most accurate and standardized region name (such as a city, state, or country) as a plain string. Do not include any extra text or formatting.`;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that returns only the standardized region name as plain text.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  });
  const normalized = response.choices[0].message.content.trim();
  console.log("Normalized region name from OpenAI:", normalized);
  return normalized;
}

// Helper: Get lat/lon from OpenAI
async function getLatLonFromOpenAI(region) {
  console.log("Getting lat/lon from OpenAI for region:", region);
  const prompt = `Provide only the latitude and longitude (as JSON with keys 'latitude' and 'longitude') for the region: ${region}`;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that returns only JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  });
  const text = response.choices[0].message.content;
  try {
    const coords = JSON.parse(text);
    console.log("Lat/lon from OpenAI response:", coords);
    return coords;
  } catch (e) {
    throw new Error("Failed to parse coordinates from OpenAI response.");
  }
}

// Helper: Get weather from Open-Meteo
async function getWeather(lat, lon) {
  console.log("Getting weather from Open-Meteo for lat start");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&forecast_days=7&timezone=UTC`;
  const { data } = await axios.get(url);
  const result = {};
  data.daily.time.forEach((date, index) => {
    result[date] = [
      data.daily.temperature_2m_mean[index],
      data.daily.relative_humidity_2m_mean[index],
      data.daily.precipitation_sum[index],
      data.daily.wind_speed_10m_max[index],
    ];
  });
  return result;
}

async function getTemperatureScore(tempC) {
  if (tempC < 15) return 0;
  if (tempC < 20) return 0.25;
  if (tempC < 25) return 0.5;
  if (tempC <= 30) return 1;
  return 0.8; // >30°C
}

async function getHumidityScore(humidity) {
  if (humidity < 40) return 0;
  if (humidity <= 60) return 0.5;
  return 1; // >60%
}

async function getRainfallScore(currentRainfallMm) {
  if (currentRainfallMm < 1) return 0;
  if (currentRainfallMm <= 5) return 0.5;
  return 1; // >5 mm today
}

async function getWindFactor(windKmh) {
  if (windKmh < 15) return 1;
  if (windKmh <= 25) return 0.7;
  return 0.3; // >25 km/h
}

async function getRiskLevel(score) {
  if (score < 20) return "low";
  if (score < 40) return "medium";
  if (score < 60) return "high";
  if (score < 80) return "veryhigh";
  return "severe";
}

async function calculateMosquitoIndex(
  tempC,
  humidity,
  currentRainfallMm,
  windKmh
) {
  const tScore = getTemperatureScore(tempC);
  const hScore = getHumidityScore(humidity);
  const rScore = getRainfallScore(currentRainfallMm);
  const wFactor = getWindFactor(windKmh);

  const rawScore = (tScore + hScore + rScore) * wFactor;
  const maxScore = 3; // Max raw score before wind adjustment

  const normalizedScore = Math.round((rawScore / maxScore) * 100);

  return {
    rawScore,
    normalizedScore,
    riskLevel: await getRiskLevel(normalizedScore),
  };
}

async function getMAILevel(data) {
  // ✅ Build the time: level object
  const output = {};

  for (const [date, [temp, humidity, rainfall, wind]] of Object.entries(data)) {
    const result = await calculateMosquitoIndex(temp, humidity, rainfall, wind);
    output[date] = result.riskLevel;
  }
  return output;
}

// Helper: Summarize weather with OpenAI
async function summarizeMAI(region, maiData) {
  const prompt = `Given the following 7-day mosquito activity index data for ${region}, please write a natural, human-like summary of the MAI:
${JSON.stringify(maiData)}`;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that summarizes weather data.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  return response.choices[0].message.content;
}

// API endpoint
app.post("/api/weather-summary", async (req, res) => {
  const { region } = req.body;
  console.log(req.body);
  if (!region) return res.status(400).json({ error: "Missing region" });
  try {
    const normalizedRegion = await getNormalizedRegionName(region);
    const coords = await getLatLonFromOpenAI(normalizedRegion);
    const weather = await getWeather(coords.latitude, coords.longitude);
    const maiData = await getMAILevel(weather);
    const summary = await summarizeMAI(normalizedRegion, maiData);
    res.json({ region: normalizedRegion, coordinates: coords, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3016;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
