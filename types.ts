export type Player = 'X' | 'O';
export type SquareValue = Player | null;

export type GameMode = 'PvP' | 'PvAI' | null;
export type Difficulty = 'Easy' | 'Hard';

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
}

export interface AIMoveResponse {
  move: number;
  taunt?: string;
}