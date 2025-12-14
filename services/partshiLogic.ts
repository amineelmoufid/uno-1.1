
import { PartshiGameState, PartshiPiece } from '../types';

// Board Constants
const TRACK_LENGTH = 52;
const P0_START = 0;
const P1_START = 26;
const P0_HOME_ENTRY = 50; // Last square before home
const P1_HOME_ENTRY = 24; // Last square before home

// Standard Ludo Safe Spots
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

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
        return currentPos; // Move invalid if overshooting
    }

    // 4. Main Track
    // Check if we pass the home entry
    // P0 goes 0->50, then home. P1 goes 26->51->0->24, then home.
    
    // Distance calculation logic
    let effectivePos = currentPos;
    let entryPos = playerIndex === 0 ? P0_HOME_ENTRY : P1_HOME_ENTRY;
    
    // Handle wrap around for distance calc
    let distanceToEntry: number;
    
    if (playerIndex === 0) {
        // Amine: 0 -> 50. simple.
        distanceToEntry = P0_HOME_ENTRY - currentPos;
    } else {
        // Hasnae: 26 -> 51 -> 0 -> 24
        if (currentPos >= P1_START) { // 26 to 51
             // Dist to 51 + (0 to 24) + 1 step for 51->0 transition
             distanceToEntry = (TRACK_LENGTH - 1 - currentPos) + 1 + P1_HOME_ENTRY;
        } else {
             // 0 to 24
             distanceToEntry = P1_HOME_ENTRY - currentPos;
        }
    }

    // Important: A player can only enter home if they have traversed the board. 
    // Since we don't track laps, we rely on the position check.
    // If distance is negative, it means we already passed it? No, circular logic handles it.
    // However, we must ensure P1 doesn't enter home immediately if they are at e.g. 23 (unlikely as they start at 26).
    // But logically, if P1 is at 23, they have almost finished a lap.
    
    if (steps > distanceToEntry) {
         // Potential home entry
         // The step ONTO the entry point uses 1 distance. 
         // Example: At 50 (Entry), roll 1 -> Home Path 0 (Index 100). 
         // distanceToEntry is 0. steps 1. 1 > 0.
         // remaining = 1 - 0 - 1 = 0. Correct.
         
         const remaining = steps - distanceToEntry - 1;
         if (remaining < 6) {
             return (playerIndex === 0 ? 100 : 200) + remaining;
         }
         // Overshoot home path entry? Stay put.
         return currentPos;
    }

    // Normal Move (Wrap around 52)
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
            newState.log += " - No moves!";
            // 6 gives another roll usually, but if blocked completely? 
            // Standard rules: If 6, roll again. If not 6 and no moves, pass.
            
            if (roll !== 6) {
                // Delay turn switch slightly in UI usually, but here immediate state update
                newState.turn = playerIdx === 0 ? 1 : 0;
                newState.dice = null;
                newState.canRoll = true;
            } else {
                 newState.canRoll = true; 
                 newState.log += " (Roll 6 again)";
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
        if (nextPos < 100 && nextPos >= 0) { // Only on main track
            const opponentIdx = playerIdx === 0 ? 1 : 0;
            const opponentPieces = newState.players[opponentIdx];
            
            // Is it a safe spot?
            const isSafe = SAFE_SPOTS.includes(nextPos);
            
            // Find victim
            const victimIndex = opponentPieces.findIndex(p => p.position === nextPos);
            
            if (victimIndex !== -1) {
                if (!isSafe) {
                    // Capture!
                    opponentPieces[victimIndex].position = -1;
                    newState.log = "Captured Opponent!";
                    // Bonus roll for capture? Standard rules often say yes. Let's keep it simple for now or give bonus.
                    // Let's grant a bonus roll for capturing.
                    newState.dice = 6; // Hack: Force a 6-like behavior (canRoll=true) without changing number? 
                    // Better: Just set canRoll = true and keep turn.
                    newState.canRoll = true; 
                    newState.log += " Roll again!";
                    
                    piece.position = nextPos; // Complete move
                    // We return here to skip the normal turn switching logic below
                    return newState; 
                } else {
                    // Safe Spot: Co-exist (Stacking handled by UI)
                }
            }
        }

        piece.position = nextPos;

        // Check Win
        if (pieces.length > 0 && pieces.every(p => p.position === 999)) {
            newState.winner = playerIdx;
            newState.log = `${playerIdx === 0 ? 'Amine' : 'Hasnae'} Wins!`;
            return newState;
        }

        // Turn Logic
        if (newState.dice === 6) {
            newState.canRoll = true; 
            newState.log = "Rolled 6. Roll again!";
        } else {
            newState.turn = playerIdx === 0 ? 1 : 0;
            newState.dice = null;
            newState.canRoll = true;
        }
    }

    return newState;
};
