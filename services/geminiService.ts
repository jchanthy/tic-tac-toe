import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SquareValue, Difficulty } from "../types";
import { getBestMove } from "../utils/gameLogic";

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

export const getAiMove = async (board: SquareValue[], difficulty: Difficulty = 'Hard'): Promise<{ move: number; taunt?: string }> => {
  // If no API Key is set, fallback to local logic (Minimax for Hard, Random for Easy)
  if (!apiKey) {
    console.warn("No API Key found. Using local logic.");
    
    // Add a small artificial delay to simulate "thinking"
    await new Promise(resolve => setTimeout(resolve, 600));

    const move = getBestMove(board, 'O', difficulty);
    
    let taunt = "";
    if (difficulty === 'Hard') {
      const taunts = ["I don't need the cloud to beat you.", "Calculated locally.", "Checkmate in 3... maybe."];
      taunt = taunts[Math.floor(Math.random() * taunts.length)];
    } else {
      taunt = "I'm just warming up.";
    }

    return { move, taunt };
  }

  try {
    const strategy = difficulty === 'Hard' 
      ? "You are an expert Tic-Tac-Toe player. You MUST win if possible, or block the opponent from winning. Do not make mistakes." 
      : "You are a beginner player. You should play casually. Occasionally miss a block or a win to give the human a chance.";

    const prompt = `
      Play Tic-Tac-Toe as 'O'. Board (0-8): ${JSON.stringify(board)}.
      'X' is Human. 'null' is empty.
      ${strategy}
      Return JSON with move (0-8) and short taunt.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: moveSchema,
        temperature: difficulty === 'Hard' ? 0.1 : 1.0, // Low temp for precision, high for variety/errors
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return result;

  } catch (error) {
    console.error("Error fetching AI move:", error);
    // Fallback logic in case of API error
    const move = getBestMove(board, 'O', difficulty);
    return { move, taunt: "My connection flickered, but I'm still here." };
  }
};