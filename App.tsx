
import React, { useState, useEffect } from 'react';
import { GameType } from './types';
import { 
    setPlayerPin, 
    setPlayerOnline, 
    setPlayerOffline, 
    subscribeToPresence,
    getPlayerPin,
    setGameType,
    subscribeToGameType,
    FIXED_ROOM_ID,
    getGameSnapshot,
    setPlayerSelection,
    subscribeToSelections,
    resetSelections
} from './services/firebase';
import UnoGame from './components/UnoGame';
import ChessGame from './components/ChessGame';
import { Users, Heart, ChevronLeft, Delete, Spade, Sparkles, Check, Loader2 } from 'lucide-react';

const PLAYER_AMINE = { id: 0, name: "Amine" };
const PLAYER_HASNAE = { id: 1, name: "Hasnae" };

type LoginStep = 'SELECT' | 'CREATE_PIN' | 'ENTER_PIN';

export default function App() {
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  
  // Auth State
  const [loginStep, setLoginStep] = useState<LoginStep>('SELECT');
  const [selectedIdentity, setSelectedIdentity] = useState<'Amine' | 'Hasnae' | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Game Lobby State
  const [activeGame, setActiveGame] = useState<GameType>(null);
  const [selections, setSelections] = useState<Record<string, GameType>>({});

  // --- Initialization & Presence ---

  useEffect(() => {
    const unsub = subscribeToPresence((data) => {
        setOnlineUsers(data || {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
      if (myPlayerId !== null) {
          const unsubGame = subscribeToGameType((type) => {
              setActiveGame(type);
          });
          const unsubSel = subscribeToSelections((data) => {
              setSelections(data || {});
          });
          return () => {
              unsubGame();
              unsubSel();
          };
      }
  }, [myPlayerId]);

  // Sync Logic: Start game if both players selected the same thing
  useEffect(() => {
    if (activeGame) return; // Already started
    
    const amineSel = selections['Amine'];
    const hasnaeSel = selections['Hasnae'];

    if (amineSel && hasnaeSel && amineSel === hasnaeSel) {
        // Both match, start the game
        setGameType(amineSel);
    }
  }, [selections, activeGame]);


  const handleIdentitySelect = async (identity: 'Amine' | 'Hasnae') => {
      setLoading(true);
      setSelectedIdentity(identity);
      
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
          await setPlayerPin(selectedIdentity!, pinInput);
          finalizeLogin();
      } else {
          if (pinInput === storedPin) {
              finalizeLogin();
          } else {
              setPinError("Wrong PIN");
              setPinInput(""); 
              setLoading(false);
          }
      }
  };

  const finalizeLogin = async () => {
      const player = selectedIdentity === 'Amine' ? PLAYER_AMINE : PLAYER_HASNAE;
      setPlayerOnline(selectedIdentity!);
      setMyPlayerId(player.id);
      setLoading(false);
  };

  const handleLogout = () => {
      if (selectedIdentity) {
          setPlayerOffline(selectedIdentity);
          setPlayerSelection(selectedIdentity, null);
      }
      setMyPlayerId(null);
      setSelectedIdentity(null);
      setLoginStep('SELECT');
      setPinInput("");
  };

  const handleExitGame = async () => {
      await setGameType(null);
      await resetSelections();
  };

  const handleGameSelect = (game: GameType) => {
      if (!selectedIdentity) return;
      // Toggle selection or set new one
      const current = selections[selectedIdentity];
      const newSelection = current === game ? null : game;
      setPlayerSelection(selectedIdentity, newSelection);
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

            <div className="flex gap-4 mb-8">
                {[0,1,2,3].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pinInput.length ? 'bg-amber-400' : 'bg-stone-700'}`} />
                ))}
            </div>
            
            {pinError && <div className="text-rose-500 font-bold mb-4 animate-bounce">{pinError}</div>}

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
        
        {loginStep === 'SELECT' && (
            <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-5xl font-black tracking-tighter mb-2">GAME HUB</h1>
                <p className="text-stone-500 font-medium tracking-widest text-xs uppercase">Secure Login</p>
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

  // 2. Game Selection Lobby
  if (!activeGame) {
      const opponentName = selectedIdentity === 'Amine' ? 'Hasnae' : 'Amine';
      
      const mySelection = selections[selectedIdentity!];
      const opponentSelection = selections[opponentName];

      const renderCard = (game: GameType, label: string, color: string, Icon: any, gradient: string) => {
          const isMySelection = mySelection === game;
          const isOpponentSelection = opponentSelection === game;
          const isBoth = isMySelection && isOpponentSelection;

          return (
             <button 
                onClick={() => handleGameSelect(game)}
                className={`
                    group relative h-80 bg-stone-900 border-2 rounded-3xl transition-all flex flex-col items-center justify-center gap-6 overflow-hidden shadow-2xl
                    ${isMySelection ? `border-${color}-500 bg-stone-800 scale-105 z-10 ring-4 ring-${color}-500/20` : 'border-stone-800 hover:bg-stone-800 hover:border-stone-700'}
                `}
             >
                 {/* Background Glow */}
                 <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 ${isMySelection ? 'opacity-10' : 'group-hover:opacity-10'} transition-opacity`}></div>
                 
                 {/* Opponent Selection Indicator */}
                 {isOpponentSelection && (
                     <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-300">
                         <div className={`
                             flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg border border-stone-700
                             ${opponentName === 'Amine' ? 'bg-indigo-900/90 text-indigo-100' : 'bg-rose-900/90 text-rose-100'}
                         `}>
                             <div className={`w-2 h-2 rounded-full animate-pulse ${opponentName === 'Amine' ? 'bg-indigo-400' : 'bg-rose-400'}`} />
                             <span className="text-[10px] font-bold tracking-wider uppercase">{opponentName}</span>
                         </div>
                     </div>
                 )}

                 {/* Icon */}
                 <div className={`
                     flex gap-2 transition-transform duration-500
                     ${isMySelection ? 'scale-110' : 'group-hover:scale-110'}
                     ${game === 'UNO' ? 'rotate-[-5deg]' : ''}
                 `}>
                     {game === 'UNO' ? (
                         <>
                            <div className="w-12 h-16 bg-rose-500 rounded-lg shadow-lg"></div>
                            <div className="w-12 h-16 bg-blue-500 rounded-lg shadow-lg"></div>
                         </>
                     ) : (
                         <Icon size={48} className={isMySelection ? `text-${color}-400` : 'text-stone-500 group-hover:text-stone-300'} />
                     )}
                 </div>
                 
                 {/* Text Status */}
                 <div className="relative z-10 flex flex-col items-center">
                     <span className={`text-3xl font-black tracking-widest ${isMySelection ? 'text-white' : 'text-stone-400 group-hover:text-stone-200'}`}>
                         {label}
                     </span>
                     
                     <div className="h-6 mt-2">
                         {isBoth ? (
                             <span className={`text-xs font-bold text-${color}-400 flex items-center gap-1 animate-pulse`}>
                                 <Loader2 size={12} className="animate-spin" /> STARTING...
                             </span>
                         ) : isMySelection ? (
                             <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase animate-pulse">
                                 WAITING FOR {opponentName}...
                             </span>
                         ) : isOpponentSelection ? (
                             <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase">
                                 OPPONENT READY
                             </span>
                         ) : null}
                     </div>
                 </div>

                 {/* Selection Overlay */}
                 {isMySelection && (
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-stone-100/20">
                         <div className={`h-full bg-${color}-500 animate-[loading_2s_ease-in-out_infinite] w-full origin-left`}></div>
                     </div>
                 )}
             </button>
          );
      };

      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-stone-100 p-6">
            <div className="absolute top-4 left-4">
                 <button onClick={handleLogout} className="text-xs font-bold text-stone-600 hover:text-stone-400 flex items-center gap-1">
                    <ChevronLeft size={14} /> LOGOUT
                 </button>
            </div>
            
            <h1 className="text-4xl font-black mb-12 tracking-tighter">SELECT GAME</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                 {renderCard('UNO', 'UNO', 'amber', null, 'from-rose-500/10 to-blue-500/10')}
                 {renderCard('CHESS', 'CHESS', 'emerald', Spade, 'from-stone-700/10 to-white/5')}
            </div>
            
            <div className="mt-12 text-center text-stone-500 text-sm max-w-xs h-10 flex items-center justify-center">
                {mySelection && !opponentSelection && (
                    <span className="animate-pulse">Waiting for {opponentName} to join...</span>
                )}
                {!mySelection && opponentSelection && (
                    <span className="text-stone-400 font-bold">{opponentName} is waiting for you in {opponentSelection}!</span>
                )}
                {mySelection && opponentSelection && mySelection !== opponentSelection && (
                    <span className="text-amber-500 font-bold">You selected different games!</span>
                )}
            </div>
        </div>
      );
  }

  // 3. Render Selected Game
  if (activeGame === 'UNO') {
      return <UnoGame myPlayerId={myPlayerId} onExit={handleExitGame} />;
  }

  if (activeGame === 'CHESS') {
      return <ChessGame myPlayerId={myPlayerId} onExit={handleExitGame} />;
  }

  return <div>Loading...</div>;
}
