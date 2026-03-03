import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import { supabase } from './supabaseConfig';
import { RealtimeChannel } from '@supabase/supabase-js';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const generateUserId = () => `u_${Math.random().toString(36).slice(2, 10)}`;

interface Participant {
    userId: string;
    userName?: string;
    isHost?: boolean;
}

export class WebRTCService extends EventEmitter {
    private webrtc: any = null;
    private channel: RealtimeChannel | null = null;
    public isNativeModuleAvailable: boolean = false;
    public userId: string = generateUserId();
    public userName: string = 'Guest';
    public partyId: string | null = null;
    public isConnected: boolean = false;
    public localStream: any = null;
    public isAudioEnabled: boolean = true;
    public isVideoEnabled: boolean = true;
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
            this.isAudioEnabled = true;
            this.isVideoEnabled = true;
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

        await this.getLocalStream();

        // Initialize Supabase Channel
        this.channel = supabase.channel(`party_rtc_${partyId}`, {
            config: {
                presence: {
                    key: this.userId,
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                const newState = this.channel?.presenceState();
                if (!newState) return;

                const participants: Participant[] = [];
                let oldestUser: { id: string, joinedAt: number } | null = null;

                for (const [key, stateArray] of Object.entries(newState)) {
                    const state = stateArray[0] as any;
                    participants.push({
                        userId: key,
                        userName: state.userName,
                        isHost: false, // We will calculate host
                    });

                    if (!oldestUser || state.joinedAt < oldestUser.joinedAt) {
                        oldestUser = { id: key, joinedAt: state.joinedAt };
                    }
                }

                // The oldest user in the room becomes the host naturally
                participants.forEach(p => {
                    p.isHost = p.userId === oldestUser?.id;
                });

                this.isHost = this.userId === oldestUser?.id;

                this.emit('participants_list', participants);
                this.emit('role_update', { isHost: this.isHost, hostId: oldestUser?.id });

                participants.forEach((p) => {
                    if (p.userId !== this.userId && !this.peers[p.userId]) {
                        const shouldInitiate = this.userId < p.userId;
                        if (shouldInitiate) {
                            this.createPeerConnection(p.userId, true);
                        }
                    }
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                this.cleanupPeer(key);
            })
            .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
                this.emit('sync_state', payload);
            })
            .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
                this.emit('typing_start', payload);
            })
            .on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
                this.emit('typing_stop', payload);
            })
            .on('broadcast', { event: 'webrtc_offer' }, ({ payload }) => {
                if (payload.targetUserId === this.userId) {
                    this.handleSignal({ type: 'offer', data: { sdp: payload.sdp }, senderId: payload.senderId });
                }
            })
            .on('broadcast', { event: 'webrtc_answer' }, ({ payload }) => {
                if (payload.targetUserId === this.userId) {
                    this.handleSignal({ type: 'answer', data: { sdp: payload.sdp }, senderId: payload.senderId });
                }
            })
            .on('broadcast', { event: 'webrtc_ice_candidate' }, ({ payload }) => {
                if (payload.targetUserId === this.userId) {
                    this.handleSignal({ type: 'candidate', data: { candidate: payload.candidate }, senderId: payload.senderId });
                }
            });

        // Track presence
        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                this.isConnected = true;
                await this.channel?.track({
                    userName: this.userName,
                    joinedAt: Date.now()
                });
            }
        });
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
            this.channel?.send({
                type: 'broadcast',
                event: 'webrtc_ice_candidate',
                payload: {
                    senderId: this.userId,
                    targetUserId,
                    candidate: event.candidate,
                }
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
            this.channel?.send({
                type: 'broadcast',
                event: 'webrtc_offer',
                payload: {
                    senderId: this.userId,
                    targetUserId,
                    sdp: offer,
                }
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
                    this.channel?.send({
                        type: 'broadcast',
                        event: 'webrtc_answer',
                        payload: {
                            senderId: this.userId,
                            targetUserId: senderId,
                            sdp: answer,
                        }
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

    startTyping() {
        if (!this.partyId) return;
        this.channel?.send({
            type: 'broadcast',
            event: 'typing_start',
            payload: {
                userId: this.userId,
                userName: this.userName,
            }
        });
    }

    stopTyping() {
        if (!this.partyId) return;
        this.channel?.send({
            type: 'broadcast',
            event: 'typing_stop',
            payload: {
                userId: this.userId,
                userName: this.userName,
            }
        });
    }

    async updatePlaybackState(isPlaying: boolean, positionMs: number, contentUrl?: string) {
        if (!this.partyId) return;
        this.channel?.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: {
                hostId: this.userId,
                isPlaying,
                positionMs,
                contentUrl: contentUrl || undefined,
            }
        });
    }

    toggleAudio() {
        if (!this.localStream) return false;
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            this.isAudioEnabled = !this.isAudioEnabled;
            audioTracks.forEach((track: any) => {
                track.enabled = this.isAudioEnabled;
            });
            this.emit('media_toggle', { audio: this.isAudioEnabled, video: this.isVideoEnabled });
        }
        return this.isAudioEnabled;
    }

    toggleVideo() {
        if (!this.localStream) return false;
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTracks.forEach((track: any) => {
                track.enabled = this.isVideoEnabled;
            });
            this.emit('media_toggle', { audio: this.isAudioEnabled, video: this.isVideoEnabled });
        }
        return this.isVideoEnabled;
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

        if (this.channel) {
            await this.channel.untrack();
            await supabase.removeChannel(this.channel);
            this.channel = null;
        }

        this.partyId = null;
        this.isConnected = false;
    }
}

export const webRTCService = new WebRTCService();
