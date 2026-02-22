import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { initDb, saveMessage, getMessages } from './database';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

interface PartyState {
    isPlaying: boolean;
    positionMs: number;
    lastUpdate: number;
    contentUrl: string;
    hostId: string | null;
}

interface PartyParticipant {
    userId: string;
    userName: string;
    socketId: string;
    joinedAt: number;
}

interface JoinPartyPayload {
    partyId: string;
    userId: string;
    userName?: string;
    contentUrl?: string;
}

interface LeavePartyPayload {
    partyId: string;
}

interface ChatMessagePayload {
    partyId: string;
    userId: string;
    userName?: string;
    text: string;
}

interface RegisterPushTokenPayload {
    userId: string;
    token: string;
}

interface TypingPayload {
    partyId: string;
    userId: string;
    userName?: string;
}

interface UpdatePlaybackPayload {
    partyId: string;
    userId: string;
    isPlaying: boolean;
    positionMs: number;
    contentUrl?: string;
}

interface WebRTCOfferPayload {
    partyId: string;
    targetUserId?: string;
    sdp: any;
}

interface WebRTCAnswerPayload {
    partyId: string;
    targetUserId?: string;
    sdp: any;
}

interface WebRTCIceCandidatePayload {
    partyId: string;
    targetUserId?: string;
    candidate: any;
}

const parties: Record<string, PartyState> = {};
const partyParticipants: Record<string, Record<string, PartyParticipant>> = {};
const ENABLE_PUSH_NOTIFICATIONS = false;

const getParticipantsList = (partyId: string) => {
    const party = partyParticipants[partyId] || {};
    const hostId = parties[partyId]?.hostId || null;

    return Object.values(party).map((p) => ({
        userId: p.userId,
        userName: p.userName,
        isHost: p.userId === hostId,
    }));
};

const findSocketByUserId = (partyId: string, userId: string) => {
    const party = partyParticipants[partyId] || {};
    const entry = Object.values(party).find((p) => p.userId === userId);
    return entry?.socketId || null;
};

const removeParticipantBySocket = (socketId: string) => {
    Object.keys(partyParticipants).forEach((partyId) => {
        const party = partyParticipants[partyId];
        if (!party[socketId]) return;

        const leavingUser = party[socketId].userId;
        delete party[socketId];

        if (Object.keys(party).length === 0) {
            delete partyParticipants[partyId];
            delete parties[partyId];
            return;
        }

        if (parties[partyId]?.hostId === leavingUser) {
            const nextHost = Object.values(party)[0];
            parties[partyId].hostId = nextHost?.userId || null;
        }

        io.to(partyId).emit('participants_list', getParticipantsList(partyId));
        io.to(partyId).emit('sync_state', parties[partyId]);
    });
};

initDb().catch(console.error);

app.get('/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({ ok: true });
});

io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_party', async ({ partyId, userId, userName, contentUrl }: JoinPartyPayload) => {
        if (!partyId || !userId) return;

        socket.join(partyId);

        if (!parties[partyId]) {
            parties[partyId] = {
                isPlaying: false,
                positionMs: 0,
                lastUpdate: Date.now(),
                contentUrl: contentUrl || '',
                hostId: userId,
            };
        } else if (!parties[partyId].hostId) {
            parties[partyId].hostId = userId;
        }

        if (!partyParticipants[partyId]) {
            partyParticipants[partyId] = {};
        }

        partyParticipants[partyId][socket.id] = {
            userId,
            userName: userName || 'Guest',
            socketId: socket.id,
            joinedAt: Date.now(),
        };

        socket.data.partyId = partyId;
        socket.data.userId = userId;

        socket.emit('sync_state', parties[partyId]);
        socket.emit('chat_history', await getMessages(partyId));

        io.to(partyId).emit('participants_list', getParticipantsList(partyId));

        console.log(`User ${socket.id} (ID: ${userId}) joined ${partyId}`);
    });

    socket.on('leave_party', ({ partyId }: LeavePartyPayload) => {
        if (!partyId || !partyParticipants[partyId]) return;

        if (partyParticipants[partyId][socket.id]) {
            const leavingUser = partyParticipants[partyId][socket.id].userId;
            delete partyParticipants[partyId][socket.id];

            if (Object.keys(partyParticipants[partyId]).length === 0) {
                delete partyParticipants[partyId];
                delete parties[partyId];
                return;
            }

            if (parties[partyId]?.hostId === leavingUser) {
                const nextHost = Object.values(partyParticipants[partyId])[0];
                parties[partyId].hostId = nextHost?.userId || null;
            }

            io.to(partyId).emit('participants_list', getParticipantsList(partyId));
            io.to(partyId).emit('sync_state', parties[partyId]);
        }

        socket.leave(partyId);
    });

    socket.on('chat_message', async ({ partyId, userId, userName, text }: ChatMessagePayload) => {
        if (!partyId || !userId || !text) return;

        await saveMessage(partyId, userId, userName || 'Guest', text);

        io.to(partyId).emit('chat_message', {
            user_id: userId,
            userName: userName || 'Guest',
            text,
            created_at: Date.now(),
        });
    });

    socket.on('typing_start', ({ partyId, userId, userName }: TypingPayload) => {
        if (!partyId || !userId) return;
        socket.to(partyId).emit('typing_start', { userId, userName: userName || 'Guest' });
    });

    socket.on('typing_stop', ({ partyId, userId, userName }: TypingPayload) => {
        if (!partyId || !userId) return;
        socket.to(partyId).emit('typing_stop', { userId, userName: userName || 'Guest' });
    });

    socket.on('register_push_token', async ({ userId, token }: RegisterPushTokenPayload) => {
        if (!ENABLE_PUSH_NOTIFICATIONS || !userId || !token) return;
    });

    socket.on('update_playback', ({ partyId, userId, isPlaying, positionMs, contentUrl }: UpdatePlaybackPayload) => {
        if (!partyId || !parties[partyId]) return;

        const state = parties[partyId];
        if (state.hostId !== userId) {
            socket.emit('playback_rejected', { reason: 'host_only' });
            return;
        }

        parties[partyId] = {
            ...state,
            isPlaying: Boolean(isPlaying),
            positionMs: Number(positionMs || 0),
            lastUpdate: Date.now(),
            contentUrl: contentUrl || state.contentUrl,
        };

        io.to(partyId).emit('sync_state', parties[partyId]);
    });

    socket.on('webrtc_offer', ({ partyId, targetUserId, sdp }: WebRTCOfferPayload) => {
        if (!partyId || !sdp) return;

        if (targetUserId) {
            const targetSocketId = findSocketByUserId(partyId, targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_offer', { sdp, senderId: socket.data.userId || socket.id });
                return;
            }
        }

        socket.to(partyId).emit('webrtc_offer', { sdp, senderId: socket.data.userId || socket.id });
    });

    socket.on('webrtc_answer', ({ partyId, targetUserId, sdp }: WebRTCAnswerPayload) => {
        if (!partyId || !sdp) return;

        if (targetUserId) {
            const targetSocketId = findSocketByUserId(partyId, targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_answer', { sdp, senderId: socket.data.userId || socket.id });
                return;
            }
        }

        socket.to(partyId).emit('webrtc_answer', { sdp, senderId: socket.data.userId || socket.id });
    });

    socket.on('webrtc_ice_candidate', ({ partyId, targetUserId, candidate }: WebRTCIceCandidatePayload) => {
        if (!partyId || !candidate) return;

        if (targetUserId) {
            const targetSocketId = findSocketByUserId(partyId, targetUserId);
            if (targetSocketId) {
                io.to(targetSocketId).emit('webrtc_ice_candidate', { candidate, senderId: socket.data.userId || socket.id });
                return;
            }
        }

        socket.to(partyId).emit('webrtc_ice_candidate', { candidate, senderId: socket.data.userId || socket.id });
    });

    socket.on('disconnect', () => {
        removeParticipantBySocket(socket.id);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
