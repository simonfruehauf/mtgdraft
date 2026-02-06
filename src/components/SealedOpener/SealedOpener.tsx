import { useState, useEffect } from 'react';
import type { ScryfallCard, DraftSettings } from '../../types';
import { generateBooster } from '../../services/boosterGenerator';
import { Card } from '../Card';
import { shouldRotateCard } from '../../services/scryfall';
import './SealedOpener.css';

interface SealedOpenerProps {
    settings: DraftSettings;
    onComplete: (picks: ScryfallCard[]) => void;
    onBack: () => void;
}

export function SealedOpener({ settings, onComplete, onBack }: SealedOpenerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allCards, setAllCards] = useState<ScryfallCard[]>([]);
    const [currentPackIndex, setCurrentPackIndex] = useState(0);
    const [packsOpened, setPacksOpened] = useState<ScryfallCard[][]>([]);
    const [isOpening, setIsOpening] = useState(false);
    const [showAllCards, setShowAllCards] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);

    useEffect(() => {
        generateAllPacks();
    }, []);

    async function generateAllPacks() {
        try {
            setLoading(true);
            const packs: ScryfallCard[][] = [];

            for (let i = 0; i < settings.numberOfPacks; i++) {
                const booster = await generateBooster(
                    settings.setCode,
                    settings.boosterType
                );
                packs.push(booster.cards);
            }

            setPacksOpened(packs);
            setAllCards(packs.flat());
            setAllCards(packs.flat());
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to generate packs. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function openNextPack() {
        if (currentPackIndex < packsOpened.length) {
            setIsOpening(true);
            setTimeout(() => {
                setCurrentPackIndex(prev => prev + 1);
                setIsOpening(false);
            }, 500);
        }
    }

    function openAllRemaining() {
        setCurrentPackIndex(packsOpened.length);
    }

    function handleDone() {
        onComplete(allCards);
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Generating {settings.numberOfPacks} packs...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error-text">{error}</p>
                <button className="btn btn-primary" onClick={generateAllPacks}>Retry</button>
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
            </div>
        );
    }

    const openedCards = packsOpened.slice(0, currentPackIndex).flat();
    const allOpened = currentPackIndex >= packsOpened.length;
    const displayPackIndex = allOpened ? packsOpened.length - 1 : currentPackIndex;
    const currentPack = displayPackIndex < packsOpened.length ? packsOpened[displayPackIndex] : null;

    // IMPORTANT: Group cards by color identity
    // Order: White, Blue, Black, Red, Green, Multicolor, Colorless, Land
    const sortedPool = (() => {
        if (openedCards.length === 0) return null;

        const groups = {
            White: [] as typeof openedCards,
            Blue: [] as typeof openedCards,
            Black: [] as typeof openedCards,
            Red: [] as typeof openedCards,
            Green: [] as typeof openedCards,
            Multicolor: [] as typeof openedCards,
            Colorless: [] as typeof openedCards,
            Land: [] as typeof openedCards
        };

        openedCards.forEach(card => {
            const colors = card.colors || [];
            if (card.type_line.includes('Land')) {
                groups.Land.push(card);
            } else if (colors.length === 0) {
                groups.Colorless.push(card);
            } else if (colors.length > 1) {
                groups.Multicolor.push(card);
            } else if (colors.includes('W')) {
                groups.White.push(card);
            } else if (colors.includes('U')) {
                groups.Blue.push(card);
            } else if (colors.includes('B')) {
                groups.Black.push(card);
            } else if (colors.includes('R')) {
                groups.Red.push(card);
            } else if (colors.includes('G')) {
                groups.Green.push(card);
            } else {
                groups.Colorless.push(card); // Fallback
            }
        });

        // Helper to sort and group duplicates
        const processGroup = (cards: typeof openedCards) => {
            // Sort by name
            cards.sort((a, b) => a.name.localeCompare(b.name));

            // Group duplicates (by unique printing ID)
            const uniqueCards = new Map<string, { card: ScryfallCard, count: number }>();
            cards.forEach(card => {
                const existing = uniqueCards.get(card.id);
                if (existing) {
                    existing.count++;
                } else {
                    uniqueCards.set(card.id, { card, count: 1 });
                }
            });
            return Array.from(uniqueCards.values());
        };

        return {
            White: processGroup(groups.White),
            Blue: processGroup(groups.Blue),
            Black: processGroup(groups.Black),
            Red: processGroup(groups.Red),
            Green: processGroup(groups.Green),
            Multicolor: processGroup(groups.Multicolor),
            Colorless: processGroup(groups.Colorless),
            Land: processGroup(groups.Land)
        };
    })();

    function handleExportPool() {
        const lines: string[] = [];
        const cardCounts = new Map<string, number>();

        openedCards.forEach(card => {
            const name = card.name; // Use simple name for export
            cardCounts.set(name, (cardCounts.get(name) || 0) + 1);
        });

        // Add Deck header for MTGA import
        lines.push('Deck');
        cardCounts.forEach((count, name) => {
            lines.push(`${count} ${name}`);
        });

        const text = lines.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert('Pool exported to clipboard in MTG Arena format!');
        });
    }

    // Card preview priority: Hovered -> nothing (unlike draft where selection matters)
    const previewCard = hoveredCard;

    return (
        <div className="sealed-layout">
            <div className="sealed-main">
                <div className="sealed-header">
                    <button className="btn btn-secondary" onClick={onBack}>
                        ← Back
                    </button>
                    <div className="sealed-progress">
                        <h2>Box Brawl - {settings.setName}</h2>
                        <p className="pack-progress">
                            {currentPackIndex} / {settings.numberOfPacks} packs opened
                        </p>
                    </div>
                    <div className="sealed-actions">
                        {!allOpened && (
                            <>
                                <button
                                    className="btn btn-primary"
                                    onClick={openNextPack}
                                    disabled={isOpening}
                                >
                                    {isOpening ? 'Opening...' : 'Open Next Pack'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={openAllRemaining}
                                >
                                    Open All
                                </button>
                            </>
                        )}
                        {allOpened && (
                            <>
                                <button className="btn btn-secondary" onClick={handleExportPool}>
                                    📋 Export Pool
                                </button>
                                <button className="btn btn-primary" onClick={handleDone}>
                                    Build Deck ({allCards.length} cards)
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Current or Last Pack */}
                {currentPack && (
                    <div className="current-pack-section">
                        <h3>{allOpened ? 'Last Pack' : `Pack ${currentPackIndex + 1}`}</h3>
                        <div className={`pack-reveal ${isOpening ? 'opening' : ''}`}>
                            {currentPack.map((card, i) => (
                                <div
                                    key={`${card.id}-${i}`}
                                    className="pack-card-reveal"
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                    onMouseEnter={() => setHoveredCard(card)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                >
                                    <Card card={card} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pool Display */}
                {(showAllCards || allOpened) && sortedPool && (
                    <div className="opened-cards-section">
                        <h3>Your Pool ({openedCards.length} cards)</h3>
                        <div className="pool-columns">
                            {Object.entries(sortedPool).map(([color, cards]) => {
                                if (cards.length === 0) return null;
                                return (
                                    <div key={color} className="pool-column">
                                        <h4 className={`color-header color-${color.toLowerCase()}`}>
                                            {color} ({cards.reduce((acc, c) => acc + c.count, 0)})
                                        </h4>
                                        <div className="color-cards">
                                            {cards.map(({ card, count }, i) => (
                                                <div
                                                    key={`${card.id}-${i}`}
                                                    className="pool-card-stack"
                                                    onMouseEnter={() => setHoveredCard(card)}
                                                    onMouseLeave={() => setHoveredCard(null)}
                                                >
                                                    <Card card={card} size="small" />
                                                    {count > 1 && (
                                                        <span className="card-count">x{count}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pool toggle (only if not finished) */}
                {openedCards.length > 0 && !allOpened && (
                    <div className="pool-toggle">
                        <button
                            className={`btn ${showAllCards ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setShowAllCards(!showAllCards)}
                        >
                            {showAllCards ? 'Hide' : 'Show'} Full Pool ({openedCards.length} cards)
                        </button>
                    </div>
                )}


                {/* Unopened packs visualization */}
                {!allOpened && (
                    <div className="unopened-packs">
                        {Array.from({ length: settings.numberOfPacks - currentPackIndex - 1 }).map((_, i) => (
                            <div key={i} className="unopened-pack">
                                📦
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sidebar for Preview */}
            <div className="sealed-sidebar">
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
            </div>
        </div>
    );
}
