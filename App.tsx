import React, { useState, useEffect, useCallback } from 'react';
import { calculateWinner, isBoardFull } from './utils/gameLogic';
import { getAiMove } from './services/geminiService';
import { Player, SquareValue, GameMode, ScoreBoard } from './types';
import { UserIcon, CpuChipIcon, SparklesIcon, XIcon, OIcon, ArrowPathIcon, HomeIcon } from './components/Icons';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [startingPlayer, setStartingPlayer] = useState<Player>('X'); // Track who started the current game
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [scores, setScores] = useState<ScoreBoard>({ X: 0, O: 0 });
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiTaunt, setAiTaunt] = useState<string>("");

  const currentPlayer = xIsNext ? 'X' : 'O';
  const isGameOver = winner !== null;

  // Sound effects (simple oscillator beeps could be added here, but sticking to visual only for robustness)

  const handleSquareClick = useCallback((index: number) => {
    if (board[index] || winner || isAiThinking) return;
    
    // In PvAI mode, if it's O's turn (AI), human shouldn't be able to click
    if (gameMode === 'PvAI' && !xIsNext) return;

    makeMove(index, currentPlayer);
  }, [board, winner, isAiThinking, gameMode, xIsNext, currentPlayer]);

  const makeMove = (index: number, player: Player) => {
    const newBoard = [...board];
    newBoard[index] = player;
    setBoard(newBoard);
    
    // Check for win
    const result = calculateWinner(newBoard);
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      setScores(prev => ({ ...prev, [result.winner as Player]: prev[result.winner as Player] + 1 }));
      setAiTaunt(result.winner === 'O' && gameMode === 'PvAI' ? "Calculation complete. Victory achieved." : "");
    } else if (isBoardFull(newBoard)) {
      setWinner('Draw');
      setAiTaunt(gameMode === 'PvAI' ? "A logical stalemate." : "");
    } else {
      setXIsNext(!xIsNext);
    }
  };

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setAiTaunt("");

    // Alternate starting player
    const nextStarter = startingPlayer === 'X' ? 'O' : 'X';
    setStartingPlayer(nextStarter);
    setXIsNext(nextStarter === 'X');
  }, [startingPlayer]);

  const resetMode = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setXIsNext(true);
    setStartingPlayer('X');
    setAiTaunt("");
    setScores({ X: 0, O: 0 });
    setGameMode(null);
  };

  // Auto-play next game
  useEffect(() => {
    if (winner) {
      const timer = setTimeout(() => {
        resetGame();
      }, 2500); // 2.5s delay to see the result
      return () => clearTimeout(timer);
    }
  }, [winner, resetGame]);

  // AI Logic Effect
  useEffect(() => {
    if (gameMode === 'PvAI' && !xIsNext && !winner && !isBoardFull(board)) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        
        try {
          const { move, taunt } = await getAiMove(board, 'Hard');
          if (taunt) setAiTaunt(taunt);
          if (board[move] === null) {
            makeMove(move, 'O');
          } else {
            // Fallback for invalid move (rare with this logic but possible)
            console.error("AI tried to play on taken square");
          }
        } catch (e) {
            console.error(e);
        } finally {
          setIsAiThinking(false);
        }
      };
      makeAiMove();
    }
  }, [xIsNext, gameMode, winner, board]);

  const renderSquare = (i: number) => {
    const isWinningSquare = winningLine?.includes(i);
    const value = board[i];
    
    return (
      <button
        key={i}
        onClick={() => handleSquareClick(i)}
        disabled={!!value || !!winner || (gameMode === 'PvAI' && !xIsNext)}
        className={`
          h-16 w-16 sm:h-24 sm:w-24 m-1 rounded-xl shadow-sm flex items-center justify-center
          transition-all duration-200 transform hover:scale-105 active:scale-95 border-2
          ${value ? 'bg-white border-white' : 'bg-gray-100 border-gray-100 hover:bg-gray-200'}
          ${isWinningSquare ? 'ring-4 ring-green-400 bg-green-50 border-green-50 scale-105' : ''}
          ${!value && !winner && ((gameMode === 'PvAI' && xIsNext) || gameMode === 'PvP') ? 'cursor-pointer' : 'cursor-default'}
        `}
      >
        <span className={`
          transform transition-transform duration-300 scale-0 flex items-center justify-center
          ${value ? 'scale-100' : ''}
        `}>
          {value === 'X' && <XIcon className="w-10 h-10 sm:w-16 sm:h-16 text-violet-600" />}
          {value === 'O' && <OIcon className="w-10 h-10 sm:w-16 sm:h-16 text-rose-500" />}
        </span>
      </button>
    );
  };

  if (!gameMode) {
    return (
      <div className="h-[100dvh] w-full bg-gray-50 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl shadow-xl text-center space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Tic Tac Toe</h1>
            <p className="text-gray-500 text-sm sm:text-base">Choose your opponent</p>
          </div>

          <div className="grid gap-3 sm:gap-4">
            <button
              onClick={() => setGameMode('PvAI')}
              className="group relative flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-primary to-accent text-white rounded-2xl transition-all hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-1"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CpuChipIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base sm:text-lg">Play vs Gemini</div>
                  <div className="text-white/80 text-xs sm:text-sm">Challenge the AI</div>
                </div>
              </div>
              <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => setGameMode('PvP')}
              className="group flex items-center justify-between p-4 sm:p-6 bg-white border-2 border-gray-100 hover:border-primary/30 text-gray-700 rounded-2xl transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-primary/10 transition-colors">
                  <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500 group-hover:text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-base sm:text-lg">Play vs Human</div>
                  <div className="text-gray-500 text-xs sm:text-sm">Local multiplayer</div>
                </div>
              </div>
            </button>
          </div>
          
          <div className="pt-2 sm:pt-4 text-xs text-gray-400">
            Powered by Google Gemini
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-gray-50 flex flex-col items-center p-3 sm:p-4 overflow-hidden">
      {/* Main Container - Full Height, flex-col */}
      <div className="w-full max-w-lg flex flex-col h-full">
        
        {/* Top: Header */}
        <div className="w-full flex items-center justify-between px-2 sm:px-0 mb-2">
          <button 
            onClick={resetMode}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
            title="Back to Menu"
          >
            <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-sm text-xs sm:text-sm font-medium text-gray-500">
            {gameMode === 'PvAI' ? 'Human vs AI' : 'Human vs Human'}
          </div>
          <button 
            onClick={() => resetGame()}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
            title="Restart Game"
          >
            <ArrowPathIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Players & Score - Transparent Background */}
        <div className="w-full flex justify-between items-center px-4 py-2 mb-2">
          {/* Player X */}
          <div className={`flex flex-col items-center transition-opacity duration-300 ${!xIsNext && !winner ? 'opacity-50' : 'opacity-100 scale-105'}`}>
            <div className="relative mb-0.5">
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${xIsNext && !winner ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-white text-gray-400 border border-gray-100'}`}>
                <UserIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-px shadow-sm">
                <XIcon className="w-2 h-2 text-primary" />
              </div>
            </div>
            <span className="font-semibold text-gray-700 text-[8px] sm:text-[10px] leading-tight">Player 1</span>
            <span className="text-sm sm:text-base font-bold text-primary leading-tight">{scores.X}</span>
          </div>

          {/* Vs / Result */}
          <div className="flex flex-col items-center justify-center px-2">
             {winner ? (
               <div className="text-center animate-bounce-short">
                 <span className="block text-[7px] sm:text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-px">Winner</span>
                 <span className={`text-sm sm:text-base font-bold whitespace-nowrap ${winner === 'X' ? 'text-primary' : (winner === 'O' ? 'text-rose-500' : 'text-gray-600')}`}>
                   {winner === 'Draw' ? 'Draw!' : (winner === 'X' ? 'Player 1' : (gameMode === 'PvAI' ? 'Gemini' : 'Player 2'))}
                 </span>
               </div>
             ) : (
               <div className="text-base sm:text-xl font-light text-gray-400">vs</div>
             )}
          </div>

          {/* Player O */}
          <div className={`flex flex-col items-center transition-opacity duration-300 ${xIsNext && !winner ? 'opacity-50' : 'opacity-100 scale-105'}`}>
            <div className="relative mb-0.5">
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${!xIsNext && !winner ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'bg-white text-gray-400 border border-gray-100'}`}>
                {gameMode === 'PvAI' ? <CpuChipIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <UserIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
              </div>
              {isAiThinking && (
                <div className="absolute inset-0 rounded-full border-2 border-rose-300 border-t-transparent animate-spin"></div>
              )}
              <div className="absolute -bottom-0.5 -left-0.5 bg-white rounded-full p-px shadow-sm">
                <OIcon className="w-2 h-2 text-rose-500" />
              </div>
            </div>
            <span className="font-semibold text-gray-700 text-[8px] sm:text-[10px] leading-tight">{gameMode === 'PvAI' ? 'Gemini' : 'Player 2'}</span>
            <span className="text-sm sm:text-base font-bold text-rose-500 leading-tight">{scores.O}</span>
          </div>
        </div>

        {/* Middle: Board & Taunt (takes available space) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full gap-4">
          
          {/* Board */}
          <div className="bg-white p-3 rounded-2xl shadow-xl shadow-purple-100/50">
            <div className="grid grid-cols-3 gap-0">
              {board.map((_, i) => renderSquare(i))}
            </div>
          </div>

          {/* AI Message / Taunt */}
          <div className="h-6 flex items-center justify-center w-full px-4">
            {gameMode === 'PvAI' && aiTaunt && !isAiThinking && (
              <div className="bg-white border border-gray-100 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm text-gray-600 shadow-sm flex items-center gap-2 animate-fade-in-up text-center truncate max-w-full">
                <SparklesIcon className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                <span className="truncate">"{aiTaunt}"</span>
              </div>
            )}
            {gameMode === 'PvAI' && isAiThinking && (
              <div className="text-xs sm:text-sm text-rose-500 font-medium animate-pulse">Gemini is thinking...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;