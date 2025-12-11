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
  TurnStart = 'TURN_START', // Interstitial screen (Pass device)
  TurnAction = 'TURN_ACTION', // Player is playing
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