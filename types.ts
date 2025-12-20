export type Player = 'X' | 'O';
export type SquareValue = Player | null;

export type GameMode = 'PvP' | 'PvAI' | null;
export type Difficulty = 'Easy' | 'Hard' | 'Impossible';
export type TimeLimit = null | 3 | 5 | 10;
export type MatchDuration = null | 1 | 3 | 5; // minutes

export interface GameState {
  board: SquareValue[];
  xIsNext: boolean;
  winner: Player | 'Draw' | null;
  winningLine: number[] | null;
  history: SquareValue[][];
}

export interface ScoreBoard {
  X: number;
  O: number;
  Draws: number;
  Total: number;
}

export interface AIMoveResponse {
  move: number;
  taunt?: string;
}