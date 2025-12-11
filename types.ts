
export enum CardColor {
  Red = 'RED',
  Blue = 'BLUE',
  Green = 'GREEN',
  Yellow = 'YELLOW',
  Wild = 'WILD'
}

export enum CardValue {
  Zero = '0',
  One = '1',
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Skip = 'SKIP',
  Reverse = 'REVERSE',
  DrawTwo = 'DRAW_TWO',
  Wild = 'WILD',
  WildDrawFour = 'WILD_DRAW_FOUR'
}

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  reaction?: { emoji: string, timestamp: number } | null;
  shout?: { text: string, timestamp: number } | null;
}

export enum GameStatus {
  Setup = 'SETUP',
  TurnStart = 'TURN_START',
  TurnAction = 'TURN_ACTION',
  Finished = 'FINISHED'
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  status: GameStatus;
  winner: Player | null;
  activeColor: CardColor;
  log: string;
}

// --- Chess Types ---

export type GameType = 'UNO' | 'CHESS' | null;

export interface ChessPiece {
  type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k'; // pawn, rook, knight, bishop, queen, king
  color: 'w' | 'b'; // white, black
  hasMoved?: boolean;
}

export interface ChessGameState {
  board: (ChessPiece | null)[][];
  turn: 'w' | 'b';
  winner: 'w' | 'b' | 'draw' | null;
  lastMove: { 
    from: {r: number, c: number}, 
    to: {r: number, c: number},
    piece: ChessPiece 
  } | null;
  inCheck?: boolean;
  log: string;
}
