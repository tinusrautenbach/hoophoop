import { Server, Socket } from "socket.io";

export function setupSocket(io: Server) {
    io.on("connection", (socket: Socket) => {
        console.log("Client connected", socket.id);

        socket.on("join-game", (gameId) => {
            socket.join(`game-${gameId}`);
            console.log(`Socket ${socket.id} joined game-${gameId}`);
        });

        socket.on("update-game", ({ gameId, updates }) => {
            // Broadcast to everyone in the room except sender
            socket.to(`game-${gameId}`).emit("game-updated", updates);
            console.log(`Game ${gameId} updated`, updates);
        });

        socket.on("add-event", ({ gameId, event }) => {
            // Broadcast to everyone in the room except sender
            socket.to(`game-${gameId}`).emit("event-added", event);
            console.log(`Event added to game ${gameId}`, event);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });
}
