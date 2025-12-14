
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, get, child, onDisconnect, runTransaction } from "firebase/database";
import { GameState, GameType, ChessGameState, MorrisGameState, TTTMoveGameState } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyA1dOqowN6zPTIrk4A-7ckTl325bQgVGyI",
  authDomain: "aminedotink.firebaseapp.com",
  databaseURL: "https://aminedotink-default-rtdb.firebaseio.com",
  projectId: "aminedotink",
  storageBucket: "aminedotink.firebasestorage.app",
  messagingSenderId: "154560363228",
  appId: "1:154560363228:web:57107df3a5716bdbc45219",
  measurementId: "G-6LQ52X09TG"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const FIXED_ROOM_ID = "AMINE_HASNAE_UNO_V1";

// --- Game Selection ---

export const setGameType = async (gameType: GameType) => {
    await set(ref(db, `config/${FIXED_ROOM_ID}/activeGame`), gameType);
};

export const subscribeToGameType = (callback: (gameType: GameType) => void) => {
    return onValue(ref(db, `config/${FIXED_ROOM_ID}/activeGame`), (snapshot) => {
        callback(snapshot.val() || null);
    });
};

// New: Individual Player Selections
export const setPlayerSelection = async (playerName: string, gameType: GameType) => {
    await set(ref(db, `config/${FIXED_ROOM_ID}/selections/${playerName}`), gameType);
};

export const subscribeToSelections = (callback: (data: Record<string, GameType> | null) => void) => {
    return onValue(ref(db, `config/${FIXED_ROOM_ID}/selections`), (snapshot) => {
        callback(snapshot.val());
    });
};

export const resetSelections = async () => {
    await set(ref(db, `config/${FIXED_ROOM_ID}/selections`), null);
};

// --- UNO Game State ---

export const getGameSnapshot = async (roomId: string) => {
    const snapshot = await get(child(ref(db), `games/${roomId}`));
    return snapshot.exists() ? snapshot.val() : null;
};

export const createGameInFirebase = async (roomId: string, initialState: GameState) => {
  await set(ref(db, `games/${roomId}`), initialState);
};

export const subscribeToGame = (roomId: string, callback: (data: GameState | null) => void) => {
  const gameRef = ref(db, `games/${roomId}`);
  return onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
};

export const updateGameState = async (roomId: string, newState: GameState) => {
  await set(ref(db, `games/${roomId}`), newState);
};

// --- Chess Game State ---

export const updateChessState = async (roomId: string, newState: ChessGameState) => {
    await set(ref(db, `games/${roomId}_CHESS`), newState);
};

export const subscribeToChess = (roomId: string, callback: (data: ChessGameState | null) => void) => {
    return onValue(ref(db, `games/${roomId}_CHESS`), (snapshot) => {
        callback(snapshot.val());
    });
};

// --- Morris Game State ---

export const updateMorrisState = async (roomId: string, newState: MorrisGameState) => {
    await set(ref(db, `games/${roomId}_MORRIS`), newState);
};

export const subscribeToMorris = (roomId: string, callback: (data: MorrisGameState | null) => void) => {
    return onValue(ref(db, `games/${roomId}_MORRIS`), (snapshot) => {
        callback(snapshot.val());
    });
};

// --- TTT Move Game State ---

export const updateTTTMoveState = async (roomId: string, newState: TTTMoveGameState) => {
    await set(ref(db, `games/${roomId}_TTT_MOVE`), newState);
};

export const subscribeToTTTMove = (roomId: string, callback: (data: TTTMoveGameState | null) => void) => {
    return onValue(ref(db, `games/${roomId}_TTT_MOVE`), (snapshot) => {
        callback(snapshot.val());
    });
};


// --- Auth & Presence ---

export const getPlayerPin = async (playerName: string) => {
    const snapshot = await get(child(ref(db), `config/${FIXED_ROOM_ID}/pins/${playerName}`));
    return snapshot.exists() ? snapshot.val() : null;
};

export const setPlayerPin = async (playerName: string, pin: string) => {
    await set(ref(db, `config/${FIXED_ROOM_ID}/pins/${playerName}`), pin);
};

export const setPlayerOnline = (playerName: string) => {
    const presenceRef = ref(db, `config/${FIXED_ROOM_ID}/presence/${playerName}`);
    // Set online
    set(presenceRef, true);
    // Auto go offline if disconnect
    onDisconnect(presenceRef).set(false);
};

export const setPlayerOffline = (playerName: string) => {
    const presenceRef = ref(db, `config/${FIXED_ROOM_ID}/presence/${playerName}`);
    set(presenceRef, false);
};

export const subscribeToPresence = (callback: (data: Record<string, boolean> | null) => void) => {
    const presenceRef = ref(db, `config/${FIXED_ROOM_ID}/presence`);
    return onValue(presenceRef, (snapshot) => {
        callback(snapshot.val());
    });
};

// --- Scoring ---

export const incrementScore = (gameType: string, winnerName: string) => {
    const scoreRef = ref(db, `config/${FIXED_ROOM_ID}/scores/${gameType}/${winnerName}`);
    runTransaction(scoreRef, (currentScore) => {
        return (currentScore || 0) + 1;
    });
};

export const subscribeToScores = (callback: (scores: Record<string, { Amine: number, Hasnae: number }> | null) => void) => {
    return onValue(ref(db, `config/${FIXED_ROOM_ID}/scores`), (snapshot) => {
        callback(snapshot.val());
    });
};
