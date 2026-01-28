
import { GoogleGenAI, Type } from "@google/genai";
import { BoardData } from "../types";

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
        model: "gemini-3-flash-preview", // Using stable 1.5 Flash model
        contents: {
          parts: [
            {
              text: `Analyze this image of a football squares board. Return ONLY a valid JSON object. Do not use markdown code blocks.
              
              Structure:
              {
                "bearsAxis": number[], // Top horizontal axis numbers (0-9)
                "oppAxis": number[],   // Left vertical axis numbers (0-9)
                "squares": string[][]  // 100 squares (10x10), row-major. Empty string for empty squares.
              }
              2. DETECT AXIS NUMBERS: Look strictly at the gray or highlighted headers directly adjacent to the grid 10x10.
                 - IGNORE dates (e.g., 12/14), prices ($125), team names, or other text outside the main axis headers.
                 - The top axis must have EXACTLY 10 digits (0-9).
                 - The left axis must have EXACTLY 10 digits (0-9).
                 - If NO (just one row/col): Extract the single set into 'bearsAxis' and 'oppAxis'.
              
              3. DATA CLEANING:
                 - Use 0-9 digits only for axes.
                 - If a digit is unreadable, use null or -1.
                 - Ensure output used strictly 10 items for axes and 100 items for 'squaresGrid'.`
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
                description: "The exactly 10 digits on the vertical (left) axis. Ignore dates or decorative numbers."
              },
              oppAxis: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "The exactly 10 digits on the horizontal (top) axis. Ignore dates or decorative numbers."
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
                description: "Exactly 100 arrays, one per grid cell."
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

      throw new Error(isOverloaded
        ? "Gemini is currently overloaded. Please try again in a minute."
        : `Gemini API error: ${apiError?.message || 'Unknown API error'}`
      );
    }
  }

  const text = response.text;
  if (!text) {
    console.error("Gemini returned empty response:", response);
    throw new Error("AI returned empty response - check API key and quota");
  }

  try {
    const rawData = JSON.parse(text);

    const board: BoardData = {
      bearsAxis: rawData.bearsAxis?.slice(0, 10),
      oppAxis: rawData.oppAxis?.slice(0, 10),
      squares: rawData.squaresGrid,
      isDynamic: !!rawData.bearsAxisByQuarter || !!rawData.oppAxisByQuarter
    };

    if (board.isDynamic) {
      board.bearsAxisByQuarter = rawData.bearsAxisByQuarter;
      board.oppAxisByQuarter = rawData.oppAxisByQuarter;
    }

    return board;
  } catch (e) {
    console.error("Failed to parse or transform AI response:", text);
    throw new Error("AI returned invalid data structure");
  }
}
