export const config = {
    runtime: "nodejs",
};

// COMMONJS IMPORT
const { GoogleGenerativeAI } = require("@google/genai");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// CORS domain
const ALLOWED_ORIGIN = "https://thuviensomnhongha.com";

// Init Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Init TTS
const ttsClient = new TextToSpeechClient();

const TTS_CONFIG = {
    languageCode: "vi-VN",
    name: process.env.TTS_VOICE_NAME || "vi-VN-Wavenet-C",
    pitch: parseFloat(process.env.TTS_VOICE_PITCH) || 5.0,
    speakingRate: 1.1,
};

async function handler(req, res) {
    // CORS
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

    const { message, tts_requested } = req.body;
    if (!message) {
        res.status(400).json({ error: "Missing message" });
        return;
    }

    try {
        // A. CALL GEMINI
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(message);

        const replyText = result.response.text();
        let audioUrl = null;

        // B. TTS
        if (tts_requested && replyText.trim()) {
            const [ttsResponse] = await ttsClient.synthesizeSpeech({
                input: { text: replyText },
                voice: TTS_CONFIG,
                audioConfig: {
                    audioEncoding: "MP3",
                    pitch: TTS_CONFIG.pitch,
                    speakingRate: TTS_CONFIG.speakingRate,
                },
            });

            if (ttsResponse.audioContent) {
                const fileName = `reply-${uuidv4()}.mp3`;
                const filePath = path.join(process.cwd(), "public", fileName);

                await fs.promises.writeFile(
                    filePath,
                    Buffer.from(ttsResponse.audioContent, "base64")
                );

                audioUrl = `/${fileName}`;
            }
        }

        res.status(200).json({
            reply: replyText,
            audio_url: audioUrl,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Internal server error",
            details:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
}

module.exports = handler;
