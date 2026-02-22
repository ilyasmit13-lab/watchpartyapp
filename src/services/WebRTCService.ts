import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const DEFAULT_BACKEND_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

const generateUserId = () => `u_${Math.random().toString(36).slice(2, 10)}`;

interface Participant {
    userId: string;
    userName?: string;
    isHost?: boolean;
}

export class WebRTCService extends EventEmitter {
    private webrtc: any = null;
    private socket: Socket | null = null;
    public isNativeModuleAvailable: boolean = false;
    public userId: string = generateUserId();
    public userName: string = 'Guest';
    public partyId: string | null = null;
    public isConnected: boolean = false;
    public localStream: any = null;
    public peers: { [userId: string]: any } = {};
    public remoteStreams: { [userId: string]: any } = {};
    public isHost: boolean = false;

    constructor() {
        super();
        try {
            this.webrtc = require('react-native-webrtc');
            this.isNativeModuleAvailable = !!this.webrtc?.RTCPeerConnection;
        } catch {
            this.webrtc = null;
            this.isNativeModuleAvailable = false;
        }
    }

    isSupported() {
        return this.isNativeModuleAvailable;
    }

    private getBackendUrl() {
        return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
    }

    private ensureSocket() {
        if (this.socket) return;
        this.socket = io(this.getBackendUrl(), {
            transports: ['websocket'],
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 10,
        });

        this.socket.on('connect', () => {
            this.emit('connected');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.emit('disconnected');
        });

        this.socket.on('sync_state', (state: any) => {
            this.isHost = state?.hostId === this.userId;
            this.emit('sync_state', state);
            this.emit('role_update', { isHost: this.isHost, hostId: state?.hostId });
        });

        this.socket.on('chat_history', (history: any[]) => {
            this.emit('chat_history', history || []);
        });

        this.socket.on('chat_message', (msg: any) => {
            this.emit('chat_message', msg);
        });

        this.socket.on('typing_start', (payload: any) => {
            this.emit('typing_start', payload);
        });

        this.socket.on('typing_stop', (payload: any) => {
            this.emit('typing_stop', payload);
        });

        this.socket.on('participants_list', (participants: Participant[]) => {
            const list = participants || [];
            this.isHost = !!list.find((p) => p.userId === this.userId && p.isHost);
            this.emit('participants_list', list);
            this.emit('role_update', { isHost: this.isHost, hostId: list.find((p) => p.isHost)?.userId || null });

            list.forEach((p) => {
                if (p.userId !== this.userId && !this.peers[p.userId]) {
                    const shouldInitiate = this.userId < p.userId;
                    if (shouldInitiate) {
                        this.createPeerConnection(p.userId, true);
                    }
                }
            });
        });

        this.socket.on('webrtc_offer', async ({ sdp, senderId }: any) => {
            await this.handleSignal({ type: 'offer', data: { sdp }, senderId });
        });

        this.socket.on('webrtc_answer', async ({ sdp, senderId }: any) => {
            await this.handleSignal({ type: 'answer', data: { sdp }, senderId });
        });

        this.socket.on('webrtc_ice_candidate', async ({ candidate, senderId }: any) => {
            await this.handleSignal({ type: 'candidate', data: { candidate }, senderId });
        });
    }

    async getLocalStream() {
        if (!this.isNativeModuleAvailable || !this.webrtc?.mediaDevices) return null;
        if (this.localStream) return this.localStream;

        try {
            const stream = await this.webrtc.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: 640,
                    height: 480,
                    frameRate: 30,
                    facingMode: 'user',
                },
            });
            this.localStream = stream;
            this.emit('local_stream', stream);
            return stream;
        } catch (err: any) {
            console.error('Error getting local stream:', err);
            return null;
        }
    }

    async connect(partyId: string, contentUrl?: string, userName?: string) {
        if (this.isConnected && this.partyId === partyId) return;

        this.partyId = partyId;
        this.userName = userName?.trim() || this.userName;
        this.ensureSocket();

        await this.getLocalStream();

        this.socket?.emit('join_party', {
            partyId,
            userId: this.userId,
            userName: this.userName,
            contentUrl: contentUrl || '',
        });

        this.isConnected = true;
    }

    async createPeerConnection(targetUserId: string, isInitiator: boolean) {
        if (!this.isNativeModuleAvailable || !this.webrtc?.RTCPeerConnection) return;
        if (this.peers[targetUserId]) return;

        const pc = new this.webrtc.RTCPeerConnection(configuration);
        this.peers[targetUserId] = pc;

        if (this.localStream) {
            this.localStream.getTracks().forEach((track: any) => {
                pc.addTrack(track, this.localStream);
            });
        }

        pc.onicecandidate = async (event: any) => {
            if (!event.candidate || !this.partyId) return;
            this.socket?.emit('webrtc_ice_candidate', {
                partyId: this.partyId,
                targetUserId,
                candidate: event.candidate,
            });
        };

        pc.ontrack = (event: any) => {
            if (event.streams && event.streams[0]) {
                this.remoteStreams[targetUserId] = event.streams[0];
                this.emit('remote_stream', { userId: targetUserId, stream: event.streams[0] });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                this.cleanupPeer(targetUserId);
            }
        };

        if (isInitiator && this.partyId) {
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            this.socket?.emit('webrtc_offer', {
                partyId: this.partyId,
                targetUserId,
                sdp: offer,
            });
        }
    }

    async handleSignal(signal: any) {
        if (!this.isNativeModuleAvailable || !this.webrtc) return;
        const { type, data, senderId } = signal;
        if (!senderId) return;

        if (!this.peers[senderId]) {
            await this.createPeerConnection(senderId, false);
        }
        const pc = this.peers[senderId];
        if (!pc) return;

        try {
            if (type === 'offer') {
                await pc.setRemoteDescription(new this.webrtc.RTCSessionDescription(data.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                if (this.partyId) {
                    this.socket?.emit('webrtc_answer', {
                        partyId: this.partyId,
                        targetUserId: senderId,
                        sdp: answer,
                    });
                }
            } else if (type === 'answer') {
                await pc.setRemoteDescription(new this.webrtc.RTCSessionDescription(data.sdp));
            } else if (type === 'candidate' && data.candidate) {
                await pc.addIceCandidate(new this.webrtc.RTCIceCandidate(data.candidate));
            }
        } catch (e) {
            console.error('Signaling handling error', e);
        }
    }

    async sendChatMessage(text: string) {
        if (!this.partyId || !text.trim()) return;
        this.socket?.emit('chat_message', {
            partyId: this.partyId,
            userId: this.userId,
            userName: this.userName,
            text,
        });
    }

    startTyping() {
        if (!this.partyId) return;
        this.socket?.emit('typing_start', {
            partyId: this.partyId,
            userId: this.userId,
            userName: this.userName,
        });
    }

    stopTyping() {
        if (!this.partyId) return;
        this.socket?.emit('typing_stop', {
            partyId: this.partyId,
            userId: this.userId,
            userName: this.userName,
        });
    }

    async updatePlaybackState(isPlaying: boolean, positionMs: number, contentUrl?: string) {
        if (!this.partyId) return;
        this.socket?.emit('update_playback', {
            partyId: this.partyId,
            userId: this.userId,
            isPlaying,
            positionMs,
            contentUrl: contentUrl || undefined,
        });
    }

    cleanupPeer(userId: string) {
        if (this.peers[userId]) {
            this.peers[userId].close();
            delete this.peers[userId];
        }
        if (this.remoteStreams[userId]) {
            delete this.remoteStreams[userId];
        }
        this.emit('participant_left', userId);
    }

    async leave() {
        if (this.localStream) {
            this.localStream.getTracks().forEach((t: any) => t.stop());
            this.localStream = null;
        }

        Object.keys(this.peers).forEach((uid) => this.cleanupPeer(uid));

        if (this.partyId) {
            this.socket?.emit('leave_party', {
                partyId: this.partyId,
                userId: this.userId,
            });
        }

        this.partyId = null;
        this.isConnected = false;
    }
}

export const webRTCService = new WebRTCService();
