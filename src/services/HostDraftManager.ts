
import type { ScryfallCard } from '../types';
import type { MultiPlayer, MultiplayerDraftState } from '../types/multiplayer';
import { peerService, type PeerMessage } from './peerService';
import type { DataConnection } from 'peerjs';

// Ported from server/draftState.ts but adapted for P2P

interface PlayerState {
    id: string; // Peer ID
    name: string;
    picks: ScryfallCard[];
    currentHand: ScryfallCard[];
    hasPicked: boolean;
    isConnected: boolean;
}

export class HostDraftManager {
    private players: PlayerState[] = [];
    private unopenedPacks: ScryfallCard[][][] = []; // [playerIndex][packIndex] -> Cards[]
    private packNumber = 0;
    private totalPacks = 3;
    private isDrafting = false;
    private listeners: ((state: MultiplayerDraftState) => void)[] = [];
    private lobbyListeners: ((players: MultiPlayer[]) => void)[] = [];

    constructor() {
        // Listen for picks from peers
        peerService.on('make_pick', (msg, conn) => this.handlePick(msg, conn));
        peerService.on('join_request', (msg, conn) => this.handleJoin(msg, conn));
        peerService.on('request_state', (_msg, conn) => this.handleRequestState(conn));
    }

    private handleRequestState(conn: DataConnection) {
        const player = this.players.find(p => p.id === conn.peer);
        if (player) {
            console.log(`Sending requested state to ${player.name} (${player.id})`);
            const state: MultiplayerDraftState = {
                hand: player.currentHand,
                pickNumber: player.picks.length + 1,
                packNumber: this.packNumber + 1,
                waitingFor: this.players.filter(p => !p.hasPicked).map(p => p.name)
            };
            peerService.send(player.id, 'draft_state', state);
        } else {
            console.warn(`Peer ${conn.peer} requested state but is not in player list.`);
        }
    }

    subscribe(callback: (state: MultiplayerDraftState) => void) {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    subscribeLobby(callback: (players: MultiPlayer[]) => void) {
        this.lobbyListeners.push(callback);
        return () => { this.lobbyListeners = this.lobbyListeners.filter(l => l !== callback); };
    }

    private notifyHostState() {
        const state = this.getHostState();
        if (state) {
            this.listeners.forEach(l => l(state));
        }
    }

    private notifyHostLobby() {
        this.lobbyListeners.forEach(l => l(this.getPublicPlayers()));
    }

    handleJoin(msg: PeerMessage, conn: DataConnection) {
        const { name } = msg.payload;

        // Prevent duplicate joins or joins after start
        if (this.isDrafting) {
            peerService.send(conn.peer, 'error', { message: 'Draft already started' });
            return;
        }

        // Add player
        const newPlayer: PlayerState = {
            id: conn.peer,
            name: name || `Guest ${conn.peer.substring(0, 4)}`,
            picks: [],
            currentHand: [],
            hasPicked: false,
            isConnected: true
        };

        this.players.push(newPlayer);

        // Send welcome
        peerService.send(conn.peer, 'room_joined', {
            playerId: conn.peer,
            players: this.getPublicPlayers()
        });

        // Broadcast update to all
        this.broadcastLobbyUpdate();
    }

    // Host manually joins themselves
    addHostPlayer(name: string, hostPeerId: string) {
        this.players.push({
            id: hostPeerId,
            name: name,
            picks: [],
            currentHand: [],
            hasPicked: false,
            isConnected: true
        });
        this.broadcastLobbyUpdate();
    }

    startDraft(allPacks: ScryfallCard[][][]) {
        console.log('Host starting draft with packs:', allPacks.length);
        this.unopenedPacks = allPacks;
        this.totalPacks = allPacks[0].length;
        this.isDrafting = true;
        this.packNumber = 0;

        // Distribute first packs
        this.openNextPack();

        // Broadcast start
        peerService.broadcast('draft_started', {
            totalPacks: this.totalPacks,
            players: this.getPublicPlayers()
        });

        this.broadcastState();
    }

    private openNextPack() {
        if (this.packNumber >= this.totalPacks) {
            this.finishDraft();
            return;
        }

        // Distribute
        this.players.forEach((player, index) => {
            // Safety check
            if (this.unopenedPacks[index] && this.unopenedPacks[index][this.packNumber]) {
                player.currentHand = this.unopenedPacks[index][this.packNumber];
            } else {
                player.currentHand = []; // Should not happen
            }
            player.hasPicked = false;
        });
    }

    // Host calls this when *Host* makes a pick
    handleHostPick(cardId: string) {
        const hostPlayer = this.players.find(p => p.id === peerService.getId());
        if (hostPlayer) {
            this.processPick(hostPlayer, cardId);
        }
    }

    // Handle peer pick
    private handlePick(msg: PeerMessage, conn: DataConnection) {
        const { cardId } = msg.payload;
        const player = this.players.find(p => p.id === conn.peer);
        if (player) {
            this.processPick(player, cardId);
        }
    }

    private processPick(player: PlayerState, cardId: string) {
        if (player.hasPicked) return;

        const cardIndex = player.currentHand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const [card] = player.currentHand.splice(cardIndex, 1);
        player.picks.push(card);
        player.hasPicked = true;

        // Confirm to player (if peer)
        if (player.id !== peerService.getId()) {
            peerService.send(player.id, 'pick_confirmed', { card });
        }

        // Check rotation
        if (this.players.every(p => p.hasPicked)) {
            this.rotatePacks();
        } else {
            this.broadcastStatus();
        }
    }

    private rotatePacks() {
        if (this.players[0].currentHand.length === 0) {
            this.packNumber++;
            this.openNextPack();
        } else {
            const isPassLeft = this.packNumber % 2 === 0;
            const currentHands = this.players.map(p => p.currentHand);

            if (isPassLeft) {
                // Pass Left logic
                for (let i = 0; i < this.players.length; i++) {
                    const sourceIndex = (i - 1 + this.players.length) % this.players.length;
                    this.players[i].currentHand = currentHands[sourceIndex];
                    this.players[i].hasPicked = false;
                }
            } else {
                // Pass Right logic
                for (let i = 0; i < this.players.length; i++) {
                    const sourceIndex = (i + 1) % this.players.length;
                    this.players[i].currentHand = currentHands[sourceIndex];
                    this.players[i].hasPicked = false;
                }
            }
        }
        this.broadcastState();
    }

    private finishDraft() {
        peerService.broadcast('draft_complete', {
            players: this.players.map(p => ({ id: p.id, picks: p.picks }))
        });
        // Also notify host listener if any (managed by UI observing state usually)
    }

    private broadcastLobbyUpdate() {
        peerService.broadcast('lobby_update', { players: this.getPublicPlayers() });
        this.notifyHostLobby();
    }

    private broadcastState() {
        this.players.forEach(player => {
            const state: MultiplayerDraftState = {
                hand: player.currentHand,
                packNumber: this.packNumber + 1,
                pickNumber: player.picks.length + 1,
                waitingFor: this.players.filter(p => !p.hasPicked).map(p => p.name)
            };

            if (player.id === peerService.getId()) {
                // Host State Update
                this.notifyHostState();
            } else {
                peerService.send(player.id, 'draft_state', state);
            }
        });
    }

    private broadcastStatus() {
        const waitingFor = this.players.filter(p => !p.hasPicked).map(p => p.name);
        peerService.broadcast('player_status_update', { waitingFor });
    }

    private getPublicPlayers(): MultiPlayer[] {
        return this.players.map(p => ({
            id: p.id,
            name: p.name,
            hasPicked: p.hasPicked
        }));
    }

    // Accessors for Host UI
    getHostState(): MultiplayerDraftState | null {
        const hostPlayer = this.players.find(p => p.id === peerService.getId());
        if (!hostPlayer || !this.isDrafting) return null;

        return {
            hand: hostPlayer.currentHand,
            packNumber: this.packNumber + 1,
            pickNumber: hostPlayer.picks.length + 1,
            waitingFor: this.players.filter(p => !p.hasPicked).map(p => p.name)
        };
    }

    getPlayers() { return this.getPublicPlayers(); }
}

export const hostDraftManager = new HostDraftManager();
