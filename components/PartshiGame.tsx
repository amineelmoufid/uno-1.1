
import React, { useState, useEffect, useMemo } from 'react';
import { PartshiGameState, PartshiPiece } from '../types';
import { updatePartshiState, subscribeToPartshi, FIXED_ROOM_ID, incrementScore, subscribeToScores } from '../services/firebase';
import { getInitialPartshiState, performPartshiAction } from '../services/partshiLogic';
import { RefreshCw, Trophy, ChevronLeft, Loader2, Dices, Star, Shield, Play } from 'lucide-react';

interface PartshiGameProps {
    myPlayerId: number; // 0 = Amine, 1 = Hasnae
    onExit: () => void;
}

const PLAYER_NAMES: Record<number, string> = { 0: 'Amine', 1: 'Hasnae' };

// --- Professional Board Constants ---
const BOARD_SIZE = 100; // viewBox 0 0 100 100
const C_S = 6.66; // Cell Size (100 / 15)

// Track Path (52 tiles)
const TRACK_PATH: {x: number, y: number}[] = [
    {x:6,y:13},{x:6,y:12},{x:6,y:11},{x:6,y:10},{x:6,y:9}, // 0-4
    {x:5,y:8},{x:4,y:8},{x:3,y:8},{x:2,y:8},{x:1,y:8},{x:0,y:8}, // 5-10
    {x:0,y:7}, // 11
    {x:0,y:6},{x:1,y:6},{x:2,y:6},{x:3,y:6},{x:4,y:6},{x:5,y:6}, // 12-17
    {x:6,y:5},{x:6,y:4},{x:6,y:3},{x:6,y:2},{x:6,y:1},{x:6,y:0}, // 18-23
    {x:7,y:0}, // 24
    {x:8,y:0},{x:8,y:1},{x:8,y:2},{x:8,y:3},{x:8,y:4},{x:8,y:5}, // 25-30
    {x:9,y:6},{x:10,y:6},{x:11,y:6},{x:12,y:6},{x:13,y:6},{x:14,y:6}, // 31-36
    {x:14,y:7}, // 37
    {x:14,y:8},{x:13,y:8},{x:12,y:8},{x:11,y:8},{x:10,y:8},{x:9,y:8}, // 38-43
    {x:8,y:9},{x:8,y:10},{x:8,y:11},{x:8,y:12},{x:8,y:13},{x:8,y:14}, // 44-49
    {x:7,y:14}, // 50
    {x:6,y:14}  // 51
];

const P0_HOME = [{x:7,y:13}, {x:7,y:12}, {x:7,y:11}, {x:7,y:10}, {x:7,y:9}, {x:7,y:8}]; // Blue Up
const P1_HOME = [{x:7,y:1}, {x:7,y:2}, {x:7,y:3}, {x:7,y:4}, {x:7,y:5}, {x:7,y:6}]; // Red Down

// Safe Spots: Start squares (0, 26) + Stars (8, 13, 21, 34, 39, 47)
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

// --- 3D Dice Component ---
const Dice3D = ({ value, rolling, onClick, disabled }: { value: number | null, rolling: boolean, onClick?: () => void, disabled?: boolean }) => {
    // Dice dots mapping
    const dots: Record<number, number[]> = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`w-24 h-24 perspective-500 mx-auto transition-transform active:scale-95 ${disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:scale-105'}`}
        >
             <div className={`
                relative w-full h-full bg-gradient-to-br from-stone-100 to-stone-300 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.6)] border-b-8 border-r-2 border-stone-400
                flex flex-wrap p-3 content-between transition-all duration-700 ease-out
                ${rolling ? 'rotate-[720deg] scale-90 blur-sm' : 'rotate-0 scale-100'}
                ${!disabled && !rolling ? 'animate-[pulse_3s_infinite]' : ''}
             `}>
                 {Array(9).fill(0).map((_, i) => (
                     <div key={i} className="w-1/3 h-1/3 flex items-center justify-center p-0.5">
                         {dots[rolling ? 6 : (value || 1)]?.includes(i) && (
                             <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-900 rounded-full shadow-inner" />
                         )}
                     </div>
                 ))}
             </div>
        </button>
    );
};

export default function PartshiGame({ myPlayerId, onExit }: PartshiGameProps) {
    const [gameState, setGameState] = useState<PartshiGameState | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [scores, setScores] = useState<{ Amine: number; Hasnae: number } | null>(null);
    
    // Dice Animation State
    const [displayDice, setDisplayDice] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);

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
                const safeState = { ...data };
                if (!safeState.players) safeState.players = { 0: [], 1: [] };
                if (safeState.winner === undefined) safeState.winner = null;
                setGameState(safeState);
            }
            setIsResetting(false);
        });
        return () => unsub();
    }, []);

    // Handle Dice Animation Logic
    useEffect(() => {
        if (gameState?.dice) {
            if (gameState.dice !== displayDice) {
                // New dice value detected
                setIsRolling(true);
                const timer = setTimeout(() => {
                    setDisplayDice(gameState.dice);
                    setIsRolling(false);
                }, 600); // Animation duration
                return () => clearTimeout(timer);
            }
        } else {
            // Reset logic
            if (displayDice !== null) setDisplayDice(null);
        }
    }, [gameState?.dice]);

    const handleAction = (action: { type: 'ROLL' } | { type: 'MOVE', pieceId: number }) => {
        if (!gameState) return;
        
        if (action.type === 'ROLL') {
            setIsRolling(true); // Immediate feedback
        }

        try {
            const newState = performPartshiAction(gameState, action);
            updatePartshiState(FIXED_ROOM_ID, newState);
            if (newState.winner !== null) {
                incrementScore('PARTSHI', newState.winner === 0 ? 'Amine' : 'Hasnae');
            }
        } catch (e) {
            console.log("Action blocked:", e);
            if (action.type === 'ROLL') setIsRolling(false); // Revert if failed
        }
    };

    const handleNewGame = async () => {
        if (isResetting) return;
        setIsResetting(true);
        setDisplayDice(null);
        await updatePartshiState(FIXED_ROOM_ID, getInitialPartshiState());
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500 bg-stone-950">Loading Partshi...</div>;

    const isMyTurn = gameState.turn === myPlayerId;
    const canRoll = isMyTurn && gameState.canRoll;

    // Helpers
    const getPieceCoord = (p: PartshiPiece, playerIdx: number) => {
        if (p.position === -1) {
            // Base Positions
            const baseX = playerIdx === 0 ? 1.5 : 10.5;
            const baseY = playerIdx === 0 ? 10.5 : 1.5;
            const offsetX = (p.id % 2) * 2;
            const offsetY = Math.floor(p.id / 2) * 2;
            return { x: baseX + offsetX, y: baseY + offsetY };
        }
        if (p.position === 999) {
            // Center Triangle Goal
            return { x: 7.5, y: 7.5 }; 
        }
        if (p.position >= 100) {
            // Home Path
            const idx = p.position >= 200 ? p.position - 200 : p.position - 100;
            const path = playerIdx === 0 ? P0_HOME : P1_HOME;
            return path[Math.min(idx, 5)] || {x:7, y:7};
        }
        // Main Track
        return TRACK_PATH[p.position % 52] || {x:0,y:0};
    };

    // Calculate Stack Offsets
    const getStackOffsets = () => {
        type RenderPiece = PartshiPiece & { pl: number };
        const counts: Record<string, RenderPiece[]> = {};
        const offsets: Record<string, {x:number, y:number}> = {};

        if (!gameState) return {};

        const all: RenderPiece[] = [...(gameState.players[0]||[]).map(p=>({...p, pl:0})), ...(gameState.players[1]||[]).map(p=>({...p, pl:1}))];
        
        all.forEach(p => {
             const key = p.position === -1 ? `base-${p.pl}-${p.id}` : 
                         p.position === 999 ? `goal` : 
                         `pos-${p.position}`;
             
             if (!counts[key]) counts[key] = [];
             counts[key].push(p);
        });

        all.forEach(p => {
            const key = p.position === -1 ? `base-${p.pl}-${p.id}` : p.position === 999 ? `goal` : `pos-${p.position}`;
            const stack = counts[key];
            const idx = stack.findIndex(x => x.id === p.id && x.pl === p.pl);
            const count = stack.length;
            
            if (p.position === -1) {
                offsets[`${p.pl}-${p.id}`] = {x:0, y:0};
            } else if (p.position === 999) {
                 const angle = (idx / count) * Math.PI * 2;
                 offsets[`${p.pl}-${p.id}`] = { x: Math.cos(angle) * 0.5, y: Math.sin(angle) * 0.5 };
            } else if (count > 1) {
                offsets[`${p.pl}-${p.id}`] = { x: (idx * 0.3) - (count * 0.15), y: -(idx * 0.3) };
            } else {
                offsets[`${p.pl}-${p.id}`] = {x:0, y:0};
            }
        });
        return offsets;
    };

    const offsets = getStackOffsets();

    const isMoveValid = (piece: PartshiPiece) => {
        if (!isMyTurn || gameState.canRoll || !gameState.dice) return false;
        try {
            if (piece.position === -1 && gameState.dice !== 6) return false;
            return true;
        } catch { return false; }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans selection:bg-transparent">
             {/* Header */}
             <div className="h-16 flex items-center justify-between px-6 border-b border-stone-900 bg-stone-950 z-20 shadow-sm relative">
                <button onClick={onExit} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm tracking-[0.3em] text-stone-400">PARTSHI PRO</h1>
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
                    <span className="hidden sm:inline">{isResetting ? 'RESETTING' : 'RESET'}</span>
                </button>
            </div>

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative p-4">
                
                {/* Winner Overlay */}
                {typeof gameState.winner === 'number' && (
                     <div className="absolute inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                         <div className="relative">
                             <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20 animate-pulse"></div>
                             <Trophy size={80} className="text-amber-400 mb-6 drop-shadow-[0_0_25px_rgba(251,191,36,0.6)] relative z-10" />
                         </div>
                         <h2 className="text-4xl font-light tracking-[0.2em] mb-4 text-white uppercase">Victory</h2>
                         <div className={`text-6xl font-black mb-8 tracking-tighter ${gameState.winner === 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                            {gameState.winner === 0 ? 'AMINE' : 'HASNAE'}
                         </div>
                         <button onClick={handleNewGame} className="bg-white text-stone-950 px-12 py-4 rounded-full font-bold tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95 hover:bg-stone-100">
                             PLAY AGAIN
                         </button>
                     </div>
                )}

                {/* Opponent HUD */}
                <div className={`w-full max-w-[420px] mb-2 flex justify-between items-center transition-opacity duration-300 ${!isMyTurn ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg border-2 ${myPlayerId === 0 ? 'bg-rose-900/20 border-rose-500/50 text-rose-500' : 'bg-indigo-900/20 border-indigo-500/50 text-indigo-500'}`}>
                            {PLAYER_NAMES[myPlayerId === 0 ? 1 : 0][0]}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-stone-400 tracking-wider">OPPONENT</div>
                            <div className="text-sm font-bold text-stone-200">{PLAYER_NAMES[myPlayerId === 0 ? 1 : 0]}</div>
                        </div>
                    </div>
                </div>

                {/* --- BOARD SVG --- */}
                <div className="relative w-full aspect-square max-w-[420px] bg-[#1a1918] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden border-8 border-stone-800 select-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <defs>
                            <pattern id="grid" width="6.66" height="6.66" patternUnits="userSpaceOnUse">
                                <path d="M 6.66 0 L 0 0 0 6.66" fill="none" stroke="#222" strokeWidth="0.1"/>
                            </pattern>
                            <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#2a2928" />
                                <stop offset="50%" stopColor="#1c1b1a" />
                                <stop offset="100%" stopColor="#2a2928" />
                            </linearGradient>
                            <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                             <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </defs>

                        {/* Background */}
                        <rect width="100%" height="100%" fill="url(#metal)" />
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Bases (Prisons) */}
                        <rect x="0" y="60" width="40" height="40" className="fill-indigo-950/30 stroke-indigo-900/20 stroke-1" rx="4" />
                        <rect x="60" y="0" width="40" height="40" className="fill-rose-950/30 stroke-rose-900/20 stroke-1" rx="4" />
                        
                        {/* Base Labels */}
                        <text x="20" y="80" textAnchor="middle" className="fill-indigo-500/20 font-black text-[5px] tracking-[0.3em]">AMINE</text>
                        <text x="80" y="20" textAnchor="middle" className="fill-rose-500/20 font-black text-[5px] tracking-[0.3em]">HASNAE</text>

                        {/* Track Path */}
                        {TRACK_PATH.map((c, i) => {
                            const isSafe = SAFE_SPOTS.includes(i);
                            const isStartP0 = i === 0;
                            const isStartP1 = i === 26;
                            
                            let fill = '#232221';
                            let stroke = '#333';

                            if (isStartP0) { fill = 'rgba(99, 102, 241, 0.15)'; stroke = '#4f46e5'; }
                            else if (isStartP1) { fill = 'rgba(244, 63, 94, 0.15)'; stroke = '#e11d48'; }
                            else if (isSafe) { fill = '#2d2b29'; stroke = '#444'; }

                            return (
                                <g key={`sq-${i}`}>
                                    <rect 
                                        x={c.x * C_S} y={c.y * C_S} 
                                        width={C_S} height={C_S} 
                                        fill={fill} stroke={stroke} strokeWidth="0.3"
                                    />
                                    {isSafe && !isStartP0 && !isStartP1 && (
                                        <g transform={`translate(${(c.x * C_S) + 3.33}, ${(c.y * C_S) + 3.33})`}>
                                            <Star size={3.5} className="text-stone-600/30" fill="currentColor" stroke="none" transform="translate(-1.75, -1.75)" />
                                        </g>
                                    )}
                                    {isStartP0 && <text x={(c.x+0.5)*C_S} y={(c.y+0.65)*C_S} fontSize="2.5" fill="#6366f1" textAnchor="middle" fontWeight="bold">START</text>}
                                    {isStartP1 && <text x={(c.x+0.5)*C_S} y={(c.y+0.65)*C_S} fontSize="2.5" fill="#f43f5e" textAnchor="middle" fontWeight="bold">START</text>}
                                </g>
                            );
                        })}

                        {/* Home Paths (Chevron Arrows) */}
                        {P0_HOME.map((c, i) => (
                             <path 
                                key={`hp0-${i}`}
                                d={`M ${c.x*C_S} ${(c.y+1)*C_S} L ${(c.x+0.5)*C_S} ${c.y*C_S} L ${(c.x+1)*C_S} ${(c.y+1)*C_S} L ${(c.x+1)*C_S} ${(c.y+0.2)*C_S + C_S} L ${(c.x+0.5)*C_S} ${(c.y+0.2)*C_S} L ${c.x*C_S} ${(c.y+0.2)*C_S + C_S} Z`}
                                className="fill-indigo-500/20 stroke-indigo-500/30 stroke-[0.2]"
                             />
                        ))}
                        {P1_HOME.map((c, i) => (
                             <path 
                                key={`hp1-${i}`}
                                d={`M ${c.x*C_S} ${c.y*C_S} L ${(c.x+0.5)*C_S} ${(c.y+1)*C_S} L ${(c.x+1)*C_S} ${c.y*C_S} L ${(c.x+1)*C_S} ${(c.y-0.2)*C_S} L ${(c.x+0.5)*C_S} ${(c.y+0.8)*C_S} L ${c.x*C_S} ${(c.y-0.2)*C_S} Z`}
                                className="fill-rose-500/20 stroke-rose-500/30 stroke-[0.2]"
                             />
                        ))}

                        {/* Center Goal */}
                        <polygon points="40,40 60,40 60,60 40,60" className="fill-stone-900 stroke-stone-700" />
                        <polygon points="40,60 60,60 50,50" className="fill-indigo-500/40" />
                        <polygon points="60,40 40,40 50,50" className="fill-rose-500/40" />
                        <circle cx="50" cy="50" r="1.5" className="fill-stone-800 stroke-stone-600" />

                        {/* Pieces */}
                        {Object.entries(offsets).map(([key, offset]) => {
                            const [plStr, idStr] = key.split('-');
                            const player = parseInt(plStr);
                            const id = parseInt(idStr);
                            const p = gameState.players[player as 0|1].find(px => px.id === id);
                            if (!p) return null;

                            const coord = getPieceCoord(p, player);
                            const isValid = isMoveValid(p);
                            
                            // Visuals
                            const color = player === 0 ? '#6366f1' : '#f43f5e'; 
                            const strokeColor = player === 0 ? '#818cf8' : '#fb7185';
                            const glowId = player === 0 ? 'url(#glow-blue)' : 'url(#glow-red)';

                            // Animation coords
                            const cx = (coord.x + 0.5) * C_S + (offset.x * C_S);
                            const cy = (coord.y + 0.5) * C_S + (offset.y * C_S);

                            return (
                                <g 
                                    key={key} 
                                    className={`transition-all duration-500 ease-out`} 
                                    style={{ transformOrigin: `${cx}% ${cy}%`, transitionProperty: 'cx, cy' }}
                                    onClick={() => isValid && handleAction({ type: 'MOVE', pieceId: p.id })}
                                >
                                    {/* Ripple Effect for Valid Moves */}
                                    {isValid && (
                                        <circle cx={cx} cy={cy} r={C_S * 0.7} fill="none" stroke={color} strokeWidth="0.4" className="animate-ping opacity-60" />
                                    )}
                                    
                                    {/* The Piece */}
                                    <circle 
                                        cx={cx} cy={cy} 
                                        r={C_S * 0.35} 
                                        fill={color} 
                                        stroke={strokeColor} 
                                        strokeWidth="0.5"
                                        filter={isValid ? glowId : 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'}
                                        className={`
                                            transition-all duration-300
                                            ${isValid ? 'cursor-pointer' : ''}
                                        `}
                                    />
                                    {/* Inner Detail */}
                                    <circle cx={cx} cy={cy} r={C_S * 0.15} fill="rgba(255,255,255,0.2)" />
                                </g>
                            );
                        })}

                    </svg>
                </div>

                {/* Controls Area */}
                <div className={`w-full max-w-[420px] mt-6 flex justify-between items-center transition-all duration-500 ${isMyTurn ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2 grayscale'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg border-2 ${myPlayerId === 0 ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-rose-600 border-rose-400 text-white'}`}>
                            {PLAYER_NAMES[myPlayerId][0]}
                        </div>
                        <div>
                             <div className="text-xs font-bold text-stone-400 tracking-wider">YOU</div>
                             <div className="text-sm font-bold text-white uppercase flex items-center gap-2">
                                 {isMyTurn ? (canRoll ? 'ROLL DICE' : 'MOVE PIECE') : 'WAITING...'}
                                 {isMyTurn && <span className="flex w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}
                             </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <Dice3D 
                            value={displayDice || 1} 
                            rolling={isRolling} 
                            onClick={() => canRoll && handleAction({ type: 'ROLL' })}
                            disabled={!canRoll}
                        />
                        
                        {!canRoll && isMyTurn && (
                            <div className="text-[10px] font-bold text-stone-500 animate-pulse tracking-widest">
                                SELECT PIECE TO MOVE
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
