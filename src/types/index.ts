// Scryfall API Types

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  released_at: string;
  set_type: string;
  card_count: number;
  icon_svg_uri: string;
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';
  type_line: string;
  mana_cost?: string;
  cmc: number;
  colors?: string[];
  color_identity: string[];
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    colors?: string[]; // Added colors
    type_line?: string;
    mana_cost?: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      png: string;
      art_crop: string;
      border_crop: string;
    };
  }>;
  finishes: string[];
  booster: boolean;
  released_at?: string;

  // Special card indicators
  frame_effects?: string[];  // 'showcase', 'extendedart', 'borderless', 'inverted', etc.
  full_art?: boolean;
  border_color?: string;     // 'black', 'borderless', 'gold', 'silver'
  promo?: boolean;
  textless?: boolean;
  layout?: string;          // 'normal', 'token', 'art_series', etc.
  frame?: string;           // '2015', 'showcase', 'extendedart'
  promo_types?: string[];   // 'boosterfun', 'buyabox', etc.

  // Internal flags (added by our app)
  _isFoil?: boolean;
  _isFromList?: boolean;
}

export interface ScryfallListResponse<T> {
  object: 'list';
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: T[];
}

// App Types

export type BoosterType = 'play' | 'draft' | 'set';

export interface CardPool {
  commons: ScryfallCard[];
  uncommons: ScryfallCard[];
  rares: ScryfallCard[];
  mythics: ScryfallCard[];
  basicLands: ScryfallCard[];
  all: ScryfallCard[];
  variants?: ScryfallCard[]; // Alt-art/Showcase cards (Booster Fun)
  foilOnly?: ScryfallCard[]; // Cards that only exist in foil (different collector numbers)
}

export interface Booster {
  cards: ScryfallCard[];
  setCode: string;
  boosterType: BoosterType;
}

export interface DraftState {
  packNumber: number;        // 1-3 typically
  pickNumber: number;        // 1-14/15 depending on pack size
  currentPack: ScryfallCard[];
  pickedCards: ScryfallCard[];
  passingPacks: ScryfallCard[][];  // Packs waiting to be passed
  isComplete: boolean;
}

export type DraftMode = 'draft' | 'sealed' | 'multiplayer';

export interface DraftSettings {
  setCode: string;
  setName: string;
  boosterType: BoosterType;
  numberOfPacks: number;
  numberOfPlayers: number;  // Including bots (only used in draft mode)
  pickTimeSeconds: number;
  draftMode: DraftMode;     // 'draft' for regular, 'sealed' for Box Brawl, 'multiplayer' for online
}

export interface DeckCard extends ScryfallCard {
  quantity: number;
  isInMaindeck: boolean;
}

export interface Deck {
  maindeck: DeckCard[];
  sideboard: DeckCard[];
}

// Bot Types

export interface BotPlayer {
  id: string;
  name: string;
  colorPreferences: string[];  // Preferred colors based on early picks
  pickedCards: ScryfallCard[];
}


