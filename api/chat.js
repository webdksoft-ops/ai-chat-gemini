import OpenAI from "openai";
import textToSpeech from "@google-cloud/text-to-speech";

// Tên miền widget của bạn
const ALLOWED_ORIGIN = "https://thuviensomnhongha.com";

export default async function handler(req, res) {
  // =========================
  // 1. CORS
  // =========================
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // =========================
  // 2. Validate input
  // =========================
  const body = req.body;
  if (!body || !body.message) {
    res.status(400).json({ error: "Missing message in request body" });
    return;
  }

  try {
    // =========================
    // 3. OpenAI Chat
    // =========================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: body.message }],
    });

    const replyText = completion.choices[0].message.content;

    // =========================
    // 4. Google Cloud TTS
    // =========================
    const credentials = JSON.parse(
      Buffer.from(
        process.env.GOOGLE_TTS_KEY_BASE64,
        "base64"
      ).toString("utf8")
    );

    const ttsClient = new textToSpeech.TextToSpeechClient({
      credentials,
    });

    const [ttsResponse] = await ttsClient.synthesizeSpeech({
      input: { text: replyText },
      voice: {
        languageCode: "vi-VN",
        name: "vi-VN-Wavenet-A", // giọng Việt rất rõ
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0,
      },
    });

    // =========================
    // 5. Response
    // =========================
    res.status(200).json({
      reply: replyText,
      audioBase64: ttsResponse.audioContent.toString("base64"),
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({
      error: "Lỗi nội bộ server",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}
