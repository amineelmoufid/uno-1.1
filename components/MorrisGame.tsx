
import React, { useState, useEffect } from 'react';
import { MorrisGameState } from '../types';
import { updateMorrisState, subscribeToMorris, FIXED_ROOM_ID, incrementScore, subscribeToScores } from '../services/firebase';
import { getInitialMorrisState, performMorrisAction } from '../services/morrisLogic';
import { RefreshCw, Trophy, ChevronLeft, Loader2, Grip, Move } from 'lucide-react';

interface MorrisGameProps {
    myPlayerId: number;
    onExit: () => void;
}

const PLAYER_NAMES: Record<number, string> = { 0: 'Amine', 1: 'Hasnae' };

export default function MorrisGame({ myPlayerId, onExit }: MorrisGameProps) {
    const [gameState, setGameState] = useState<MorrisGameState | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [scores, setScores] = useState<{ Amine: number; Hasnae: number } | null>(null);

    useEffect(() => {
        const unsub = subscribeToScores((data) => {
            setScores(data?.['MORRIS'] || { Amine: 0, Hasnae: 0 });
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeToMorris(FIXED_ROOM_ID, (data) => {
            if (!data) {
                updateMorrisState(FIXED_ROOM_ID, getInitialMorrisState());
            } else {
                // Sanitize data to prevent crashes if board is undefined/malformed
                const rawBoard = data.board || [];
                const safeBoard = Array(9).fill(null).map((_, i) => rawBoard[i] ?? null);
                
                const safeState: MorrisGameState = {
                    ...data,
                    board: safeBoard,
                    piecesPlaced: data.piecesPlaced || { 0: 0, 1: 0 },
                    winner: data.winner ?? null,
                    turn: data.turn ?? 0,
                    phase: data.phase || 'PLACING',
                    log: data.log || ''
                };
                setGameState(safeState);
            }
            setIsResetting(false);
        });
        return () => unsub();
    }, []);

    const handlePointClick = (idx: number) => {
        if (!gameState || gameState.winner !== null) return;
        if (gameState.turn !== myPlayerId) return;

        try {
            if (gameState.phase === 'PLACING') {
                const newState = performMorrisAction(gameState, { type: 'PLACE', idx });
                updateMorrisState(FIXED_ROOM_ID, newState);
                
                if (newState.winner !== null) {
                    incrementScore('MORRIS', newState.winner === 0 ? 'Amine' : 'Hasnae');
                }
            } else {
                // Moving Phase
                const clickedOwner = gameState.board[idx];

                if (clickedOwner === myPlayerId) {
                    // Select own piece
                    if (selectedIdx === idx) setSelectedIdx(null);
                    else setSelectedIdx(idx);
                } else if (clickedOwner === null && selectedIdx !== null) {
                    // Move to empty
                    const newState = performMorrisAction(gameState, { 
                        type: 'MOVE', 
                        from: selectedIdx, 
                        to: idx 
                    });
                    updateMorrisState(FIXED_ROOM_ID, newState);
                    
                    if (newState.winner !== null) {
                         incrementScore('MORRIS', newState.winner === 0 ? 'Amine' : 'Hasnae');
                    }
                    
                    setSelectedIdx(null);
                }
            }
        } catch (e) {
            console.log("Invalid Move:", e);
            // Optional: Shake animation or toast
        }
    };

    const handleNewGame = async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        if (isResetting) return;
        setIsResetting(true);
        setSelectedIdx(null);
        await updateMorrisState(FIXED_ROOM_ID, getInitialMorrisState());
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500 bg-stone-950">Loading Morris...</div>;

    const myColor = myPlayerId === 0 ? 'bg-indigo-500 shadow-indigo-500/50' : 'bg-rose-600 shadow-rose-600/50';
    const opColor = myPlayerId === 0 ? 'bg-rose-600 shadow-rose-600/50' : 'bg-indigo-500 shadow-indigo-500/50';
    
    // UI Helpers
    const getPieceColor = (owner: number) => owner === 0 ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]';
    const isMyTurn = gameState.turn === myPlayerId;

    return (
        <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans selection:bg-transparent">
             {/* Header */}
             <div className="h-16 flex items-center justify-between px-6 border-b border-stone-900 bg-stone-950 z-20 shadow-sm relative">
                <button onClick={onExit} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm tracking-[0.3em] text-stone-400">3 MEN'S MORRIS</h1>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 mt-0.5">
                         <span className="text-indigo-400">A: {scores?.Amine || 0}</span>
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

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                
                {gameState.winner !== null && (
                     <div className="absolute inset-0 z-30 bg-stone-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                         <Trophy size={64} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                         <h2 className="text-3xl font-light tracking-widest mb-2 text-white">GAME OVER</h2>
                         <div className="text-5xl font-black mb-6 tracking-tighter text-stone-200">
                            {gameState.winner === 0 ? 'AMINE WINS' : 'HASNAE WINS'}
                         </div>
                         <div className="flex gap-8 mb-8 text-2xl font-bold">
                             <div className="text-indigo-400 flex flex-col items-center">
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${opColor} text-white`}>
                            {PLAYER_NAMES[myPlayerId === 0 ? 1 : 0][0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">{PLAYER_NAMES[myPlayerId === 0 ? 1 : 0]}</span>
                            <span className="text-[10px] font-mono text-stone-500 uppercase">
                                {!isMyTurn ? 'Thinking...' : 'Waiting'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* BOARD */}
                <div className="relative w-[80vw] h-[80vw] max-w-[320px] max-h-[320px]">
                    {/* Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-stone-700 stroke-2 z-0">
                        {/* Horizontal */}
                        <line x1="16.6%" y1="16.6%" x2="83.3%" y2="16.6%" />
                        <line x1="16.6%" y1="50%" x2="83.3%" y2="50%" />
                        <line x1="16.6%" y1="83.3%" x2="83.3%" y2="83.3%" />
                        {/* Vertical */}
                        <line x1="16.6%" y1="16.6%" x2="16.6%" y2="83.3%" />
                        <line x1="50%" y1="16.6%" x2="50%" y2="83.3%" />
                        <line x1="83.3%" y1="16.6%" x2="16.6%" y2="83.3%" />
                        {/* Diagonal */}
                        <line x1="16.6%" y1="16.6%" x2="83.3%" y2="83.3%" />
                        <line x1="83.3%" y1="16.6%" x2="16.6%" y2="83.3%" />
                    </svg>
                    
                    {/* Points Grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 z-10">
                        {gameState.board.map((owner, idx) => {
                            const isSelectable = isMyTurn && (
                                (gameState.phase === 'PLACING' && owner === null) ||
                                (gameState.phase === 'MOVING' && (owner === myPlayerId || (selectedIdx !== null && owner === null)))
                            );

                            return (
                                <div key={idx} className="flex items-center justify-center">
                                    <button
                                        onClick={() => handlePointClick(idx)}
                                        className={`
                                            w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300
                                            ${owner === null ? 'bg-stone-800 hover:bg-stone-700 scale-50 hover:scale-75' : `scale-100 ${getPieceColor(owner)}`}
                                            ${isSelectable ? 'cursor-pointer' : 'cursor-default'}
                                            ${selectedIdx === idx ? 'ring-4 ring-white scale-110 z-20' : ''}
                                            ${gameState.phase === 'MOVING' && selectedIdx !== null && owner === null ? 'bg-stone-700/50 animate-pulse scale-75' : ''}
                                        `}
                                    >
                                        {owner !== null && (
                                            <div className="w-full h-full rounded-full bg-gradient-to-br from-white/20 to-transparent"></div>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* My Info */}
                <div className={`w-full max-w-[320px] mt-8 flex justify-between items-start opacity-90 transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${myColor} text-white`}>
                            {PLAYER_NAMES[myPlayerId][0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">YOU</span>
                            <span className="text-[10px] font-mono text-violet-500 uppercase font-bold">
                                {isMyTurn ? (gameState.phase === 'PLACING' ? 'Place Piece' : 'Move Piece') : ''}
                            </span>
                        </div>
                    </div>
                    {/* Helper Icons */}
                    <div className="flex gap-2 text-stone-600">
                        {gameState.phase === 'PLACING' ? <Grip size={20} /> : <Move size={20} />}
                    </div>
                </div>

            </div>
        </div>
    );
}
