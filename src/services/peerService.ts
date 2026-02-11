
/* eslint-disable @typescript-eslint/no-explicit-any */
import Peer, { type DataConnection } from 'peerjs';

export interface PeerMessage {
    type: string;
    payload: any;
}

export type MessageHandler = (data: PeerMessage, conn: DataConnection) => void;

class PeerService {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map(); // id -> connection
    private messageHandlers: Map<string, MessageHandler[]> = new Map();
    private myId: string = '';

    // Initialize as Host
    initializeHost(): Promise<string> {
        return new Promise((resolve, reject) => {
            // No ID provided = generate random ID (PeerJS default)
            this.peer = new Peer();

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log('Host initialized with ID:', id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });
        });
    }

    // Initialize as Guest and connect to Host
    initializeGuest(hostId: string): Promise<DataConnection> {
        return new Promise((resolve, reject) => {
            this.peer = new Peer(); // Generate our own ID first

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log('Guest initialized, connecting to:', hostId);
                const conn = this.peer!.connect(hostId);

                conn.on('open', () => {
                    console.log('Connected to host');
                    this.handleConnection(conn);
                    resolve(conn);
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    reject(err);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                reject(err);
            });
        });
    }

    private handleConnection(conn: DataConnection) {
        this.connections.set(conn.peer, conn);

        conn.on('data', (data: any) => {
            const message = data as PeerMessage;
            this.triggerHandlers(message, conn);
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
        });
    }

    on(type: string, handler: MessageHandler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type)!.push(handler);
    }

    off(type: string, handler: MessageHandler) {
        const handlers = this.messageHandlers.get(type);
        if (handlers) {
            this.messageHandlers.set(type, handlers.filter(h => h !== handler));
        }
    }

    // Trigger local handlers (for when we receive data)
    private triggerHandlers(message: PeerMessage, conn: DataConnection) {
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            handlers.forEach(h => h(message, conn));
        }
    }

    // Send to specific peer
    send(connId: string, type: string, payload: any) {
        const conn = this.connections.get(connId);
        if (conn && conn.open) {
            conn.send({ type, payload });
        }
    }

    // Broadcast to all (for Host)
    broadcast(type: string, payload: any) {
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send({ type, payload });
            }
        });
    }

    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        this.messageHandlers.clear();
    }

    getId() {
        return this.myId;
    }
}

export const peerService = new PeerService();
