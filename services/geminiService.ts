import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SquareValue } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Define the schema for the AI's response
const moveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    move: {
      type: Type.INTEGER,
      description: "The 0-indexed position on the board (0-8) where the AI wants to place its symbol.",
    },
    taunt: {
      type: Type.STRING,
      description: "A short, witty, or competitive comment about the move (max 10 words).",
    },
  },
  required: ["move"],
};

export const getAiMove = async (board: SquareValue[], difficulty: 'Easy' | 'Hard' = 'Hard'): Promise<{ move: number; taunt?: string }> => {
  if (!apiKey) {
    console.warn("No API Key found. Returning random move.");
    const availableMoves = board.map((val, idx) => val === null ? idx : null).filter((val) => val !== null) as number[];
    const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    return { move: randomMove, taunt: "I'm playing blind here!" };
  }

  try {
    // Concise prompt for faster token processing
    const prompt = `
      Play Tic-Tac-Toe as 'O'. Board (0-8): ${JSON.stringify(board)}.
      'X' is Human. 'null' is empty.
      Win or block 'X'. Else play strategic.
      Return JSON with move (0-8) and short taunt.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: moveSchema,
        temperature: difficulty === 'Hard' ? 0.2 : 0.8,
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for maximum speed
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return result;

  } catch (error) {
    console.error("Error fetching AI move:", error);
    // Fallback logic in case of API error
    const availableMoves = board.map((val, idx) => val === null ? idx : null).filter((val) => val !== null) as number[];
    const fallbackMove = availableMoves.length > 0 ? availableMoves[0] : 0;
    return { move: fallbackMove, taunt: "My circuits are fried, but I'll still play." };
  }
};