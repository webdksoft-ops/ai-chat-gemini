import { GoogleGenerativeAI } from "@google/generative-ai";
import textToSpeech from "@google-cloud/text-to-speech";

// Tạo client TTS từ JSON nằm trong biến môi trường (phù hợp với Vercel)
function createTTSClient() {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

  return new textToSpeech.TextToSpeechClient({
    credentials,
    projectId: credentials.project_id
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { message, voice = "vi-VN-Wavenet-A" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // === GEMINI ===
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const geminiResult = await model.generateContent(message);
    const replyText = geminiResult.response.text();

    // === GOOGLE TTS ===
    const ttsClient = createTTSClient();

    const ttsRequest = {
      input: { text: replyText },
      voice: {
        languageCode: "vi-VN",
        name: voice
      },
      audioConfig: {
        audioEncoding: "MP3"
      }
    };

    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);

    // Trả về base64 audio
    const audioBase64 = ttsResponse.audioContent.toString("base64");

    return res.status(200).json({
      text: replyText,
      audio: audioBase64
    });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
