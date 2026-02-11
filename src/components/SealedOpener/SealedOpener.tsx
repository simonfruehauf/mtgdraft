import { useState, useEffect } from 'react';
import type { ScryfallCard, DraftSettings } from '../../types';
import { generateBooster } from '../../services/boosterGenerator';
import { fetchSetCards, shouldRotateCard, fetchCardText } from '../../services/scryfall';
import { formatOracleText } from '../../services/textFormatter';
import { Card } from '../Card';
import './SealedOpener.css';

interface SealedOpenerProps {
    settings: DraftSettings;
    onBack: () => void;
}

export function SealedOpener({ settings, onBack }: SealedOpenerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentPackIndex, setCurrentPackIndex] = useState(0);
    const [packsOpened, setPacksOpened] = useState<ScryfallCard[][]>([]);
    const [isOpening, setIsOpening] = useState(false);
    const [showAllCards, setShowAllCards] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);
    const [cardText, setCardText] = useState<string>('');
    const [showExport, setShowExport] = useState(false);
    const [exportFormat, setExportFormat] = useState<'mtga' | 'scryfall'>('mtga');
    // Track which cards in the current pack have been revealed (for flip animation)
    const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
    const [isFlipped, setIsFlipped] = useState(false);

    // Persistent hover handler - card stays displayed until a new one is hovered
    function handleCardHover(card: ScryfallCard) {
        if (hoveredCard?.id !== card.id) {
            setHoveredCard(card);
            setIsFlipped(false); // Reset flip state for new card
        }
    }

    // Effect to fetch card text when hover changes
    useEffect(() => {
        if (!hoveredCard) {
            setCardText('');
            return;
        }

        let ignore = false;
        fetchCardText(hoveredCard.id).then(text => {
            if (!ignore) setCardText(text);
        });

        return () => { ignore = true; };
    }, [hoveredCard]);

    useEffect(() => {
        let ignore = false;

        async function initPacks() {
            setLoading(true);
            try {
                // Optimization: Fetch cards once
                const poolCards = await fetchSetCards(settings.setCode);

                const packs: ScryfallCard[][] = [];
                for (let i = 0; i < settings.numberOfPacks; i++) {
                    const booster = await generateBooster(
                        settings.setCode,
                        settings.boosterType,
                        undefined,
                        poolCards
                    );
                    packs.push(booster.cards);
                }

                if (!ignore) {
                    setPacksOpened(packs);
                    // Trigger animation for first pack
                    // We set currentPackIndex to -1 explicitly to trigger the effect
                    setCurrentPackIndex(-1);
                    setLoading(false);
                }
            } catch (err) {
                if (!ignore) {
                    console.error(err);
                    setError(err instanceof Error ? err.message : 'Failed to generate packs. Please try again.');
                    setLoading(false);
                }
            }
        }

        initPacks();

        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Effect to trigger opening of first pack safely
    useEffect(() => {
        if (packsOpened.length > 0 && currentPackIndex === -1) {
            const timer = setTimeout(() => {
                openNextPack();
            }, 100);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [packsOpened, currentPackIndex]);

    // Manual retry function
    function handleRetry() {
        // Force re-mount or reload logic would be ideal, but for now we can just calling the logic
        // We'll reset error and let the effect run? No, effect only runs on mount.
        // We can duplicate the logic or extract it. Let's extract checking the code above.
        // For simplicity in this patch, I'll essentially reload the component key or just duplicate for retry.
        // Actually, let's just make initPacks a named function outside useEffect?
        // But it relies on 'ignore' closure.
        // Let's reload the page or navigate back/forth? 
        // Or better: define generatePacks separate.
        window.location.reload();
    }

    function openNextPack() {
        if (currentPackIndex < packsOpened.length) {
            setIsOpening(true);
            setRevealedCards(new Set()); // Reset revealed cards for new pack
            setHoveredCard(null);

            // Move to next pack immediately so we render the NEW cards (face down)
            setCurrentPackIndex(prev => prev + 1);

            const packSize = 14;

            // Stagger reveal each card
            for (let i = 0; i < packSize; i++) {
                setTimeout(() => {
                    setRevealedCards(prev => new Set([...prev, i]));
                }, 300 + i * 300); // 300ms initial delay + 300ms between each card flip (slower)
            }

            // Animation complete
            setTimeout(() => {
                setIsOpening(false);
            }, 300 + packSize * 300 + 500);
        }
    }

    function openAllRemaining() {
        setCurrentPackIndex(packsOpened.length);
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
                <button className="btn btn-primary" onClick={handleRetry}>Retry</button>
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
            </div>
        );
    }

    const openedCards = packsOpened.slice(0, Math.max(0, currentPackIndex)).flat();
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
            if (card.type_line && card.type_line.includes('Land')) {
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

    // MTGA format
    function generateMTGAExport(): string {
        const lines: string[] = ['Deck'];
        const cardCounts = new Map<string, { card: ScryfallCard, count: number }>();
        openedCards.forEach(card => {
            const key = `${card.name}|${card.set}|${card.collector_number}`;
            const existing = cardCounts.get(key);
            if (existing) existing.count++;
            else cardCounts.set(key, { card, count: 1 });
        });
        for (const { card, count } of cardCounts.values()) {
            lines.push(`${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
        }
        return lines.join('\n');
    }

    // Scryfall format with foil/variants
    function generateScryfallExport(): string {
        const lines: string[] = ['// Pool - ' + settings.setName, ''];
        const cardCounts = new Map<string, { card: ScryfallCard, count: number }>();
        openedCards.forEach(card => {
            const key = card.id;
            const existing = cardCounts.get(key);
            if (existing) existing.count++;
            else cardCounts.set(key, { card, count: 1 });
        });
        for (const { card, count } of cardCounts.values()) {
            const foilMark = card._isFoil ? ' *F*' : '';
            lines.push(`${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}${foilMark}`);
        }
        return lines.join('\n');
    }

    // TTS export removed per request

    function getExportContent(): string {
        switch (exportFormat) {
            case 'mtga': return generateMTGAExport();
            case 'scryfall': return generateScryfallExport();
        }
        return '';
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(getExportContent()).then(() => {
            alert('Pool copied to clipboard!');
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
                            {Math.max(0, currentPackIndex)} / {settings.numberOfPacks} packs opened
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
                            <button className="btn btn-secondary" onClick={() => setShowExport(true)}>
                                Export Pool
                            </button>
                        )}
                    </div>
                </div>

                {/* Current or Last Pack */}
                {currentPack && (
                    <div className="current-pack-section">
                        <h3>{allOpened ? 'Last Pack' : `Pack ${currentPackIndex + 1}`}</h3>
                        <div className={`pack-reveal ${isOpening ? 'opening' : ''}`}>
                            {currentPack.map((card, i) => {
                                const isRevealed = !isOpening || revealedCards.has(i);
                                const rarityClass = card.rarity === 'mythic' ? 'is-mythic' :
                                    card.rarity === 'rare' ? 'is-rare' : '';
                                return (
                                    <div
                                        key={`${card.id}-${i}`}
                                        className={`pack-card-reveal flip-card ${isRevealed ? 'flipped' : ''} ${rarityClass}`}
                                        onMouseEnter={() => isRevealed && handleCardHover(card)}
                                    >
                                        <div className="flip-card-inner">
                                            <div className="flip-card-back">
                                                <div className="card-back-design" />
                                            </div>
                                            <div className="flip-card-front">
                                                <Card card={card} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
                                                    onMouseEnter={() => handleCardHover(card)}
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



            </div>

            {/* Sidebar for Preview */}
            <div className="sealed-sidebar">
                <div className="card-preview-area">
                    {previewCard ? (
                        <div
                            className={`preview-card fade-in ${shouldRotateCard(previewCard) ? 'rotated' : ''} ${isFlipped ? 'flipped-view' : ''}`}
                            onClick={() => setIsFlipped(!isFlipped)}
                            style={{ cursor: 'pointer' }}
                            title="Click to flip"
                        >
                            <Card
                                card={previewCard}
                                size="large"
                                face={isFlipped ? 'back' : 'front'}
                            />
                        </div>
                    ) : (
                        <div className="preview-placeholder">
                            Hover a card to view
                        </div>
                    )}
                </div>

                {/* Card Text Display */}
                {previewCard && (
                    <div className="card-text-area">
                        <a
                            href={`https://scryfall.com/card/${previewCard.set}/${previewCard.collector_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="card-name-link"
                        >
                            {previewCard.name}
                        </a>
                        {cardText && (
                            <div className="card-text-content">{formatOracleText(cardText)}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Export Modal */}
            {showExport && (
                <div className="export-modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="export-modal" onClick={e => e.stopPropagation()}>
                        <h3>Export Pool</h3>

                        <div className="export-tabs">
                            <button
                                className={`export-tab ${exportFormat === 'mtga' ? 'active' : ''}`}
                                onClick={() => setExportFormat('mtga')}
                            >
                                MTG Arena
                            </button>
                            <button
                                className={`export-tab ${exportFormat === 'scryfall' ? 'active' : ''}`}
                                onClick={() => setExportFormat('scryfall')}
                            >
                                Scryfall
                            </button>
                        </div>

                        <p className="export-hint">
                            {exportFormat === 'mtga' && 'Standard Arena format for deck import.'}
                            {exportFormat === 'scryfall' && 'Includes foil status and variant info.'}
                        </p>

                        <textarea
                            readOnly
                            value={getExportContent()}
                            className="export-textarea"
                        />
                        <div className="export-actions">
                            <button className="btn btn-primary" onClick={copyToClipboard}>
                                Copy to Clipboard
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowExport(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
