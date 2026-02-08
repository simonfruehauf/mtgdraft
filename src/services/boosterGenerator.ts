import type { ScryfallCard, CardPool, Booster, BoosterType } from '../types';
import { fetchSetCards, fetchListCards } from './scryfall';

/**
 * Build a card pool organized by rarity from a list of cards
 * Filters out cards that aren't booster-eligible
 */
export function buildCardPool(cards: ScryfallCard[]): CardPool {
    const pool: CardPool = {
        commons: [],
        uncommons: [],
        rares: [],
        mythics: [],
        basicLands: [],
        variants: [],
        foilOnly: [], // Cards that only exist in foil (different collector numbers)
        all: cards
    };

    for (const card of cards) {
        // Skip tokens/art/digital if they snuck in (though we filter in fetch)
        if (card.layout === 'token' || card.layout === 'art_series') continue;

        // Check if it's a basic land (special handling)
        if (card.type_line && card.type_line.includes('Basic Land')) {
            pool.basicLands.push(card);
            continue;
        }

        // Determine if it's a variant (Booster Fun)
        // Criteria: Not in base booster, but has special frame/border
        const isPromo = card.promo_types && (
            card.promo_types.includes('buyabox') ||
            card.promo_types.includes('bundle') ||
            card.promo_types.includes('prerelease') ||
            card.promo_types.includes('judge_gift')
        );

        if (isPromo) continue; // Skip pure promos

        // Is it a variant?
        const isVariant = !card.booster && (
            (card.frame_effects && card.frame_effects.length > 0) ||
            card.border_color === 'borderless' ||
            (card.promo_types && card.promo_types.includes('boosterfun')) ||
            card.frame === 'showcase' ||
            card.frame === 'extendedart'
        );

        if (isVariant) {
            if (pool.variants) {
                pool.variants.push(card);
            }
            continue;
        }

        // If it's not a variant and not in booster, skip it (e.g. Commander decks)
        if (!card.booster && !isVariant) continue;

        // Standard Booster Cards
        switch (card.rarity) {
            case 'common':
                pool.commons.push(card);
                break;
            case 'uncommon':
                pool.uncommons.push(card);
                break;
            case 'rare':
                pool.rares.push(card);
                break;
            case 'mythic':
                pool.mythics.push(card);
                break;
        }
    }

    // Safety: ensure optional pools are initialized
    if (!pool.variants) pool.variants = [];
    if (!pool.foilOnly) pool.foilOnly = [];

    // Second pass: identify foil-only cards (have 'foil' but not 'nonfoil' in finishes)
    // These are cards with unique collector numbers for foil versions
    for (const card of cards) {
        if (card.finishes &&
            card.finishes.includes('foil') &&
            !card.finishes.includes('nonfoil')) {
            pool.foilOnly.push(card);
        }
    }

    return pool;
}

/**
 * Pick a random card from an array
 */
function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Check if a card can be foil
 */
function canBeFoil(card: ScryfallCard): boolean {
    return card.finishes && card.finishes.includes('foil');
}

/**
 * Pick a foil card, preferring foil-only cards (with unique collector numbers)
 * Falls back to any foilable card if no foil-only cards exist
 * Foil-only cards (special variants) only have ~15% chance to appear
 */
function pickFoilCard(pool: CardPool): ScryfallCard | null {
    // Any card that can be foil from all pools
    const foilable = pool.all.filter(canBeFoil);

    // 15% chance to get a foil-only special variant (showcase/borderless/etc)
    if (pool.foilOnly && pool.foilOnly.length > 0 && Math.random() < 0.15) {
        return { ...pickRandom(pool.foilOnly), _isFoil: true };
    }

    // Otherwise, pick a regular card in foil
    if (foilable.length > 0) {
        return { ...pickRandom(foilable), _isFoil: true };
    }

    // Fallback: return null (caller should handle this)
    return null;
}

/**
 * Pick N random cards from an array (with replacement prevention)
 */
function pickRandomN<T>(arr: T[], n: number): T[] {
    if (n <= 0) return [];
    if (arr.length === 0) return [];

    // If asking for more cards than available, return duplicates if allowed, 
    // or just return shuffled array repeated.
    const result: T[] = [];
    while (result.length < n) {
        const remaining = n - result.length;
        if (arr.length >= remaining) {
            // We have enough, pick unique ones
            const shuffled = [...arr].sort(() => Math.random() - 0.5);
            result.push(...shuffled.slice(0, remaining));
        } else {
            // Not enough, take all and reshuffle for next iteration
            result.push(...[...arr].sort(() => Math.random() - 0.5));
        }
    }

    return result.slice(0, n);
}

/**
 * Safely pick cards from specific pool, falling back to other rarities if needed
 */
function safePick(pool: CardPool, count: number, preferredRarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'land'): ScryfallCard[] {
    let source: ScryfallCard[] = [];

    // Determine primary source
    switch (preferredRarity) {
        case 'common': source = pool.commons; break;
        case 'uncommon': source = pool.uncommons; break;
        case 'rare': source = pool.rares; break;
        case 'mythic': source = pool.mythics; break;
        case 'land': source = pool.basicLands; break;
    }

    // If we have enough, just use them
    if (source.length >= count) {
        return pickRandomN(source, count);
    }

    const picked: ScryfallCard[] = [];

    // Take what we have
    if (source.length > 0) {
        picked.push(...pickRandomN(source, source.length));
    }

    // Calculate remaining needed
    const remaining = count - picked.length;

    if (remaining > 0) {
        // Fallback strategy: try adjacent rarities
        let fallbackPool: ScryfallCard[] = [];

        switch (preferredRarity) {
            case 'common':
                fallbackPool = [...pool.uncommons, ...pool.rares];
                break;
            case 'uncommon':
                fallbackPool = [...pool.commons, ...pool.rares];
                break;
            case 'rare':
                fallbackPool = [...pool.mythics, ...pool.uncommons, ...pool.commons];
                break;
            case 'mythic':
                fallbackPool = [...pool.rares, ...pool.uncommons, ...pool.commons];
                break;
            case 'land':
                fallbackPool = pool.commons; // Use commons if no lands
                break;
        }

        // Final fallback: use ANYTHING
        if (fallbackPool.length === 0) {
            fallbackPool = pool.all;
        }

        if (fallbackPool.length > 0) {
            picked.push(...pickRandomN(fallbackPool, remaining));
        }
    }

    return picked;
}

/**
 * Pick rare or mythic based on probability
 * @param usePlayBoosterRatio - Play Boosters use 1:7 ratio (14.28% mythic), Draft Boosters use 1:8 (12.5%)
 */
function pickRareOrMythic(pool: CardPool, usePlayBoosterRatio: boolean = false): ScryfallCard {
    // If no mythics exist, always pick rare
    if (pool.mythics.length === 0) {
        if (pool.rares.length === 0) {
            // If neither exist, pick whatever (fallback)
            return safePick(pool, 1, 'uncommon')[0];
        }
        return pickRandom(pool.rares);
    }

    // If no rares exist, always pick mythic
    if (pool.rares.length === 0) {
        return pickRandom(pool.mythics);
    }

    // Play Boosters: 1:7 ratio = 1/7 chance of mythic (~14.28%)
    // Draft Boosters: 1:8 ratio = 1/8 chance of mythic (12.5%)
    const mythicChance = usePlayBoosterRatio ? (1 / 7) : 0.125;
    return Math.random() < mythicChance
        ? pickRandom(pool.mythics)
        : pickRandom(pool.rares);
}

/**
 * Pick a wildcard (any rarity with weighted odds)
 * C: 49%, U: 35%, R: 12.5%, M: 3.5%
 * Includes variants (Booster Fun) in the pool logic
 */
function pickWildcard(pool: CardPool): ScryfallCard {
    const roll = Math.random();

    // Helper to mix standard cards with variants of same rarity
    const getPoolWithVariants = (standard: ScryfallCard[], rarity: string) => {
        const variants = pool.variants ? pool.variants.filter(c => c.rarity === rarity) : [];
        if (standard.length === 0 && variants.length === 0) return [];
        if (standard.length === 0) return variants;
        if (variants.length === 0) return standard;

        // Mix them: Give variants a decent chance to appear
        // If we just concat, variants might be rare if set is large.
        // But physically, they are specific slots. 
        // For simulation, let's just 50/50 chance to pick from variant pool if available
        if (Math.random() < 0.3) { // 30% chance to prefer variant if available
            return variants;
        }
        return standard;
    };

    if (roll < 0.49) {
        const source = getPoolWithVariants(pool.commons, 'common');
        if (source.length > 0) return pickRandom(source);
    }

    if (roll < 0.84) { // C + U
        const source = getPoolWithVariants(pool.uncommons, 'uncommon');
        if (source.length > 0) return pickRandom(source);
    }

    if (roll < 0.965) { // C + U + R
        const source = getPoolWithVariants(pool.rares, 'rare');
        if (source.length > 0) return pickRandom(source);
    }

    // Mythic or fallback
    const source = getPoolWithVariants(pool.mythics, 'mythic');
    if (source.length > 0) return pickRandom(source);

    // Absolute fallback
    return pickRandom(pool.all);
}

/**
 * Generate a Play Booster (14 cards, MKM onwards)
 * 
 * Slot 1-6: Commons
 * Slot 7: Common OR The List (12.5%)
 * Slot 8-10: Uncommons
 * Slot 11: Rare/Mythic
 * Slot 12: Non-foil wildcard
 * Slot 13: Foil wildcard (marked as foil)
 * Slot 14: Basic land
 */
async function generatePlayBooster(
    pool: CardPool,
    _setCode: string,
    setReleaseDate?: string
): Promise<ScryfallCard[]> {
    const cards: ScryfallCard[] = [];

    // Slots 1-6: Commons
    cards.push(...safePick(pool, 6, 'common'));

    // Slot 7: Common OR The List (12.5% chance)
    if (Math.random() < 0.125) {
        try {
            const listCards = await fetchListCards(setReleaseDate);
            if (listCards.length > 0) {
                const listCard = { ...pickRandom(listCards), _isFromList: true };
                cards.push(listCard);
            } else {
                cards.push(...safePick(pool, 1, 'common'));
            }
        } catch {
            cards.push(...safePick(pool, 1, 'common'));
        }
    } else {
        cards.push(...safePick(pool, 1, 'common'));
    }

    // Slots 8-10: Uncommons
    cards.push(...safePick(pool, 3, 'uncommon'));

    // Slot 11: Rare/Mythic (Play Booster uses 1:7 ratio)
    cards.push(pickRareOrMythic(pool, true));

    // Slot 12: Basic land
    if (pool.basicLands.length > 0) {
        cards.push(pickRandom(pool.basicLands));
    } else {
        // Fallback to a common if no lands (e.g. Master sets)
        cards.push(...safePick(pool, 1, 'common'));
    }

    // Slot 13: Non-foil wildcard
    cards.push(pickWildcard(pool));

    // Slot 14: Foil wildcard - prefer foil-only cards (unique collector numbers)
    const foilCard = pickFoilCard(pool);
    if (foilCard) {
        cards.push(foilCard);
    } else {
        // Fallback: just add a non-foil wildcard
        cards.push(pickWildcard(pool));
    }

    return cards;
}

/**
 * Generate a Draft Booster (15 cards, pre-MKM)
 * 
 * Slots 1-10: Commons
 * Slots 11-13: Uncommons
 * Slot 14: Rare/Mythic
 * Slot 15: Basic land
 */
function generateDraftBooster(pool: CardPool): ScryfallCard[] {
    const cards: ScryfallCard[] = [];

    // Slots 1-10: Commons
    cards.push(...safePick(pool, 10, 'common'));

    // Slots 11-13: Uncommons
    cards.push(...safePick(pool, 3, 'uncommon'));

    // Slot 14: Rare/Mythic
    cards.push(pickRareOrMythic(pool));

    // Slot 15: Basic land
    if (pool.basicLands.length > 0) {
        cards.push(pickRandom(pool.basicLands));
    } else {
        // Fallback to a common if no lands
        cards.push(...safePick(pool, 1, 'common'));
    }

    return cards;
}

/**
 * Generate a Set Booster (12 cards, ZNR through LCI)
 */
function generateSetBooster(pool: CardPool): ScryfallCard[] {
    const cards: ScryfallCard[] = [];

    // Slots 1-6: Mix of commons and uncommons
    const mixedPool = [...pool.commons, ...pool.uncommons];

    // Graceful fallback if mixed pool is empty
    if (mixedPool.length === 0) {
        if (pool.rares.length > 0) mixedPool.push(...pool.rares);
        else mixedPool.push(...pool.all);
    }

    cards.push(...pickRandomN(mixedPool, 6));

    // Slots 7-8: Uncommons
    cards.push(...safePick(pool, 2, 'uncommon'));

    // Slot 9: Guaranteed Rare/Mythic
    cards.push(pickRareOrMythic(pool));

    // Slot 10: Rare/Mythic OR foil (50/50)
    if (Math.random() < 0.5) {
        cards.push(pickRareOrMythic(pool));
    } else {
        // Foil slot - prefer foil-only cards (unique collector numbers)
        const foilCard = pickFoilCard(pool);
        if (foilCard) {
            cards.push(foilCard);
        } else {
            cards.push(pickWildcard(pool));
        }
    }

    // Slot 11: Basic Land
    if (pool.basicLands.length > 0) {
        cards.push(pickRandom(pool.basicLands));
    } else {
        cards.push(...safePick(pool, 1, 'common'));
    }

    // Slot 12: Art card - we'll use an extra common as placeholder
    cards.push(...safePick(pool, 1, 'common'));

    return cards;
}

/**
 * Generate a Generic Booster (for sets with weird distributions)
 * Just picks 14 cards respecting roughly rarity distribution if possible
 */
function generateGenericBooster(pool: CardPool): ScryfallCard[] {
    const cards: ScryfallCard[] = [];

    // Try to mimic a Play Booster structure loosely
    cards.push(...safePick(pool, 9, 'common'));
    cards.push(...safePick(pool, 3, 'uncommon'));
    cards.push(pickRareOrMythic(pool));
    cards.push(pickWildcard(pool));

    // Ensure we have at least 7 cards (standard small booster size)
    // and cap at 15
    return cards.slice(0, 15);
}

/**
 * Generate a booster pack for a given set and booster type
 */
export async function generateBooster(
    setCode: string,
    boosterType: BoosterType,
    setReleaseDate?: string,
    preFetchedCards?: ScryfallCard[]
): Promise<Booster> {
    // Fetch cards for the set (or use pre-fetched)
    const cards = preFetchedCards || await fetchSetCards(setCode);

    // Check if we have enough cards
    if (cards.length === 0) {
        throw new Error(`No booster-eligible cards found for set "${setCode}". This set may not support booster generation.`);
    }

    const pool = buildCardPool(cards);

    // IMPORTANT: We removed the strict validation here allowing empty rarity pools.
    // The generation functions now use safePick() to handle missing rarities gracefully.

    let boosterCards: ScryfallCard[];

    try {
        switch (boosterType) {
            case 'play':
                boosterCards = await generatePlayBooster(pool, setCode, setReleaseDate);
                break;
            case 'draft':
                boosterCards = generateDraftBooster(pool);
                break;
            case 'set':
                boosterCards = generateSetBooster(pool);
                break;
            default:
                // Fallback for unknown types
                boosterCards = generateGenericBooster(pool);
        }
    } catch (err) {
        console.warn('Standard booster generation failed, falling back to generic generation', err);
        boosterCards = generateGenericBooster(pool);
    }

    return {
        cards: boosterCards,
        setCode,
        boosterType
    };
}

/**
 * Generate multiple boosters for a draft
 */
export async function generateDraftBoosters(
    setCode: string,
    boosterType: BoosterType,
    numberOfPacks: number,
    numberOfPlayers: number,
    setReleaseDate?: string
): Promise<Booster[][]> {
    const allBoosters: Booster[][] = [];

    // Optimization: Fetch cards ONCE for the whole draft
    const cards = await fetchSetCards(setCode);

    // Check if we have enough cards
    if (cards.length === 0) {
        throw new Error(`No booster-eligible cards found for set "${setCode}".`);
    }

    // Build the pool once (or we can let generateBooster build it, but passing cards is enough)
    // Actually, generateBooster calls buildCardPool. 
    // We should probably modify generateBooster to accept pre-fetched cards.

    // Generate packs for each player for each round
    for (let pack = 0; pack < numberOfPacks; pack++) {
        const roundBoosters: Booster[] = [];
        for (let player = 0; player < numberOfPlayers; player++) {
            // pass the pre-fetched cards
            const booster = await generateBooster(setCode, boosterType, setReleaseDate, cards);
            roundBoosters.push(booster);
        }
        allBoosters.push(roundBoosters);
    }

    return allBoosters;
}
