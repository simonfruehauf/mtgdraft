import type { ScryfallCard } from '../types';

export type ColorGroup = 'White' | 'Blue' | 'Black' | 'Red' | 'Green' | 'Multicolor' | 'Colorless' | 'Land';

export const COLOR_ORDER: ColorGroup[] = [
    'White',
    'Blue',
    'Black',
    'Red',
    'Green',
    'Multicolor',
    'Colorless',
    'Land'
];

export function getCardColorGroup(card: ScryfallCard): ColorGroup {
    if (card.type_line && card.type_line.includes('Land')) {
        return 'Land';
    }

    // Handle transform/MDFC cards that might not have top-level colors
    const colors = (card.colors && card.colors.length > 0)
        ? card.colors
        : (card.card_faces?.[0]?.colors || []);

    if (colors.length === 0) {
        return 'Colorless';
    }
    if (colors.length > 1) {
        return 'Multicolor';
    }
    if (colors.includes('W')) return 'White';
    if (colors.includes('U')) return 'Blue';
    if (colors.includes('B')) return 'Black';
    if (colors.includes('R')) return 'Red';
    if (colors.includes('G')) return 'Green';

    return 'Colorless';
}

export function sortCards(cards: ScryfallCard[]): ScryfallCard[] {
    // Sort by Group -> Name
    return [...cards].sort((a, b) => {
        const groupA = getCardColorGroup(a);
        const groupB = getCardColorGroup(b);

        if (groupA !== groupB) {
            return COLOR_ORDER.indexOf(groupA) - COLOR_ORDER.indexOf(groupB);
        }

        return a.name.localeCompare(b.name);
    });
}

export function groupCardsByColor(cards: ScryfallCard[]): Record<ColorGroup, ScryfallCard[]> {
    const groups: Record<ColorGroup, ScryfallCard[]> = {
        White: [],
        Blue: [],
        Black: [],
        Red: [],
        Green: [],
        Multicolor: [],
        Colorless: [],
        Land: []
    };

    cards.forEach(card => {
        const group = getCardColorGroup(card);
        groups[group].push(card);
    });

    // Sort within groups
    Object.values(groups).forEach(groupCards => {
        groupCards.sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
}
