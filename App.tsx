
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
    getGameSnapshot
} from './services/firebase';
import UnoGame from './components/UnoGame';
import ChessGame from './components/ChessGame';
import { Users, Heart, ChevronLeft, Delete, Spade, Sparkles } from 'lucide-react';

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

  // --- Initialization & Presence ---

  useEffect(() => {
    const unsub = subscribeToPresence((data) => {
        setOnlineUsers(data || {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
      if (myPlayerId !== null) {
          const unsub = subscribeToGameType((type) => {
              setActiveGame(type);
          });
          return () => unsub();
      }
  }, [myPlayerId]);

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
      }
      setMyPlayerId(null);
      setSelectedIdentity(null);
      setLoginStep('SELECT');
      setPinInput("");
  };

  const handleExitGame = async () => {
      await setGameType(null);
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
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-stone-100 p-6">
            <div className="absolute top-4 left-4">
                 <button onClick={handleLogout} className="text-xs font-bold text-stone-600 hover:text-stone-400 flex items-center gap-1">
                    <ChevronLeft size={14} /> LOGOUT
                 </button>
            </div>
            
            <h1 className="text-4xl font-black mb-12 tracking-tighter">SELECT GAME</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                 <button 
                    onClick={() => setGameType('UNO')}
                    className="group relative h-80 bg-stone-900 border-2 border-stone-800 rounded-3xl hover:border-amber-400/50 hover:bg-stone-800 transition-all flex flex-col items-center justify-center gap-6 overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <div className="flex gap-2 rotate-[-5deg] group-hover:scale-110 transition-transform duration-500">
                         <div className="w-12 h-16 bg-rose-500 rounded-lg shadow-lg"></div>
                         <div className="w-12 h-16 bg-blue-500 rounded-lg shadow-lg"></div>
                     </div>
                     <span className="text-3xl font-black tracking-widest relative z-10">UNO</span>
                 </button>

                 <button 
                    onClick={() => setGameType('CHESS')}
                    className="group relative h-80 bg-stone-900 border-2 border-stone-800 rounded-3xl hover:border-emerald-400/50 hover:bg-stone-800 transition-all flex flex-col items-center justify-center gap-6 overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-gradient-to-br from-stone-700/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <div className="flex gap-4 group-hover:scale-110 transition-transform duration-500 text-stone-400 group-hover:text-stone-200">
                         <Spade size={48} />
                     </div>
                     <span className="text-3xl font-black tracking-widest relative z-10">CHESS</span>
                 </button>
            </div>
            
            <div className="mt-12 text-center text-stone-500 text-sm max-w-xs animate-pulse">
                Waiting for both players to join the same lobby...
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
