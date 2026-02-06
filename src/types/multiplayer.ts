
import type { ScryfallCard } from './index';

export interface MultiPlayer {
    id: string;
    name: string;
    hasPicked: boolean;
    pickedCards?: ScryfallCard[];
}

export interface MultiplayerDraftState {
    hand: ScryfallCard[];
    packNumber: number;
    pickNumber: number;
    waitingFor: string[];
}
