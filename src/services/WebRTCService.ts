import { EventEmitter } from 'events';
import { auth, db } from './firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
    doc, setDoc, getDoc, onSnapshot, collection, addDoc, query, orderBy, limit, updateDoc, serverTimestamp, deleteDoc, getDocs, where
} from 'firebase/firestore';
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
    MediaStream,
} from 'react-native-webrtc';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export class WebRTCService extends EventEmitter {
    public userId: string | null = null;
    public partyId: string | null = null;
    public isConnected: boolean = false;
    public localStream: MediaStream | null = null;
    public peers: { [userId: string]: RTCPeerConnection } = {};
    public remoteStreams: { [userId: string]: MediaStream } = {};

    private unsubParty: (() => void) | null = null;
    private unsubChat: (() => void) | null = null;
    private unsubSignals: (() => void) | null = null;
    private unsubParticipants: (() => void) | null = null;

    constructor() {
        super();
        onAuthStateChanged(auth, (user) => {
            if (user) this.userId = user.uid;
        });
    }

    async getLocalStream() {
        if (this.localStream) return this.localStream;
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: 640,
                    height: 480,
                    frameRate: 30,
                    facingMode: 'user', // Front camera
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

    async connect(partyId: string, contentUrl?: string) {
        if (this.isConnected && this.partyId === partyId) return;
        this.partyId = partyId;
        
        if (!auth.currentUser) await signInAnonymously(auth);
        
        // Ensure local stream is ready before joining fully
        await this.getLocalStream();

        await this.ensurePartyExists(partyId, contentUrl);

        // 1. Listen to Party State (Sync)
        this.unsubParty = onSnapshot(doc(db, 'parties', partyId), (snap) => {
            if (snap.exists()) this.emit('sync_state', snap.data());
        });

        // 2. Listen to Chat
        const chatQ = query(collection(db, 'parties', partyId, 'messages'), orderBy('createdAt', 'asc'), limit(50));
        let initialChat = true;
        this.unsubChat = onSnapshot(chatQ, (snap) => {
            if (initialChat) {
                this.emit('chat_history', snap.docs.map(d => d.data()));
                initialChat = false;
            } else {
                snap.docChanges().forEach(c => {
                    if (c.type === 'added') this.emit('chat_message', c.doc.data());
                });
            }
        });

        // 3. Join Presence & Listen to Participants
        await this.participantJoin();

        // 4. Listen to Signals (Handshake)
        const signalsRef = collection(db, 'parties', partyId, 'signals');
        const qSignals = query(signalsRef, where('targetId', '==', this.userId));
        this.unsubSignals = onSnapshot(qSignals, (snap) => {
            snap.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    await this.handleSignal(data, change.doc.id);
                }
            });
        });

        this.isConnected = true;
        this.emit('connected');
    }

    async participantJoin() {
        if (!this.partyId || !this.userId) return;
        const userRef = doc(db, 'parties', this.partyId, 'participants', this.userId);
        await setDoc(userRef, { userId: this.userId, joinedAt: serverTimestamp(), lastActive: serverTimestamp() });

        this.unsubParticipants = onSnapshot(collection(db, 'parties', this.partyId, 'participants'), (snap) => {
            const participants = snap.docs.map(d => d.data());
            this.emit('participants_list', participants);
            
            // Initiate connection to others if I am "new" (or just connect disjoint sets)
            // Simplified Mesh: If I see a participant with ID < my ID, I offer. (Or any stable tie-breaker)
            // Better: New joiner offers to existing. But simplest is just consistent logic:
            // Let's rely on the fact that existing participants are already there.
            // We iterate and connect to anyone we don't have a peer for.
            participants.forEach(p => {
                if (p.userId !== this.userId && !this.peers[p.userId]) {
                    this.createPeerConnection(p.userId, true); // Initiator logic could be refined
                }
            });
        });
    }

    async createPeerConnection(targetUserId: string, isInitiator: boolean) {
        if (this.peers[targetUserId]) return;

        const pc = new RTCPeerConnection(configuration);
        this.peers[targetUserId] = pc;

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await this.sendSignal(targetUserId, 'candidate', { candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.remoteStreams[targetUserId] = event.streams[0];
                this.emit('remote_stream', { userId: targetUserId, stream: event.streams[0] });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
               this.cleanupPeer(targetUserId);
            }
        };

        if (isInitiator) {
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            await this.sendSignal(targetUserId, 'offer', { sdp: offer });
        }
    }

    async handleSignal(signal: any, docId: string) {
        const { type, data, senderId } = signal;
        if (!this.peers[senderId]) {
            await this.createPeerConnection(senderId, false);
        }
        const pc = this.peers[senderId];

        try {
            if (type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await this.sendSignal(senderId, 'answer', { sdp: answer });
            } else if (type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } else if (type === 'candidate') {
                if (data.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
            // Delete signal after processing to keep DB clean
             await deleteDoc(doc(db, 'parties', this.partyId!, 'signals', docId));
        } catch (e) {
            console.error('Signaling handling error', e);
        }
    }

    async sendSignal(targetId: string, type: string, data: any) {
        if (!this.partyId || !this.userId) return;
        await addDoc(collection(db, 'parties', this.partyId, 'signals'), {
            type, targetId, senderId: this.userId, data, createdAt: serverTimestamp()
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
    
    // -- Chat & Sync Helpers --

    async ensurePartyExists(partyId: string, contentUrl?: string) {
        const partyRef = doc(db, 'parties', partyId);
        const snapshot = await getDoc(partyRef);
        if (!snapshot.exists()) {
            await setDoc(partyRef, { 
                id: partyId, isPlaying: false, positionMs: 0, 
                contentUrl: contentUrl || '', lastUpdate: serverTimestamp() 
            });
        }
    }

    async sendChatMessage(text: string) {
        if (!this.partyId || !this.userId) return;
        await addDoc(collection(db, 'parties', this.partyId, 'messages'), {
            partyId: this.partyId, user_id: this.userId, text, createdAt: serverTimestamp()
        });
    }

    async updatePlaybackState(isPlaying: boolean, positionMs: number) {
        if (!this.partyId) return;
        await updateDoc(doc(db, 'parties', this.partyId), { isPlaying, positionMs, lastUpdate: serverTimestamp() });
    }

    async leave() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        Object.keys(this.peers).forEach(uid => this.cleanupPeer(uid));
        
        if (this.partyId && this.userId) {
             const userRef = doc(db, 'parties', this.partyId, 'participants', this.userId);
             await deleteDoc(userRef);
        }

        if (this.unsubParty) this.unsubParty();
        if (this.unsubChat) this.unsubChat();
        if (this.unsubSignals) this.unsubSignals();
        if (this.unsubParticipants) this.unsubParticipants();
        
        this.isConnected = false;
        this.emit('disconnected');
    }
}

export const webRTCService = new WebRTCService();
