import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (gameId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // In production/standalone, we might need a specific URL. 
        // In dev with custom server, it's usually the same origin.
        const socket = io();

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join-game', gameId);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [gameId]);

    return {
        socket: socketRef.current,
        isConnected,
    };
};
