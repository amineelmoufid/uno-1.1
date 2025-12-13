
import { MorrisGameState } from '../types';

// Board indices:
// 0 - 1 - 2
// | \ | / |
// 3 - 4 - 5
// | / | \ |
// 6 - 7 - 8

const WINNING_LINES = [
    [0, 1, 2], // Row 1
    [3, 4, 5], // Row 2
    [6, 7, 8], // Row 3
    [0, 3, 6], // Col 1
    [1, 4, 7], // Col 2
    [2, 5, 8], // Col 3
    [0, 4, 8], // Diag 1
    [2, 4, 6]  // Diag 2
];

// Neighbors based on lines drawn (including diagonals through center)
const ADJACENCY: Record<number, number[]> = {
    0: [1, 3, 4],
    1: [0, 2, 4],
    2: [1, 5, 4],
    3: [0, 6, 4],
    4: [0, 1, 2, 3, 5, 6, 7, 8], // Center connects to all
    5: [2, 8, 4],
    6: [3, 7, 4],
    7: [6, 8, 4],
    8: [5, 7, 4]
};

export const checkWin = (board: (number | null)[]): number | null => {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line;
        if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
};

export const getInitialMorrisState = (): MorrisGameState => ({
    board: Array(9).fill(null),
    turn: 0,
    phase: 'PLACING',
    piecesPlaced: { 0: 0, 1: 0 },
    winner: null,
    log: 'Game Started: Place your pieces'
});

export const performMorrisAction = (
    currentState: MorrisGameState, 
    action: { type: 'PLACE', idx: number } | { type: 'MOVE', from: number, to: number }
): MorrisGameState => {
    const newState = JSON.parse(JSON.stringify(currentState)) as MorrisGameState;
    const player = newState.turn;
    const opponent = player === 0 ? 1 : 0;

    if (action.type === 'PLACE') {
        if (newState.phase !== 'PLACING') throw new Error("Invalid phase");
        if (newState.board[action.idx] !== null) throw new Error("Spot taken");
        if (newState.piecesPlaced[player] >= 3) throw new Error("All pieces placed");

        newState.board[action.idx] = player;
        newState.piecesPlaced[player]++;
        newState.log = `Player ${player === 0 ? 'A' : 'H'} placed a piece`;

        // Check if placing phase is done for everyone
        if (newState.piecesPlaced[0] === 3 && newState.piecesPlaced[1] === 3) {
            newState.phase = 'MOVING';
            newState.log = "All pieces placed. Movement phase!";
        }
    } else {
        if (newState.phase !== 'MOVING') throw new Error("Invalid phase");
        if (newState.board[action.from] !== player) throw new Error("Not your piece");
        if (newState.board[action.to] !== null) throw new Error("Destination occupied");
        
        // Check adjacency
        if (!ADJACENCY[action.from].includes(action.to)) {
             throw new Error("Invalid move: not connected");
        }

        newState.board[action.from] = null;
        newState.board[action.to] = player;
        newState.log = `Player ${player === 0 ? 'A' : 'H'} moved`;
    }

    // Check Win
    const winner = checkWin(newState.board);
    if (winner !== null) {
        newState.winner = winner;
        newState.log = `Player ${winner === 0 ? 'Amine' : 'Hasnae'} Wins!`;
    } else {
        newState.turn = opponent;
    }

    return newState;
};
