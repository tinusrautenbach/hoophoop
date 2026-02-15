import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { setupSocket, cleanupSocketServer } from "./src/server/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    // Create HTTP server with optimized settings for high load
    const httpServer = createServer({
        // Keep-alive timeout for connections
        keepAliveTimeout: 65000,
        // Headers timeout
        headersTimeout: 66000,
        // Request timeout
        requestTimeout: 30000,
    }, handler);

    // Configure Socket.io with optimized settings for 10K+ connections
    const io = new Server(httpServer, {
        // Performance settings
        maxHttpBufferSize: 1e6, // 1MB max buffer
        pingTimeout: 60000, // 60 seconds
        pingInterval: 25000, // 25 seconds
        
        // Connection settings
        connectTimeout: 10000, // 10 second connection timeout
        
        // Transport settings
        transports: ['websocket', 'polling'],
        
        // Compression (disabled for high throughput)
        perMessageDeflate: false,
        
        // CORS settings
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true
        },
        
        // Memory management
        cleanupEmptyChildNamespaces: true,
        
        // Note: Connection limits are enforced in socket handler (15K max)
    });

    // Setup optimized socket handlers
    setupSocket(io);

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
        console.log(`\n${signal} received. Starting graceful shutdown...`);
        
        // Stop accepting new connections
        httpServer.close(async () => {
            console.log('HTTP server closed');
            
            // Cleanup socket server
            await cleanupSocketServer();
            
            console.log('Graceful shutdown complete');
            process.exit(0);
        });
        
        // Force shutdown after 10 seconds
        setTimeout(() => {
            console.error('Forced shutdown due to timeout');
            process.exit(1);
        }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
            console.log(`> Socket.io configured for high load (max 15K connections)`);
        });
});
