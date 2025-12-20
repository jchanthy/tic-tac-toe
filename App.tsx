import React, { useState, useEffect, useCallback, useRef } from 'react';
import { calculateWinner, isBoardFull } from './utils/gameLogic';
import { getAiMove } from './services/geminiService';
import { Player, SquareValue, GameMode, ScoreBoard, Difficulty, TimeLimit } from './types';
import { UserIcon, CpuChipIcon, SparklesIcon, XIcon, OIcon, ArrowPathIcon, HomeIcon } from './components/Icons';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('Hard');
  const [timeLimit, setTimeLimit] = useState<TimeLimit>(null);
  const [userPiece, setUserPiece] = useState<Player>('X');
  
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [startingPlayer, setStartingPlayer] = useState<Player>('X'); 
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiTaunt, setAiTaunt] = useState<string>("");
  
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [autoResetCounter, setAutoResetCounter] = useState<number | null>(null);
  
  const autoResetTimerRef = useRef<number | null>(null);
  const turnTimerRef = useRef<number | null>(null);

  const [scores, setScores] = useState<ScoreBoard>(() => {
    const saved = localStorage.getItem('ttt-scores-v7');
    return saved ? JSON.parse(saved) : { X: 0, O: 0, Draws: 0, Total: 0 };
  });

  useEffect(() => {
    localStorage.setItem('ttt-scores-v7', JSON.stringify(scores));
  }, [scores]);

  const startNewRound = useCallback(() => {
    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    
    setAutoResetCounter(null);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setAiTaunt("");
    
    // Toggle who starts each round
    const nextStart = startingPlayer === 'X' ? 'O' : 'X';
    setStartingPlayer(nextStart);
    setXIsNext(nextStart === 'X');
    
    setIsAiThinking(false);
    setRemainingTime(timeLimit);
  }, [startingPlayer, timeLimit]);

  const manualFullReset = useCallback(() => {
    startNewRound();
    setScores({ X: 0, O: 0, Draws: 0, Total: 0 });
  }, [startNewRound]);

  const handleTimeout = useCallback(() => {
    const loser = xIsNext ? 'X' : 'O';
    const victor = loser === 'X' ? 'O' : 'X';
    setWinner(victor);
    setScores(s => ({ ...s, [victor]: s[victor] + 1, Total: s.Total + 1 }));
    setAiTaunt("Time ran out!");
  }, [xIsNext]);

  const executeMove = useCallback((index: number, player: Player) => {
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    
    setBoard(prevBoard => {
      if (prevBoard[index] !== null || winner) return prevBoard;
      
      const nextBoard = [...prevBoard];
      nextBoard[index] = player;
      
      const result = calculateWinner(nextBoard);
      if (result.winner) {
        setWinner(result.winner);
        setWinningLine(result.line);
        setScores(s => ({ ...s, [result.winner as Player]: s[result.winner as Player] + 1, Total: s.Total + 1 }));
      } else if (isBoardFull(nextBoard)) {
        setWinner('Draw');
        setScores(s => ({ ...s, Draws: s.Draws + 1, Total: s.Total + 1 }));
      } else {
        setXIsNext(p => !p);
        setRemainingTime(timeLimit);
      }
      
      return nextBoard;
    });
  }, [winner, timeLimit]);

  // Turn Timer Logic
  useEffect(() => {
    if (gameMode && !winner && timeLimit !== null && remainingTime !== null) {
      turnTimerRef.current = window.setInterval(() => {
        setRemainingTime(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            window.clearInterval(turnTimerRef.current!);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
      };
    }
  }, [xIsNext, winner, gameMode, timeLimit, remainingTime, handleTimeout]);

  const handleHumanClick = (i: number) => {
    if (board[i] || winner || isAiThinking) return;
    const currentPlayer = xIsNext ? 'X' : 'O';
    
    if (gameMode === 'PvAI' && currentPlayer !== userPiece) return;
    executeMove(i, currentPlayer);
  };

  // Auto-reset logic
  useEffect(() => {
    if (winner) {
      if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
      const COUNTDOWN_START = 3;
      setAutoResetCounter(COUNTDOWN_START);
      
      let count = COUNTDOWN_START;
      autoResetTimerRef.current = window.setInterval(() => {
        count -= 1;
        if (count <= 0) {
          startNewRound();
        } else {
          setAutoResetCounter(count);
        }
      }, 1000);

      return () => {
        if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
      };
    }
  }, [winner, startNewRound]);

  // AI Turn Logic
  useEffect(() => {
    let active = true;
    const aiPiece = userPiece === 'X' ? 'O' : 'X';
    const currentTurnPiece = xIsNext ? 'X' : 'O';

    if (gameMode === 'PvAI' && currentTurnPiece === aiPiece && !winner && !isBoardFull(board)) {
      const handleAiTurn = async () => {
        setIsAiThinking(true);
        try {
          const result = await getAiMove(board, difficulty, aiPiece);
          if (active && result.move !== undefined && board[result.move] === null) {
            if (result.taunt) setAiTaunt(result.taunt);
            executeMove(result.move, aiPiece);
          }
        } catch (e) {
          console.error("AI Move failed", e);
        } finally {
          if (active) setIsAiThinking(false);
        }
      };
      
      const timer = setTimeout(handleAiTurn, 150);
      return () => { active = false; clearTimeout(timer); };
    }
  }, [xIsNext, gameMode, winner, board, difficulty, executeMove, userPiece]);

  const quitToMenu = () => {
    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    setGameMode(null);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setXIsNext(true);
    setIsAiThinking(false);
    setAutoResetCounter(null);
    setRemainingTime(null);
  };

  const aiPiece = userPiece === 'X' ? 'O' : 'X';

  if (!gameMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-xs space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary">
              <SparklesIcon className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">X & O</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Neural Edition</p>
          </div>

          <div className="space-y-4">
            {/* Piece Selection */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Piece</p>
              <div className="bg-white p-1 rounded-xl flex gap-1 border border-slate-200 shadow-sm">
                {(['X', 'O'] as Player[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setUserPiece(p)}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${userPiece === p ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="font-black">{p}</span>
                    {p === 'X' ? <XIcon className="w-3 h-3" /> : <OIcon className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Difficulty</p>
              <div className="bg-white p-1 rounded-xl flex gap-1 border border-slate-200 shadow-sm">
                {['Easy', 'Hard', 'Impossible'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d as Difficulty)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${difficulty === d ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Timing Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turn Timer</p>
              <div className="bg-white p-1 rounded-xl flex gap-1 border border-slate-200 shadow-sm">
                {[null, 3, 5, 10].map((t) => (
                  <button
                    key={String(t)}
                    onClick={() => setTimeLimit(t as TimeLimit)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${timeLimit === t ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t === null ? 'Off' : `${t}s`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setGameMode('PvAI'); setRemainingTime(timeLimit); }}
              className="w-full group p-6 bg-slate-900 text-white rounded-[2rem] hover:bg-slate-800 transition-all active:scale-95 shadow-xl flex flex-col items-center gap-2"
            >
              <CpuChipIcon className="w-8 h-8 text-rose-400" />
              <div className="text-lg font-bold">Vs. Machine</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Fast Neural AI</div>
            </button>

            <button
              onClick={() => { setGameMode('PvP'); setRemainingTime(timeLimit); }}
              className="w-full group p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-primary/30 transition-all active:scale-95 shadow-sm flex flex-col items-center gap-2"
            >
              <UserIcon className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
              <div className="text-lg font-bold text-slate-700">Vs. Human</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Local Match</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        
        <div className="flex items-center justify-between bg-white px-4 py-4 rounded-3xl shadow-sm border border-slate-100">
          <button onClick={quitToMenu} className="p-2 text-slate-300 hover:text-slate-600" title="Back to Menu">
            <HomeIcon className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className={`flex flex-col items-center px-3 py-1 rounded-xl transition-all ${xIsNext && !winner ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
              <span className={`text-[10px] font-black ${xIsNext && !winner ? 'text-primary' : 'text-slate-300'}`}>P1 (X)</span>
              <span className="text-xl font-black text-slate-900">{scores.X}</span>
            </div>
            <div className="text-slate-100 font-black">|</div>
            <div className={`flex flex-col items-center px-3 py-1 rounded-xl transition-all ${!xIsNext && !winner ? 'bg-rose-500/5 ring-1 ring-rose-500/20' : ''}`}>
              <span className={`text-[10px] font-black ${!xIsNext && !winner ? 'text-rose-500' : 'text-slate-300'}`}>
                {gameMode === 'PvAI' ? 'AI' : 'P2'} (O)
              </span>
              <span className="text-xl font-black text-slate-900">{scores.O}</span>
            </div>
          </div>

          <button onClick={manualFullReset} className="p-2 text-slate-300 hover:text-slate-600" title="Reset Game & Scores">
            <ArrowPathIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white p-6 rounded-[3rem] shadow-xl border border-slate-100 relative overflow-hidden">
          
          {timeLimit !== null && !winner && (
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${remainingTime && remainingTime <= 1 ? 'bg-rose-500 animate-pulse' : 'bg-primary'}`}
                style={{ width: `${(remainingTime! / timeLimit) * 100}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {board.map((val, i) => (
              <button
                key={i}
                onClick={() => handleHumanClick(i)}
                disabled={!!val || !!winner || (gameMode === 'PvAI' && (xIsNext ? 'X' : 'O') !== userPiece)}
                className={`aspect-square w-full rounded-2xl flex items-center justify-center transition-all border-2 
                  ${val ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent hover:bg-slate-100'} 
                  ${winningLine?.includes(i) ? 'bg-primary/5 border-primary ring-2 ring-primary/20 scale-105 z-10' : ''}`}
              >
                <div className="w-[60%] h-[60%] flex items-center justify-center">
                  {val === 'X' && <XIcon className="w-full h-full text-primary" />}
                  {val === 'O' && <OIcon className="w-full h-full text-rose-500" />}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 h-12 flex items-center justify-center text-center">
            {winner ? (
              <div className="flex flex-col items-center gap-1">
                <div className={`px-8 py-2 rounded-2xl font-black text-[10px] tracking-widest shadow-lg text-white ${winner === 'X' ? 'bg-primary' : (winner === 'O' ? 'bg-rose-500' : 'bg-slate-900')}`}>
                  {winner === 'Draw' 
                    ? 'STALEMATE' 
                    : (gameMode === 'PvAI' 
                        ? (winner === userPiece ? 'YOU WIN' : 'YOU LOST')
                        : `${winner} WINS`
                      )
                  }
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Auto-next round in {autoResetCounter}s...
                </div>
              </div>
            ) : isAiThinking ? (
              <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                Analyzing...
              </div>
            ) : (remainingTime !== null && remainingTime <= 1 && timeLimit !== null) ? (
              <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                Hurry! Turn Ending!
              </div>
            ) : aiTaunt ? (
              <div className="text-[11px] text-slate-500 font-bold italic px-4 animate-fade-in">
                "{aiTaunt}"
              </div>
            ) : (
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                {xIsNext 
                  ? (gameMode === 'PvAI' && userPiece === 'O' ? "AI is Thinking (X)" : "Player X's Turn")
                  : (gameMode === 'PvAI' && userPiece === 'X' ? "AI is Thinking (O)" : "Player O's Turn")
                }
              </div>
            )}
          </div>
        </div>

        {timeLimit !== null && !winner && (
          <div className="flex justify-center -mt-2">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${remainingTime! <= 1 ? 'text-rose-500' : 'text-slate-400'}`}>
              Time Left: {remainingTime}s
            </span>
          </div>
        )}

        <div className="flex justify-center gap-8 opacity-40">
          <div className="text-center">
            <div className="text-[8px] font-black uppercase tracking-widest">Draws</div>
            <div className="font-bold text-xs">{scores.Draws}</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] font-black uppercase tracking-widest">Total</div>
            <div className="font-bold text-xs">{scores.Total}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;