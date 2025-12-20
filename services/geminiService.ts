import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SquareValue, Difficulty, Player } from "../types";
import { getBestMove } from "../utils/gameLogic";

const moveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    move: {
      type: Type.INTEGER,
      description: "0-8 index",
    },
    taunt: {
      type: Type.STRING,
      description: "Short witty comment",
    },
  },
  required: ["move"],
};

const tauntSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    taunt: {
      type: Type.STRING,
      description: "Short robotic comment",
    },
  },
  required: ["taunt"],
};

export const getAiMove = async (
  board: SquareValue[], 
  difficulty: Difficulty = 'Hard', 
  aiPlayer: Player = 'O'
): Promise<{ move: number; taunt?: string }> => {
  const currentApiKey = process.env.API_KEY;

  // Faster local move generation
  const localMove = getBestMove(board, aiPlayer, difficulty);

  if (!currentApiKey) {
    return { move: localMove, taunt: "Offline Mode." };
  }

  const ai = new GoogleGenAI({ apiKey: currentApiKey });

  if (difficulty === 'Impossible') {
    try {
      const tauntPromise = ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `AI move at ${localMove}. Playing as '${aiPlayer}'. Say a 5-word robotic taunt.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: tauntSchema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const response = await Promise.race([
        tauntPromise,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);

      if (!response) throw new Error('Timeout');
      const result = JSON.parse(response.text || '{"taunt": "Calculated."}');
      return { move: localMove, taunt: result.taunt };
    } catch (e) {
      return { move: localMove, taunt: "Resistance is futile." };
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Tic-Tac-Toe. AI is '${aiPlayer}'. Board: ${JSON.stringify(board)}. Difficulty: ${difficulty}. Return JSON: {move: index 0-8, taunt: short string}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: moveSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const result = JSON.parse(response.text || '{}');
    if (typeof result.move === 'number' && board[result.move] === null) {
      return result;
    }
    return { move: localMove, taunt: "Standard move." };
  } catch (error) {
    return { move: localMove, taunt: "Moving..." };
  }
};