import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, get, child, onDisconnect } from "firebase/database";
import { GameState } from "../types";

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

// --- Game State ---

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
