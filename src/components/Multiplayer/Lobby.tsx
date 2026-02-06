import { useState, useEffect } from 'react';
import { peerService, type PeerMessage } from '../../services/peerService';
import { hostDraftManager } from '../../services/HostDraftManager';
import type { MultiPlayer } from '../../types/multiplayer';
import type { DraftSettings } from '../../types';
import './Lobby.css';

interface LobbyProps {
    settings: DraftSettings;
    onHostStart: (roomId: string, players: MultiPlayer[]) => Promise<void>;
    onGameStart: (roomId: string, players: MultiPlayer[]) => void;
    onBack: () => void;
}

export function Lobby({ settings, onHostStart, onGameStart, onBack }: LobbyProps) {
    const [roomId, setRoomId] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [playerName, setPlayerName] = useState('Player ' + Math.floor(Math.random() * 1000));
    const [players, setPlayers] = useState<MultiPlayer[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [joined, setJoined] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        // Guest Listeners
        const handleLobbyUpdate = (msg: PeerMessage) => {
            setPlayers(msg.payload.players);
        };

        const handleDraftStart = (msg: PeerMessage) => {
            onGameStart(roomId || joinRoomId, msg.payload.players);
        };

        const handleJoinSuccess = (msg: PeerMessage) => {
            setPlayers(msg.payload.players);
            setJoined(true);
            setError(null);
        };

        const handleError = (msg: PeerMessage) => {
            setError(msg.payload.message);
        };

        peerService.on('lobby_update', handleLobbyUpdate);
        peerService.on('draft_started', handleDraftStart);
        peerService.on('room_joined', handleJoinSuccess);
        peerService.on('error', handleError);

        // Host local listener
        let unsubscribeHost: (() => void) | undefined;
        if (isHost) {
            unsubscribeHost = hostDraftManager.subscribeLobby((updatedPlayers) => {
                setPlayers(updatedPlayers);
            });
        }

        return () => {
            peerService.off('lobby_update', handleLobbyUpdate);
            peerService.off('draft_started', handleDraftStart);
            peerService.off('room_joined', handleJoinSuccess);
            peerService.off('error', handleError);
            if (unsubscribeHost) unsubscribeHost();
        };
    }, [roomId, joinRoomId, onGameStart, isHost]);

    async function handleCreateRoom() {
        if (!playerName.trim()) return;
        try {
            const id = await peerService.initializeHost();
            setRoomId(id);
            setJoined(true);
            setIsHost(true);

            // Register Host as player
            hostDraftManager.addHostPlayer(playerName, id);
            setPlayers(hostDraftManager.getPlayers());
        } catch (err) {
            console.error(err);
            setError('Failed to create room. Check console/network.');
        }
    }

    async function handleJoinRoom() {
        if (!playerName.trim() || !joinRoomId.trim()) return;
        try {
            setError(null);
            // Initialize and connect
            const targetId = joinRoomId.trim();
            await peerService.initializeGuest(targetId);
            setRoomId(targetId);
            // Send join request
            peerService.send(targetId, 'join_request', { name: playerName });

            // We wait for 'room_joined' message to confirm joined status (handled in effect)
        } catch (err) {
            console.error(err);
            setError('Failed to connect to room. confirm ID is correct.');
        }
    }

    async function handleStartDraft() {
        if (!isHost) return;
        setIsStarting(true);
        try {
            await onHostStart(roomId, players);
        } catch (e) {
            console.error(e);
            // If it failed, stop loading
            setIsStarting(false);
        }
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(roomId).then(() => {
            setCopySuccess('Copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    }

    // If we're not joined, show Join/Create UI
    if (!joined) {
        return (
            <div className="lobby-container fade-in">
                <h2>Multiplayer Lobby (P2P)</h2>
                <div className="lobby-form">
                    <div className="form-group">
                        <label>Your Name</label>
                        <input
                            type="text"
                            className="input-text"
                            value={playerName}
                            onChange={e => setPlayerName(e.target.value)}
                        />
                    </div>

                    <div className="lobby-actions-split">
                        <div className="action-section">
                            <h3>Create Room</h3>
                            <p>Host a new draft. You will act as the server.</p>
                            <button className="btn btn-primary" onClick={handleCreateRoom}>
                                Create Room
                            </button>
                        </div>
                        <div className="separator">OR</div>
                        <div className="action-section">
                            <h3>Join Room</h3>
                            <input
                                type="text"
                                className="input-text"
                                placeholder="Enter Host ID"
                                value={joinRoomId}
                                onChange={e => setJoinRoomId(e.target.value)}
                            />
                            <button className="btn btn-secondary" onClick={handleJoinRoom}>
                                Join Room
                            </button>
                        </div>
                    </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button className="btn btn-text" onClick={onBack}>← Back</button>
            </div>
        );
    }

    // If joined, show Waiting Room
    return (
        <div className="lobby-container fade-in">
            <div className="lobby-header">
                <h2>Room ID</h2>
                <div className="room-code-display" onClick={copyToClipboard} title="Click to copy">
                    <span className="room-code">{roomId}</span>
                    <span className="copy-hint">{copySuccess || '📋'}</span>
                </div>
                <p>Share this code with your friends!</p>
            </div>

            <div className="players-list">
                <h3>Players ({players.length})</h3>
                {players.map(p => (
                    <div key={p.id} className="player-row">
                        <span className="player-avatar">👤</span>
                        <span className="player-name">{p.name} {p.id === peerService.getId() ? '(You)' : ''} {p.id === roomId ? '(Host)' : ''}</span>
                    </div>
                ))}
            </div>

            <div className="lobby-footer">
                {isHost ? (
                    <button
                        className="btn btn-primary btn-large"
                        onClick={handleStartDraft}
                        disabled={players.length < 2 || isStarting}
                    >
                        {isStarting ? 'Generating Packs...' : `Start Draft (${settings.setName})`}
                    </button>
                ) : (
                    <div className="waiting-message">
                        Waiting for host to start...
                    </div>
                )}
                <button className="btn btn-text" onClick={onBack}>Cancel/Leave</button>
            </div>
        </div>
    );
}
