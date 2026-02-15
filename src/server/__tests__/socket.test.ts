import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { setupSocket } from '../socket';
import { AddressInfo } from 'node:net';
import type { Socket } from 'socket.io';

describe('Game Event Propagation', () => {
    let io: SocketServer;
    let httpServer: HttpServer;
    let serverSocket: Socket;
    let port: number;

    beforeEach(async () => {
        return new Promise<void>((resolve) => {
            httpServer = createServer();
            io = new SocketServer(httpServer);
            setupSocket(io);

            httpServer.listen(() => {
                port = (httpServer.address() as AddressInfo).port;
                resolve();
            });
        });
    });

    afterEach(() => {
        io.close();
        httpServer.close();
    });

    it('should propagate game updates to other clients in the same room', async () => {
        const client1 = Client(`http://localhost:${port}`);
        const client2 = Client(`http://localhost:${port}`);
        const gameId = 'test-game-1';

        // Wait for connection
        await new Promise<void>((resolve) => {
            let connected = 0;
            const onConnect = () => {
                connected++;
                if (connected === 2) resolve();
            };
            client1.on('connect', onConnect);
            client2.on('connect', onConnect);
        });

        // Join game
        client1.emit('join-game', gameId);
        client2.emit('join-game', gameId);

        // Wait a bit for join to process
        await new Promise((r) => setTimeout(r, 50));

        const updateData = { score: { home: 10, guest: 8 } };

        const updatePromise = new Promise<any>((resolve) => {
            client2.on('game-updated', (data) => {
                resolve(data);
            });
        });

        client1.emit('update-game', { gameId, updates: updateData });

        const receivedUpdate = await updatePromise;
        expect(receivedUpdate).toEqual(updateData);

        client1.close();
        client2.close();
    });

    it('should propagate game events to other clients in the same room', async () => {
        const client1 = Client(`http://localhost:${port}`);
        const client2 = Client(`http://localhost:${port}`);
        const gameId = 'test-game-2';

        // Wait for connection
        await new Promise<void>((resolve) => {
            let connected = 0;
            const onConnect = () => {
                connected++;
                if (connected === 2) resolve();
            };
            client1.on('connect', onConnect);
            client2.on('connect', onConnect);
        });

        // Join game
        client1.emit('join-game', gameId);
        client2.emit('join-game', gameId);

        // Wait a bit for join to process
        await new Promise((r) => setTimeout(r, 50));

        const eventData = { type: 'FOUL', player: 'Player 1' };

        const eventPromise = new Promise<any>((resolve) => {
            client2.on('event-added', (data) => {
                resolve(data);
            });
        });

        client1.emit('add-event', { gameId, event: eventData });

        const receivedEvent = await eventPromise;
        expect(receivedEvent).toEqual(eventData);

        client1.close();
        client2.close();
    });
});
