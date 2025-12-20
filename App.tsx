import React, { useState, useEffect, useCallback, useRef } from 'react';
import { calculateWinner, isBoardFull } from './utils/gameLogic';
import { getAiMove } from './services/geminiService';
import { Player, SquareValue, GameMode, ScoreBoard, Difficulty, TimeLimit, MatchDuration } from './types';
import { UserIcon, CpuChipIcon, SparklesIcon, XIcon, OIcon, ArrowPathIcon, HomeIcon, GameLogo } from './components/Icons';

function App() {
  // Config States
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('Hard');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TimeLimit>(null);
  const [matchDuration, setMatchDuration] = useState<MatchDuration>(null);
  const [userPiece, setUserPiece] = useState<Player>('X');
  
  // Game States
  const [board, setBoard] = useState<SquareValue[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [startingPlayer, setStartingPlayer] = useState<Player>('X'); 
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [aiTaunt, setAiTaunt] = useState<string>("");
  
  // Timer States
  const [remainingTurnTime, setRemainingTurnTime] = useState<number | null>(null);
  const [matchTimeLeft, setMatchTimeLeft] = useState<number | null>(null);
  const [autoResetCounter, setAutoResetCounter] = useState<number | null>(null);
  const [isMatchEnded, setIsMatchEnded] = useState<boolean>(false);
  
  const autoResetTimerRef = useRef<number | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  const matchTimerRef = useRef<number | null>(null);

  const [scores, setScores] = useState<ScoreBoard>(() => {
    const saved = localStorage.getItem('ttt-scores-v8');
    return saved ? JSON.parse(saved) : { X: 0, O: 0, Draws: 0, Total: 0 };
  });

  useEffect(() => {
    localStorage.setItem('ttt-scores-v8', JSON.stringify(scores));
  }, [scores]);

  const startNewRound = useCallback(() => {
    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    
    setAutoResetCounter(null);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setAiTaunt("");
    
    const nextStart = startingPlayer === 'X' ? 'O' : 'X';
    setStartingPlayer(nextStart);
    setXIsNext(nextStart === 'X');
    
    setIsAiThinking(false);
    setRemainingTurnTime(turnTimeLimit);
  }, [startingPlayer, turnTimeLimit]);

  const manualFullReset = useCallback(() => {
    if (matchDuration) {
      setMatchTimeLeft(matchDuration * 60);
      setIsMatchEnded(false);
    }
    startNewRound();
    setScores({ X: 0, O: 0, Draws: 0, Total: 0 });
  }, [startNewRound, matchDuration]);

  const handleTimeout = useCallback(() => {
    const loser = xIsNext ? 'X' : 'O';
    const victor = loser === 'X' ? 'O' : 'X';
    setWinner(victor);
    setScores(s => ({ ...s, [victor]: s[victor] + 1, Total: s.Total + 1 }));
    setAiTaunt("Time ran out!");
  }, [xIsNext]);

  const executeMove = useCallback((index: number, player: Player) => {
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    if (isMatchEnded) return;
    
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
        setRemainingTurnTime(turnTimeLimit);
      }
      
      return nextBoard;
    });
  }, [winner, turnTimeLimit, isMatchEnded]);

  // Global Match Timer Logic
  useEffect(() => {
    if (gameMode && matchDuration && matchTimeLeft !== null && matchTimeLeft > 0 && !isMatchEnded) {
      matchTimerRef.current = window.setInterval(() => {
        setMatchTimeLeft(prev => {
          if (prev !== null && prev <= 1) {
            window.clearInterval(matchTimerRef.current!);
            setIsMatchEnded(true);
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
      return () => {
        if (matchTimerRef.current) window.clearInterval(matchTimerRef.current);
      };
    }
  }, [gameMode, matchDuration, isMatchEnded]);

  // Turn Timer Logic
  useEffect(() => {
    if (gameMode && !winner && turnTimeLimit !== null && remainingTurnTime !== null && !isMatchEnded) {
      turnTimerRef.current = window.setInterval(() => {
        setRemainingTurnTime(prev => {
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
  }, [xIsNext, winner, gameMode, turnTimeLimit, remainingTurnTime, handleTimeout, isMatchEnded]);

  const handleHumanClick = (i: number) => {
    if (board[i] || winner || isAiThinking || isMatchEnded) return;
    const currentPlayer = xIsNext ? 'X' : 'O';
    if (gameMode === 'PvAI' && currentPlayer !== userPiece) return;
    executeMove(i, currentPlayer);
  };

  // Auto-reset logic
  useEffect(() => {
    if (winner && !isMatchEnded) {
      if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
      const COUNTDOWN_START = 2;
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
  }, [winner, startNewRound, isMatchEnded]);

  // AI Turn Logic
  useEffect(() => {
    let active = true;
    const aiPiece = userPiece === 'X' ? 'O' : 'X';
    const currentTurnPiece = xIsNext ? 'X' : 'O';

    if (gameMode === 'PvAI' && currentTurnPiece === aiPiece && !winner && !isBoardFull(board) && !isMatchEnded) {
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
  }, [xIsNext, gameMode, winner, board, difficulty, executeMove, userPiece, isMatchEnded]);

  const quitToMenu = () => {
    if (autoResetTimerRef.current) window.clearInterval(autoResetTimerRef.current);
    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
    if (matchTimerRef.current) window.clearInterval(matchTimerRef.current);
    setGameMode(null);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setXIsNext(true);
    setIsAiThinking(false);
    setAutoResetCounter(null);
    setRemainingTurnTime(null);
    setMatchTimeLeft(null);
    setIsMatchEnded(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!gameMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-[320px] space-y-5 animate-fade-in overflow-y-auto max-h-screen hide-scrollbar py-4">
          <div className="space-y-4">
            <div className="mx-auto w-20 h-20">
              <GameLogo className="w-full h-full" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">X & O</h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Neural Edition</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Your Piece</p>
              <div className="bg-white p-1 rounded-xl flex gap-1 border border-slate-200 shadow-sm">
                {(['X', 'O'] as Player[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setUserPiece(p)}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all ${userPiece === p ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="font-black text-xs">{p}</span>
                    {p === 'X' ? <XIcon className="w-3 h-3" /> : <OIcon className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Difficulty</p>
              <div className="bg-white p-1 rounded-xl flex gap-1 border border-slate-200 shadow-sm">
                {['Easy', 'Hard', 'Impossible'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d as Difficulty)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${difficulty === d ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Turn</p>
                <div className="bg-white p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200 shadow-sm">
                  {[null, 3, 5].map((t) => (
                    <button
                      key={String(t)}
                      onClick={() => setTurnTimeLimit(t as TimeLimit)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase transition-all ${turnTimeLimit === t ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t === null ? '∞' : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-primary">Match Duration</p>
                <div className="bg-white p-1 rounded-xl flex flex-wrap gap-1 border border-slate-200 shadow-sm">
                  {[null, 1, 3, 5].map((m) => (
                    <button
                      key={String(m)}
                      onClick={() => setMatchDuration(m as MatchDuration)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase transition-all ${matchDuration === m ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {m === null ? 'Single' : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => { 
                setGameMode('PvAI'); 
                setRemainingTurnTime(turnTimeLimit); 
                if (matchDuration) setMatchTimeLeft(matchDuration * 60);
              }}
              className="w-full group p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg flex flex-col items-center gap-1"
            >
              <CpuChipIcon className="w-5 h-5 text-rose-400" />
              <div className="text-base font-bold">Vs. Machine</div>
            </button>

            <button
              onClick={() => { 
                setGameMode('PvP'); 
                setRemainingTurnTime(turnTimeLimit); 
                if (matchDuration) setMatchTimeLeft(matchDuration * 60);
              }}
              className="w-full group p-4 bg-white border border-slate-100 rounded-2xl hover:border-primary/30 transition-all active:scale-95 shadow-sm flex flex-col items-center gap-1"
            >
              <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
              <div className="text-base font-bold text-slate-700">Vs. Human</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const matchWinner = scores.X > scores.O ? 'X' : scores.O > scores.X ? 'O' : 'Draw';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 hide-scrollbar">
      <div className="w-full max-w-[280px] flex flex-col gap-4">
        
        {/* Match Timer */}
        {matchDuration && matchTimeLeft !== null && (
          <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl flex items-center justify-between shadow-lg">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Match Time</span>
            <span className={`font-mono font-black text-lg ${matchTimeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-primary'}`}>
              {formatTime(matchTimeLeft)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between bg-white px-3 py-3 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={quitToMenu} className="p-1.5 text-slate-300 hover:text-slate-600" title="Back to Menu">
            <HomeIcon className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`flex flex-col items-center px-2 py-0.5 rounded-lg transition-all ${xIsNext && !winner ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
              <span className={`text-[9px] font-black ${xIsNext && !winner ? 'text-primary' : 'text-slate-300'}`}>X</span>
              <span className="text-sm font-black text-slate-900">{scores.X}</span>
            </div>
            <div className="text-slate-100 font-black">|</div>
            <div className={`flex flex-col items-center px-2 py-0.5 rounded-lg transition-all ${!xIsNext && !winner ? 'bg-rose-500/5 ring-1 ring-rose-500/20' : ''}`}>
              <span className={`text-[9px] font-black ${!xIsNext && !winner ? 'text-rose-500' : 'text-slate-300'}`}>O</span>
              <span className="text-sm font-black text-slate-900">{scores.O}</span>
            </div>
          </div>

          <button onClick={manualFullReset} className="p-1.5 text-slate-300 hover:text-slate-600" title="Reset Match">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white p-4 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden">
          
          {turnTimeLimit !== null && !winner && !isMatchEnded && (
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
              <div 
                className={`h-full transition-all duration-1000 ease-linear ${remainingTurnTime && remainingTurnTime <= 1 ? 'bg-rose-500 animate-pulse' : 'bg-primary'}`}
                style={{ width: `${(remainingTurnTime! / turnTimeLimit) * 100}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {board.map((val, i) => (
              <button
                key={i}
                onClick={() => handleHumanClick(i)}
                disabled={!!val || !!winner || (gameMode === 'PvAI' && (xIsNext ? 'X' : 'O') !== userPiece) || isMatchEnded}
                className={`aspect-square w-full rounded-xl flex items-center justify-center transition-all border-2 
                  ${val ? 'bg-white border-slate-100' : 'bg-slate-50 border-transparent hover:bg-slate-100'} 
                  ${winningLine?.includes(i) ? 'bg-primary/5 border-primary ring-1 ring-primary/20 scale-105 z-10' : ''}`}
              >
                <div className="w-[50%] h-[50%] flex items-center justify-center">
                  {val === 'X' && <XIcon className="w-full h-full text-primary" />}
                  {val === 'O' && <OIcon className="w-full h-full text-rose-500" />}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 h-10 flex items-center justify-center text-center">
            {isMatchEnded ? (
              <div className="text-[9px] font-black text-primary uppercase tracking-widest">
                MATCH OVER
              </div>
            ) : winner ? (
              <div className="flex flex-col items-center">
                <div className={`px-4 py-1 rounded-xl font-black text-[9px] tracking-widest shadow text-white ${winner === 'X' ? 'bg-primary' : (winner === 'O' ? 'bg-rose-500' : 'bg-slate-900')}`}>
                  {winner === 'Draw' 
                    ? 'STALEMATE' 
                    : (gameMode === 'PvAI' 
                        ? (winner === userPiece ? 'YOU WIN' : 'YOU LOST')
                        : `${winner} WINS`
                      )
                  }
                </div>
                {!isMatchEnded && (
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Next round in {autoResetCounter}s
                  </div>
                )}
              </div>
            ) : isAiThinking ? (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></div>
                Analyzing...
              </div>
            ) : (remainingTurnTime !== null && remainingTurnTime <= 1 && turnTimeLimit !== null) ? (
              <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                Hurry!
              </div>
            ) : aiTaunt ? (
              <div className="text-[10px] text-slate-500 font-bold italic px-2 animate-fade-in line-clamp-2">
                "{aiTaunt}"
              </div>
            ) : (
              <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                {xIsNext 
                  ? (gameMode === 'PvAI' && userPiece === 'O' ? "Thinking..." : "X's Turn")
                  : (gameMode === 'PvAI' && userPiece === 'X' ? "Thinking..." : "O's Turn")
                }
              </div>
            )}
          </div>
        </div>

        {turnTimeLimit !== null && !winner && !isMatchEnded && (
          <div className="flex justify-center -mt-1">
            <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${remainingTurnTime! <= 1 ? 'text-rose-500' : 'text-slate-400'}`}>
              Turn: {remainingTurnTime}s
            </span>
          </div>
        )}

        <div className="flex justify-center gap-6 opacity-30 mt-2">
          <div className="text-center">
            <div className="text-[7px] font-black uppercase tracking-widest">Draws</div>
            <div className="font-bold text-[10px]">{scores.Draws}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] font-black uppercase tracking-widest">Total Rounds</div>
            <div className="font-bold text-[10px]">{scores.Total}</div>
          </div>
        </div>

      </div>

      {/* Match Result Overlay */}
      {isMatchEnded && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-[300px] rounded-[3rem] p-8 text-center shadow-2xl space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Match Summary</p>
              <h2 className="text-3xl font-black text-slate-900">
                {matchWinner === 'Draw' ? "TIE MATCH!" : `${matchWinner} VICTORIOUS!`}
              </h2>
            </div>
            
            <div className="flex items-center justify-center gap-8 py-4 bg-slate-50 rounded-3xl">
              <div className="flex flex-col items-center">
                <span className="text-xs font-black text-primary mb-1">X</span>
                <span className="text-3xl font-black text-slate-900">{scores.X}</span>
              </div>
              <div className="text-slate-300 text-xl font-bold">:</div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-black text-rose-500 mb-1">O</span>
                <span className="text-3xl font-black text-slate-900">{scores.O}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={manualFullReset}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="w-5 h-5 text-primary" />
                REMATCH
              </button>
              <button 
                onClick={quitToMenu}
                className="w-full bg-white border border-slate-100 text-slate-400 font-black py-4 rounded-2xl hover:text-slate-900 transition-all"
              >
                BACK TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;