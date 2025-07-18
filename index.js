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
    const prompt = `
    ${region} is the user’s input. Please respond to this according to the system prompt.

Your task:

When a user asks about the MAI (Mosquito Activity Index) for a specific region, you must respond based on accurate data analysis, using the following logic:

1. **Data Collection (Past & Future Weather)**:
   - Retrieve the past **14 days** of weather data for the specified region, including:
     - 'Temperature'
     - 'Humidity'
     - 'Rainfall'
     - 'Wind speed'
   - Also gather the **forecasted weather for the next 7 days** for the same variables.

2. **MAI Calculation Rules**:
   - Analyze the weather data to assess mosquito activity based on environmental conditions known to affect mosquito populations.
   - Use established correlations between 'temperature', 'humidity', 'rainfall', and 'wind speed' to determine mosquito risk.
   - MAI risk levels must be categorized as one of the following:
     - 'Low', 'Medium', 'High', 'Very High', or 'Severe'

3. **Response Format (Must use Markdown):**
   - Provide a **day-by-day forecast** of the MAI for the next 7 days.
   - The forecast must begin with **today’s actual calendar date** (e.g., *July 18, 2025*), **determined dynamically at the time of response generation**, and continue for 7 consecutive days.
   - Do **not** use a table — respond using friendly, conversational Markdown-formatted text.
   - For each day, include:
     - **Day** (e.g., Day 1, Day 2..., Do not mentione exactly date like *July 18, 2025*)
     - **MAI risk level** (e.g., *High*)
     - **Short explanation** (e.g., *"High rainfall and warm temperatures create ideal breeding conditions."*)
   - Use Markdown formatting:
     - Use '**' for bolded items (e.g., **July 18, 2025**, **MAI Risk**)
     - Use '*' for emphasis or example text
     - Use '-' for bullet points where needed
     - Use '#' for optional headers only if necessary
     - Avoid tables entirely

4. **Include relevant health or behavioral advice** based on MAI risk:
   - For example:
     - 'Severe' → *"Use repellents, avoid outdoor exposure in early morning and evening, and eliminate standing water."*
     - 'High' → *"Limit evening exposure and ensure window screens are intact."*
     - 'Medium' → *"Stay alert and monitor conditions, especially after rain."*
     - 'Low' → *"Risk is minimal, but stay aware during dusk and dawn."*

**Tone & Style**:
- Communicate clearly, professionally, and informatively — suitable for a **customer service chat** setting.
- Use a friendly, reassuring, and helpful tone — like you're guiding a concerned resident.
`;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use GPT-4.1 model
      messages: [
        {
          role: "system",
          content: `You are an AI chatbot that specializes in weather analysis and calculating the Mosquito Activity Index (MAI). You act as both a weather expert and a public health advisor.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });
    const summary = response.choices[0].message.content;
    console.log("OpenAI response:", summary);
    res.json({ summary: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3016;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
