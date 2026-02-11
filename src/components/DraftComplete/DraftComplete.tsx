import { useState, useEffect } from 'react';
import type { ScryfallCard } from '../../types';
import { Card } from '../Card';
import { PoolView } from '../PoolView/PoolView';
import { shouldRotateCard, fetchCardText } from '../../services/scryfall';
import { formatOracleText } from '../../services/textFormatter';
import '../SealedOpener/SealedOpener.css'; // Re-using Sealed layout styles
import './DraftComplete.css';

interface DraftCompleteProps {
    picks: ScryfallCard[];
    setName: string;
    onNewDraft: () => void;
    onRedoDraft: () => void;
    onExport: () => void;
}

export function DraftComplete({ picks, setName, onNewDraft, onRedoDraft, onExport }: DraftCompleteProps) {
    const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);
    const [cardText, setCardText] = useState<string>('');
    const [isFlipped, setIsFlipped] = useState(false);
    const [showAllCards, setShowAllCards] = useState(true);

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

    const previewCard = hoveredCard;

    return (
        <div className="sealed-layout draft-complete-layout">
            <div className="sealed-main">
                <div className="sealed-header">
                    <div className="sealed-progress">
                        <h2>Draft Complete - {setName}</h2>
                        <p className="pack-progress">
                            {picks.length} cards drafted
                        </p>
                    </div>
                    <div className="sealed-actions">
                        <button className="btn btn-secondary" onClick={onExport}>
                            Export Pool
                        </button>
                        <button className="btn btn-secondary" onClick={onRedoDraft}>
                            Redo Draft
                        </button>
                        <button className="btn btn-primary" onClick={onNewDraft}>
                            New Draft
                        </button>
                    </div>
                </div>

                <PoolView
                    cards={picks}
                    onCardHover={handleCardHover}
                    title="Drafted Pool"
                    showAll={showAllCards}
                    onToggleShowAll={() => setShowAllCards(!showAllCards)}
                />
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
        </div>
    );
}
