import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Modal, Platform, Share } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

import { contentProviders } from '../providers/ContentProvider';
import { InjectedPlayer } from '../components/InjectedPlayer';
import { webRTCService } from '../services/WebRTCService';
import { supabase } from '../services/supabaseConfig';

const { width, height } = Dimensions.get('window');

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const PartyRoomScreen = ({ route, navigation }: any) => {
    const { partyId, contentUrl, userName = 'Guest' } = route.params || {};
    const safeUrl = contentUrl || 'https://www.youtube.com'; // Default to homepage if empty
    const isExpoGo = Constants.appOwnership === 'expo';

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(1);
    const [seekingVal, setSeekingVal] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // UI State
    const [showControls, setShowControls] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [messages, setMessages] = useState<{ user: string, text: string, id: string }[]>([]);

    // WebRTC State
    const [localStream, setLocalStream] = useState<any>(null);
    const [remoteStreams, setRemoteStreams] = useState<{ [userId: string]: any }>({});
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [RTCViewComponent, setRTCViewComponent] = useState<any>(null);
    const [webrtcSupported, setWebrtcSupported] = useState(false);
    const lastPlaybackSyncRef = useRef(0);
    const currentTimeRef = useRef(0);
    const typingStopTimeoutRef = useRef<any>(null);
    const twitchWebViewRef = useRef<WebView>(null);
    const twitchReloadGuardRef = useRef(0);

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
        currentTimeRef.current = currentTime;
    }, [currentTime]);

    useEffect(() => {
        if (isExpoGo || !webRTCService.isSupported()) {
            setWebrtcSupported(false);
            return;
        }
        try {
            const mod = require('react-native-webrtc');
            setRTCViewComponent(() => mod.RTCView);
            setWebrtcSupported(!!mod.RTCView);
        } catch {
            setRTCViewComponent(null);
            setWebrtcSupported(false);
        }
    }, [isExpoGo]);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            if (partyId) {
                await webRTCService.connect(partyId, contentUrl, userName);
            }

            // Retry local stream acquisition after permissions settle.
            const stream = await webRTCService.getLocalStream();
            if (isMounted && stream) {
                setLocalStream(stream);
            }
        };

        init();

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
            isMounted = false;
            webRTCService.leave();
            webRTCService.off('local_stream', handleLocal);
            webRTCService.off('remote_stream', handleRemote);
            webRTCService.off('participant_left', handleLeft);
        };
    }, [partyId, webrtcSupported, contentUrl, userName]);

    // Notifications & Presence & Sync
    useEffect(() => {
        const fetchMessages = async () => {
            const { data } = await supabase
                .from('party_messages')
                .select('*')
                .eq('partyId', partyId)
                .order('createdAt', { ascending: true });

            if (data) {
                setMessages(data.map(m => ({
                    user: m.userId === webRTCService.userId ? 'Me' : m.userName,
                    text: m.text,
                    id: m.id
                })));
            }
        };

        fetchMessages();

        const sub = supabase.channel(`party-${partyId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `partyId=eq.${partyId}` }, (payload) => {
                const msg = payload.new;
                // Wait for potential out-of-order local appends
                setTimeout(() => {
                    setMessages(prev => {
                        // Prevent duplicates if we already added it locally
                        const exists = prev.find(m => m.id === msg.id);
                        if (exists) return prev;

                        const isMe = msg.userId === webRTCService.userId;
                        if (!isChatOpen && !isMe) {
                            setUnreadCount((count) => count + 1);
                        }

                        return [...prev, {
                            user: isMe ? 'Me' : msg.userName,
                            text: msg.text,
                            id: msg.id
                        }];
                    });
                }, 50);
            })
            .subscribe();

        const handleHistory = (history: any[]) => {
            const formatted = history.map(h => ({
                user: h.user_id === webRTCService.userId ? 'Me' : (h.userName || h.user_name || (h.user_id ? `User ${h.user_id.substr(0, 4)}` : 'Unknown')),
                text: h.text,
                id: h.id || String(Math.random())
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
                navigation.replace('PartyRoom', { partyId, contentUrl: state.contentUrl, userName });
            }
            if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
            if (state.positionMs !== undefined) {
                const remoteSeconds = Number(state.positionMs || 0) / 1000;
                if (Math.abs(remoteSeconds - currentTimeRef.current) > 2) {
                    setSeekingVal(remoteSeconds);
                    setCurrentTime(remoteSeconds);
                }
            }
        };

        const handleRoleUpdate = ({ isHost: host }: any) => {
            setIsHost(!!host);
        };

        const handleTypingStart = ({ userId, userName: typingName }: any) => {
            if (!userId || userId === webRTCService.userId) return;
            setTypingUsers((prev) => ({ ...prev, [userId]: typingName || `User ${String(userId).slice(0, 4)}` }));
        };

        const handleTypingStop = ({ userId }: any) => {
            if (!userId) return;
            setTypingUsers((prev) => {
                const copy = { ...prev };
                delete copy[userId];
                return copy;
            });
        };

        webRTCService.on('participants_list', handleParticipants);
        webRTCService.on('sync_state', handleSync);
        webRTCService.on('role_update', handleRoleUpdate);
        webRTCService.on('typing_start', handleTypingStart);
        webRTCService.on('typing_stop', handleTypingStop);

        return () => {
            sub.unsubscribe();
            webRTCService.off('chat_history', handleHistory);
            webRTCService.off('participants_list', handleParticipants);
            webRTCService.off('sync_state', handleSync);
            webRTCService.off('role_update', handleRoleUpdate);
            webRTCService.off('typing_start', handleTypingStart);
            webRTCService.off('typing_stop', handleTypingStop);
        };
    }, [contentUrl, partyId, navigation, userName]);

    useEffect(() => {
        if (isChatOpen) {
            setUnreadCount(0);
        }
    }, [isChatOpen]);

    // ... (rest of logic)



    const sendMessage = async () => {
        if (!messageText.trim()) return;

        const currentText = messageText.trim();
        setMessageText('');
        setIsTyping(false);
        webRTCService.stopTyping();

        // Optimistically insert
        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, { user: 'Me', text: currentText, id: tempId }]);

        // Send to Supabase
        const { error } = await supabase.from('party_messages').insert([{
            partyId: partyId,
            userId: webRTCService.userId || 'unknown-uuid',
            userName: userName,
            text: currentText
        }]);

        if (error) {
            console.error('Supabase Chat Insert Error:', error);
            alert(`Chat Error: ${error.message} - Make sure you ran the SQL setup script in Supabase!`);
        }
    };

    const shareParty = async () => {
        try {
            const deepLink = `enlyn://party/${partyId}`;
            const message = `Join my Enlyn WatchParty!\nParty Code: ${partyId}\nOpen in app: ${deepLink}`;
            await Share.share({
                message,
                title: 'Join My Party',
            });
        } catch (err) {
            console.error('Share failed', err);
        }
    };

    // Missing Handlers
    const onProgress = (current: number, total: number) => {
        setCurrentTime(current);
        setDuration(total);

        if (!isHost) return;
        const now = Date.now();
        if (now - lastPlaybackSyncRef.current > 2000) {
            lastPlaybackSyncRef.current = now;
            webRTCService.updatePlaybackState(isPlaying, current * 1000, safeUrl);
        }
    };

    const togglePlayback = () => {
        const next = !isPlaying;
        setIsPlaying(next);
        webRTCService.updatePlaybackState(next, currentTime * 1000, safeUrl);
    };

    const skipBackward = () => {
        const next = Math.max(0, currentTime - 10);
        setSeekingVal(next);
        webRTCService.updatePlaybackState(isPlaying, next * 1000, safeUrl);
    };

    const skipForward = () => {
        const next = currentTime + 10;
        setSeekingVal(next);
        webRTCService.updatePlaybackState(isPlaying, next * 1000, safeUrl);
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
                    <View style={styles.headerRightControls}>
                        <TouchableOpacity onPress={shareParty} style={styles.topActionButton}>
                            <Ionicons name="share-outline" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={styles.partyIdBadge}>
                            <Text style={styles.partyIdLabel}>Code:</Text>
                            <Text style={styles.partyIdValue} selectable>{partyId}</Text>
                        </View>
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
                            ref={twitchWebViewRef}
                            source={{
                                uri: playerSource.type === 'video'
                                    ? `https://m.twitch.tv/videos/${playerSource.id}`
                                    : `https://m.twitch.tv/${playerSource.id}`,
                            }}
                            style={{ flex: 1, backgroundColor: 'black' }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            allowsInlineMediaPlayback={true}
                            allowsFullscreenVideo={true}
                            setSupportMultipleWindows={false}
                            originWhitelist={['*']}
                            mediaPlaybackRequiresUserAction={false}
                            androidLayerType="hardware"
                            onMessage={(event) => {
                                try {
                                    const data = JSON.parse(event.nativeEvent.data || '{}');
                                    if (data?.type === 'TWITCH_STALL') {
                                        const now = Date.now();
                                        if (now - twitchReloadGuardRef.current > 15000) {
                                            twitchReloadGuardRef.current = now;
                                            twitchWebViewRef.current?.reload();
                                        }
                                    }
                                } catch { }
                            }}
                            injectedJavaScript={`
                                (function() {
                                    var lastTime = 0;
                                    var stuckFor = 0;
                                    setInterval(function() {
                                        var v = document.querySelector('video');
                                        if (!v) return;
                                        var t = Number(v.currentTime || 0);
                                        var paused = !!v.paused;
                                        if (!paused && t > 0 && Math.abs(t - lastTime) < 0.01) {
                                            stuckFor += 2;
                                        } else {
                                            stuckFor = 0;
                                        }
                                        lastTime = t;
                                        if (stuckFor >= 8) {
                                            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TWITCH_STALL' }));
                                            stuckFor = 0;
                                        }
                                    }, 2000);
                                })();
                                true;
                            `}
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
                                    <TouchableOpacity onPress={skipBackward} style={[styles.skipButton, !isHost && styles.disabledControl]}>
                                        <MaterialIcons name="replay-10" size={42} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={togglePlayback} style={[styles.playButton, !isHost && styles.disabledControl]}>
                                        <Ionicons name={isPlaying ? "pause" : "play"} size={44} color="black" style={{ marginLeft: isPlaying ? 0 : 4 }} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={skipForward} style={[styles.skipButton, !isHost && styles.disabledControl]}>
                                        <MaterialIcons name="forward-10" size={42} color="white" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.controlBarBottom}>
                                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                    <Slider
                                        style={styles.slider}
                                        minimumValue={0} maximumValue={duration} value={currentTime}
                                        onSlidingComplete={(value) => {
                                            setSeekingVal(value);
                                            if (isHost) {
                                                webRTCService.updatePlaybackState(isPlaying, value * 1000, safeUrl);
                                            }
                                        }}
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
                        <TouchableOpacity style={styles.controlBtn} onPress={() => setIsChatOpen(!isChatOpen)}>
                            <Ionicons name="chatbubbles" size={22} color="white" />
                            <Text style={styles.controlText}>Chat</Text>
                            {unreadCount > 0 && !isChatOpen && (
                                <View style={styles.chatBadge}>
                                    <Text style={styles.chatBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <View style={[styles.controlBtn, isHost ? styles.hostBtnActive : styles.guestBtnActive]}>
                            <Ionicons name={isHost ? 'shield-checkmark' : 'people'} size={22} color="white" />
                            <Text style={styles.controlText}>{isHost ? 'Host' : 'Guest'}</Text>
                        </View>
                    </View>
                    {!webrtcSupported && (
                        <Text style={styles.webrtcNotice}>
                            Voice/video chat is disabled in Expo Go. Use a development build to enable react-native-webrtc.
                        </Text>
                    )}

                    <View style={styles.bottomPanel}>
                        <Text style={styles.sectionTitle}>Participants</Text>
                        <ScrollView horizontal contentContainerStyle={{ gap: 10 }} style={styles.participantRow} showsHorizontalScrollIndicator={false}>

                            {/* LOCAL USER (ME) */}
                            <View style={styles.participantTile}>
                                <View style={styles.cameraContainer}>
                                    {webrtcSupported && RTCViewComponent && localStream && videoEnabled ? (
                                        <RTCViewComponent
                                            streamURL={localStream.toURL()}
                                            style={styles.rtcVideo}
                                            objectFit="cover"
                                            mirror={true}
                                        />
                                    ) : (
                                        <View style={styles.cameraPlaceholder}>
                                            <Ionicons name="person" size={44} color="#555" />
                                        </View>
                                    )}
                                    <View style={styles.nameTag}><Text style={styles.nameText}>Me</Text></View>

                                    <View style={styles.mediaControls}>
                                        <TouchableOpacity
                                            style={[styles.mediaBtn, !audioEnabled && styles.mediaBtnOff]}
                                            onPress={() => setAudioEnabled(webRTCService.toggleAudio())}
                                        >
                                            <Ionicons name={audioEnabled ? "mic" : "mic-off"} size={18} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.mediaBtn, !videoEnabled && styles.mediaBtnOff]}
                                            onPress={() => setVideoEnabled(webRTCService.toggleVideo())}
                                        >
                                            <Ionicons name={videoEnabled ? "videocam" : "videocam-off"} size={18} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Remote Users */}
                            {participants.map((p, i) => {
                                const stream = remoteStreams[p.userId];
                                return (
                                    <View key={p.userId || i} style={styles.participantTile}>
                                        <View style={styles.cameraContainer}>
                                            {webrtcSupported && RTCViewComponent && stream ? (
                                                <RTCViewComponent
                                                    streamURL={stream.toURL()}
                                                    style={styles.rtcVideo}
                                                    objectFit="cover"
                                                />
                                            ) : (
                                                <View style={styles.cameraPlaceholder}>
                                                    <Ionicons name="person" size={44} color="#555" />
                                                </View>
                                            )}
                                            <View style={styles.nameTag}>
                                                <Text style={styles.nameText}>
                                                    {p.userName || (p.userId ? p.userId.substr(0, 4) : `Guest ${i + 1}`)}
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

            {/* Overlay Chat Modal */}
            <Modal visible={isChatOpen} transparent={true} animationType="slide">
                <View style={styles.chatOverlayWrapper}>
                    <TouchableOpacity style={styles.chatBackdrop} activeOpacity={1} onPress={() => setIsChatOpen(false)} />
                    <View style={styles.chatContainer}>
                        <View style={styles.chatHeader}>
                            <Text style={styles.chatTitle}>Live Chat</Text>
                            <TouchableOpacity onPress={() => setIsChatOpen(false)}>
                                <Ionicons name="close-circle" size={32} color="#4A5568" />
                            </TouchableOpacity>
                        </View>
                        {Object.keys(typingUsers).length > 0 && (
                            <Text style={styles.typingNotice}>
                                {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length > 1 ? 'are' : 'is'} typing...
                            </Text>
                        )}
                        <ScrollView style={styles.chatList}>
                            {messages.map((m, i) => (
                                <View key={i} style={[styles.chatMsgWrapper, m.user === 'Me' ? styles.chatMsgWrapperMe : styles.chatMsgWrapperOther]}>
                                    {m.user !== 'Me' && <Text style={styles.chatUser}>{m.user}</Text>}
                                    <View style={[styles.chatBubble, m.user === 'Me' ? styles.chatBubbleMe : styles.chatBubbleOther]}>
                                        <Text style={[styles.chatText, m.user === 'Me' ? styles.chatTextMe : styles.chatTextOther]}>{m.text}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={styles.chatInputRow}>
                            <TextInput
                                style={styles.chatInput}
                                value={messageText}
                                onChangeText={(text) => {
                                    setMessageText(text);
                                    if (!isTyping && text.trim().length > 0) {
                                        setIsTyping(true);
                                        webRTCService.startTyping();
                                    }
                                    if (typingStopTimeoutRef.current) {
                                        clearTimeout(typingStopTimeoutRef.current);
                                    }
                                    typingStopTimeoutRef.current = setTimeout(() => {
                                        setIsTyping(false);
                                        webRTCService.stopTyping();
                                    }, 1200);
                                    if (text.trim().length === 0) {
                                        setIsTyping(false);
                                        webRTCService.stopTyping();
                                    }
                                }}
                                placeholder="Say something..."
                                placeholderTextColor="#8F9BB3"
                            />
                            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                                <Ionicons name="send" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05070D' },
    fullscreenContainer: { backgroundColor: 'black' },

    headerAbsolute: {
        position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, paddingRight: 12, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
    backText: { color: 'white', fontWeight: 'bold', marginLeft: 4 },
    headerRightControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    topActionButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#333' },

    partyIdBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.8)',
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20
    },
    partyIdLabel: { color: 'white', fontSize: 13, marginRight: 4, opacity: 0.9 },
    partyIdValue: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    videoWrapper: { width: '100%', height: height * 0.4, backgroundColor: 'black', position: 'relative' },
    fullscreenVideo: { height: '100%' },

    controlsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'space-between', paddingVertical: 20 },
    centerControls: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
    playButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
    skipButton: { padding: 10 },
    disabledControl: { opacity: 0.45 },

    controlBarBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    slider: { flex: 1, marginHorizontal: 10 },
    timeText: { color: 'white', fontSize: 12, width: 40, textAlign: 'center' },

    controlBar: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, justifyContent: 'center', gap: 16 },
    controlBtn: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    hostBtnActive: { backgroundColor: 'rgba(52, 199, 89, 0.2)', borderColor: 'rgba(52, 199, 89, 0.4)' },
    guestBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' },
    controlText: { fontWeight: '700', color: '#fff', fontSize: 15 },
    webrtcNotice: { color: '#f5c451', fontSize: 12, paddingHorizontal: 14, paddingBottom: 6 },
    chatBadge: {
        position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10,
        backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
        borderWidth: 2, borderColor: '#05070D'
    },
    chatBadgeText: { color: 'white', fontSize: 10, fontWeight: '800' },

    bottomPanel: { flex: 1, padding: 20 },
    sectionTitle: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 16 },
    participantRow: {},
    participantTile: { marginRight: 16 },

    cameraContainer: {
        width: 140, height: 190,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#161B22',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2D3748',
        position: 'relative',
    },
    cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', backgroundColor: '#161B22' },
    rtcVideo: { width: '100%', height: '100%' },

    mediaControls: { position: 'absolute', top: 10, right: 10, gap: 8 },
    mediaBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    mediaBtnOff: { backgroundColor: 'rgba(255, 59, 48, 0.8)', borderColor: '#FF3B30' },

    nameTag: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    nameText: { color: 'white', fontSize: 12, fontWeight: '700' },

    chatOverlayWrapper: { flex: 1, justifyContent: 'flex-end' },
    chatBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    chatContainer: { height: '55%', backgroundColor: '#0D1117', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: '#1F2937' },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
    chatTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
    typingNotice: { color: '#38BDF8', fontSize: 12, paddingHorizontal: 20, paddingTop: 10, fontWeight: '600' },

    chatList: { flex: 1, padding: 20 },
    chatMsgWrapper: { marginBottom: 16, maxWidth: '85%' },
    chatMsgWrapperMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    chatMsgWrapperOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    chatUser: { color: '#8B949E', fontSize: 12, marginBottom: 4, marginLeft: 2, fontWeight: '600' },
    chatBubble: { padding: 14, borderRadius: 20 },
    chatBubbleMe: { backgroundColor: '#34C759', borderBottomRightRadius: 4 },
    chatBubbleOther: { backgroundColor: '#1F2937', borderBottomLeftRadius: 4 },
    chatText: { fontSize: 15, lineHeight: 22 },
    chatTextMe: { color: 'white', fontWeight: '500' },
    chatTextOther: { color: '#E5E7EB', fontWeight: '500' },

    chatInputRow: { padding: 16, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#1F2937', flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1117' },
    chatInput: { flex: 1, backgroundColor: '#161B22', color: 'white', padding: 16, borderRadius: 24, fontSize: 16, borderWidth: 1, borderColor: '#2D3748', marginRight: 12 },
    sendButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' }
});
