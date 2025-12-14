
import React, { useState, useEffect } from 'react';
import { PartshiGameState, PartshiPiece } from '../types';
import { updatePartshiState, subscribeToPartshi, FIXED_ROOM_ID, incrementScore, subscribeToScores } from '../services/firebase';
import { getInitialPartshiState, performPartshiAction } from '../services/partshiLogic';
import { RefreshCw, Trophy, ChevronLeft, Loader2, Dices } from 'lucide-react';

interface PartshiGameProps {
    myPlayerId: number; // 0 = Amine, 1 = Hasnae
    onExit: () => void;
}

const PLAYER_NAMES = { 0: 'Amine', 1: 'Hasnae' };

// --- SVG & Board Constants ---
const CELL_SIZE = 6.66; // 15x15 grid, 100% / 15 = 6.66%
const BOARD_SIZE = 15;

// Coordinate Mapping (Ludo 15x15)
// Amine (Blue) starts bottom left (pos 0). Track runs clockwise.
// 0 is at (6, 13) ? No, typically start is safe spot.
// Let's define the path coordinates explicitly for 0-51.
// 15x15 Grid. (0,0) is top-left.
// Arms are at:
// Top: x=6..8, y=0..5
// Bottom: x=6..8, y=9..14
// Left: x=0..5, y=6..8
// Right: x=9..14, y=6..8

// Path sequence (standard clockwise Ludo):
// Starts at (1, 8) -> (5, 8) -> (6, 9) -> (6, 14) -> (8, 14) -> (8, 9) -> ...
// Let's map indices to {x, y}
const PATH_COORDS: {x: number, y: number}[] = [
    // Amine Start (Blue/Bottom-Left) - Index 0
    {x: 6, y: 13}, {x: 6, y: 12}, {x: 6, y: 11}, {x: 6, y: 10}, {x: 6, y: 9}, 
    {x: 5, y: 8}, {x: 4, y: 8}, {x: 3, y: 8}, {x: 2, y: 8}, {x: 1, y: 8}, {x: 0, y: 8}, 
    {x: 0, y: 7}, // Turn
    {x: 0, y: 6}, {x: 1, y: 6}, {x: 2, y: 6}, {x: 3, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
    {x: 6, y: 5}, {x: 6, y: 4}, {x: 6, y: 3}, {x: 6, y: 2}, {x: 6, y: 1}, {x: 6, y: 0},
    {x: 7, y: 0}, // Turn
    {x: 8, y: 0}, {x: 8, y: 1}, {x: 8, y: 2}, {x: 8, y: 3}, {x: 8, y: 4}, {x: 8, y: 5},
    {x: 9, y: 6}, {x: 10, y: 6}, {x: 11, y: 6}, {x: 12, y: 6}, {x: 13, y: 6}, {x: 14, y: 6},
    {x: 14, y: 7}, // Turn
    {x: 14, y: 8}, {x: 13, y: 8}, {x: 12, y: 8}, {x: 11, y: 8}, {x: 10, y: 8}, {x: 9, y: 8},
    {x: 8, y: 9}, {x: 8, y: 10}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13}, {x: 8, y: 14},
    {x: 7, y: 14} // Last step before loop closes
];

// Home Paths
const P0_HOME_PATH = [ {x: 7, y: 13}, {x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8} ]; // Amine (Bottom) -> Up
const P1_HOME_PATH = [ {x: 7, y: 1}, {x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6} ]; // Hasnae (Top) -> Down
// Wait, P1 starts at 26 (Top-Right arm?). 
// Index 26 in PATH_COORDS is {x: 8, y: 1} which is Top Right arm start. Correct.

const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

const getCoord = (pos: number, playerIdx: number) => {
    // Base
    if (pos === -1) {
        // Base positions visual logic handled in render
        return { x: 0, y: 0 }; 
    }
    // Goal
    if (pos === 999) {
        return { x: 7, y: 7 };
    }
    // Home Path
    if (pos >= 100) {
        const idx = (pos >= 200 ? pos - 200 : pos - 100);
        const path = playerIdx === 0 ? P0_HOME_PATH : P1_HOME_PATH;
        return path[idx] || { x: 7, y: 7 };
    }
    // Track
    return PATH_COORDS[pos % 52] || { x: 0, y: 0 };
};

export default function PartshiGame({ myPlayerId, onExit }: PartshiGameProps) {
    const [gameState, setGameState] = useState<PartshiGameState | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [scores, setScores] = useState<{ Amine: number; Hasnae: number } | null>(null);

    useEffect(() => {
        const unsub = subscribeToScores((data) => {
            setScores(data?.['PARTSHI'] || { Amine: 0, Hasnae: 0 });
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeToPartshi(FIXED_ROOM_ID, (data) => {
            if (!data) {
                updatePartshiState(FIXED_ROOM_ID, getInitialPartshiState());
            } else {
                // Ensure arrays
                const safeState = { ...data };
                if (!safeState.players) safeState.players = { 0: [], 1: [] };
                if (!safeState.players[0]) safeState.players[0] = [];
                if (!safeState.players[1]) safeState.players[1] = [];
                setGameState(safeState);
            }
            setIsResetting(false);
        });
        return () => unsub();
    }, []);

    const handleAction = (action: { type: 'ROLL' } | { type: 'MOVE', pieceId: number }) => {
        if (!gameState) return;
        try {
            const newState = performPartshiAction(gameState, action);
            updatePartshiState(FIXED_ROOM_ID, newState);
            
            if (newState.winner !== null) {
                incrementScore('PARTSHI', newState.winner === 0 ? 'Amine' : 'Hasnae');
            }
        } catch (e) {
            console.log("Action failed:", e);
        }
    };

    const handleNewGame = async () => {
        if (isResetting) return;
        setIsResetting(true);
        await updatePartshiState(FIXED_ROOM_ID, getInitialPartshiState());
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500 bg-stone-950">Loading Partshi...</div>;

    const isMyTurn = gameState.turn === myPlayerId;
    const canRoll = isMyTurn && gameState.canRoll;
    const canMove = isMyTurn && !gameState.canRoll && gameState.dice !== null;

    // --- Render Board ---
    
    // Draw Grid
    const renderGrid = () => {
        const rects = [];
        // Draw track squares
        for(let i=0; i<52; i++) {
            const {x, y} = PATH_COORDS[i];
            const isSafe = SAFE_SPOTS.includes(i);
            const isStart0 = i === 0;
            const isStart1 = i === 26;
            
            let color = 'fill-stone-800 stroke-stone-900';
            if (isStart0) color = 'fill-indigo-900/50 stroke-indigo-500';
            if (isStart1) color = 'fill-rose-900/50 stroke-rose-500';
            if (isSafe && !isStart0 && !isStart1) color = 'fill-stone-700 stroke-stone-600';

            rects.push(
                <rect key={`track-${i}`} x={`${x*CELL_SIZE}%`} y={`${y*CELL_SIZE}%`} width={`${CELL_SIZE}%`} height={`${CELL_SIZE}%`} className={`stroke-[0.5] ${color}`} />
            );
            if (isSafe) {
                rects.push(
                    <text key={`safe-${i}`} x={`${(x+0.5)*CELL_SIZE}%`} y={`${(y+0.65)*CELL_SIZE}%`} fontSize="2.5%" textAnchor="middle" className="fill-stone-500/50 pointer-events-none">★</text>
                );
            }
        }

        // Home Paths
        P0_HOME_PATH.forEach((c, i) => {
             rects.push(<rect key={`hp0-${i}`} x={`${c.x*CELL_SIZE}%`} y={`${c.y*CELL_SIZE}%`} width={`${CELL_SIZE}%`} height={`${CELL_SIZE}%`} className="fill-indigo-500/20 stroke-indigo-500/50 stroke-[0.5]" />);
        });
        P1_HOME_PATH.forEach((c, i) => {
             rects.push(<rect key={`hp1-${i}`} x={`${c.x*CELL_SIZE}%`} y={`${c.y*CELL_SIZE}%`} width={`${CELL_SIZE}%`} height={`${CELL_SIZE}%`} className="fill-rose-500/20 stroke-rose-500/50 stroke-[0.5]" />);
        });

        // Center Goal
        rects.push(
            <polygon key="center" points={`${6*CELL_SIZE},${6*CELL_SIZE} ${9*CELL_SIZE},${6*CELL_SIZE} ${9*CELL_SIZE},${9*CELL_SIZE} ${6*CELL_SIZE},${9*CELL_SIZE}`} className="fill-stone-800 stroke-stone-700" />
        );
        // Triangles in center
        rects.push(<polygon key="c-tri-0" points={`${6*CELL_SIZE},${9*CELL_SIZE} ${9*CELL_SIZE},${9*CELL_SIZE} ${7.5*CELL_SIZE},${7.5*CELL_SIZE}`} className="fill-indigo-500/30" />); // Bottom (Amine)
        rects.push(<polygon key="c-tri-1" points={`${6*CELL_SIZE},${6*CELL_SIZE} ${9*CELL_SIZE},${6*CELL_SIZE} ${7.5*CELL_SIZE},${7.5*CELL_SIZE}`} className="fill-rose-500/30" />); // Top (Hasnae)

        return rects;
    };

    // Render Pieces
    const renderPieces = () => {
        const els = [];

        // Combine all pieces
        const p0 = gameState.players[0] || [];
        const p1 = gameState.players[1] || [];

        // Group pieces by position to handle stacking
        const posMap: Record<string, (PartshiPiece & { player: number })[]> = {};
        
        [...p0.map(p => ({...p, player: 0})), ...p1.map(p => ({...p, player: 1}))].forEach(p => {
             const key = `${p.player}-${p.position}`;
             if (!posMap[key]) posMap[key] = [];
             posMap[key].push(p);
        });

        // Base Offsets
        const getBaseXY = (player: number, id: number) => {
            // Amine Base: Bottom Left (0-5, 9-14)
            // Hasnae Base: Top Right (9-14, 0-5)
            // Let's put visual bases in corners 
            // Amine: x:1-4, y:10-13
            // Hasnae: x:10-13, y:1-4
            
            const baseX = player === 0 ? 1.5 : 10.5;
            const baseY = player === 0 ? 10.5 : 1.5;
            
            const offsetX = (id % 2) * 2;
            const offsetY = Math.floor(id / 2) * 2;
            
            return { x: baseX + offsetX, y: baseY + offsetY };
        };

        const allPieces = [...p0.map(p => ({...p, player: 0})), ...p1.map(p => ({...p, player: 1}))];

        for(const piece of allPieces) {
             let x, y;
             if (piece.position === -1) {
                 const c = getBaseXY(piece.player, piece.id);
                 x = c.x; y = c.y;
             } else {
                 const c = getCoord(piece.position, piece.player);
                 x = c.x; y = c.y;
             }

             // Handle Stacking (Simple offset)
             const stack = allPieces.filter(op => op.position === piece.position && op.player === piece.player && op.position !== -1);
             const stackIdx = stack.findIndex(op => op.id === piece.id);
             if (stack.length > 1 && piece.position !== -1) {
                 x += (stackIdx * 0.2) - (stack.length * 0.1);
                 y -= (stackIdx * 0.2); 
             }

             const isSelectable = canMove && piece.player === myPlayerId;
             const colorClass = piece.player === 0 
                ? 'fill-indigo-500 stroke-indigo-300' 
                : 'fill-rose-500 stroke-rose-300';
             
             els.push(
                 <circle
                    key={`p-${piece.player}-${piece.id}`}
                    cx={`${(x + 0.5) * CELL_SIZE}%`}
                    cy={`${(y + 0.5) * CELL_SIZE}%`}
                    r={`${CELL_SIZE * 0.35}%`}
                    className={`
                        transition-all duration-300 stroke-2 drop-shadow-md
                        ${colorClass}
                        ${isSelectable ? 'cursor-pointer hover:stroke-white animate-pulse' : ''}
                    `}
                    onClick={() => isSelectable && handleAction({ type: 'MOVE', pieceId: piece.id })}
                 />
             );
        }
        return els;
    };

    return (
        <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans selection:bg-transparent">
             {/* Header */}
             <div className="h-16 flex items-center justify-between px-6 border-b border-stone-900 bg-stone-950 z-20 shadow-sm relative">
                <button onClick={onExit} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm tracking-[0.3em] text-stone-400">PARTSHI</h1>
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
            <div className="flex-1 flex flex-col items-center justify-center relative p-4">
                
                {/* Winner Overlay */}
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
                <div className={`w-full max-w-[400px] mb-4 flex justify-between items-center opacity-90 transition-opacity ${!isMyTurn ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${myPlayerId === 0 ? 'bg-rose-600' : 'bg-indigo-500'} text-white`}>
                            {PLAYER_NAMES[myPlayerId === 0 ? 1 : 0][0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">{PLAYER_NAMES[myPlayerId === 0 ? 1 : 0]}</span>
                            <span className="text-[10px] font-mono text-stone-500 uppercase">
                                {!isMyTurn ? 'Rolling...' : 'Waiting'}
                            </span>
                        </div>
                    </div>
                    {/* Opponent Last Roll Display */}
                    {gameState.turn !== myPlayerId && gameState.dice && (
                        <div className="flex items-center gap-2 bg-stone-800 px-3 py-1 rounded-lg">
                            <Dices size={16} className="text-stone-400"/>
                            <span className="text-xl font-bold text-white">{gameState.dice}</span>
                        </div>
                    )}
                </div>

                {/* BOARD */}
                <div className="relative w-full aspect-square max-w-[400px] bg-stone-900 rounded-xl shadow-2xl overflow-hidden border border-stone-800">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        {/* Base Areas */}
                        <rect x="0" y="60" width="40" height="40" className="fill-indigo-900/20" /> {/* Amine Base Area */}
                        <rect x="60" y="0" width="40" height="40" className="fill-rose-900/20" /> {/* Hasnae Base Area */}
                        
                        {renderGrid()}
                        {renderPieces()}
                    </svg>
                </div>

                {/* Controls & My Info */}
                <div className={`w-full max-w-[400px] mt-6 flex justify-between items-center opacity-90 transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${myPlayerId === 0 ? 'bg-indigo-500' : 'bg-rose-600'} text-white`}>
                            {PLAYER_NAMES[myPlayerId][0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">YOU</span>
                            <span className="text-[10px] font-mono text-stone-500 uppercase font-bold text-nowrap">
                                {isMyTurn ? (gameState.canRoll ? 'Your Turn' : 'Move Piece') : ''}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Dice */}
                        <div className="flex flex-col items-center">
                            {gameState.dice !== null && (
                                <div className="text-3xl font-black text-stone-200 mb-1 drop-shadow-lg">
                                    {gameState.dice}
                                </div>
                            )}
                            <button
                                onClick={() => handleAction({ type: 'ROLL' })}
                                disabled={!canRoll}
                                className={`
                                    flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-widest transition-all shadow-lg
                                    ${canRoll 
                                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-stone-900 hover:scale-105 active:scale-95 hover:brightness-110' 
                                        : 'bg-stone-800 text-stone-600 cursor-not-allowed'}
                                `}
                            >
                                <Dices size={20} /> ROLL
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
