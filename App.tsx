import React, { useState, useEffect, useRef } from 'react';
import { Card, CardColor, CardValue, GameState, GameStatus, Player } from './types';
import { createDeck, shuffle, isValidMove } from './services/gameLogic';
import { 
    createGameInFirebase, 
    subscribeToGame, 
    updateGameState, 
    getGameSnapshot, 
    FIXED_ROOM_ID, 
    getPlayerPin, 
    setPlayerPin, 
    setPlayerOnline, 
    setPlayerOffline, 
    subscribeToPresence 
} from './services/firebase';
import CardComponent from './components/CardComponent';
import { Trophy, Users, RefreshCw, Heart, Lock, Delete, ChevronLeft, Smile, MessageCircle, Megaphone } from 'lucide-react';

const HAND_SIZE = 7;
const PLAYER_AMINE = { id: 0, name: "Amine" };
const PLAYER_HASNAE = { id: 1, name: "Hasnae" };
const EMOJIS = ["😎", "😂", "😡", "😭", "🤔", "🤡", "❤️", "👍"];

type LoginStep = 'SELECT' | 'CREATE_PIN' | 'ENTER_PIN';

const Confetti = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: {x: number, y: number, r: number, d: number, color: string, tilt: number, tiltAngle: number, tiltAngleIncremental: number}[] = [];
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#ffffff'];

        for (let i = 0; i < 300; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * 30 + 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10,
                tiltAngle: 0,
                tiltAngleIncremental: Math.random() * 0.07 + 0.05
            });
        }

        let animationId: number;
        let angle = 0;

        const draw = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            angle += 0.01;
            
            particles.forEach((p, i) => {
                p.tiltAngle += p.tiltAngleIncremental;
                p.y += (Math.cos(angle + p.d) + 3 + p.r / 2) * 0.5;
                p.x += Math.sin(angle);
                p.tilt = Math.sin(p.tiltAngle) * 15;

                if (p.y > canvas.height) {
                    particles[i] = {
                        x: Math.random() * canvas.width,
                        y: -10,
                        r: p.r,
                        d: p.d,
                        color: p.color,
                        tilt: p.tilt,
                        tiltAngle: p.tiltAngle,
                        tiltAngleIncremental: p.tiltAngleIncremental
                    };
                }

                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r * 1.5);
                ctx.stroke();
            });

            animationId = requestAnimationFrame(draw);
        };

        draw();

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  
  // Auth State
  const [loginStep, setLoginStep] = useState<LoginStep>('SELECT');
  const [selectedIdentity, setSelectedIdentity] = useState<'Amine' | 'Hasnae' | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});

  // Game UI State
  const [unoCall, setUnoCall] = useState(false);
  const [wildPickerOpen, setWildPickerOpen] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Reactions & Shouts
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Initialization & Presence ---

  useEffect(() => {
    // Listen to who is online to disable buttons
    const unsub = subscribeToPresence((data) => {
        setOnlineUsers(data || {});
    });
    return () => unsub();
  }, []);

  const initializeRoom = async () => {
      // Changed to 'let' to allow re-shuffling
      let deck = createDeck();
      
      const hand1 = deck.splice(0, HAND_SIZE);
      const hand2 = deck.splice(0, HAND_SIZE);

      let first = deck.pop()!;
      while(first.color === CardColor.Wild) {
        deck.unshift(first);
        deck = shuffle(deck); // Properly re-assign shuffled deck
        first = deck.pop()!;
      }

      const initialState: GameState = {
        deck,
        discardPile: [first],
        players: [
            { ...PLAYER_AMINE, hand: hand1, reaction: null, shout: null },
            { ...PLAYER_HASNAE, hand: hand2, reaction: null, shout: null }
        ],
        currentPlayerIndex: 0,
        direction: 1,
        status: GameStatus.TurnAction,
        winner: null,
        activeColor: first.color,
        log: "New Game Started!"
      };

      await createGameInFirebase(FIXED_ROOM_ID, initialState);
      return initialState;
  };

  const handleIdentitySelect = async (identity: 'Amine' | 'Hasnae') => {
      setLoading(true);
      setSelectedIdentity(identity);
      
      // Check if PIN exists in DB
      const dbPin = await getPlayerPin(identity);
      setStoredPin(dbPin);
      
      if (dbPin) {
          setLoginStep('ENTER_PIN');
      } else {
          setLoginStep('CREATE_PIN');
      }
      setPinInput("");
      setPinError("");
      setLoading(false);
  };

  const handlePinSubmit = async () => {
      if (pinInput.length !== 4) return;
      setLoading(true);

      if (loginStep === 'CREATE_PIN') {
          // Set new PIN
          await setPlayerPin(selectedIdentity!, pinInput);
          finalizeLogin();
      } else {
          // Validate PIN
          if (pinInput === storedPin) {
              finalizeLogin();
          } else {
              setPinError("Wrong PIN");
              setPinInput(""); // Clear for retry
              setLoading(false);
          }
      }
  };

  const finalizeLogin = async () => {
      const player = selectedIdentity === 'Amine' ? PLAYER_AMINE : PLAYER_HASNAE;
      
      // Mark online
      setPlayerOnline(selectedIdentity!);
      
      setMyPlayerId(player.id);
      
      // Check game existence
      const existingGame = await getGameSnapshot(FIXED_ROOM_ID);
      if (!existingGame) {
          await initializeRoom();
      }
      setLoading(false);
  };

  const handleLogout = () => {
      if (selectedIdentity) {
          setPlayerOffline(selectedIdentity);
      }
      setMyPlayerId(null);
      setSelectedIdentity(null);
      setLoginStep('SELECT');
      setPinInput("");
  };

  const handleResetGame = async (e?: React.MouseEvent) => {
      e?.preventDefault();
      const isFinished = gameState?.status === GameStatus.Finished;
      
      if (isFinished || window.confirm("Are you sure you want to start a new game?")) {
        try {
            await initializeRoom();
        } catch (err) {
            console.error("Failed to reset game:", err);
            alert("Could not restart game. Please check your connection.");
        }
      }
  };

  const sendReaction = async (emoji: string) => {
    if (!gameState || myPlayerId === null) return;
    
    const newState = { ...gameState };
    if (newState.players[myPlayerId]) {
        newState.players[myPlayerId].reaction = {
            emoji,
            timestamp: Date.now()
        };
    }
    await updateGameState(FIXED_ROOM_ID, newState);
    setShowEmojiPicker(false);

    // Auto clear after 4 seconds
    if (emojiTimeoutRef.current) clearTimeout(emojiTimeoutRef.current);
    emojiTimeoutRef.current = setTimeout(async () => {
        const freshState = await getGameSnapshot(FIXED_ROOM_ID);
        if (freshState && freshState.players[myPlayerId]) {
            freshState.players[myPlayerId].reaction = null;
            updateGameState(FIXED_ROOM_ID, freshState);
        }
    }, 4000);
  };

  const handleShout = async () => {
    if (!gameState || myPlayerId === null) return;

    const newState = { ...gameState };
    if (newState.players[myPlayerId]) {
        newState.players[myPlayerId].shout = {
            text: "wa L3EEB",
            timestamp: Date.now()
        };
    }
    await updateGameState(FIXED_ROOM_ID, newState);

    if (shoutTimeoutRef.current) clearTimeout(shoutTimeoutRef.current);
    shoutTimeoutRef.current = setTimeout(async () => {
        const freshState = await getGameSnapshot(FIXED_ROOM_ID);
        if (freshState && freshState.players[myPlayerId]) {
            freshState.players[myPlayerId].shout = null;
            updateGameState(FIXED_ROOM_ID, freshState);
        }
    }, 1000); // 1 second notice
  };

  // --- Syncing ---

  useEffect(() => {
    if (myPlayerId !== null) {
      const unsubscribe = subscribeToGame(FIXED_ROOM_ID, (data) => {
        setGameState(data);
      });
      return () => unsubscribe();
    }
  }, [myPlayerId]);


  // --- Game Actions ---

  const nextTurn = (state: GameState, skip = false, reverse = false) => {
    let dir = state.direction;
    if (reverse) dir *= -1;
    
    let nextIdx = state.currentPlayerIndex + (dir * (skip ? 2 : 1));
    const count = state.players.length;
    nextIdx = ((nextIdx % count) + count) % count;

    return {
      ...state,
      direction: dir as 1 | -1,
      currentPlayerIndex: nextIdx,
      status: GameStatus.TurnAction
    };
  };

  // Helper to safely draw cards, reshuffling if needed
  const drawCards = (state: GameState, count: number, playerIndex: number) => {
    const p = state.players[playerIndex];
    for (let i = 0; i < count; i++) {
        if (state.deck.length === 0) {
             if (state.discardPile.length > 1) {
                 const top = state.discardPile.pop()!;
                 state.deck = shuffle(state.discardPile);
                 state.discardPile = [top];
             } else {
                 // No cards left to draw at all
                 break; 
             }
        }
        if (state.deck.length > 0) {
            p.hand.push(state.deck.pop()!);
        }
    }
  };

  const handleDrawAction = () => {
    if (!gameState || gameState.currentPlayerIndex !== myPlayerId) return;

    // Create deep copy to allow safe mutation in helper
    let newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    
    // Check initial deck size
    const initialHandSize = newState.players[myPlayerId].hand.length;
    
    drawCards(newState, 1, myPlayerId);
    
    const myPlayer = newState.players[myPlayerId];
    
    // Check if we actually got a card
    if (myPlayer.hand.length === initialHandSize) {
        // Deck empty, discard empty (rare) - just pass turn?
        newState.log = "Deck empty, cannot draw!";
        newState = nextTurn(newState);
        updateGameState(FIXED_ROOM_ID, newState);
        return;
    }

    const drawnCard = myPlayer.hand[myPlayer.hand.length - 1];
    newState.log = `${myPlayer.name} drew a card`;

    // Discard pile safety
    newState.discardPile = newState.discardPile || [];
    const top = newState.discardPile[newState.discardPile.length - 1];

    if (top && isValidMove(drawnCard, top, newState.activeColor)) {
         newState.log = `${myPlayer.name} drew a playable card!`;
         newState = nextTurn(newState); 
    } else {
         newState = nextTurn(newState);
    }

    updateGameState(FIXED_ROOM_ID, newState);
  };

  const playCard = (card: Card, colorOverride?: CardColor) => {
    if (!gameState || gameState.currentPlayerIndex !== myPlayerId) return;

    let newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    // Firebase Safety
    newState.discardPile = newState.discardPile || [];
    newState.deck = newState.deck || [];
    
    const p = newState.players[myPlayerId!];
    p.hand = p.hand || [];
    
    // REMOVED PENALTY CHECK HERE

    p.hand = p.hand.filter((c: Card) => c.id !== card.id);

    // Win Check
    if (p.hand.length === 0) {
        const finishedState: GameState = {
            ...newState,
            deck: [], 
            discardPile: [],
            players: newState.players.map(pl => ({ ...pl, hand: [] })),
            winner: p,
            status: GameStatus.Finished,
            log: `${p.name} won the game!`
        };
        updateGameState(FIXED_ROOM_ID, finishedState);
        return;
    }

    newState.players[myPlayerId!] = p;
    newState.discardPile.push(card);
    newState.log = `${p.name} played ${card.value}`;

    // Auto-announce UNO
    if (p.hand.length === 1) {
        newState.log += " - UNO!";
    }
    
    let nextColor = card.color === CardColor.Wild ? (colorOverride || CardColor.Red) : card.color;
    newState.activeColor = nextColor;

    let skip = false;
    let drawTarget = 0;

    if (card.value === CardValue.Reverse) {
        if (newState.players.length === 2) skip = true;
        else newState.direction *= -1;
    } else if (card.value === CardValue.Skip) {
        skip = true;
    } else if (card.value === CardValue.DrawTwo) {
        drawTarget = 2;
        skip = true;
    } else if (card.value === CardValue.WildDrawFour) {
        drawTarget = 4;
        skip = true;
    }

    if (drawTarget > 0) {
         let nextIdx = newState.currentPlayerIndex + (newState.direction * 1);
         const count = newState.players.length;
         nextIdx = ((nextIdx % count) + count) % count;
         
         // Use helper for +2/+4 to ensure reshuffling works
         drawCards(newState, drawTarget, nextIdx);
         
         const victim = newState.players[nextIdx];
         newState.log += ` - ${victim.name} +${drawTarget}`;
    }

    setUnoCall(false);
    newState = nextTurn(newState, skip);
    updateGameState(FIXED_ROOM_ID, newState);
  };

  const onCardClick = (card: Card) => {
    if (!gameState || gameState.currentPlayerIndex !== myPlayerId) return;

    const discardPile = gameState.discardPile || [];
    const top = discardPile[discardPile.length - 1];
    
    if (top && isValidMove(card, top, gameState.activeColor)) {
      if (card.color === CardColor.Wild) {
        setPendingCard(card);
        setWildPickerOpen(true);
      } else {
        playCard(card);
      }
    }
  };


  // --- Render Functions ---

  const renderPinPad = () => {
    const handleNumClick = (num: number) => {
        if (pinInput.length < 4) {
            setPinInput(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        setPinInput(prev => prev.slice(0, -1));
        setPinError("");
    };

    return (
        <div className="flex flex-col items-center animate-fade-in w-full max-w-sm">
            <button onClick={() => setLoginStep('SELECT')} className="self-start mb-4 text-stone-500 hover:text-white flex items-center gap-1">
                <ChevronLeft size={20}/> Back
            </button>
            <h2 className="text-2xl font-bold mb-2">
                {loginStep === 'CREATE_PIN' ? `Set PIN for ${selectedIdentity}` : `Enter PIN for ${selectedIdentity}`}
            </h2>
            <p className="text-stone-500 mb-6 text-sm">
                {loginStep === 'CREATE_PIN' ? 'Memorize this! It will be required to log in.' : 'Enter your 4-digit security code.'}
            </p>

            {/* Dots Display */}
            <div className="flex gap-4 mb-8">
                {[0,1,2,3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pinInput.length ? 'bg-amber-400' : 'bg-stone-700'}`} />
                ))}
            </div>
            
            {pinError && <div className="text-rose-500 font-bold mb-4 animate-bounce">{pinError}</div>}

            {/* Custom Numpad */}
            <div className="grid grid-cols-3 gap-4 w-full">
                {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button 
                        key={num} 
                        onClick={() => handleNumClick(num)}
                        className="h-16 bg-stone-800 rounded-xl font-bold text-2xl hover:bg-stone-700 active:scale-95 transition-all shadow-lg"
                    >
                        {num}
                    </button>
                ))}
                <div className="h-16"></div>
                <button 
                    onClick={() => handleNumClick(0)}
                    className="h-16 bg-stone-800 rounded-xl font-bold text-2xl hover:bg-stone-700 active:scale-95 transition-all shadow-lg"
                >
                    0
                </button>
                <button 
                    onClick={handleBackspace}
                    className="h-16 bg-stone-800/50 text-stone-500 rounded-xl flex items-center justify-center hover:bg-stone-800 hover:text-white active:scale-95 transition-all"
                >
                    <Delete size={20} />
                </button>
            </div>

            <button 
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4 || loading}
                className="w-full mt-8 py-4 bg-stone-100 text-stone-900 rounded-xl font-bold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {loading ? 'Processing...' : loginStep === 'CREATE_PIN' ? 'SET PASSWORD' : 'LOGIN'}
            </button>
        </div>
    );
  };

  // 1. Selection Screen
  if (myPlayerId === null) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-900 text-stone-100 p-6 overflow-hidden">
        
        {/* Logo (only show on SELECT screen) */}
        {loginStep === 'SELECT' && (
            <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex gap-2 mb-4">
                    <div className="w-8 h-12 bg-rose-500 rounded-md rotate-[-15deg] shadow-lg shadow-rose-900/50"></div>
                    <div className="w-8 h-12 bg-blue-500 rounded-md rotate-[15deg] shadow-lg shadow-blue-900/50"></div>
                </div>
                <h1 className="text-5xl font-black tracking-tighter">UNO</h1>
                <p className="text-stone-500 font-medium tracking-widest text-xs mt-2 uppercase">Secure Login</p>
            </div>
        )}
        
        {loginStep === 'SELECT' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-md">
                <button 
                    onClick={() => handleIdentitySelect('Amine')}
                    disabled={loading || onlineUsers['Amine']}
                    className={`group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-800 p-8 rounded-2xl shadow-xl transition-all ${onlineUsers['Amine'] ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={48} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center">
                        <span className="text-3xl font-black mb-1">AMINE</span>
                        <span className="text-blue-200 text-sm font-bold tracking-widest">
                            {onlineUsers['Amine'] ? 'ONLINE' : 'PLAYER 1'}
                        </span>
                    </div>
                </button>

                <button 
                    onClick={() => handleIdentitySelect('Hasnae')}
                    disabled={loading || onlineUsers['Hasnae']}
                    className={`group relative overflow-hidden bg-gradient-to-br from-rose-500 to-pink-700 p-8 rounded-2xl shadow-xl transition-all ${onlineUsers['Hasnae'] ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105'}`}
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Heart size={48} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center">
                        <span className="text-3xl font-black mb-1">HASNAE</span>
                        <span className="text-rose-200 text-sm font-bold tracking-widest">
                             {onlineUsers['Hasnae'] ? 'ONLINE' : 'PLAYER 2'}
                        </span>
                    </div>
                </button>
            </div>
        ) : (
            renderPinPad()
        )}
        
      </div>
    );
  }

  if (!gameState) {
      return <div className="h-screen flex items-center justify-center text-stone-500 bg-stone-900">Connecting to secure room...</div>;
  }

  // 2. Game Finished
  if (gameState.status === GameStatus.Finished) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-stone-900 text-stone-100 relative overflow-hidden">
        <Confetti />
        <div className="relative z-10 flex flex-col items-center">
            <Trophy size={64} className="text-amber-400 mb-6 animate-bounce" />
            <h1 className="text-5xl font-black mb-4 tracking-tight">{gameState.winner?.name} Wins!</h1>
            <div className="flex gap-4 mt-8">
                <button 
                onClick={handleResetGame}
                className="px-8 py-4 bg-stone-100 text-stone-900 rounded-xl font-bold hover:bg-white hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                >
                <RefreshCw size={20}/>
                New Game
                </button>
            </div>
        </div>
      </div>
    );
  }

  // 3. Playing
  const me = gameState.players[myPlayerId];
  const myHand = me?.hand || [];
  const opponent = gameState.players.find(p => p.id !== myPlayerId);
  const opponentHand = opponent?.hand || [];
  const isMyTurn = gameState.currentPlayerIndex === myPlayerId;
  const discardPile = gameState.discardPile || [];
  const topCard = discardPile[discardPile.length - 1];

  // Calculate hand overlapping
  const cardOverlapAmount = myHand.length > 12 ? '-2.5rem' : myHand.length > 7 ? '-2rem' : '-1rem';

  return (
    <div className="h-screen w-full flex flex-col bg-stone-950 text-stone-100 relative overflow-hidden">
      
      {/* SHOUT OVERLAY */}
      {gameState.players.map(p => p.shout ? (
        <div key={p.id} className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
             <div className="bg-red-600/90 text-white font-black text-4xl px-8 py-4 rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.8)] rotate-[-5deg] animate-bounce">
                 {p.shout.text}
             </div>
        </div>
      ) : null)}

      {/* Top Bar */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-stone-800 bg-stone-900 z-10">
        <div className="flex items-center gap-3">
             <button onClick={handleLogout} className="text-xs font-bold text-stone-600 hover:text-stone-400 flex items-center gap-1">
                <ChevronLeft size={14} /> EXIT
             </button>
             <button onClick={handleResetGame} className="text-xs font-bold text-stone-500 hover:text-stone-300 flex items-center gap-1 border border-stone-700 px-2 py-1 rounded hover:bg-stone-800">
                <RefreshCw size={12} /> RESTART
             </button>
             <div className="h-4 w-px bg-stone-700 mx-2"></div>
             <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500 ${
                gameState.activeColor === CardColor.Red ? 'bg-rose-500 text-rose-500' :
                gameState.activeColor === CardColor.Blue ? 'bg-blue-500 text-blue-500' :
                gameState.activeColor === CardColor.Green ? 'bg-emerald-500 text-emerald-500' :
                gameState.activeColor === CardColor.Yellow ? 'bg-amber-400 text-amber-400' : 'bg-stone-500 text-stone-500'
            }`} />
        </div>
        
        <div className="flex items-center gap-2">
            <div className="relative">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">{opponent?.name}</span>
                {/* Opponent Reaction Bubble */}
                {opponent?.reaction && (
                     <div className="absolute -left-12 -top-2 text-4xl animate-bounce drop-shadow-lg z-50">
                        {opponent.reaction.emoji}
                     </div>
                )}
            </div>
            
            <div className="flex -space-x-2">
                {Array.from({length: Math.min(opponentHand.length, 5)}).map((_,i) => (
                    <div key={i} className="w-5 h-7 bg-stone-700 rounded-sm border border-stone-600 shadow-sm"></div>
                ))}
                {(opponentHand.length) > 5 && <span className="text-xs ml-3 text-stone-500 font-bold">+{opponentHand.length - 5}</span>}
            </div>
        </div>
      </div>

      {/* Board */}
      <div className={`flex-1 flex flex-col items-center justify-center relative transition-colors duration-1000
         ${isMyTurn ? 'bg-gradient-to-b from-stone-900 to-stone-900' : 'bg-stone-950 opacity-90'}
      `}>
        
        {/* Game Log Message - Moved Here */}
        <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500 z-20">
             <span className="text-xs font-bold text-stone-400 uppercase tracking-widest bg-stone-900/50 px-6 py-2 rounded-full border border-stone-800/50 backdrop-blur-sm shadow-xl">
                 {gameState.log}
             </span>
        </div>

        <div className="flex items-center gap-12 scale-110 mb-8">
            {/* Draw Pile */}
            <div onClick={handleDrawAction} className={`cursor-pointer group relative ${!isMyTurn ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Stack effect */}
                <div className="absolute top-1 left-1 w-24 h-36 bg-stone-800 rounded-lg border-2 border-stone-700"></div>
                <div className="absolute top-2 left-2 w-24 h-36 bg-stone-800 rounded-lg border-2 border-stone-700"></div>
                <CardComponent isHidden className="relative z-10 group-hover:-translate-y-2 transition-transform shadow-2xl" />
                <div className="mt-4 text-center text-[10px] font-black tracking-widest text-stone-600 group-hover:text-stone-400">DRAW</div>
            </div>

            {/* Discard Pile */}
            <div className="relative">
                 {/* Color Indicator Badge for Wild Cards */}
                 {topCard?.color === CardColor.Wild && (
                    <div className={`
                        absolute -top-10 left-1/2 -translate-x-1/2 z-20
                        px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-xl border 
                        animate-in fade-in zoom-in duration-300 whitespace-nowrap
                        ${gameState.activeColor === CardColor.Red ? 'bg-rose-600 border-rose-400 text-white shadow-rose-900/50' : ''}
                        ${gameState.activeColor === CardColor.Blue ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50' : ''}
                        ${gameState.activeColor === CardColor.Green ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/50' : ''}
                        ${gameState.activeColor === CardColor.Yellow ? 'bg-amber-400 border-amber-200 text-black shadow-amber-900/50' : ''}
                    `}>
                        {gameState.activeColor}
                    </div>
                 )}

                 {/* Previous card ghost */}
                {discardPile.length > 1 && (
                    <div className="absolute top-0 left-0 rotate-[-6deg] opacity-40 scale-95">
                        <CardComponent card={discardPile[discardPile.length-2]} />
                    </div>
                )}
                {topCard ? (
                  <div className="rotate-3 transition-transform hover:rotate-0 duration-300">
                      <CardComponent card={topCard} className="shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]" />
                  </div>
                ) : (
                  <div className="w-24 h-36 bg-stone-800/50 rounded-lg border-2 border-stone-700 border-dashed flex items-center justify-center">
                    <span className="text-xs text-stone-600 font-bold">EMPTY</span>
                  </div>
                )}
                
                <div className="mt-4 text-center text-[10px] font-black tracking-widest text-stone-500">
                    {topCard?.color === CardColor.Wild ? (
                         <span className={`transition-colors duration-300
                            ${gameState.activeColor === CardColor.Red ? 'text-rose-500' : ''}
                            ${gameState.activeColor === CardColor.Blue ? 'text-blue-500' : ''}
                            ${gameState.activeColor === CardColor.Green ? 'text-emerald-500' : ''}
                            ${gameState.activeColor === CardColor.Yellow ? 'text-amber-400' : ''}
                        `}>
                            {gameState.activeColor}
                        </span>
                    ) : (topCard ? topCard.color : '-')}
                </div>
            </div>
        </div>
        
        {/* Turn Indicator */}
        <div className={`
            px-8 py-3 rounded-full font-black text-sm tracking-[0.2em] transition-all transform duration-300
            ${isMyTurn 
                ? 'bg-stone-100 text-stone-900 scale-110 shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
                : 'bg-stone-900 text-stone-600 border border-stone-800'}
        `}>
            {isMyTurn ? "YOUR TURN" : `${opponent?.name.toUpperCase()}'S TURN`}
        </div>
      </div>

      {/* My Hand Area */}
      <div className={`
        relative bg-stone-900 border-t border-stone-800 pt-6 pb-8 transition-all duration-300
        ${!isMyTurn ? 'bg-stone-950' : 'shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'}
      `}>
        {/* Actions Bar */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
             {unoCall && <div className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-bounce">UNO CALLED!</div>}
        </div>

        <div className="flex justify-between items-end mb-4 px-6 relative z-20">
             <div className="flex items-center gap-3">
                 <div className="text-xl font-bold text-stone-200">Your Hand</div>
                 
                 {/* Reaction Button - Always Enabled */}
                 <div className="relative">
                    <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-yellow-400 transition-colors"
                    >
                        <Smile size={20} />
                    </button>
                    {/* My Reaction Display */}
                    {me?.reaction && (
                        <div className="absolute left-10 bottom-0 text-3xl animate-bounce drop-shadow-md z-50">
                            {me.reaction.emoji}
                        </div>
                    )}
                    {/* Picker */}
                    {showEmojiPicker && (
                        <div className="absolute bottom-12 left-0 bg-stone-800 border border-stone-700 p-2 rounded-xl shadow-2xl grid grid-cols-4 gap-2 z-50 w-48">
                            {EMOJIS.map(emoji => (
                                <button 
                                    key={emoji}
                                    onClick={() => sendReaction(emoji)}
                                    className="text-2xl hover:bg-stone-700 p-2 rounded-lg hover:scale-125 transition-transform"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                 </div>

                 {/* Shout Button - Always Enabled - SMALLER NOW */}
                 <button 
                    onClick={handleShout}
                    className="p-1.5 rounded-full bg-stone-800 hover:bg-red-900/50 text-stone-400 hover:text-red-500 transition-colors"
                    title="wa L3EEB!"
                 >
                     <Megaphone size={16} />
                 </button>
             </div>

             <button 
                onClick={() => setUnoCall(!unoCall)}
                disabled={!isMyTurn}
                className={`px-4 py-2 rounded-lg font-bold text-xs tracking-wider transition-all border-2 ${
                    unoCall 
                    ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-900/50' 
                    : !isMyTurn 
                        ? 'bg-stone-800 border-stone-800 text-stone-600 opacity-50 cursor-not-allowed'
                        : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-rose-500 hover:text-rose-500'
                }`}
             >
                 CALL UNO
             </button>
        </div>

        {/* Cards Scroll Container - Disabled if not my turn */}
        <div className={`flex overflow-x-auto pb-8 px-6 no-scrollbar touch-pan-x min-h-[160px] ${!isMyTurn ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div 
                className="flex mx-auto transition-all duration-300 items-end" 
                style={{ 
                    // Dynamic margin logic inside map for overlapping
                    paddingLeft: myHand.length > 5 ? '2rem' : '0',
                    paddingRight: myHand.length > 5 ? '2rem' : '0'
                }}
            >
                {myHand.map((card, index) => {
                    const playable = isMyTurn && topCard && isValidMove(card, topCard, gameState.activeColor);
                    return (
                        <div 
                            key={card.id} 
                            style={{ 
                                marginLeft: index === 0 ? 0 : cardOverlapAmount,
                                zIndex: index
                            }}
                            className={`
                                relative transition-all duration-200 origin-bottom flex-shrink-0
                                ${playable ? 'hover:-translate-y-8 hover:z-50' : 'hover:-translate-y-4 hover:z-50 opacity-90'}
                            `}
                        >
                            <CardComponent 
                                card={card} 
                                isPlayable={!!playable} 
                                onClick={() => onCardClick(card)} 
                                className="shadow-2xl"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Wild Color Picker Modal */}
      {wildPickerOpen && (
        <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <h2 className="text-3xl font-black mb-12 text-stone-200 tracking-tighter">SELECT COLOR</h2>
           <div className="grid grid-cols-2 gap-6 p-4">
               <button onClick={() => { playCard(pendingCard!, CardColor.Red); setWildPickerOpen(false); }} className="w-32 h-32 bg-rose-500 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(244,63,94,0.3)] ring-4 ring-transparent hover:ring-rose-400/50 border-4 border-rose-600" />
               <button onClick={() => { playCard(pendingCard!, CardColor.Blue); setWildPickerOpen(false); }} className="w-32 h-32 bg-blue-500 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(59,130,246,0.3)] ring-4 ring-transparent hover:ring-blue-400/50 border-4 border-blue-600" />
               <button onClick={() => { playCard(pendingCard!, CardColor.Green); setWildPickerOpen(false); }} className="w-32 h-32 bg-emerald-500 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(16,185,129,0.3)] ring-4 ring-transparent hover:ring-emerald-400/50 border-4 border-emerald-600" />
               <button onClick={() => { playCard(pendingCard!, CardColor.Yellow); setWildPickerOpen(false); }} className="w-32 h-32 bg-amber-400 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_40px_rgba(251,191,36,0.3)] ring-4 ring-transparent hover:ring-amber-200/50 border-4 border-amber-500" />
           </div>
           <button onClick={() => setWildPickerOpen(false)} className="mt-8 text-stone-500 font-bold hover:text-white">CANCEL</button>
        </div>
      )}

    </div>
  );
}