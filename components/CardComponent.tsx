import React from 'react';
import { Card, CardColor, CardValue } from '../types';
import { Ban, RefreshCw, Plus, Sparkles } from 'lucide-react';

interface CardProps {
  card?: Card;
  onClick?: () => void;
  isHidden?: boolean;
  isPlayable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CardComponent: React.FC<CardProps> = ({ card, onClick, isHidden, isPlayable, className, style }) => {
  if (isHidden || !card) {
    return (
      <div 
        className={`w-24 h-36 rounded-xl border-2 border-stone-700 flex items-center justify-center shadow-2xl bg-stone-800 relative overflow-hidden ${className}`}
        style={style}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-700 to-stone-900 opacity-50"></div>
        <div className="w-16 h-24 rounded-full border-4 border-stone-700 rotate-12 flex items-center justify-center bg-stone-800 z-10">
            <span className="font-black text-stone-600 tracking-widest text-xl -rotate-12 select-none">UNO</span>
        </div>
      </div>
    );
  }

  const isWild = card.color === CardColor.Wild;
  const isAction = [CardValue.Skip, CardValue.Reverse, CardValue.DrawTwo].includes(card.value);

  const getColorStyles = (c: CardColor) => {
    switch(c) {
      case CardColor.Red: return 'bg-gradient-to-br from-rose-500 to-red-700 text-white border-rose-800';
      case CardColor.Blue: return 'bg-gradient-to-br from-blue-500 to-blue-700 text-white border-blue-800';
      case CardColor.Green: return 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-800';
      case CardColor.Yellow: return 'bg-gradient-to-br from-amber-300 to-amber-500 text-black border-amber-600';
      case CardColor.Wild: return 'bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-rose-500 via-amber-400 via-emerald-500 via-blue-500 to-rose-500 text-white border-stone-800';
      default: return 'bg-stone-700';
    }
  };

  const renderContent = () => {
    switch(card.value) {
      case CardValue.Skip: return <Ban size={32} strokeWidth={3} className="drop-shadow-md" />;
      case CardValue.Reverse: return <RefreshCw size={32} strokeWidth={3} className="drop-shadow-md" />;
      case CardValue.DrawTwo: return (
        <div className="flex items-center font-black text-4xl drop-shadow-md">
            <Plus size={24} strokeWidth={4}/>2
        </div>
      );
      case CardValue.WildDrawFour: return (
        <div className="flex flex-col items-center drop-shadow-md">
            <div className="flex items-center font-black text-4xl relative z-10">
                <Plus size={24} strokeWidth={4}/>4
            </div>
            <div className="flex gap-0.5 mt-1">
                <div className="w-2 h-3 bg-rose-500 rounded-sm"></div>
                <div className="w-2 h-3 bg-blue-500 rounded-sm"></div>
                <div className="w-2 h-3 bg-emerald-500 rounded-sm"></div>
                <div className="w-2 h-3 bg-amber-400 rounded-sm"></div>
            </div>
        </div>
      );
      case CardValue.Wild: return (
        <div className="flex flex-col items-center">
             <Sparkles size={32} className="mb-1 drop-shadow-md" />
             <span className="font-black tracking-widest text-sm uppercase">Wild</span>
        </div>
      );
      default: return <span className="text-5xl font-black drop-shadow-md select-none">{card.value}</span>;
    }
  };

  const cornerValue = () => {
      if (card.value === CardValue.Wild || card.value === CardValue.WildDrawFour) return 'W';
      if (card.value === CardValue.DrawTwo) return '+2';
      if (card.value === CardValue.Skip) return 'Ø';
      if (card.value === CardValue.Reverse) return '⇄';
      return card.value;
  };

  return (
    <div 
      onClick={isPlayable ? onClick : undefined}
      style={style}
      className={`
        relative w-24 h-36 rounded-xl border-b-[6px] border-r-2 border-l-2 border-t-2 flex items-center justify-center shadow-lg transition-all duration-200
        ${getColorStyles(card.color)}
        ${isPlayable ? 'cursor-pointer hover:-translate-y-6 hover:scale-110 hover:brightness-110 z-0 hover:z-50' : ''}
        ${!isPlayable && !isHidden ? 'opacity-100' : ''}
        ${className}
      `}
    >
       {/* Background Pattern for Action Cards */}
       {isAction && !isWild && (
         <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent"></div>
       )}

      {/* Top Left Corner */}
      <div className="absolute top-1.5 left-2 text-sm font-black opacity-90 drop-shadow-sm">
        {cornerValue()}
      </div>
      
      {/* Center Content */}
      <div className={`${card.color === CardColor.Yellow && !isWild ? 'text-black' : 'text-white'}`}>
        {renderContent()}
      </div>

       {/* Bottom Right Corner */}
       <div className="absolute bottom-1.5 right-2 text-sm font-black opacity-90 rotate-180 drop-shadow-sm">
        {cornerValue()}
      </div>
    </div>
  );
};

export default CardComponent;