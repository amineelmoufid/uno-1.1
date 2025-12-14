
import React, { useState, useEffect } from 'react';
import { TTTMoveGameState } from '../types';
import { updateTTTMoveState, subscribeToTTTMove, FIXED_ROOM_ID, incrementScore, subscribeToScores } from '../services/firebase';
import { getInitialTTTMoveState, performTTTAction } from '../services/tttMoveLogic';
import { RefreshCw, Trophy, ChevronLeft, Loader2, X, Circle, Move } from 'lucide-react';

interface TTTMoveGameProps {
    myPlayerId: number; // 0 = Amine (X), 1 = Hasnae (O)
    onExit: () => void;
}

const PLAYER_NAMES = { 0: 'Amine', 1: 'Hasnae' };

export default function TTTMoveGame({ myPlayerId, onExit }: TTTMoveGameProps) {
    const [gameState, setGameState] = useState<TTTMoveGameState | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [scores, setScores] = useState<{ Amine: number; Hasnae: number } | null>(null);

    // Amine is X, Hasnae is O
    const myMark = myPlayerId === 0 ? 'X' : 'O';

    useEffect(() => {
        const unsub = subscribeToScores((data) => {
            setScores(data?.['TTT_MOVE'] || { Amine: 0, Hasnae: 0 });
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeToTTTMove(FIXED_ROOM_ID, (data) => {
            if (!data) {
                updateTTTMoveState(FIXED_ROOM_ID, getInitialTTTMoveState());
            } else {
                // Sanitize: Firebase might return an object for sparse arrays
                const rawBoard = data.board || {}; 
                const safeBoard = Array.from({ length: 9 }).map((_, i) => rawBoard[i] ?? null);
                
                setGameState({
                    ...data,
                    board: safeBoard,
                });
            }
            setIsResetting(false);
        });
        return () => unsub();
    }, []);

    const handleSquareClick = (idx: number) => {
        if (!gameState || gameState.winner) return;
        if (gameState.turn !== myMark) return;

        try {
            if (gameState.phase === 'DROP') {
                const newState = performTTTAction(gameState, { type: 'DROP', idx });
                updateTTTMoveState(FIXED_ROOM_ID, newState);
                
                if (newState.winner) {
                    incrementScore('TTT_MOVE', newState.winner === 'X' ? 'Amine' : 'Hasnae');
                }
            } else {
                // MOVE Phase
                const clickedVal = gameState.board[idx];
                
                if (clickedVal === myMark) {
                    // Select own
                    setSelectedIdx(idx === selectedIdx ? null : idx);
                } else if (!clickedVal && selectedIdx !== null) {
                    // Move selected to empty
                    const newState = performTTTAction(gameState, { 
                        type: 'MOVE', 
                        from: selectedIdx, 
                        to: idx 
                    });
                    updateTTTMoveState(FIXED_ROOM_ID, newState);
                    
                    if (newState.winner) {
                        incrementScore('TTT_MOVE', newState.winner === 'X' ? 'Amine' : 'Hasnae');
                    }
                    
                    setSelectedIdx(null);
                }
            }
        } catch (e) {
            console.log("Invalid move", e);
        }
    };

    const handleNewGame = async () => {
        if (isResetting) return;
        setIsResetting(true);
        setSelectedIdx(null);
        await updateTTTMoveState(FIXED_ROOM_ID, getInitialTTTMoveState());
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500 bg-stone-950">Loading Tic-Tac-Toe...</div>;

    const isMyTurn = gameState.turn === myMark;
    
    return (
        <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans selection:bg-transparent">
             {/* Header */}
             <div className="h-16 flex items-center justify-between px-6 border-b border-stone-900 bg-stone-950 z-20 shadow-sm relative">
                <button onClick={onExit} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm tracking-[0.3em] text-stone-400">TIC-TAC-MOVE</h1>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 mt-0.5">
                         <span className="text-cyan-400">A: {scores?.Amine || 0}</span>
                         <span className="text-stone-600">|</span>
                         <span className="text-rose-400">H: {scores?.Hasnae || 0}</span>
                     </div>
                </div>
                <button 
                    onClick={handleNewGame} 
                    disabled={isResetting}
                    className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-2 border border-stone-800 bg-stone-900 px-3 py-1.5 rounded hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
                    <span className="hidden sm:inline">{isResetting ? 'RESETTING' : 'NEW GAME'}</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                
                {gameState.winner && (
                     <div className="absolute inset-0 z-30 bg-stone-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                         <Trophy size={64} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                         <h2 className="text-3xl font-light tracking-widest mb-2 text-white">GAME OVER</h2>
                         <div className="text-5xl font-black mb-6 tracking-tighter text-stone-200">
                            {gameState.winner === 'X' ? 'AMINE WINS' : 'HASNAE WINS'}
                         </div>
                         <div className="flex gap-8 mb-8 text-2xl font-bold">
                             <div className="text-cyan-400 flex flex-col items-center">
                                 <span>AMINE</span>
                                 <span className="text-4xl">{scores?.Amine || 0}</span>
                             </div>
                             <div className="text-rose-400 flex flex-col items-center">
                                 <span>HASNAE</span>
                                 <span className="text-4xl">{scores?.Hasnae || 0}</span>
                             </div>
                        </div>
                         <button onClick={handleNewGame} className="bg-stone-100 hover:bg-white text-stone-950 px-10 py-4 rounded-full font-bold tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                             {isResetting ? 'LOADING...' : 'PLAY AGAIN'}
                         </button>
                     </div>
                )}

                {/* Opponent Info */}
                <div className={`w-full max-w-[320px] mb-8 flex justify-between items-end opacity-90 transition-opacity ${!isMyTurn ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg border-2 ${myMark === 'X' ? 'border-rose-500 text-rose-500 bg-rose-950/30' : 'border-cyan-500 text-cyan-500 bg-cyan-950/30'}`}>
                            {myMark === 'X' ? <Circle size={20} strokeWidth={3} /> : <X size={24} strokeWidth={3} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">{PLAYER_NAMES[myPlayerId === 0 ? 1 : 0]}</span>
                            <span className="text-[10px] font-mono text-stone-500 uppercase">
                                {!isMyTurn ? 'Thinking...' : 'Waiting'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 w-[80vw] h-[80vw] max-w-[320px] max-h-[320px] gap-2 p-2 bg-stone-900 rounded-2xl relative">
                    {gameState.board.map((cell, i) => {
                        const isSelected = selectedIdx === i;
                        const isSelectable = isMyTurn && (
                            (gameState.phase === 'DROP' && !cell) ||
                            (gameState.phase === 'MOVE' && (cell === myMark || (!cell && selectedIdx !== null)))
                        );
                        
                        // Highlight any empty square if a piece is selected during MOVE phase
                        let isHighlight = false;
                        if (gameState.phase === 'MOVE' && selectedIdx !== null && !cell && isMyTurn) {
                           isHighlight = true;
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => handleSquareClick(i)}
                                disabled={!isSelectable && !isHighlight}
                                className={`
                                    rounded-xl flex items-center justify-center text-4xl font-black transition-all duration-200
                                    ${cell === 'X' ? 'text-cyan-400 bg-stone-800' : cell === 'O' ? 'text-rose-500 bg-stone-800' : 'bg-stone-800/50 hover:bg-stone-800'}
                                    ${isSelected ? 'ring-4 ring-amber-400 z-10 scale-105' : ''}
                                    ${isHighlight ? 'bg-stone-700/50 ring-2 ring-stone-600 scale-95 animate-pulse cursor-pointer' : ''}
                                    ${!cell && isMyTurn && gameState.phase === 'DROP' ? 'hover:bg-stone-800 cursor-pointer' : ''}
                                    ${!isSelectable && !isHighlight ? 'cursor-default' : ''}
                                `}
                            >
                                {cell === 'X' && <X size={48} strokeWidth={4} className="drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />}
                                {cell === 'O' && <Circle size={40} strokeWidth={4} className="drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]" />}
                            </button>
                        );
                    })}
                </div>

                {/* My Info */}
                <div className={`w-full max-w-[320px] mt-8 flex justify-between items-start opacity-90 transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg border-2 ${myMark === 'X' ? 'border-cyan-500 text-cyan-500 bg-cyan-950/30' : 'border-rose-500 text-rose-500 bg-rose-950/30'}`}>
                            {myMark === 'X' ? <X size={24} strokeWidth={3} /> : <Circle size={20} strokeWidth={3} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">YOU</span>
                            <span className="text-[10px] font-mono text-cyan-500 uppercase font-bold">
                                {isMyTurn ? (gameState.phase === 'DROP' ? 'Drop Piece' : 'Move Piece') : ''}
                            </span>
                        </div>
                    </div>
                     {/* Helper Icons */}
                     <div className="flex gap-2 text-stone-600">
                        {gameState.phase === 'DROP' ? <Move size={20} className="opacity-50"/> : <Move size={20} className="text-cyan-500"/>}
                    </div>
                </div>

            </div>
        </div>
    );
}
