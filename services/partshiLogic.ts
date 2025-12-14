
import { PartshiGameState, PartshiPiece } from '../types';

// Board Constants
const TRACK_LENGTH = 52;
const P0_START = 0;
const P1_START = 26;
const P0_HOME_ENTRY = 50; // Last square before home
const P1_HOME_ENTRY = 24; // Last square before home

// Helper: Get next position
const getNextPosition = (currentPos: number, steps: number, playerIndex: number): number => {
    // 1. If in Base (-1)
    if (currentPos === -1) {
        if (steps === 6) return playerIndex === 0 ? P0_START : P1_START;
        return -1; // Cannot move
    }

    // 2. If in Goal (999)
    if (currentPos === 999) return 999;

    // 3. If in Home Path (100+ or 200+)
    if (currentPos >= 100) {
        const offset = currentPos >= 200 ? 200 : 100;
        const relativePos = currentPos - offset; // 0 to 5
        const target = relativePos + steps;
        
        if (target === 6) return 999; // Goal!
        if (target < 6) return offset + target;
        return currentPos; // Bounce or stay? Usually stay if exact roll needed. We'll say stay.
    }

    // 4. Main Track
    // Check if we pass the home entry
    const entryPoint = playerIndex === 0 ? P0_HOME_ENTRY : P1_HOME_ENTRY;
    
    // We need to calculate distance to entry point considering wrap-around
    let distanceToEntry = -1;
    if (playerIndex === 0) {
        // Simple case: 0 to 50
        if (currentPos <= P0_HOME_ENTRY) distanceToEntry = P0_HOME_ENTRY - currentPos;
        // Else passed? Should not happen if logic is correct
    } else {
        // 26...51...0...24
        if (currentPos >= P1_START) {
            distanceToEntry = (TRACK_LENGTH - currentPos) + P1_HOME_ENTRY; 
        } else {
            distanceToEntry = P1_HOME_ENTRY - currentPos;
        }
    }

    if (steps > distanceToEntry) {
        // Entering Home Path
        const remainingSteps = steps - distanceToEntry - 1; // -1 to step INTO the first home square
        if (remainingSteps >= 6) return currentPos; // Too far? Unlikely with 1 die
        return (playerIndex === 0 ? 100 : 200) + remainingSteps;
    }

    // Normal Move
    return (currentPos + steps) % TRACK_LENGTH;
};

export const getInitialPartshiState = (): PartshiGameState => ({
    players: {
        0: [0,1,2,3].map(id => ({ id, position: -1 })),
        1: [0,1,2,3].map(id => ({ id, position: -1 }))
    },
    turn: 0,
    dice: null,
    canRoll: true,
    winner: null,
    log: 'Game Started: Roll the dice!'
});

export const performPartshiAction = (
    state: PartshiGameState,
    action: { type: 'ROLL' } | { type: 'MOVE', pieceId: number }
): PartshiGameState => {
    const newState = JSON.parse(JSON.stringify(state)) as PartshiGameState;
    const playerIdx = newState.turn as 0 | 1;

    if (action.type === 'ROLL') {
        if (!newState.canRoll) throw new Error("Cannot roll now");
        
        const roll = Math.floor(Math.random() * 6) + 1;
        newState.dice = roll;
        newState.canRoll = false;
        newState.log = `Rolled a ${roll}`;

        // Check valid moves
        const pieces = newState.players[playerIdx];
        const canMove = pieces.some(p => {
            // Can enter from base?
            if (p.position === -1) return roll === 6;
            // Can move on track/home?
            const next = getNextPosition(p.position, roll, playerIdx);
            return next !== p.position; // Position changed means move valid
        });

        if (!canMove) {
            // Skip turn
            newState.log += " - No moves!";
            // Delay turn switch slightly for UI? No, logic handles state.
            // If roll was 6, do they get to roll again even if no move? 
            // Usually yes, but if no pieces on board and 6, can't move. 
            // Let's simplified: 6 gives roll again ONLY if you moved? 
            // Standard: 6 gives another roll. If you can't move, you pass, but if it was 6, do you roll again?
            // Let's say: If no move possible, turn ends immediately, UNLESS it was a 6.
            
            if (roll !== 6) {
                newState.turn = playerIdx === 0 ? 1 : 0;
                newState.dice = null;
                newState.canRoll = true;
            } else {
                 newState.canRoll = true; // Roll again
                 newState.log += " (Roll again)";
            }
        }
    } else {
        // MOVE
        if (newState.canRoll || newState.dice === null) throw new Error("Must roll first");
        
        const pieces = newState.players[playerIdx];
        const piece = pieces.find(p => p.id === action.pieceId);
        if (!piece) throw new Error("Piece not found");

        // Validate move
        let nextPos = -999;
        
        if (piece.position === -1) {
            if (newState.dice !== 6) throw new Error("Need 6 to enter");
            nextPos = playerIdx === 0 ? P0_START : P1_START;
        } else {
            nextPos = getNextPosition(piece.position, newState.dice, playerIdx);
            if (nextPos === piece.position) throw new Error("Invalid move");
        }

        // Check collisions (Capturing)
        // If landing on opponent piece, send them to base (-1)
        // Note: Safe spots usually prevent capture. We'll ignore safe spots for simplicity OR add them.
        // Let's add simple capture. 
        if (nextPos < 100 && nextPos >= 0) { // Only on main track
            const opponentIdx = playerIdx === 0 ? 1 : 0;
            const opponentPieces = newState.players[opponentIdx];
            const victim = opponentPieces.find(p => p.position === nextPos);
            
            if (victim) {
                // Safe spot check? 
                // Safe spots: 0, 8, 13, 21, 26, 34, 39, 47
                const isSafe = [0, 8, 13, 21, 26, 34, 39, 47].includes(nextPos);
                if (!isSafe) {
                    victim.position = -1; // Send to base
                    newState.log += ` - Captured!`;
                } else {
                    // Safe spot: Blocks? Or Stack?
                    // Simplified: Just stack. No capture.
                }
            }
        }

        piece.position = nextPos;

        // Check Win
        if (pieces.every(p => p.position === 999)) {
            newState.winner = playerIdx;
            newState.log = `${playerIdx === 0 ? 'Amine' : 'Hasnae'} Wins!`;
            return newState;
        }

        // Turn Logic
        if (newState.dice === 6) {
            newState.canRoll = true; // Roll again
            newState.log = "Moved. Roll again!";
        } else {
            newState.turn = playerIdx === 0 ? 1 : 0;
            newState.dice = null;
            newState.canRoll = true;
        }
    }

    return newState;
};
