import { useState, useEffect } from 'react';
import { peerService, type PeerMessage } from '../../services/peerService';
import { hostDraftManager } from '../../services/HostDraftManager';
import { Card } from '../Card';
import { shouldRotateCard } from '../../services/scryfall';
import type { ScryfallCard } from '../../types';
import type { MultiplayerDraftState } from '../../types/multiplayer';
// Reuse styles from DraftPick
import '../DraftPick/DraftPick.css';

interface MultiplayerDraftProps {
    roomId: string; // Used to identify if we are host and context
    onComplete: (picks: ScryfallCard[]) => void;
}

export function MultiplayerDraft({ roomId, onComplete }: MultiplayerDraftProps) {
    const [gameState, setGameState] = useState<MultiplayerDraftState | null>(null);
    const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
    const [myPicks, setMyPicks] = useState<ScryfallCard[]>([]);
    const [waitingMessage, setWaitingMessage] = useState<string | null>(null);

    // Check if we are host
    const isHost = roomId === peerService.getId();

    // Derived state
    const currentPack = gameState?.hand || [];
    const pickNumber = gameState?.pickNumber || 1;
    const packNumber = gameState?.packNumber || 1;

    useEffect(() => {
        // Reset selection and waiting message when we move to a new pick/pack
        // This avoids resetting UI when we just receive a polling update with the same state
        setSelectedCard(null);
        setWaitingMessage(null);
    }, [gameState?.packNumber, gameState?.pickNumber]);

    useEffect(() => {
        let unsubscribeHost: (() => void) | undefined;

        // Common Handlers
        const handlePickConfirmed = (msg: PeerMessage) => {
            setMyPicks(prev => [...prev, msg.payload.card]);
            setWaitingMessage("Waiting for other players...");
        };

        const handleStatusUpdate = (_msg: PeerMessage) => {
            // Optional logic: we could visualize who we are waiting for using msg.payload.waitingFor
        };

        const handleDraftComplete = (msg: PeerMessage) => {
            // Find our picks. msg.payload.players is list.
            const myData = msg.payload.players.find((p: any) => p.id === peerService.getId());
            if (myData) {
                onComplete(myData.picks);
            } else {
                // Fallback to local state if for some reason not found
                onComplete(myPicks);
            }
        };

        const handleDraftState = (msg: PeerMessage) => {
            setGameState(msg.payload);
        };

        peerService.on('pick_confirmed', handlePickConfirmed);
        peerService.on('player_status_update', handleStatusUpdate);
        peerService.on('draft_complete', handleDraftComplete);
        peerService.on('draft_state', handleDraftState);

        // Host specific subscription
        if (isHost) {
            // Initialize view with current state
            const initialState = hostDraftManager.getHostState();
            if (initialState) setGameState(initialState);

            unsubscribeHost = hostDraftManager.subscribe((state) => {
                setGameState(state);
            });
        }

        return () => {
            peerService.off('pick_confirmed', handlePickConfirmed);
            peerService.off('player_status_update', handleStatusUpdate);
            peerService.off('draft_complete', handleDraftComplete);
            peerService.off('draft_state', handleDraftState);
            if (unsubscribeHost) unsubscribeHost();
        };
    }, [isHost, onComplete, roomId]);

    // State Polling (for Guests)
    // We poll every 5 seconds to ensure we don't get desynced or stuck waiting
    useEffect(() => {
        if (isHost) return;

        // Immediate request on mount
        peerService.send(roomId, 'request_state', {});

        const interval = setInterval(() => {
            peerService.send(roomId, 'request_state', {});
        }, 5000);

        return () => clearInterval(interval);
    }, [isHost, roomId]);

    function handleConfirmPick() {
        if (!selectedCard) return;

        if (isHost) {
            // Host action
            hostDraftManager.handleHostPick(selectedCard.id);
            setMyPicks(prev => [...prev, selectedCard]);
            setWaitingMessage("Waiting for other players...");
        } else {
            // Guest action
            peerService.send(roomId, 'make_pick', { cardId: selectedCard.id });
        }
    }

    // Hover state for zooming
    const [hoveredCard, setHoveredCard] = useState<ScryfallCard | null>(null);

    // Determines which card to preview (hovered > selected)
    const previewCard = hoveredCard || selectedCard;

    function handleCardHover(card: ScryfallCard) {
        setHoveredCard(card);
    }

    function handleCardLeave() {
        setHoveredCard(null);
    }

    // Import helper if not already imported (it's not, we need to add it to imports)
    // Actually, I'll add the import in a separate edit or assume I can add it now.
    // Wait, I can't add imports easily with replace_file_content if I'm only replacing this block.
    // I will replace the component body and then I will check imports.

    // ... wait, I need `shouldRotateCard` which is not imported. 
    // I should use multi_replace to handle imports and the component body.
    // But since I'm here, I will just rewrite the component body to match the DraftPick structure
    // and I'll do a separate pass for imports if needed, or I'll just use replace_file_content on the whole file 
    // but that's risky if it's too big. The file is small enough (189 lines).
    // Let's stick to the plan: I'll replace the return statement and add the necessary state/functions.

    if (!gameState) {
        return <div className="loading">Loading draft state...</div>;
    }

    if (waitingMessage) {
        return (
            <div className="draft-layout">
                <div className="draft-main">
                    <div className="waiting-screen">
                        <h2>Pack {packNumber}, Pick {pickNumber}</h2>
                        <div className="waiting-animation">⏳</div>
                        <p>{waitingMessage}</p>
                        {gameState.waitingFor && gameState.waitingFor.length > 0 && (
                            <p className="waiting-details">Waiting for: {gameState.waitingFor.join(', ')}</p>
                        )}
                    </div>
                </div>
                {/* Still show sidebar while waiting so you can see your picks */}
                <div className="draft-sidebar">
                    <div className="card-preview-area">
                        {/* Empty preview when waiting/no hover */}
                        <div className="preview-placeholder">Waiting...</div>
                    </div>
                    {renderPickList()}
                </div>
            </div>
        );
    }

    function renderPickList() {
        return (
            <div className="pool-preview">
                <h3>Your Picks ({myPicks.length})</h3>

                {(['mythic', 'rare', 'uncommon', 'common'] as const).map(rarity => {
                    const cards = myPicks.filter(c => c.rarity === rarity);
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
                                        onMouseLeave={handleCardLeave}
                                    >
                                        <Card card={card} size="small" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="draft-layout">
            <div className="draft-main">
                <div className="draft-header">
                    <div className="draft-info">
                        <div className="draft-info-item">
                            <span className="draft-info-label">Pack</span>
                            <span className="draft-info-value">{packNumber}</span>
                        </div>
                        <div className="draft-info-item">
                            <span className="draft-info-label">Pick</span>
                            <span className="draft-info-value">{pickNumber}</span>
                        </div>
                    </div>
                    <div className="draft-controls">
                        <button
                            className="btn btn-primary"
                            disabled={!selectedCard}
                            onClick={handleConfirmPick}
                        >
                            Confirm Pick
                        </button>
                    </div>
                </div>

                <div className="pack-container">
                    {currentPack.map((card, index) => (
                        <div
                            key={`${card.id}-${index}`}
                            className={`pack-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                            onClick={() => setSelectedCard(card)}
                            onMouseEnter={() => handleCardHover(card)}
                            onMouseLeave={handleCardLeave}
                            onDoubleClick={() => {
                                setSelectedCard(card);
                                handleConfirmPick();
                            }}
                        >
                            <Card
                                card={card}
                                selected={selectedCard?.id === card.id}
                                onClick={() => setSelectedCard(card)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="draft-sidebar">
                {/* Large Card Preview */}
                <div className="card-preview-area">
                    {previewCard ? (
                        // Note: We need to import shouldRotateCard or replicate it. 
                        // I will assume I need to fix imports in next step.
                        <div className={`preview-card fade-in ${shouldRotateCard(previewCard) ? 'rotated' : ''}`}>
                            <Card card={previewCard} size="large" />
                        </div>
                    ) : (
                        <div className="preview-placeholder">
                            Hover a card to view
                        </div>
                    )}
                </div>

                {renderPickList()}
            </div>
        </div>
    );
}
