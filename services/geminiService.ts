
import { GoogleGenAI, Type } from "@google/genai";
import { BoardData } from "../types";

export async function parseBoardImage(base64Image: string): Promise<BoardData> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env.local");
  }

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Analyze this football squares board image. 
            1. Identify the numbers on the top horizontal axis (oppAxis).
            2. Identify the numbers on the left vertical axis (bearsAxis).
            3. Extract the names written in each of the 100 squares.
            4. Check if there are different axis numbers for different quarters (Dynamic Board).
               - Look for multiple rows/columns of numbers labeled Q1, Q2, Q3, Q4/Final.
               - If found, extract them into the ByQuarter fields.
               - If only one set is found, populate the main axis fields and leave ByQuarter fields null.
            
            Important:
            - Output the results as JSON.
            - Identify the positions of names. 
            - Provide 'squaresGrid' as an array of 100 items. 
            - Each item corresponds to a position (moving row by row, left to right).
            - Each item is an array of strings (names in that box).
            - If a square is empty, provide an empty array [].
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
  } catch (apiError: any) {
    console.error("Gemini API Error:", apiError);
    throw new Error(`Gemini API error: ${apiError?.message || 'Unknown API error'}`);
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
