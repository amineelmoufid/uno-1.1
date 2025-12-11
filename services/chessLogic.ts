
import { ChessPiece, ChessGameState } from '../types';

type Pos = { r: number; c: number };

const isPosEqual = (p1: Pos, p2: Pos) => p1.r === p2.r && p1.c === p2.c;

// --- Helper: Clone Board ---
const cloneBoard = (board: (ChessPiece | null)[][]) => board.map(row => row.map(p => p ? { ...p } : null));

// --- Helper: Is On Board ---
const onBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

// --- Helper: Is Square Attacked? ---
// Checks if `color` attacks square (r, c)
const isAttacked = (board: (ChessPiece | null)[][], r: number, c: number, attackerColor: 'w' | 'b') => {
  // Check Pawn attacks
  const pawnDir = attackerColor === 'w' ? -1 : 1;
  // Attackers come from opposite direction
  if (onBoard(r - pawnDir, c - 1)) {
    const p = board[r - pawnDir][c - 1];
    if (p && p.type === 'p' && p.color === attackerColor) return true;
  }
  if (onBoard(r - pawnDir, c + 1)) {
    const p = board[r - pawnDir][c + 1];
    if (p && p.type === 'p' && p.color === attackerColor) return true;
  }

  // Check Knight attacks
  const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const m of knightMoves) {
    const nr = r + m[0], nc = c + m[1];
    if (onBoard(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.type === 'n' && p.color === attackerColor) return true;
    }
  }

  // Check Sliding attacks (Bishop/Rook/Queen)
  const dirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1], // Straight
    [-1, -1], [-1, 1], [1, -1], [1, 1] // Diagonal
  ];

  for (let i = 0; i < 8; i++) {
    const dr = dirs[i][0];
    const dc = dirs[i][1];
    let k = 1;
    while (true) {
      const nr = r + dr * k, nc = c + dc * k;
      if (!onBoard(nr, nc)) break;
      const p = board[nr][nc];
      if (p) {
        if (p.color === attackerColor) {
           const isStraight = i < 4;
           if (p.type === 'q') return true;
           if (isStraight && p.type === 'r') return true;
           if (!isStraight && p.type === 'b') return true;
           if (k === 1 && p.type === 'k') return true; // King vs King
        }
        break; // Blocked
      }
      k++;
    }
  }

  return false;
};

// --- Check Detection ---
const findKing = (board: (ChessPiece | null)[][], color: 'w' | 'b'): Pos | null => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  }
  return null;
};

export const isInCheck = (board: (ChessPiece | null)[][], color: 'w' | 'b'): boolean => {
  const kingPos = findKing(board, color);
  if (!kingPos) return false; // Should not happen
  return isAttacked(board, kingPos.r, kingPos.c, color === 'w' ? 'b' : 'w');
};

// --- Move Validation (Raw Geometry + blocking) ---
const getPseudoLegalMoves = (board: (ChessPiece | null)[][], from: Pos, lastMove: ChessGameState['lastMove']): Pos[] => {
  const piece = board[from.r][from.c];
  if (!piece) return [];
  
  const moves: Pos[] = [];
  const addIfValid = (r: number, c: number) => {
    if (!onBoard(r, c)) return;
    const target = board[r][c];
    if (!target || target.color !== piece.color) {
      moves.push({ r, c });
    }
  };
  const addSlide = (dr: number, dc: number) => {
    let k = 1;
    while (true) {
      const nr = from.r + dr * k;
      const nc = from.c + dc * k;
      if (!onBoard(nr, nc)) break;
      const target = board[nr][nc];
      if (target) {
        if (target.color !== piece.color) moves.push({ r: nr, c: nc });
        break;
      }
      moves.push({ r: nr, c: nc });
      k++;
    }
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;

    // Forward 1
    if (onBoard(from.r + dir, from.c) && !board[from.r + dir][from.c]) {
      moves.push({ r: from.r + dir, c: from.c });
      // Forward 2
      if (from.r === startRow && onBoard(from.r + dir * 2, from.c) && !board[from.r + dir * 2][from.c]) {
        moves.push({ r: from.r + dir * 2, c: from.c });
      }
    }
    // Captures
    [[from.r + dir, from.c - 1], [from.r + dir, from.c + 1]].forEach(([r, c]) => {
      if (onBoard(r, c)) {
        const target = board[r][c];
        if (target && target.color !== piece.color) {
          moves.push({ r, c });
        }
        // En Passant
        if (!target && lastMove && lastMove.piece.type === 'p' && 
            Math.abs(lastMove.from.r - lastMove.to.r) === 2 &&
            lastMove.to.r === from.r && lastMove.to.c === c) {
           moves.push({ r, c }); // Move to empty square behind pawn
        }
      }
    });
  } else if (piece.type === 'n') {
    const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    jumps.forEach(([dr, dc]) => addIfValid(from.r + dr, from.c + dc));
  } else if (piece.type === 'k') {
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => {
      addIfValid(from.r + dr, from.c + dc);
    });
    // Castling
    if (!piece.hasMoved && !isInCheck(board, piece.color)) {
      // Kingside
      if (board[from.r][7] && board[from.r][7]!.type === 'r' && !board[from.r][7]!.hasMoved) {
        if (!board[from.r][5] && !board[from.r][6]) {
            if (!isAttacked(board, from.r, 5, piece.color === 'w' ? 'b' : 'w') && 
                !isAttacked(board, from.r, 6, piece.color === 'w' ? 'b' : 'w')) {
                  moves.push({ r: from.r, c: 6 });
            }
        }
      }
      // Queenside
      if (board[from.r][0] && board[from.r][0]!.type === 'r' && !board[from.r][0]!.hasMoved) {
        if (!board[from.r][1] && !board[from.r][2] && !board[from.r][3]) {
            if (!isAttacked(board, from.r, 3, piece.color === 'w' ? 'b' : 'w') && // Cell D1/D8 check not required by rules but path C1/C8 check is required
                !isAttacked(board, from.r, 2, piece.color === 'w' ? 'b' : 'w')) {
                  moves.push({ r: from.r, c: 2 });
            }
        }
      }
    }
  } else {
    // R, B, Q
    const dirs = piece.type === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]] :
                 piece.type === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                 [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    dirs.forEach(([dr, dc]) => addSlide(dr, dc));
  }
  
  return moves;
};

// --- Get Valid Moves (Legal only) ---
export const getLegalMoves = (board: (ChessPiece | null)[][], from: Pos, lastMove: ChessGameState['lastMove']): Pos[] => {
  const piece = board[from.r][from.c];
  if (!piece) return [];
  
  const candidates = getPseudoLegalMoves(board, from, lastMove);
  
  // Filter out moves that leave King in check
  return candidates.filter(move => {
    const nextBoard = cloneBoard(board);
    const movingPiece = nextBoard[from.r][from.c]!;
    
    // Simulate Move
    nextBoard[from.r][from.c] = null;
    nextBoard[move.r][move.c] = movingPiece;
    
    // Handle En Passant Capture Simulation
    if (movingPiece.type === 'p' && move.c !== from.c && !board[move.r][move.c]) {
       // We moved diagonal to empty square -> EP
       nextBoard[from.r][move.c] = null; // Remove victim
    }
    
    // NOTE: We don't need to simulate Rook move for Castling to check King safety, 
    // because `getPseudoLegalMoves` already checks the path safety for King.
    
    return !isInCheck(nextBoard, piece.color);
  });
};

// --- Execute Move & Get New State ---
export const performMove = (currentState: ChessGameState, from: Pos, to: Pos): ChessGameState => {
    const board = cloneBoard(currentState.board);
    const piece = board[from.r][from.c]!;
    const target = board[to.r][to.c];
    
    let log = `${piece.color === 'w' ? 'White' : 'Black'} moved`;
    
    // Handle Castling
    if (piece.type === 'k' && Math.abs(to.c - from.c) > 1) {
        const isKingside = to.c > from.c;
        const rookCol = isKingside ? 7 : 0;
        const rookDestCol = isKingside ? 5 : 3;
        const rook = board[from.r][rookCol]!;
        
        board[from.r][rookCol] = null;
        board[from.r][rookDestCol] = { ...rook, hasMoved: true };
        log = "Castling";
    }

    // Handle En Passant
    if (piece.type === 'p' && to.c !== from.c && !target) {
        // Must be en passant
        board[from.r][to.c] = null; // Remove victim
        log = "En Passant";
    }

    // Move Piece
    board[to.r][to.c] = { ...piece, hasMoved: true };
    board[from.r][from.c] = null;

    // Promotion
    if (piece.type === 'p' && (to.r === 0 || to.r === 7)) {
        board[to.r][to.c]!.type = 'q';
        log = "Pawn Promoted";
    }

    const currentTurn = currentState.turn || 'w';
    const nextTurn = currentTurn === 'w' ? 'b' : 'w';
    const check = isInCheck(board, nextTurn);
    
    // Checkmate / Stalemate detection
    let hasLegalMoves = false;
    // Iterate all pieces of next player
    outer: for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === nextTurn) {
                if (getLegalMoves(board, {r, c}, { from, to, piece }).length > 0) {
                    hasLegalMoves = true;
                    break outer;
                }
            }
        }
    }

    // Initialize winner carefully (handle missing property from Firebase)
    let winner: 'w' | 'b' | 'draw' | null = currentState.winner || null;
    
    if (!hasLegalMoves) {
        if (check) {
            winner = currentTurn; // Current player wins (the one who moved)
            log = "Checkmate!";
        } else {
            winner = 'draw';
            log = "Stalemate!";
        }
    } else if (check) {
        log += " (Check)";
    }

    return {
        board,
        turn: nextTurn,
        winner: winner || null, // Ensure never undefined
        lastMove: { from, to, piece },
        inCheck: check,
        log
    };
};
