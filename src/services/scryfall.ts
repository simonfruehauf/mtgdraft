import type { ScryfallSet, ScryfallCard, ScryfallListResponse } from '../types';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const RATE_LIMIT_MS = 100; // 10 requests per second max

let lastRequestTime = 0;

/**
 * Rate-limited fetch to respect Scryfall's API limits
 */
async function rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
    }

    lastRequestTime = Date.now();
    return fetch(url);
}

/**
 * Fetch all sets from Scryfall
 */
export async function fetchSets(): Promise<ScryfallSet[]> {
    // Check localStorage cache first
    const cached = localStorage.getItem('scryfall_sets');
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache for 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            return data;
        }
    }

    const response = await rateLimitedFetch(`${SCRYFALL_API_BASE}/sets`);
    const json = await response.json();

    // Filter to only draftable sets (core, expansion, draft_innovation, masters)
    const draftableSets = (json.data as ScryfallSet[]).filter(set =>
        ['core', 'expansion', 'draft_innovation', 'masters'].includes(set.set_type)
    );

    // Cache the result
    localStorage.setItem('scryfall_sets', JSON.stringify({
        data: draftableSets,
        timestamp: Date.now()
    }));

    return draftableSets;
}

/**
 * Fetch all booster-eligible cards for a set
 */
export async function fetchSetCards(setCode: string): Promise<ScryfallCard[]> {
    // Check localStorage cache first
    const cacheKey = `scryfall_cards_${setCode}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // Cache for 7 days
            if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
                return data;
            }
        }
    } catch {
        // Cache read failed, continue to fetch
        console.warn('Failed to read from cache, fetching fresh data');
    }

    const allCards: ScryfallCard[] = [];
    // Fetch EVERYTHING in the set except tokens/art/digital
    // We handle "Booster Fun" vs "Standard" filtering in buildCardPool
    let url: string | null = `${SCRYFALL_API_BASE}/cards/search?q=e:${setCode}+-is:token+-is:art_series+-is:digital&unique=prints`;

    while (url) {
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
            // No cards found for this set
            if (response.status === 404) {
                return [];
            }
            throw new Error(`Failed to fetch cards: ${response.status}`);
        }

        const json: ScryfallListResponse<ScryfallCard> = await response.json();
        allCards.push(...json.data);

        url = json.has_more ? json.next_page! : null;
    }

    // Try to cache the result, but don't fail if storage is full
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            data: allCards,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Storage quota exceeded - try to clear old cache entries
        console.warn('Cache storage full, clearing old entries...');
        clearOldCacheEntries();

        // Try one more time
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                data: allCards,
                timestamp: Date.now()
            }));
        } catch {
            // Still can't cache - that's fine, continue without caching
            console.warn('Could not cache cards data, continuing without cache');
        }
    }

    return allCards;
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCacheEntries() {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('scryfall_')) {
            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    const { timestamp } = JSON.parse(cached);
                    // Remove entries older than 1 day
                    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
                        keysToRemove.push(key);
                    }
                }
            } catch {
                // Invalid entry, remove it
                keysToRemove.push(key);
            }
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} old cache entries`);
}

/**
 * Fetch The List cards, optionally filtered by release date
 */
export async function fetchListCards(releaseDate?: string): Promise<ScryfallCard[]> {
    const cacheKey = 'scryfall_the_list';
    const cached = localStorage.getItem(cacheKey);

    let allListCards: ScryfallCard[];

    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache for 7 days
        if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
            allListCards = data;
        } else {
            allListCards = await fetchAllListCards();
        }
    } else {
        allListCards = await fetchAllListCards();
    }

    // If a release date was provided, filter to cards released around that time
    if (releaseDate) {
        const targetDate = new Date(releaseDate);
        const filtered = allListCards.filter(card => {
            if (!card.released_at) return false;
            const cardDate = new Date(card.released_at);
            // Within 6 months of the set release
            const diffMonths = Math.abs((targetDate.getTime() - cardDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
            return diffMonths <= 6;
        });

        // If we found enough cards, use the filtered set; otherwise use all
        return filtered.length > 50 ? filtered : allListCards;
    }

    return allListCards;
}

async function fetchAllListCards(): Promise<ScryfallCard[]> {
    const allCards: ScryfallCard[] = [];
    let url: string | null = `${SCRYFALL_API_BASE}/cards/search?q=e:plst&unique=prints`;

    while (url) {
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`Failed to fetch List cards: ${response.status}`);
        }

        const json: ScryfallListResponse<ScryfallCard> = await response.json();
        allCards.push(...json.data);
        url = json.has_more ? json.next_page! : null;
    }

    // Cache the result
    localStorage.setItem('scryfall_the_list', JSON.stringify({
        data: allCards,
        timestamp: Date.now()
    }));

    return allCards;
}

/**
 * Get the image URL for a card, handling double-faced cards
 */
export function getCardImageUrl(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
    if (card.image_uris) {
        return card.image_uris[size];
    }

    // Double-faced card - use front face
    if (card.card_faces && card.card_faces[0]?.image_uris) {
        return card.card_faces[0].image_uris[size];
    }

    // Fallback to placeholder
    return 'https://cards.scryfall.io/normal/front/0/0/00000000-0000-0000-0000-000000000000.jpg';
}

/**
 * Determine which booster types are available for a set
 */
export function getAvailableBoosterTypes(set: ScryfallSet): ('play' | 'draft' | 'set')[] {
    const releaseDate = new Date(set.released_at);
    const playBoosterCutoff = new Date('2024-02-09'); // MKM release date
    const setBoosterStart = new Date('2020-09-25');   // ZNR release date

    // Play Boosters: MKM (Feb 2024) onwards
    if (releaseDate >= playBoosterCutoff) {
        return ['play'];
    }

    // Set Boosters: ZNR through LCI (Sept 2020 - Nov 2023)
    if (releaseDate >= setBoosterStart && releaseDate < playBoosterCutoff) {
        return ['draft', 'set'];
    }

    // Older sets: Draft Boosters only
    return ['draft'];
}

/**
 * Determine if a card should be rotated 90 degrees for display (e.g. Split cards, Battles)
 */
export function shouldRotateCard(card: ScryfallCard): boolean {
    // Safety check for cached/partial data
    if (!card) return false;

    // Battles (Sieges) are landscape
    if (card.type_line && card.type_line.includes('Battle')) return true;

    // Split cards (including DSK Rooms)
    if (card.layout === 'split') return true;

    // Planechase planes / phenomena
    if (card.layout === 'planar') return true;

    // Archenemy schemes
    if (card.layout === 'scheme') return true;

    return false;
}

