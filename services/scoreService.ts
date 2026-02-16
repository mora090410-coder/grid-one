
import { GoogleGenAI, Type } from "@google/genai";
import { LiveGameData } from "../types";

const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export async function fetchLiveScore(
    leftTeam: string,
    topTeam: string,
    date: string
): Promise<LiveGameData> {
    if (!apiKey) {
        throw new Error("Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env.local");
    }

    const prompt = `
    Get the live score and game status for the sports matchup: ${leftTeam} vs ${topTeam} on ${date}.
    Use Google Search to find the most recent and accurate score.
    Return exactly this JSON structure:
    {
      "leftScore": number,
      "topScore": number,
      "quarterScores": {
        "Q1": { "left": number, "top": number },
        "Q2": { "left": number, "top": number },
        "Q3": { "left": number, "top": number },
        "Q4": { "left": number, "top": number },
        "OT": { "left": number, "top": number }
      },
      "clock": "string (e.g. 2:00, Final, 12:45 PM)",
      "period": number (1-4, 5 for OT),
      "state": "pre" | "in" | "post",
      "detail": "string (brief status summary)",
      "isOvertime": boolean
    }
  `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview", // Latest efficient model from gemini-api-dev skill
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }] as any,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        leftScore: { type: Type.NUMBER },
                        topScore: { type: Type.NUMBER },
                        quarterScores: {
                            type: Type.OBJECT,
                            properties: {
                                Q1: { type: Type.OBJECT, properties: { left: { type: Type.NUMBER }, top: { type: Type.NUMBER } } },
                                Q2: { type: Type.OBJECT, properties: { left: { type: Type.NUMBER }, top: { type: Type.NUMBER } } },
                                Q3: { type: Type.OBJECT, properties: { left: { type: Type.NUMBER }, top: { type: Type.NUMBER } } },
                                Q4: { type: Type.OBJECT, properties: { left: { type: Type.NUMBER }, top: { type: Type.NUMBER } } },
                                OT: { type: Type.OBJECT, properties: { left: { type: Type.NUMBER }, top: { type: Type.NUMBER } } }
                            }
                        },
                        clock: { type: Type.STRING },
                        period: { type: Type.NUMBER },
                        state: { type: Type.STRING, enum: ["pre", "in", "post"] },
                        detail: { type: Type.STRING },
                        isOvertime: { type: Type.BOOLEAN }
                    },
                    required: ["leftScore", "topScore", "quarterScores", "clock", "period", "state", "detail", "isOvertime"]
                }
            }
        });

        const text = result.text;
        if (!text) throw new Error("Empty response from Gemini");

        const data = JSON.parse(text);

        return {
            ...data,
            isManual: false
        };
    } catch (error: any) {
        console.error("Gemini Score Fetch Error:", error);
        throw new Error(`Failed to fetch live score: ${error.message}`);
    }
}
