import { useState, useEffect } from 'react';
import { peerService, type PeerMessage } from '../../services/peerService';
import { hostDraftManager } from '../../services/HostDraftManager';
import { Card } from '../Card';
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
            // Only reset selection/waiting if we are actually moving to a new pick to avoid jarring UI on simple updates
            // But since handleDraftState usually means "next pack/pick", reset is mostly correct.
            // The issue before was spamming updates causing constant reset.
            setSelectedCard(null);
            setWaitingMessage(null);
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
                setSelectedCard(null);
                setWaitingMessage(null);
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

    // Request state on load (for Guests)
    useEffect(() => {
        // Only request if we don't have state yet!
        if (!isHost && !gameState) {
            console.log("Requesting draft state from host...");
            peerService.send(roomId, 'request_state', {});

            // Retry a few times if needed?
            const interval = setInterval(() => {
                console.log("Retry requesting draft state...");
                peerService.send(roomId, 'request_state', {});
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [isHost, roomId, gameState]);

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

    if (!gameState) {
        return <div className="loading">Loading draft state...</div>;
    }

    if (waitingMessage) {
        return (
            <div className="draft-container">
                <div className="waiting-screen">
                    <h2>Pack {packNumber}, Pick {pickNumber}</h2>
                    <div className="waiting-animation">⏳</div>
                    <p>{waitingMessage}</p>
                    {gameState.waitingFor && gameState.waitingFor.length > 0 && (
                        <p className="waiting-details">Waiting for: {gameState.waitingFor.join(', ')}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="draft-container">
            <header className="draft-header">
                <div className="draft-info">
                    <h2>Pack {packNumber} - Pick {pickNumber}</h2>
                    <span className="pack-count">Cards: {currentPack.length}</span>
                </div>
                {/* Timer could go here */}
            </header>

            <main className="draft-main">
                <div className="pack-container">
                    {currentPack.map((card, index) => (
                        <div
                            key={`${card.id}-${index}`}
                            className={`pack-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                            onClick={() => setSelectedCard(card)}
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
            </main>

            <footer className="draft-footer">
                <div className="draft-actions">
                    <button
                        className="btn btn-primary"
                        disabled={!selectedCard}
                        onClick={handleConfirmPick}
                    >
                        Confirm Pick
                    </button>
                    {selectedCard && <span className="selected-name">{selectedCard.name}</span>}
                </div>
                <div className="my-picks-preview">
                    <span>Picks: {myPicks.length}</span>
                </div>
            </footer>
        </div>
    );
}
