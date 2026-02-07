import { useState, useEffect, useRef, useCallback } from 'react';
import type { ScryfallCard, DraftSettings, BotPlayer } from '../../types';
import { generateDraftBoosters } from '../../services/boosterGenerator';
import { Card } from '../Card';
import { shouldRotateCard, fetchCardText } from '../../services/scryfall';
import { formatOracleText } from '../../services/textFormatter';
import './DraftPick.css';

interface DraftPickProps {
    settings: DraftSettings;
    onComplete: (picks: ScryfallCard[]) => void;
    onBack: () => void;
}

// Simple bot names
const BOT_NAMES = [
    'Jace Bot', 'Liliana Bot', 'Chandra Bot', 'Nissa Bot',
    'Gideon Bot', 'Ajani Bot', 'Teferi Bot', 'Karn Bot'
];

export function DraftPick({ settings, onComplete, onBack }: DraftPickProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // All boosters for the draft [packNumber][playerIndex]
    const [allBoosters, setAllBoosters] = useState<ScryfallCard[][][]>([]);

    // Current state
    const [packNumber, setPackNumber] = useState(0);
    const [pickNumber, setPickNumber] = useState(0);
    const [currentPack, setCurrentPack] = useState<ScryfallCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
    const [pickedCards, setPickedCards] = useState<ScryfallCard[]>([]);

    // Bot state
    const [bots, setBots] = useState<BotPlayer[]>([]);
    const [botPacks, setBotPacks] = useState<ScryfallCard[][]>([]);

    // Timer
    const [timeLeft, setTimeLeft] = useState(settings.pickTimeSeconds);
    const [timerActive, setTimerActive] = useState(false);

    // Initialize draft
    useEffect(() => {
        initializeDraft();
    }, []);

    async function initializeDraft() {
        try {
            setLoading(true);

            // Generate all boosters
            const boosters = await generateDraftBoosters(
                settings.setCode,
                settings.boosterType,
                settings.numberOfPacks,
                settings.numberOfPlayers
            );

            // Convert to 3D array [pack][player][cards]
            const boosterArrays: ScryfallCard[][][] = boosters.map(pack =>
                pack.map(booster => [...booster.cards])
            );

            setAllBoosters(boosterArrays);

            // Initialize bots
            const newBots: BotPlayer[] = [];
            for (let i = 1; i < settings.numberOfPlayers; i++) {
                newBots.push({
                    id: `bot-${i}`,
                    name: BOT_NAMES[i - 1] || `Bot ${i}`,
                    colorPreferences: [],
                    pickedCards: []
                });
            }
            setBots(newBots);

            // Set up first pack
            setCurrentPack(boosterArrays[0][0]);
            setBotPacks(boosterArrays[0].slice(1));
            setPickNumber(0);
            setPackNumber(0);
            setTimerActive(settings.pickTimeSeconds > 0);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to generate boosters. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    // Use a ref to access current pack without stale closures
    const currentPackRef = useRef(currentPack);
    currentPackRef.current = currentPack;

    // Timer countdown (only if timer is enabled)
    useEffect(() => {
        if (!timerActive || settings.pickTimeSeconds === 0) return;
        if (timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Auto-pick first card when timer runs out
                    const pack = currentPackRef.current;
                    if (pack.length > 0) {
                        setSelectedCard(null);
                        // We'll handle auto-pick via a state flag
                        setAutoPickTriggered(true);
                    }
                    return settings.pickTimeSeconds;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timerActive, timeLeft, settings.pickTimeSeconds]);

    // State for auto-pick trigger
    const [autoPickTriggered, setAutoPickTriggered] = useState(false);

    // Handle auto-pick when triggered
    useEffect(() => {
        if (autoPickTriggered && currentPack.length > 0) {
            setAutoPickTriggered(false);
            confirmPick(currentPack[0]);
        }
    }, [autoPickTriggered, currentPack]);

    // Hover state for zooming - persists until a new card is hovered
    const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);
    const [cardText, setCardText] = useState<string>('');

    function handleCardHover(card: ScryfallCard) {
        setHoveredCard(card);
    }

    // Effect to fetch card text when selection or hover changes
    useEffect(() => {
        const card = hoveredCard || selectedCard;
        if (!card) {
            setCardText('');
            return;
        }

        let ignore = false;
        fetchCardText(card.id).then(text => {
            if (!ignore) setCardText(text);
        });

        return () => { ignore = true; };
    }, [hoveredCard, selectedCard]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (loading || currentPack.length === 0) return;

        // Number keys 1-9 to select cards
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            if (index < currentPack.length) {
                setSelectedCard(currentPack[index]);
                setHoveredCard(currentPack[index]);
            }
            return;
        }

        // Arrow keys to navigate
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const currentIndex = selectedCard
                ? currentPack.findIndex(c => c.id === selectedCard.id)
                : -1;

            let newIndex: number;
            if (e.key === 'ArrowLeft') {
                newIndex = currentIndex <= 0 ? currentPack.length - 1 : currentIndex - 1;
            } else {
                newIndex = currentIndex >= currentPack.length - 1 ? 0 : currentIndex + 1;
            }

            setSelectedCard(currentPack[newIndex]);
            setHoveredCard(currentPack[newIndex]);
            return;
        }

        // Enter to confirm pick
        if (e.key === 'Enter' && selectedCard) {
            e.preventDefault();
            confirmPick();
            return;
        }

        // Escape to deselect
        if (e.key === 'Escape') {
            setSelectedCard(null);
            return;
        }
    }, [loading, currentPack, selectedCard]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    function handleCardClick(card: ScryfallCard) {
        // Toggle selection or select new
        if (selectedCard?.id === card.id) {
            // Optional: Deselect if clicking same card? 
            // Or maybe double click to confirm?
        } else {
            setSelectedCard(card);
        }
    }

    // Allow double click to confirm immediately
    function handleCardDoubleClick(card: ScryfallCard) {
        confirmPick(card);
    }

    function confirmPick(card: ScryfallCard = selectedCard!) {
        if (!card) return;

        // Add to picked cards
        const newPicked = [...pickedCards, card];
        setPickedCards(newPicked);

        // Remove from current pack
        const remainingPack = currentPack.filter(c => c.id !== card.id);

        // Bot picks
        const newBots = [...bots];
        const newBotPacks = botPacks.map((pack, i) => {
            if (pack.length === 0) return pack;

            // Simple bot AI: pick by rarity, then by established color
            const bot = newBots[i];
            const pickedCard = botPick(pack, bot);
            bot.pickedCards.push(pickedCard);

            // Update color preferences based on pick
            if (pickedCard.colors && pickedCard.colors.length > 0) {
                for (const color of pickedCard.colors) {
                    if (!bot.colorPreferences.includes(color)) {
                        bot.colorPreferences.push(color);
                    }
                }
            }

            return pack.filter(c => c.id !== pickedCard.id);
        });

        setBots(newBots);

        // Pass packs (simulate rotation)
        const nextPickNumber = pickNumber + 1;
        const packSize = settings.boosterType === 'play' ? 14 :
            settings.boosterType === 'set' ? 12 : 15;

        if (nextPickNumber >= packSize - 1 || remainingPack.length === 0) {
            // Pack is done, move to next pack
            const nextPackNumber = packNumber + 1;

            if (nextPackNumber >= settings.numberOfPacks) {
                // Draft complete!
                setTimerActive(false);
                onComplete(newPicked);
                return;
            }

            // Start next pack
            setPackNumber(nextPackNumber);
            setPickNumber(0);
            setCurrentPack(allBoosters[nextPackNumber][0]);
            setBotPacks(allBoosters[nextPackNumber].slice(1));
        } else {
            // Pass packs around
            // In odd packs, pass left (bots pass to us); in even packs, pass right
            const passLeft = packNumber % 2 === 0;

            if (passLeft) {
                // We receive from bot 0, bot 0 receives from bot 1, etc.
                const firstBotPack = newBotPacks[0];
                const rotatedBotPacks = [...newBotPacks.slice(1), remainingPack];
                setCurrentPack(firstBotPack);
                setBotPacks(rotatedBotPacks);
            } else {
                // We pass to bot 0, last bot's pack comes to us
                const lastBotPack = newBotPacks[newBotPacks.length - 1];
                const rotatedBotPacks = [remainingPack, ...newBotPacks.slice(0, -1)];
                setCurrentPack(lastBotPack);
                setBotPacks(rotatedBotPacks);
            }

            setPickNumber(nextPickNumber);
        }

        // Reset selection and timer
        setSelectedCard(null);
        setHoveredCard(null);
        if (settings.pickTimeSeconds > 0) {
            setTimeLeft(settings.pickTimeSeconds);
        }
    }

    // Simple bot picking logic
    function botPick(pack: ScryfallCard[], bot: BotPlayer): ScryfallCard {
        // Sort by rarity (mythic > rare > uncommon > common)
        const rarityOrder = { mythic: 0, rare: 1, uncommon: 2, common: 3, special: 1, bonus: 2 };
        const sorted = [...pack].sort((a, b) =>
            (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4)
        );

        // If bot has color preferences, try to find a card in those colors
        if (bot.colorPreferences.length > 0) {
            const onColorCards = sorted.filter(card =>
                card.colors?.some(c => bot.colorPreferences.includes(c))
            );
            if (onColorCards.length > 0) {
                return onColorCards[0];
            }
        }

        // Otherwise pick best by rarity
        return sorted[0];
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Generating boosters for {settings.setName}...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error-text">{error}</p>
                <button className="btn btn-primary" onClick={initializeDraft}>Retry</button>
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
            </div>
        );
    }

    // The card currently being shown in preview (zoomed)
    // Priority: Hovered Card -> Selected Card -> (maybe picked card? mostly not needed)
    const previewCard = hoveredCard || selectedCard;

    return (
        <div className="draft-layout">
            <div className="draft-main">
                <div className="draft-header">
                    <div className="draft-info">
                        <div className="draft-info-item">
                            <span className="draft-info-label">Pack</span>
                            <span className="draft-info-value">{packNumber + 1} / {settings.numberOfPacks}</span>
                        </div>
                        <div className="draft-info-item">
                            <span className="draft-info-label">Pick</span>
                            <span className="draft-info-value">{pickNumber + 1}</span>
                        </div>
                    </div>

                    <div className="draft-controls">
                        <button
                            className="btn btn-primary confirm-pick-btn"
                            disabled={!selectedCard}
                            onClick={() => confirmPick()}
                        >
                            Confirm Pick
                        </button>

                        {settings.pickTimeSeconds > 0 ? (
                            <div className={`timer ${timeLeft <= 10 ? 'warning' : ''}`}>
                                {timeLeft}s
                            </div>
                        ) : (
                            <div className="timer timer-disabled">--:--</div>
                        )}
                    </div>
                </div>

                <div className="pack-container">
                    {currentPack.map((card, index) => (
                        <div
                            key={card.id}
                            className={`pack-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                            onMouseEnter={() => handleCardHover(card)}
                            onClick={() => handleCardClick(card)}
                            onDoubleClick={() => handleCardDoubleClick(card)}
                        >
                            <Card
                                card={card}
                                selected={selectedCard?.id === card.id}
                            />
                            {index < 9 && (
                                <span className="card-hotkey">{index + 1}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="draft-sidebar">
                {/* Large Card Preview */}
                <div className="card-preview-area">
                    {previewCard ? (
                        <div className={`preview-card fade-in ${shouldRotateCard(previewCard) ? 'rotated' : ''}`}>
                            <Card card={previewCard} size="large" />
                        </div>
                    ) : (
                        <div className="preview-placeholder">
                            Hover a card to view
                        </div>
                    )}
                </div>

                {/* Card Text Display */}
                {cardText && (
                    <div className="card-text-area">
                        <div className="card-text-content">{formatOracleText(cardText)}</div>
                    </div>
                )}

                <div className="pool-preview">
                    <h3>Your Picks ({pickedCards.length})</h3>

                    {(['mythic', 'rare', 'uncommon', 'common'] as const).map(rarity => {
                        const cards = pickedCards.filter(c => c.rarity === rarity);
                        if (cards.length === 0) return null;

                        return (
                            <div key={rarity} className="pool-section">
                                <div className="pool-section-title">
                                    <span className={`rarity-dot rarity-${rarity}`}></span>
                                    {rarity.charAt(0).toUpperCase() + rarity.slice(1)} ({cards.length})
                                </div>
                                <div className="pool-cards">
                                    {cards.map((card, i) => (
                                        <div
                                            key={`${card.id}-${i}`}
                                            className="pool-card-wrapper"
                                            onMouseEnter={() => handleCardHover(card)}
                                        >
                                            <Card card={card} size="small" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
