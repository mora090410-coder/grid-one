
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
        model: "gemini-2.0-flash-exp", // Updated to latest model for better availability
        contents: {
          parts: [
            {
              text: `Analyze this football squares board image. 
              1. EXTRACT NAMES: Identify and extract the name written in each of the 100 squares.
                 - Output 'squaresGrid' as an array of 100 arrays (one per cell, row-by-row).
              
              2. DETECT AXIS NUMBERS: Look at the top and left headers.
                 - Are there MULTIPLE rows/columns of numbers (e.g. labeled Q1, Q2, Q3, Final)?
                 - If YES: This is a DYNAMIC BOARD. Extract each set of 10 numbers into 'bearsAxisByQuarter' (left) and 'oppAxisByQuarter' (top).
                 - If NO (just one row/col): Extract the single set into 'bearsAxis' and 'oppAxis'.
              
              3. DATA CLEANING:
                 - Use 0-9 digits only for axes.
                 - If a digit is unreadable, use null or -1.
                 - Ensure output is exactly 100 items in 'squaresGrid'.`
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
                description: "The 10 digits on the vertical (left) axis. (Default/Q1)"
              },
              oppAxis: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "The 10 digits on the horizontal (top) axis. (Default/Q1)"
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
      bearsAxis: rawData.bearsAxis,
      oppAxis: rawData.oppAxis,
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
