import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Simple in-memory state
interface PartyState {
    isPlaying: boolean;
    positionMs: number;
    lastUpdate: number;
    contentUrl: string;
}

const parties: Record<string, PartyState> = {};

import { initDb, saveMessage, getMessages, saveUserToken } from './database';

// ... (imports remain)

// Initialize DB
initDb().catch(console.error);

// ... (http/io setup)

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_party', async ({ partyId, userId }) => {
        socket.join(partyId);

        // 1. Send Sync State
        if (!parties[partyId]) {
            parties[partyId] = { isPlaying: false, positionMs: 0, lastUpdate: Date.now(), contentUrl: '' };
        }
        socket.emit('sync_state', parties[partyId]);

        // 2. Send Chat History
        const history = await getMessages(partyId);
        socket.emit('chat_history', history);

        console.log(`User ${socket.id} (ID: ${userId}) joined ${partyId}`);
    });

    socket.on('chat_message', async ({ partyId, userId, text }) => {
        // Save to DB
        await saveMessage(partyId, userId, text);
        // Broadcast
        io.to(partyId).emit('chat_message', { userId, text, created_at: Date.now() });

        // TODO: Trigger Push Notification to others
    });

    socket.on('register_push_token', async ({ userId, token }) => {
        if (userId && token) {
            await saveUserToken(userId, token);
            console.log(`Saved push token for ${userId}`);
        }
    });

    socket.on('update_playback', ({ partyId, isPlaying, positionMs }) => {
        if (parties[partyId]) {
            parties[partyId] = {
                ...parties[partyId],
                isPlaying,
                positionMs,
                lastUpdate: Date.now()
            };
            socket.to(partyId).emit('sync_state', parties[partyId]);
        }
    });

    // ... (rest of socket events like webrtc)


    // --- WebRTC Signaling ---
    socket.on('webrtc_offer', ({ partyId, sdp }) => {
        socket.to(partyId).emit('webrtc_offer', { sdp, senderId: socket.id });
    });

    socket.on('webrtc_answer', ({ partyId, sdp }) => {
        socket.to(partyId).emit('webrtc_answer', { sdp, senderId: socket.id });
    });

    socket.on('webrtc_ice_candidate', ({ partyId, candidate }) => {
        socket.to(partyId).emit('webrtc_ice_candidate', { candidate, senderId: socket.id });
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
