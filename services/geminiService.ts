import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SquareValue, Difficulty } from "../types";
import { getBestMove } from "../utils/gameLogic";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Define the schema for the AI's response (used for Easy/Hard)
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

// Define schema for Taunt only (used for Impossible mode)
const tauntSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    taunt: {
      type: Type.STRING,
      description: "A short, arrogant, robotic comment about the perfect move you just made.",
    },
  },
  required: ["taunt"],
};

export const getAiMove = async (board: SquareValue[], difficulty: Difficulty = 'Hard'): Promise<{ move: number; taunt?: string }> => {
  // If no API Key is set, fallback to local logic
  if (!apiKey) {
    console.warn("No API Key found. Using local logic.");
    await new Promise(resolve => setTimeout(resolve, 600));
    const move = getBestMove(board, 'O', difficulty);
    const taunts = difficulty === 'Impossible' 
      ? ["I cannot error.", "Resistance is futile.", "Mathematical perfection."] 
      : ["Your move.", "Interesting choice.", "Thinking..."];
    return { move, taunt: taunts[Math.floor(Math.random() * taunts.length)] };
  }

  // IMPOSSIBLE MODE: Hybrid Approach
  // Use Minimax for the move (100% perfect) and Gemini for the personality.
  if (difficulty === 'Impossible') {
    const move = getBestMove(board, 'O', 'Impossible');
    
    try {
      const prompt = `
        You are an unbeatable AI playing Tic-Tac-Toe. 
        Board: ${JSON.stringify(board)}. 
        You are making a move at index ${move} to ensure a win or draw.
        Generate a short, arrogant, robotic taunt (max 12 words) telling the human they cannot win.
        Example: "A perfect move. You cannot defeat math."
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: tauntSchema,
        },
      });
      
      const text = response.text;
      const json = text ? JSON.parse(text) : { taunt: "Calculated." };
      return { move, taunt: json.taunt };

    } catch (e) {
      console.error("Taunt generation failed", e);
      return { move, taunt: "Optimal move executed." };
    }
  }

  // EASY / HARD MODES: Full Gemini Control
  try {
    const strategy = difficulty === 'Hard' 
      ? "You are an expert player. Win if possible, block 'X' if they are about to win. Play aggressively." 
      : "You are a beginner player. Play casually. Occasionally make a mistake or miss a block.";

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
        temperature: difficulty === 'Hard' ? 0.2 : 1.2, 
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return result;

  } catch (error) {
    console.error("Error fetching AI move:", error);
    // Fallback
    const move = getBestMove(board, 'O', difficulty);
    return { move, taunt: "Connection interrupted. Playing locally." };
  }
};