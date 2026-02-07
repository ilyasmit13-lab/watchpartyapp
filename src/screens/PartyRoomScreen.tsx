import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Modal, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';

import { contentProviders } from '../providers/ContentProvider';
import { InjectedPlayer } from '../components/InjectedPlayer';
import { webRTCService } from '../services/WebRTCService';
import { RTCView } from 'react-native-webrtc';
import { useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const PartyRoomScreen = ({ route, navigation }: any) => {
    const { partyId, contentUrl } = route.params || {};
    const safeUrl = contentUrl || 'https://www.youtube.com'; // Default to homepage if empty

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(1);
    const [seekingVal, setSeekingVal] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // UI State
    const [showControls, setShowControls] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState<{ user: string, text: string }[]>([
        { user: 'System', text: `Welcome to Party ${partyId || 'Test'}` }
    ]);

    // WebRTC State
    const [permission, requestPermission] = useCameraPermissions();
    const [localStream, setLocalStream] = useState<any>(null);
    const [remoteStreams, setRemoteStreams] = useState<{ [userId: string]: any }>({});

    // Determine Source
    const [playerSource] = useState<any>(() => {
        try {
            // 1. Try Standard Providers (Regex)
            const provider = contentProviders.matchUrl(safeUrl);
            if (provider) {
                const parsed = provider.parseUrl(safeUrl);
                if (parsed) {
                    return { uri: safeUrl, provider: parsed.provider, isEmbed: parsed.provider === 'youtube', id: parsed.id };
                }
            }

            // 2. Fallback: YouTube Force
            if (safeUrl.includes('youtube.com') || safeUrl.includes('youtu.be')) {
                const idMatch = safeUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
                if (idMatch) {
                    return { uri: safeUrl, provider: 'youtube', isEmbed: true, id: idMatch[1] };
                }
            }

            // 3. Fallback: Twitch Force (Channel or Video)
            if (safeUrl.includes('twitch.tv')) {
                if (safeUrl.includes('/videos/')) {
                    const parts = safeUrl.split('/videos/');
                    if (parts[1]) {
                        const id = parts[1].split('/')[0].split('?')[0];
                        return { uri: safeUrl, provider: 'twitch', isEmbed: true, id, type: 'video' };
                    }
                } else {
                    const parts = safeUrl.split('twitch.tv/');
                    if (parts[1]) {
                        const id = parts[1].split('/')[0].split('?')[0];
                        if (id && id !== 'search' && id !== 'directory') {
                            return { uri: safeUrl, provider: 'twitch', isEmbed: true, id, type: 'channel' };
                        }
                    }
                }
            }

            // 4. Fallback: Direct File or Web Video
            const isDirectFile = safeUrl.endsWith('.mp4') || safeUrl.endsWith('.mov') || safeUrl.endsWith('.m3u8');
            if (isDirectFile) {
                return { uri: safeUrl, provider: 'direct_file', isEmbed: false };
            } else {
                return { uri: safeUrl, provider: 'web_video', isEmbed: false };
            }
        } catch (e) {
            return { uri: safeUrl, provider: 'web_video', isEmbed: false };
        }
    });

    useEffect(() => {
        const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
            const isLandscape = evt.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                evt.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
            setIsFullscreen(isLandscape);
        });
        return () => { ScreenOrientation.removeOrientationChangeListener(subscription); };
    }, []);

    const [participants, setParticipants] = useState<any[]>([]);

    useEffect(() => {
        // Permissions
        (async () => {
            if (!permission || !permission.granted) {
                await requestPermission();
            }
        })();

        // Connect
        if (partyId) {
            webRTCService.connect(partyId, contentUrl);
        }
        
        // Listeners for streams
        const handleLocal = (stream: any) => setLocalStream(stream);
        const handleRemote = ({ userId, stream }: any) => {
            setRemoteStreams(prev => ({ ...prev, [userId]: stream }));
        };
        const handleLeft = (userId: string) => {
            setRemoteStreams(prev => {
                const copy = { ...prev };
                delete copy[userId];
                return copy;
            });
        };

        webRTCService.on('local_stream', handleLocal);
        webRTCService.on('remote_stream', handleRemote);
        webRTCService.on('participant_left', handleLeft);

        return () => {
             webRTCService.leave(); 
             webRTCService.off('local_stream', handleLocal);
             webRTCService.off('remote_stream', handleRemote);
             webRTCService.off('participant_left', handleLeft);
        };
    }, [partyId]);

    // Notifications & Presence & Sync
    useEffect(() => {
        const handleChatMsg = (msg: any) => {
            const displayUser = msg.user_id === 'me' || msg.user_id === webRTCService.userId ? 'Me' : 'User ' + (msg.user_id ? msg.user_id.substr(0, 4) : 'Unknown');
            setMessages(prev => [...prev, { user: displayUser, text: msg.text }]);
        };

        const handleHistory = (history: any[]) => {
            const formatted = history.map(h => ({
                user: h.user_id === 'me' || h.user_id === webRTCService.userId ? 'Me' : 'User ' + (h.user_id ? h.user_id.substr(0, 4) : 'Unknown'),
                text: h.text
            }));
            setMessages(prev => [...prev, ...formatted]);
        };

        const handleParticipants = (users: any[]) => {
            const others = users.filter(u => u.userId !== webRTCService.userId);
            setParticipants(others);
        };

        const handleSync = (state: any) => {
            if (state.contentUrl && state.contentUrl !== contentUrl) {
                // If content differs, reload the PartyRoom with new URL
                // We use replace to avoid stacking
                navigation.replace('PartyRoom', { partyId, contentUrl: state.contentUrl });
            }
            if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
            if (state.positionMs !== undefined) {
                // ideally seek here if delta is large
            }
        };

        webRTCService.on('chat_message', handleChatMsg);
        webRTCService.on('chat_history', handleHistory);
        webRTCService.on('participants_list', handleParticipants);
        webRTCService.on('sync_state', handleSync);

        return () => {
            webRTCService.off('chat_message', handleChatMsg);
            webRTCService.off('chat_history', handleHistory);
            webRTCService.off('participants_list', handleParticipants);
            webRTCService.off('sync_state', handleSync);
        };
    }, [contentUrl, partyId]);

    // ... (rest of logic)



    const sendMessage = () => {
        if (!messageText.trim()) return;
        // Optimistic UI update
        // setMessages([...messages, { user: 'Me', text: messageText }]);

        // Send to backend
        webRTCService.sendChatMessage(messageText);
        setMessageText('');
    };

    // Missing Handlers
    const onProgress = (current: number, total: number) => {
        setCurrentTime(current);
        setDuration(total);
    };

    const togglePlayback = () => {
        setIsPlaying(!isPlaying);
    };

    const skipBackward = () => {
        setSeekingVal(currentTime - 10);
    };

    const skipForward = () => {
        setSeekingVal(currentTime + 10);
    };

    const toggleFullscreen = async () => {
        if (isFullscreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullscreen(false);
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullscreen(true);
        }
    };



    // CINEMA MODE SCRIPT for Web Video
    const cinemaScript = `
        (function() {
            function makeFull(el) {
                if (!el) return;
                el.style.position = 'fixed';
                el.style.top = '0';
                el.style.left = '0';
                el.style.width = '100vw';
                el.style.height = '100vh';
                el.style.zIndex = '9999';
                el.style.background = 'black';
                el.style.display = 'block'; 
                el.style.visibility = 'visible';
                document.body.style.overflow = 'hidden';
            }

            setInterval(() => {
                const video = document.querySelector('video');
                if (video && video.readyState > 0) {
                    makeFull(video);
                    return;
                }

                const iframes = document.querySelectorAll('iframe');
                let targetFrame = null;
                for (let i = 0; i < iframes.length; i++) {
                    const fr = iframes[i];
                    const rect = fr.getBoundingClientRect();
                    if (rect.width > 200 && rect.height > 150) {
                         targetFrame = fr;
                         break; 
                    }
                }
                if (targetFrame) {
                   makeFull(targetFrame);
                }
            }, 1000);
        })();
    `;

    return (
        <SafeAreaView style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
            {!isFullscreen && (
                <View style={styles.headerAbsolute}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="white" />
                        <Text style={styles.backText}>Leave</Text>
                    </TouchableOpacity>
                    <View style={styles.partyIdBadge}>
                        <Text style={styles.partyIdLabel}>Code:</Text>
                        <Text style={styles.partyIdValue} selectable>{partyId}</Text>
                    </View>
                </View>
            )}

            <View style={[styles.videoWrapper, isFullscreen && styles.fullscreenVideo]}>

                {/* --- YOUTUBE --- */}
                {playerSource.provider === 'youtube' ? (
                    <InjectedPlayer
                        videoId={playerSource.id}
                        isPlaying={isPlaying}
                        seekTo={seekingVal}
                        onReady={() => console.log('YT Ready')}
                        onProgress={onProgress}
                        onError={(e: string) => alert(e)}
                    />
                )
                    /* --- TWITCH --- */
                    : playerSource.provider === 'twitch' ? (
                        <WebView
                            source={{ uri: `https://player.twitch.tv/?${playerSource.type}=${playerSource.id}&parent=twitch.tv&autoplay=true&muted=false&controls=true` }}
                            style={{ flex: 1, backgroundColor: 'black' }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            allowsInlineMediaPlayback={true}
                            originWhitelist={['*']}
                            mediaPlaybackRequiresUserAction={false}
                            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                        />
                    )
                        /* --- WEB VIDEO (Generic Webpage) --- */
                        : playerSource.provider === 'web_video' ? (
                            <WebView
                                source={{ uri: playerSource.uri }}
                                style={{ flex: 1, backgroundColor: 'black' }}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                allowsInlineMediaPlayback={true}
                                originWhitelist={['*']}
                                mediaPlaybackRequiresUserAction={false}
                                injectedJavaScript={cinemaScript}
                                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                            />
                        )
                            /* --- DIRECT PLAYER (MP4 etc) --- */
                            : (
                                <Video
                                    source={{ uri: safeUrl }}
                                    style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
                                    resizeMode={ResizeMode.CONTAIN}
                                    useNativeControls={true}
                                    shouldPlay={isPlaying}
                                    isLooping
                                />
                            )}

                {/* CONTROLS (Only for YouTube as others have native/web controls) */}
                {playerSource.provider === 'youtube' && (
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.controlsOverlay}
                        onPress={() => setShowControls(!showControls)}
                    >
                        {showControls && (
                            <>
                                <View style={styles.centerControls}>
                                    <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
                                        <MaterialIcons name="replay-10" size={42} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={44} color="black" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
                                        <MaterialIcons name="forward-10" size={42} color="white" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.controlBarBottom}>
                                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                    <Slider
                                        style={styles.slider}
                                        minimumValue={0} maximumValue={duration} value={currentTime}
                                        onSlidingComplete={setSeekingVal}
                                        minimumTrackTintColor="#34C759"
                                        maximumTrackTintColor="#ffffff"
                                        thumbTintColor="#34C759"
                                    />
                                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                                    <TouchableOpacity onPress={toggleFullscreen} style={{ marginLeft: 10 }}>
                                        <Ionicons name={isFullscreen ? "contract" : "expand"} size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Flat Participants & Chat Area */}
            {!isFullscreen && (
                <>
                    <View style={styles.controlBar}>
                        <TouchableOpacity style={styles.controlBtn} onPress={() => setIsChatOpen(true)}>
                            <Ionicons name="chatbubble" size={20} color="white" style={{ marginBottom: 2 }} />
                            <Text style={styles.controlText}>Chat</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.bottomPanel}>
                        <Text style={styles.sectionTitle}>Participants</Text>
                        <ScrollView horizontal contentContainerStyle={{ gap: 10 }} style={styles.participantRow} showsHorizontalScrollIndicator={false}>

                            {/* LOCAL USER (ME) */}
                            <View style={styles.participantTile}>
                                <View style={[styles.cameraContainer, { backgroundColor: '#333' }]}>
                                    {localStream ? (
                                        <RTCView
                                            streamURL={localStream.toURL()}
                                            style={styles.rtcVideo}
                                            objectFit="cover"
                                            mirror={true}
                                        />
                                    ) : (
                                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                            <Ionicons name="videocam-off" size={30} color="#666" />
                                        </View>
                                    )}
                                    <View style={styles.nameTag}><Text style={styles.nameText}>Me</Text></View>
                                </View>
                            </View>

                            {/* Remote Users */}
                            {participants.map((p, i) => {
                                const stream = remoteStreams[p.userId];
                                return (
                                    <View key={p.userId || i} style={styles.participantTile}>
                                        <View style={[styles.cameraContainer, { backgroundColor: '#222' }]}>
                                            {stream ? (
                                                <RTCView
                                                    streamURL={stream.toURL()}
                                                    style={styles.rtcVideo}
                                                    objectFit="cover"
                                                />
                                            ) : (
                                                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Ionicons name="person" size={30} color="#555" />
                                                </View>
                                            )}
                                            <View style={styles.nameTag}>
                                                <Text style={styles.nameText}>
                                                    {p.userId ? p.userId.substr(0, 4) : `Guest ${i + 1}`}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </>
            )}

            {/* Simple Chat Modal */}
            <Modal visible={isChatOpen} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.chatContainer}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatTitle}>Chat</Text>
                        <TouchableOpacity onPress={() => setIsChatOpen(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
                    </View>
                    <ScrollView style={styles.chatList}>
                        {messages.map((m, i) => (
                            <View key={i} style={styles.chatMsg}>
                                <Text style={styles.chatUser}>{m.user}</Text>
                                <Text style={styles.chatText}>{m.text}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <View style={styles.chatInputRow}>
                        <TextInput style={styles.chatInput} value={messageText} onChangeText={setMessageText} placeholder="Type..." placeholderTextColor="#666" />
                        <TouchableOpacity onPress={sendMessage}><Text style={styles.sendText}>Send</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    fullscreenContainer: { backgroundColor: 'black' },

    headerAbsolute: {
        position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },
    backText: { color: 'white', fontWeight: 'bold', marginLeft: 4 },

    partyIdBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.8)',
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20
    },
    partyIdLabel: { color: 'white', fontSize: 12, marginRight: 4, opacity: 0.8 },
    partyIdValue: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    videoWrapper: { width: '100%', height: height * 0.4, backgroundColor: 'black', position: 'relative' },
    fullscreenVideo: { height: '100%' },

    controlsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'space-between', paddingVertical: 20 },
    centerControls: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
    playButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
    skipButton: { padding: 10 },

    controlBarBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    slider: { flex: 1, marginHorizontal: 10 },
    timeText: { color: 'white', fontSize: 12, width: 40, textAlign: 'center' },

    controlBar: { flexDirection: 'row', padding: 12, justifyContent: 'space-around', backgroundColor: '#111' },
    controlBtn: { padding: 10, borderRadius: 8, backgroundColor: '#333', minWidth: 80, alignItems: 'center', justifyContent: 'center' },
    controlText: { fontWeight: '600', color: '#fff', fontSize: 12, marginTop: 2 },

    bottomPanel: { flex: 1, padding: 16 },
    sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    participantRow: {},
    participantTile: { marginRight: 12 },

    cameraContainer: {
        width: 100, height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444'
    },
    rtcVideo: { width: '100%', height: '100%' },

    nameTag: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    nameText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    chatContainer: { flex: 1, backgroundColor: '#1c1c1e' },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
    chatTitle: { color: 'white', fontSize: 17, fontWeight: '600' },
    closeText: { color: '#007AFF', fontSize: 16 },
    chatList: { flex: 1, padding: 16 },
    chatMsg: { marginBottom: 16 },
    chatUser: { color: '#888', fontSize: 12 },
    chatText: { color: 'white', fontSize: 16 },
    chatInputRow: { padding: 16, borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    chatInput: { flex: 1, backgroundColor: '#2c2c2e', color: 'white', padding: 12, borderRadius: 20, marginRight: 10 },
    sendText: { color: '#007AFF', fontWeight: 'bold' }
});
