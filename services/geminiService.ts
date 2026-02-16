
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
              1. DETECT GRID: Locate the main 10x10 grid of squares.
              2. AXIS DIGITS:
                 - Bears Axis (Vertical/Left): Extract the 10 digits from top to bottom.
                 - Opp Axis (Horizontal/Top): Extract the 10 digits from left to right.
              3. SCAN EVERY CELL (100 TOTAL):
                 - Analyze the grid as 10 rows (Row 0 to Row 9).
                 - In each row, extract the 10 cells from left to right.
                 - Extract the handwritten name or text from each cell.
                 - If a cell is blank, use "".
                 - If a cell is unreadable, use "???".
              
              JSON Structure:
              {
                "bearsAxis": [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
                "oppAxis": [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
                "squaresGrid": [
                  ["Name R0C0", "Name R0C1", ..., "Name R0C9"],
                  ["Name R1C0", ...],
                  ...
                  ["Name R9C0", ..., "Name R9C9"]
                ]
              }`
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
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                description: "10 rows, each containing 10 cell strings."
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

    // Flatten 2D grid into the 1D flat array (length 100) expected by the UI.
    // Each cell must be string[] as per BoardData.
    const flatSquares: string[][] = [];
    const rows = rawData.squaresGrid || [];

    for (let r = 0; r < 10; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < 10; c++) {
        const cell = row[c] || "";
        flatSquares.push(cell ? [cell] : []);
      }
    }

    return {
      bearsAxis: rawData.bearsAxis?.slice(0, 10),
      oppAxis: rawData.oppAxis?.slice(0, 10),
      squares: flatSquares,
      isDynamic: !!rawData.bearsAxisByQuarter || !!rawData.oppAxisByQuarter,
      bearsAxisByQuarter: rawData.bearsAxisByQuarter,
      oppAxisByQuarter: rawData.oppAxisByQuarter
    };
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    throw new Error("AI returned invalid data structure");
  }
}
