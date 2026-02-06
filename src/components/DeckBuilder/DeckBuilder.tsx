import { useState, useMemo } from 'react';
import type { ScryfallCard } from '../../types';
import { Card } from '../Card';
import './DeckBuilder.css';

interface DeckBuilderProps {
    picks: ScryfallCard[];
    setName: string;
    onBack: () => void;
}

// Basic lands to add
const BASIC_LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

export function DeckBuilder({ picks, setName, onBack }: DeckBuilderProps) {
    const [mainDeck, setMainDeck] = useState<ScryfallCard[]>([]);
    const [sideboard, setSideboard] = useState<ScryfallCard[]>([...picks]);
    const [landCounts, setLandCounts] = useState<Record<string, number>>({
        Plains: 0,
        Island: 0,
        Swamp: 0,
        Mountain: 0,
        Forest: 0
    });
    const [showExport, setShowExport] = useState(false);

    // Move card from sideboard to main deck
    function addToMainDeck(card: ScryfallCard) {
        setSideboard(prev => {
            const index = prev.findIndex(c => c.id === card.id);
            if (index === -1) return prev;
            return [...prev.slice(0, index), ...prev.slice(index + 1)];
        });
        setMainDeck(prev => [...prev, card]);
    }

    // Move card from main deck to sideboard
    function removeFromMainDeck(card: ScryfallCard) {
        setMainDeck(prev => {
            const index = prev.findIndex(c => c.id === card.id);
            if (index === -1) return prev;
            return [...prev.slice(0, index), ...prev.slice(index + 1)];
        });
        setSideboard(prev => [...prev, card]);
    }

    // Update land count
    function updateLandCount(land: string, delta: number) {
        setLandCounts(prev => ({
            ...prev,
            [land]: Math.max(0, prev[land] + delta)
        }));
    }

    // Calculate mana curve
    const manaCurve = useMemo(() => {
        const curve: number[] = [0, 0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6, 7+
        for (const card of mainDeck) {
            const cmc = Math.min(7, Math.floor(card.cmc));
            curve[cmc]++;
        }
        return curve;
    }, [mainDeck]);

    // Calculate color distribution
    const colorDistribution = useMemo(() => {
        const colors: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
        for (const card of mainDeck) {
            if (!card.colors || card.colors.length === 0) {
                colors.C++;
            } else {
                for (const color of card.colors) {
                    colors[color]++;
                }
            }
        }
        return colors;
    }, [mainDeck]);

    // Calculate total land count
    const totalLands = Object.values(landCounts).reduce((a, b) => a + b, 0);
    const totalCards = mainDeck.length + totalLands;

    // Generate MTGA export format
    function generateMTGAExport(): string {
        const lines: string[] = ['Deck'];

        // Count cards in main deck
        const cardCounts = new Map<string, { card: ScryfallCard, count: number }>();
        for (const card of mainDeck) {
            const key = `${card.name}|${card.set}|${card.collector_number}`;
            const existing = cardCounts.get(key);
            if (existing) {
                existing.count++;
            } else {
                cardCounts.set(key, { card, count: 1 });
            }
        }

        // Add main deck cards
        for (const { card, count } of cardCounts.values()) {
            lines.push(`${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
        }

        // Add basic lands
        for (const [land, count] of Object.entries(landCounts)) {
            if (count > 0) {
                lines.push(`${count} ${land}`);
            }
        }

        // Add sideboard
        lines.push('');
        lines.push('Sideboard');

        const sideboardCounts = new Map<string, { card: ScryfallCard, count: number }>();
        for (const card of sideboard) {
            const key = `${card.name}|${card.set}|${card.collector_number}`;
            const existing = sideboardCounts.get(key);
            if (existing) {
                existing.count++;
            } else {
                sideboardCounts.set(key, { card, count: 1 });
            }
        }

        for (const { card, count } of sideboardCounts.values()) {
            lines.push(`${count} ${card.name} (${card.set.toUpperCase()}) ${card.collector_number}`);
        }

        return lines.join('\n');
    }

    function copyToClipboard() {
        const exportText = generateMTGAExport();
        navigator.clipboard.writeText(exportText).then(() => {
            alert('Deck copied to clipboard!');
        });
    }

    // Sort cards by CMC for display
    const sortedMainDeck = [...mainDeck].sort((a, b) => a.cmc - b.cmc);
    const sortedSideboard = [...sideboard].sort((a, b) => a.cmc - b.cmc);

    return (
        <div className="deck-builder">
            <div className="deck-builder-header">
                <button className="btn btn-secondary" onClick={onBack}>
                    ← Back to Draft
                </button>
                <h2>Deck Builder - {setName}</h2>
                <button className="btn btn-primary" onClick={() => setShowExport(true)}>
                    Export to MTGA
                </button>
            </div>

            <div className="deck-builder-content">
                <div className="deck-builder-main">
                    <div className="deck-section">
                        <h3>Main Deck ({totalCards} cards)</h3>

                        <div className="deck-stats">
                            <div className="mana-curve-container">
                                <div className="mana-curve">
                                    {manaCurve.map((count, cmc) => (
                                        <div
                                            key={cmc}
                                            className="mana-curve-bar"
                                            style={{ height: `${Math.min(100, count * 15)}%` }}
                                            title={`${cmc}${cmc === 7 ? '+' : ''} CMC: ${count} cards`}
                                        />
                                    ))}
                                </div>
                                <div className="mana-curve-labels">
                                    {manaCurve.map((_, cmc) => (
                                        <span key={cmc} className="mana-curve-label">{cmc === 7 ? '7+' : cmc}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="color-distribution">
                                {Object.entries(colorDistribution).map(([color, count]) => (
                                    count > 0 && (
                                        <div key={color} className={`color-pip color-${color.toLowerCase()}`}>
                                            {count}
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>

                        <div className="basic-lands">
                            <h4>Basic Lands ({totalLands})</h4>
                            <div className="land-controls">
                                {BASIC_LANDS.map(land => (
                                    <div key={land} className="land-control">
                                        <span className={`land-name land-${land.toLowerCase()}`}>{land}</span>
                                        <div className="land-buttons">
                                            <button onClick={() => updateLandCount(land, -1)}>-</button>
                                            <span className="land-count">{landCounts[land]}</span>
                                            <button onClick={() => updateLandCount(land, 1)}>+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="deck-cards">
                            {sortedMainDeck.map((card, i) => (
                                <div
                                    key={`${card.id}-${i}`}
                                    className="deck-card"
                                    onClick={() => removeFromMainDeck(card)}
                                    title="Click to move to sideboard"
                                >
                                    <Card card={card} size="small" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="deck-builder-sidebar">
                    <div className="deck-section">
                        <h3>Sideboard / Pool ({sideboard.length} cards)</h3>
                        <p className="hint">Click cards to add to main deck</p>
                        <div className="deck-cards">
                            {sortedSideboard.map((card, i) => (
                                <div
                                    key={`${card.id}-${i}`}
                                    className="deck-card"
                                    onClick={() => addToMainDeck(card)}
                                    title="Click to add to main deck"
                                >
                                    <Card card={card} size="small" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showExport && (
                <div className="export-modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="export-modal" onClick={e => e.stopPropagation()}>
                        <h3>Export to MTG Arena</h3>
                        <textarea
                            readOnly
                            value={generateMTGAExport()}
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
