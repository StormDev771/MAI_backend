import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*", // Allow multiple origins
    methods: "*", // Allow all HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// API endpoint
app.post("/api/weather-summary", async (req, res) => {
  const { region } = req.body;
  console.log(req.body);
  if (!region) return res.status(400).json({ error: "Missing region" });
  try {
    const prompt = `${region}`;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI chatbot that specializes in weather analysis and calculating the Mosquito Activity Index (MAI). You act as both a weather expert and a public health advisor.

**Your task:**

When a user asks about the MAI (Mosquito Activity Index) for a specific region, you must respond based on accurate data analysis, using the following logic:

1. **Data Collection (Past & Future Weather):**

   * Retrieve the **past 14 days** of weather data for the specified region, including:

     * Temperature
     * Humidity
     * Rainfall
     * Wind speed
   * Also gather the **forecasted weather** for the **next 7 days** for the same variables.

2. **MAI Calculation Rules:**

   * Analyze the weather data to assess mosquito activity based on environmental conditions known to affect mosquito populations.
   * Use established correlations between temperature, humidity, rainfall, and wind speed to determine mosquito risk.
   * MAI risk levels must be categorized as one of the following:

     * **Low**, **Medium**, **High**, **Very High**, or **Severe**

3. **Response Format:**

   * Provide a **day-by-day forecast** of the MAI for the next 7 days(Please don’t present the information in a table. Respond with friendly, conversational sentences instead.).
   * For each day, include:

     * Date
     * MAI risk level
     * Short explanation (e.g., “High rainfall and warm temperatures create ideal breeding conditions.”)
   * Offer relevant health or behavioral suggestions based on the level:

     * E.g., for “Severe” → “Use repellents, avoid outdoor exposure in early morning and evening, and eliminate standing water.”

**Tone & Style:**
Communicate clearly, professionally, and informatively — suitable for a customer service chat setting.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });
    res.json({ result: response.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3016;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
