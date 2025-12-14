
import { TTTMoveGameState } from '../types';

const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diags
];

export const getInitialTTTMoveState = (): TTTMoveGameState => {
    // Randomly pick X or O to start
    const startingTurn = Math.random() < 0.5 ? 'X' : 'O';
    
    return {
        board: Array(9).fill(null),
        turn: startingTurn,
        phase: 'DROP',
        piecesX: 0,
        piecesO: 0,
        winner: null,
        log: `Drop Phase: ${startingTurn}'s Turn`
    };
};

const checkWin = (board: (string | null)[]): 'X' | 'O' | null => {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a] as 'X' | 'O';
        }
    }
    return null;
};

export const performTTTAction = (
    state: TTTMoveGameState,
    action: { type: 'DROP', idx: number } | { type: 'MOVE', from: number, to: number }
): TTTMoveGameState => {
    const newState = JSON.parse(JSON.stringify(state)) as TTTMoveGameState;
    const { turn } = newState;
    const opponent = turn === 'X' ? 'O' : 'X';

    if (action.type === 'DROP') {
        if (newState.phase !== 'DROP') throw new Error("Not in drop phase");
        if (newState.board[action.idx]) throw new Error("Square occupied");
        
        const count = turn === 'X' ? newState.piecesX : newState.piecesO;
        if (count >= 3) throw new Error("All pieces dropped");

        newState.board[action.idx] = turn;
        if (turn === 'X') newState.piecesX++;
        else newState.piecesO++;
        
        newState.log = `${turn} dropped piece`;

        // Switch Phase?
        if (newState.piecesX === 3 && newState.piecesO === 3) {
            newState.phase = 'MOVE';
            newState.log = "Move Phase Begins!";
        }
    } else {
        if (newState.phase !== 'MOVE') throw new Error("Not in move phase");
        if (newState.board[action.from] !== turn) throw new Error("Not your piece");
        if (newState.board[action.to]) throw new Error("Square occupied");
        
        // ALLOW ANY MOVE TO EMPTY SQUARE (Removed adjacency check)

        newState.board[action.from] = null;
        newState.board[action.to] = turn;
        newState.log = `${turn} moved`;
    }

    const winner = checkWin(newState.board);
    if (winner) {
        newState.winner = winner;
        newState.log = `${winner} Wins!`;
    } else {
        newState.turn = opponent;
        if (newState.phase === 'DROP') newState.log = `Drop Phase: ${opponent}'s Turn`;
        else if (newState.phase === 'MOVE') newState.log = `Move Phase: ${opponent}'s Turn`;
    }

    return newState;
};
