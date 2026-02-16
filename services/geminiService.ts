
import { GoogleGenAI, Type } from "@google/genai";
import { BoardData } from "../types";

// Debug log for environment validation
console.log("Gemini Service Initializing. API Key present:", !!(import.meta as any).env.VITE_GEMINI_API_KEY);

export async function parseBoardImage(base64Image: string): Promise<BoardData> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env.local");
  }

  const ai = new GoogleGenAI({ apiKey });

  let retries = 3;
  let delay = 1000;
  let response: any;

  while (retries >= 0) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Latest efficient model
        contents: {
          parts: [
            {
              text: `Analyze this image of a football squares board. Return ONLY a valid JSON object.
              
              PRECISION OCR INSTRUCTIONS:
              1. DETECT GRID: Locate the main 10x10 grid of cells.
              2. DETECT AXIS NUMBERS: 
                 - Look for the 10 digits (0-9) positioned directly above the top edge of the grid.
                 - Look for the 10 digits (0-9) positioned directly to the left edge of the grid.
                 - These digits are often in small, distinct boxes. Ignore any other numbers like dates, prices, or year labels.
              3. DATA EXTRACTION:
                 - 'bearsAxis': The 10 vertical digits (left side), ordered from top to bottom.
                 - 'oppAxis': The 10 horizontal digits (top side), ordered from left to right.
                 - 'squaresGrid': A flat array of EXACTLY 100 strings, ordered row-by-row (row 0 then row 1...). Each string contains the name/initials in that cell. Use an empty string for blank cells.
              
              Structure:
              {
                "bearsAxis": number[],
                "oppAxis": number[],
                "squaresGrid": string[]
              }
              
              If a cell is unreadable, use "???". If a digit is unreadable, use -1.`
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bearsAxis: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Exactly 10 digits from the left vertical axis (0-9)."
              },
              oppAxis: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Exactly 10 digits from the top horizontal axis (0-9)."
              },
              bearsAxisByQuarter: {
                type: Type.OBJECT,
                properties: {
                  Q1: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q2: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q3: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q4: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                },
                nullable: true
              },
              oppAxisByQuarter: {
                type: Type.OBJECT,
                properties: {
                  Q1: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q2: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q3: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  Q4: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                },
                nullable: true
              },
              squaresGrid: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Flat array of 100 cell contents."
              }
            },
            required: ["bearsAxis", "oppAxis", "squaresGrid"]
          }
        }
      });
      break; // Success
    } catch (apiError: any) {
      console.error(`Gemini API Error (Attempt ${4 - retries}/4):`, apiError);
      const isOverloaded = apiError.message?.includes('503') || apiError.message?.includes('overloaded');

      if (isOverloaded && retries > 0) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2; // Exponential backoff
        continue;
      }

      throw apiError;
    }
  }

  const text = response.text;
  if (!text) {
    console.error("Gemini returned empty response:", response);
    throw new Error("AI returned empty response");
  }

  try {
    const rawData = JSON.parse(text);

    return {
      bearsAxis: rawData.bearsAxis?.slice(0, 10),
      oppAxis: rawData.oppAxis?.slice(0, 10),
      // Map flat strings to string[] per cell as expected by components
      squares: (rawData.squaresGrid || []).map((s: string) => s ? [s] : []),
      isDynamic: !!rawData.bearsAxisByQuarter || !!rawData.oppAxisByQuarter,
      bearsAxisByQuarter: rawData.bearsAxisByQuarter,
      oppAxisByQuarter: rawData.oppAxisByQuarter
    };
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    throw new Error("AI returned invalid data structure");
  }
}
