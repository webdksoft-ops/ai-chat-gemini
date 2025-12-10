// pages/api/chat.js hoặc app/api/chat/route.js
import { GoogleGenAI } from '@google/genai';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Tên miền widget của bạn.
const ALLOWED_ORIGIN = 'https://thuviensomnhongha.com'; 

// Khởi tạo Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Khởi tạo Google Cloud TTS Client (Sử dụng xác thực mặc định của Google Cloud)
const ttsClient = new TextToSpeechClient(); 

// Cấu hình Giọng nói TTS
const TTS_CONFIG = {
    languageCode: 'vi-VN',
    name: process.env.TTS_VOICE_NAME || 'vi-VN-Wavenet-C', // Giọng nói trẻ em chất lượng cao
    pitch: parseFloat(process.env.TTS_VOICE_PITCH) || 5.0, // Tăng cao độ cho giọng trẻ em
    speakingRate: 1.1, // Tốc độ nói nhanh hơn một chút
};

export default async function handler(req, res) {
    // 1. THIẾT LẬP CÁC HEADER CHO CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { message, tts_requested } = req.body; // Lấy cờ tts_requested từ Frontend

    if (!message) {
        res.status(400).json({ error: 'Missing message in request body' });
        return;
    }

    let replyText = "";
    let audioUrl = null;

    try {
        // A. GỌI GEMINI (LLM - Sinh văn bản)
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: [{ role: "user", parts: [{ text: message }] }],
        });

        replyText = response.text;

        // B. GỌI GOOGLE CLOUD TTS (Sinh giọng nói)
        if (tts_requested && replyText.trim().length > 0) {
            
            // 1. Gọi API TTS để lấy dữ liệu âm thanh
            const [ttsResponse] = await ttsClient.synthesizeSpeech({
                input: { text: replyText },
                voice: TTS_CONFIG,
                audioConfig: { 
                    audioEncoding: 'MP3',
                    pitch: TTS_CONFIG.pitch,
                    speakingRate: TTS_CONFIG.speakingRate,
                },
            });
            
            // 2. Lưu file MP3 vào thư mục /public
            if (ttsResponse.audioContent) {
                const audioContent = ttsResponse.audioContent;
                // Tạo tên file duy nhất (UUID)
                const fileName = `reply-${uuidv4()}.mp3`; 
                // Next.js cần path.join cho môi trường Vercel (dùng fs)
                const publicPath = path.join(process.cwd(), 'public', fileName); 

                // Ghi file MP3. Dữ liệu âm thanh thô là Base64, cần Buffer.from
                await fs.promises.writeFile(publicPath, Buffer.from(audioContent, 'base64'));
                
                // 3. Tạo URL công khai (Vercel sẽ tự động phục vụ file trong /public)
                audioUrl = `/${fileName}`; 
            }
        }
        
        // C. TRẢ VỀ PHẢN HỒI (Văn bản VÀ URL âm thanh)
        res.status(200).json({
            reply: replyText,
            audio_url: audioUrl,
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ 
            error: "Lỗi nội bộ server khi gọi AI hoặc TTS", 
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
}
