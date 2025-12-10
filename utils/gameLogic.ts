import { SquareValue, Player, Difficulty } from "../types";

export function calculateWinner(squares: SquareValue[]): { winner: Player | null, line: number[] | null } {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a] as Player, line: lines[i] };
    }
  }
  return { winner: null, line: null };
}

export function isBoardFull(squares: SquareValue[]): boolean {
  return squares.every((square) => square !== null);
}

// Minimax Algorithm for "Hard" and "Impossible" modes
export function getBestMove(squares: SquareValue[], aiPlayer: Player, difficulty: Difficulty): number {
  const availableMoves = squares.map((val, idx) => val === null ? idx : null).filter((val) => val !== null) as number[];
  
  if (availableMoves.length === 0) return -1;

  // Easy Mode: Mostly random
  if (difficulty === 'Easy') {
    // 70% chance to pick a random available move
    if (Math.random() > 0.3) {
       return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
  }

  // Hard/Impossible Mode: Minimax (Perfect Play)
  // Optimization: If center is empty, take it (saves recursion depth and is usually best)
  if (squares[4] === null) return 4;

  let bestScore = -Infinity;
  let move = availableMoves[0];

  for (let i of availableMoves) {
    squares[i] = aiPlayer;
    let score = minimax(squares, 0, false, aiPlayer);
    squares[i] = null;
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }
  return move;
}

function minimax(board: SquareValue[], depth: number, isMaximizing: boolean, aiPlayer: Player): number {
  const { winner } = calculateWinner(board);
  const opponent = aiPlayer === 'X' ? 'O' : 'X';

  if (winner === aiPlayer) return 10 - depth;
  if (winner === opponent) return depth - 10;
  if (isBoardFull(board)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) {
        board[i] = aiPlayer;
        let score = minimax(board, depth + 1, false, aiPlayer);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) {
        board[i] = opponent;
        let score = minimax(board, depth + 1, true, aiPlayer);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}