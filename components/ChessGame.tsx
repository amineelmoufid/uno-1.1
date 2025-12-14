
import React, { useState, useEffect } from 'react';
import { ChessGameState, ChessPiece } from '../types';
import { updateChessState, subscribeToChess, FIXED_ROOM_ID, incrementScore, subscribeToScores } from '../services/firebase';
import { getLegalMoves, performMove } from '../services/chessLogic';
import { RefreshCw, Trophy, ChevronLeft, Loader2 } from 'lucide-react';

// Factory function to ensure a fresh board object every time we start/restart
const getInitialBoard = (): (ChessPiece | null)[][] => [
    [{type: 'r', color: 'b', hasMoved: false}, {type: 'n', color: 'b', hasMoved: false}, {type: 'b', color: 'b', hasMoved: false}, {type: 'q', color: 'b', hasMoved: false}, {type: 'k', color: 'b', hasMoved: false}, {type: 'b', color: 'b', hasMoved: false}, {type: 'n', color: 'b', hasMoved: false}, {type: 'r', color: 'b', hasMoved: false}],
    [{type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}],
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    [{type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}],
    [{type: 'r', color: 'w', hasMoved: false}, {type: 'n', color: 'w', hasMoved: false}, {type: 'b', color: 'w', hasMoved: false}, {type: 'q', color: 'w', hasMoved: false}, {type: 'k', color: 'w', hasMoved: false}, {type: 'b', color: 'w', hasMoved: false}, {type: 'n', color: 'w', hasMoved: false}, {type: 'r', color: 'w', hasMoved: false}],
];

// Use solid glyphs for both colors to maintain visual weight; color is handled by CSS
const PIECE_GLYPHS: Record<string, string> = {
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

interface ChessGameProps {
    myPlayerId: number; // 0 for Amine (White), 1 for Hasnae (Black)
    onExit: () => void;
}

// Robust sanitizer to convert Firebase objects/sparse arrays into dense 8x8 matrix
const sanitizeBoard = (data: any): (ChessPiece | null)[][] => {
    const board: (ChessPiece | null)[][] = [];
    for (let r = 0; r < 8; r++) {
        const newRow: (ChessPiece | null)[] = [];
        const rowData = data && data[r];
        for (let c = 0; c < 8; c++) {
            newRow.push(rowData ? rowData[c] || null : null);
        }
        board.push(newRow);
    }
    return board;
};

export default function ChessGame({ myPlayerId, onExit }: ChessGameProps) {
    const [gameState, setGameState] = useState<ChessGameState | null>(null);
    const [selectedPos, setSelectedPos] = useState<{r: number, c: number} | null>(null);
    const [validMoves, setValidMoves] = useState<{r: number, c: number}[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    const [scores, setScores] = useState<{ Amine: number; Hasnae: number } | null>(null);

    const myColor = myPlayerId === 0 ? 'w' : 'b';
    const opponentName = myPlayerId === 0 ? "Hasnae" : "Amine";
    const opponentColor = myColor === 'w' ? 'b' : 'w';

    useEffect(() => {
        const unsub = subscribeToScores((data) => {
            setScores(data?.['CHESS'] || { Amine: 0, Hasnae: 0 });
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = subscribeToChess(FIXED_ROOM_ID, (data) => {
            if (!data) {
                const initial: ChessGameState = {
                    board: getInitialBoard(),
                    turn: 'w',
                    winner: null,
                    lastMove: null,
                    log: 'Game Started',
                    inCheck: false
                };
                updateChessState(FIXED_ROOM_ID, initial);
            } else {
                setGameState({ 
                    ...data, 
                    board: sanitizeBoard(data.board),
                    turn: data.turn || 'w',
                    winner: data.winner || null, // Ensure explicit null
                    lastMove: data.lastMove || null,
                    inCheck: data.inCheck || false
                });
            }
            setIsResetting(false);
        });
        return () => unsub();
    }, []);

    const handleSquareClick = (r: number, c: number) => {
        if (!gameState || gameState.winner) return;
        
        const piece = gameState.board[r][c];
        const isMyPiece = piece?.color === myColor;

        // 1. Clicked on a Valid Move target?
        const moveTarget = validMoves.find(m => m.r === r && m.c === c);
        if (selectedPos && moveTarget) {
             const newState = performMove(gameState, selectedPos, {r, c});
             updateChessState(FIXED_ROOM_ID, newState);
             
             // Check winner and increment score
             if (newState.winner && newState.winner !== 'draw') {
                 const winnerName = newState.winner === 'w' ? 'Amine' : 'Hasnae';
                 incrementScore('CHESS', winnerName);
             }

             setSelectedPos(null);
             setValidMoves([]);
             return;
        }

        // 2. Select my piece
        if (isMyPiece) {
            if (selectedPos?.r === r && selectedPos?.c === c) {
                // Deselect
                setSelectedPos(null);
                setValidMoves([]);
            } else {
                // Select and calc valid moves
                if (gameState.turn === myColor) {
                    setSelectedPos({r, c});
                    const moves = getLegalMoves(gameState.board, {r, c}, gameState.lastMove);
                    setValidMoves(moves);
                }
            }
            return;
        }

        // 3. Clicked empty or enemy but not valid move
        setSelectedPos(null);
        setValidMoves([]);
    };

    const handleNewGame = async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        
        if (isResetting) return;
        
        // Remove window.confirm blocking to ensure button always works.
        // If players want to reset, they reset.
        setIsResetting(true);
        setSelectedPos(null);
        setValidMoves([]);
        
        const initial: ChessGameState = {
            board: getInitialBoard(),
            turn: 'w',
            winner: null,
            lastMove: null,
            log: 'Game Restarted',
            inCheck: false
        };

        try {
            await updateChessState(FIXED_ROOM_ID, initial);
        } catch (err) {
            console.error("Failed to reset game:", err);
            setIsResetting(false);
        }
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500 bg-stone-950">Loading Chess...</div>;

    // View logic: If I'm Black, reverse board.
    const isFlipped = myPlayerId === 1;
    const displayBoard = isFlipped 
        ? [...gameState.board].reverse().map(r => [...r].reverse())
        : gameState.board;
    
    // UI Helpers
    const getAvatarStyle = (color: 'w' | 'b') => {
        if (color === 'w') return "bg-indigo-100 text-indigo-900 shadow-[0_0_15px_rgba(224,231,255,0.4)]";
        return "bg-rose-950 text-rose-100 border border-rose-800 shadow-[0_0_15px_rgba(244,63,94,0.2)]";
    };

    return (
        <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 overflow-hidden font-sans selection:bg-transparent">
             {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-stone-900 bg-stone-950 z-20 shadow-sm relative">
                <button onClick={onExit} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-sm tracking-[0.3em] text-stone-400">CHESS</h1>
                    {gameState.inCheck && !gameState.winner ? (
                         <span className="text-[10px] text-rose-500 font-bold animate-pulse tracking-widest mt-0.5">CHECK</span>
                    ) : (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 mt-0.5">
                             <span className="text-indigo-400">A: {scores?.Amine || 0}</span>
                             <span className="text-stone-600">|</span>
                             <span className="text-rose-400">H: {scores?.Hasnae || 0}</span>
                         </div>
                    )}
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
            <div className="flex-1 flex flex-col items-center justify-center relative">
                 {gameState.winner ? (
                     <div className="absolute inset-0 z-30 bg-stone-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                         <Trophy size={64} className="text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                         <h2 className="text-3xl font-light tracking-widest mb-2 text-white">GAME OVER</h2>
                         <div className="text-5xl font-black mb-6 tracking-tighter text-stone-200">
                            {gameState.winner === 'draw' ? 'DRAW' : gameState.winner === 'w' ? 'WHITE WINS' : 'BLACK WINS'}
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
                 ) : null}

                {/* Opponent Info */}
                <div className={`w-full max-w-[480px] px-4 mb-4 flex justify-between items-end opacity-90 transition-opacity ${gameState.turn !== myColor ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg transition-colors ${getAvatarStyle(opponentColor)}`}>
                            {opponentName[0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">{opponentName}</span>
                            <span className="text-[10px] font-mono text-stone-500 uppercase">
                                {gameState.turn !== myColor ? 'Thinking...' : 'Waiting'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Board Container */}
                <div className="relative shadow-2xl shadow-black/50 rounded-md overflow-hidden ring-1 ring-white/10 select-none">
                    <div className="grid grid-cols-8 grid-rows-8 w-[90vw] h-[90vw] max-w-[480px] max-h-[480px]">
                        {displayBoard.map((row, rIdx) => (
                            row.map((piece, cIdx) => {
                                // Logic Coords
                                const actualR = isFlipped ? 7 - rIdx : rIdx;
                                const actualC = isFlipped ? 7 - cIdx : cIdx;

                                // Colors
                                const isBlackSquare = (actualR + actualC) % 2 === 1;
                                const bgClass = isBlackSquare ? 'bg-[#57534e]' : 'bg-[#d6d3d1]'; // Stone-600 vs Stone-300
                                
                                // State Checks
                                const isSelected = selectedPos?.r === actualR && selectedPos?.c === actualC;
                                const isLastMoveFrom = gameState.lastMove?.from.r === actualR && gameState.lastMove.from.c === actualC;
                                const isLastMoveTo = gameState.lastMove?.to.r === actualR && gameState.lastMove.to.c === actualC;
                                const isValidTarget = validMoves.some(m => m.r === actualR && m.c === actualC);
                                const isCapture = isValidTarget && piece;
                                const isKingInCheck = gameState.inCheck && piece?.type === 'k' && piece.color === gameState.turn;

                                // Coords Text
                                const showRank = cIdx === 0;
                                const showFile = rIdx === 7;
                                const rankLabel = isFlipped ? 1 + rIdx : 8 - rIdx;
                                const fileLabel = String.fromCharCode(isFlipped ? 104 - cIdx : 97 + cIdx);

                                return (
                                    <div 
                                        key={`${actualR}-${actualC}`}
                                        onClick={() => handleSquareClick(actualR, actualC)}
                                        className={`
                                            relative flex items-center justify-center cursor-pointer
                                            ${bgClass}
                                            transition-colors duration-150
                                        `}
                                    >
                                        {/* Coordinates */}
                                        {showRank && (
                                            <span className={`absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold ${isBlackSquare ? 'text-[#d6d3d1]' : 'text-[#57534e]'}`}>
                                                {rankLabel}
                                            </span>
                                        )}
                                        {showFile && (
                                            <span className={`absolute bottom-0 right-1 text-[8px] sm:text-[10px] font-bold ${isBlackSquare ? 'text-[#d6d3d1]' : 'text-[#57534e]'}`}>
                                                {fileLabel}
                                            </span>
                                        )}

                                        {/* Highlights */}
                                        {isLastMoveFrom && <div className="absolute inset-0 bg-yellow-500/20 mix-blend-overlay" />}
                                        {isLastMoveTo && <div className="absolute inset-0 bg-yellow-500/30 mix-blend-overlay" />}
                                        {isSelected && <div className="absolute inset-0 bg-emerald-500/30 mix-blend-multiply ring-inset ring-2 ring-emerald-500/50" />}
                                        
                                        {/* Valid Move Markers */}
                                        {isValidTarget && !isCapture && (
                                            <div className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-black/10 rounded-full shadow-inner pointer-events-none" />
                                        )}
                                        {isValidTarget && isCapture && (
                                            <div className="absolute inset-0 ring-[6px] ring-inset ring-black/10 rounded-none pointer-events-none" />
                                        )}
                                        
                                        {/* Danger/Check */}
                                        {isKingInCheck && (
                                            <div className="absolute inset-0 bg-red-500/50 rounded-full blur-xl scale-75 animate-pulse" />
                                        )}

                                        {/* Piece */}
                                        {piece && (
                                            <span 
                                                className={`
                                                    relative z-10 text-4xl sm:text-6xl select-none leading-none
                                                    transition-transform duration-200
                                                    ${isSelected ? 'scale-110 -translate-y-1' : ''}
                                                    ${piece.color === 'w' 
                                                        ? 'text-indigo-50 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]' 
                                                        : 'text-rose-950 drop-shadow-[0_1px_0px_rgba(255,255,255,0.4)]'
                                                    }
                                                `}
                                                style={{fontFamily: 'Segoe UI Symbol, Apple Symbols, sans-serif'}} // Ensure glyph support
                                            >
                                                {PIECE_GLYPHS[piece.type]}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>

                 {/* My Info */}
                 <div className={`w-full max-w-[480px] px-4 mt-4 flex justify-between items-start opacity-90 transition-opacity ${gameState.turn === myColor ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg transition-colors ${getAvatarStyle(myColor)}`}>
                            {myPlayerId === 0 ? 'A' : 'H'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-wider text-stone-300">YOU</span>
                            <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold">
                                {gameState.turn === myColor ? 'Your Turn' : ''}
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
