import { useMemo } from 'react';
import type { ScryfallCard } from '../../types';
import { Card } from '../Card';
import './PoolView.css';

interface PoolViewProps {
    cards: ScryfallCard[];
    onCardHover: (card: ScryfallCard) => void;
    title?: string;
    onToggleShowAll?: () => void;
    showAll?: boolean;
    totalCardsCount?: number; // Total count if 'cards' is filtered/partial
}

export function PoolView({
    cards,
    onCardHover,
    title = "Your Pool",
    onToggleShowAll,
    showAll = true,
    totalCardsCount
}: PoolViewProps) {

    // Group cards by color identity
    const sortedPool = useMemo(() => {
        if (cards.length === 0) return null;

        const groups = {
            White: [] as ScryfallCard[],
            Blue: [] as ScryfallCard[],
            Black: [] as ScryfallCard[],
            Red: [] as ScryfallCard[],
            Green: [] as ScryfallCard[],
            Multicolor: [] as ScryfallCard[],
            Colorless: [] as ScryfallCard[],
            Land: [] as ScryfallCard[]
        };

        cards.forEach(card => {
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
                groups.Colorless.push(card);
            }
        });

        const processGroup = (groupCards: ScryfallCard[]) => {
            // Sort by name
            groupCards.sort((a, b) => a.name.localeCompare(b.name));

            // Group duplicates
            const uniqueCards = new Map<string, { card: ScryfallCard, count: number }>();
            groupCards.forEach(card => {
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
    }, [cards]);

    if (!sortedPool) return null;

    const displayedCount = cards.length;
    const actualTotalCount = totalCardsCount ?? displayedCount;

    return (
        <div className="opened-cards-section">
            <div className="pool-header-row">
                <h3>{title} ({displayedCount} cards)</h3>
                {onToggleShowAll && (
                    <button
                        className={`btn ${showAll ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={onToggleShowAll}
                    >
                        {showAll ? 'Hide' : 'Show'} Full Pool ({actualTotalCount} cards)
                    </button>
                )}
            </div>

            <div className="pool-columns">
                {Object.entries(sortedPool).map(([color, groupCards]) => {
                    if (groupCards.length === 0) return null;
                    const groupCount = groupCards.reduce((acc, c) => acc + c.count, 0);

                    return (
                        <div key={color} className="pool-column">
                            <h4 className={`color-header color-${color.toLowerCase()}`}>
                                {color} ({groupCount})
                            </h4>
                            <div className="color-cards">
                                {groupCards.map(({ card, count }, i) => (
                                    <div
                                        key={`${card.id}-${i}`}
                                        className="pool-card-stack"
                                        onMouseEnter={() => onCardHover(card)}
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
    );
}
