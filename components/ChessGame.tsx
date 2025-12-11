
import React, { useState, useEffect } from 'react';
import { ChessGameState, ChessPiece } from '../types';
import { updateChessState, subscribeToChess, FIXED_ROOM_ID } from '../services/firebase';
import { getLegalMoves, performMove } from '../services/chessLogic';
import { RefreshCw, Trophy, ChevronLeft, Circle } from 'lucide-react';

const INITIAL_BOARD: (ChessPiece | null)[][] = [
    [{type: 'r', color: 'b', hasMoved: false}, {type: 'n', color: 'b', hasMoved: false}, {type: 'b', color: 'b', hasMoved: false}, {type: 'q', color: 'b', hasMoved: false}, {type: 'k', color: 'b', hasMoved: false}, {type: 'b', color: 'b', hasMoved: false}, {type: 'n', color: 'b', hasMoved: false}, {type: 'r', color: 'b', hasMoved: false}],
    [{type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}, {type: 'p', color: 'b', hasMoved: false}],
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    [{type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}, {type: 'p', color: 'w', hasMoved: false}],
    [{type: 'r', color: 'w', hasMoved: false}, {type: 'n', color: 'w', hasMoved: false}, {type: 'b', color: 'w', hasMoved: false}, {type: 'q', color: 'w', hasMoved: false}, {type: 'k', color: 'w', hasMoved: false}, {type: 'b', color: 'w', hasMoved: false}, {type: 'n', color: 'w', hasMoved: false}, {type: 'r', color: 'w', hasMoved: false}],
];

const PIECE_SYMBOLS: Record<string, string> = {
    'kw': '♔', 'qw': '♕', 'rw': '♖', 'bw': '♗', 'nw': '♘', 'pw': '♙',
    'kb': '♚', 'qb': '♛', 'rb': '♜', 'bb': '♝', 'nb': '♞', 'pb': '♟'
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

    const myColor = myPlayerId === 0 ? 'w' : 'b';
    const opponentName = myPlayerId === 0 ? "Hasnae" : "Amine";

    useEffect(() => {
        const unsub = subscribeToChess(FIXED_ROOM_ID, (data) => {
            if (!data) {
                const initial: ChessGameState = {
                    board: INITIAL_BOARD,
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
                    winner: data.winner || null,
                    lastMove: data.lastMove || null,
                    inCheck: data.inCheck || false
                });
            }
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

    const resetGame = () => {
        if (window.confirm("Restart Chess?")) {
            const initial: ChessGameState = {
                board: INITIAL_BOARD,
                turn: 'w',
                winner: null,
                lastMove: null,
                log: 'Game Restarted',
                inCheck: false
            };
            updateChessState(FIXED_ROOM_ID, initial);
            setSelectedPos(null);
            setValidMoves([]);
        }
    };

    if (!gameState) return <div className="h-full flex items-center justify-center text-stone-500">Loading Chess...</div>;

    // We can safely map now because sanitizeBoard ensures arrays
    const displayBoard = myPlayerId === 1 
        ? [...gameState.board].reverse().map(r => [...r].reverse())
        : gameState.board;

    return (
        <div className="h-screen w-full flex flex-col bg-stone-900 text-stone-100 overflow-hidden">
             {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-stone-800 bg-stone-950 z-10">
                <button onClick={onExit} className="text-xs font-bold text-stone-600 hover:text-stone-400 flex items-center gap-1">
                    <ChevronLeft size={14} /> LOBBY
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="font-black text-xl tracking-wider">CHESS</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-500 font-mono uppercase tracking-widest">{gameState.turn === 'w' ? "White's Turn" : "Black's Turn"}</span>
                        {gameState.inCheck && !gameState.winner && <span className="text-[10px] text-rose-500 font-black animate-pulse">CHECK</span>}
                    </div>
                </div>
                <button onClick={resetGame} className="text-stone-600 hover:text-stone-400">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Board Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-stone-900/50">
                 {gameState.winner ? (
                     <div className="flex flex-col items-center animate-in zoom-in">
                         <Trophy size={64} className="text-amber-400 mb-4" />
                         <h2 className="text-4xl font-black mb-6">
                            {gameState.winner === 'draw' ? 'DRAW' : gameState.winner === 'w' ? 'WHITE WINS' : 'BLACK WINS'}
                         </h2>
                         <button onClick={resetGame} className="bg-stone-100 text-stone-900 px-8 py-3 rounded-xl font-bold">New Game</button>
                     </div>
                 ) : (
                    <div className="relative">
                        {/* Opponent Label */}
                        <div className={`text-center mb-4 text-xs font-bold tracking-widest flex items-center justify-center gap-2 ${gameState.turn !== myColor ? 'text-amber-400 animate-pulse' : 'text-stone-600'}`}>
                            {gameState.turn !== myColor && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                            {opponentName.toUpperCase()}
                        </div>

                        {/* Chess Board */}
                        <div className="w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] bg-stone-800 border-8 border-stone-800 rounded-lg shadow-2xl relative grid grid-cols-8 grid-rows-8 overflow-hidden ring-1 ring-stone-700">
                            {displayBoard.map((row, rIdx) => (
                                row.map((piece, cIdx) => {
                                    // Map visual coordinates to logical
                                    const actualR = myPlayerId === 1 ? 7 - rIdx : rIdx;
                                    const actualC = myPlayerId === 1 ? 7 - cIdx : cIdx;

                                    const isBlackSquare = (actualR + actualC) % 2 === 1;
                                    const isSelected = selectedPos?.r === actualR && selectedPos?.c === actualC;
                                    
                                    // Highlight last move
                                    const isLastMoveFrom = gameState.lastMove?.from.r === actualR && gameState.lastMove.from.c === actualC;
                                    const isLastMoveTo = gameState.lastMove?.to.r === actualR && gameState.lastMove.to.c === actualC;
                                    
                                    const isValidTarget = validMoves.some(m => m.r === actualR && m.c === actualC);
                                    const isCapture = isValidTarget && piece;

                                    // Check highlight
                                    const isKingInCheck = gameState.inCheck && piece?.type === 'k' && piece.color === gameState.turn;

                                    return (
                                        <div 
                                            key={`${actualR}-${actualC}`}
                                            onClick={() => handleSquareClick(actualR, actualC)}
                                            className={`
                                                flex items-center justify-center text-3xl sm:text-5xl select-none cursor-pointer relative transition-colors duration-100
                                                ${isBlackSquare ? 'bg-[#57534e]' : 'bg-[#a8a29e]'}
                                                ${isSelected ? 'ring-inset ring-4 ring-amber-400 bg-amber-200/50' : ''}
                                                ${(isLastMoveFrom || isLastMoveTo) && !isSelected ? 'bg-indigo-500/40' : ''}
                                                ${isKingInCheck ? 'bg-rose-600/80 ring-inset ring-4 ring-rose-500' : ''}
                                                ${piece?.color === 'w' ? 'text-[#f5f5f4] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-[#1c1917] drop-shadow-[0_2px_2px_rgba(255,255,255,0.2)]'}
                                            `}
                                        >
                                            <span className="relative z-10 transform hover:scale-105 transition-transform duration-200">
                                                {piece ? PIECE_SYMBOLS[piece.type + piece.color] : ''}
                                            </span>
                                            
                                            {/* Valid move indicator */}
                                            {isValidTarget && !isCapture && (
                                                <div className="absolute w-4 h-4 rounded-full bg-emerald-500/60 pointer-events-none shadow-sm"></div>
                                            )}
                                            {isValidTarget && isCapture && (
                                                <div className="absolute inset-0 ring-inset ring-8 ring-rose-500/40 pointer-events-none"></div>
                                            )}
                                        </div>
                                    );
                                })
                            ))}
                        </div>

                        {/* My Label */}
                        <div className={`text-center mt-4 text-xs font-bold tracking-widest flex items-center justify-center gap-2 ${gameState.turn === myColor ? 'text-green-400 animate-pulse' : 'text-stone-600'}`}>
                            {gameState.turn === myColor && <div className="w-2 h-2 rounded-full bg-green-400" />}
                            YOU ({myColor === 'w' ? 'White' : 'Black'})
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );
}
