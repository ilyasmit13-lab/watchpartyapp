import React, { useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Text, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { ENABLE_NOLBOX } from '../config/features';

export const BrowserScreen = ({ route, navigation }: any) => {
    const { startUrl = 'https://m.youtube.com', userName = 'Guest' } = route.params || {};
    const [progress, setProgress] = useState(0);
    const [currentUrl, setCurrentUrl] = useState(startUrl);
    const [detectedVideo, setDetectedVideo] = useState<{ src?: string, pageUrl: string } | null>(null);
    const hasAutoNavigated = useRef(false);
    const lastNolboxPlayIntentAt = useRef(0);

    const generatePartyId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    const hasNolboxPlayerHash = (url: string) => /nolbox\.in/i.test(url) && /#player=\d+/i.test(url);
    const isNolboxPlaybackUrl = (url: string) =>
        /nolbox\.in/i.test(url) &&
        (/\/(watch|movie|series|episode|content|video)\b/i.test(url) ||
            /[?&#](id|vid|video|movie|series|episode|player)=/i.test(url));

    // INJECTED JS TO SNIFF VIDEOS
    const snifferScript = `
        (function() {
            var lastSentAt = 0;
            function canSend() {
                var now = Date.now();
                if (now - lastSentAt < 700) return false;
                lastSentAt = now;
                return true;
            }

            function sendDetection(video, reason) {
                if (!video) return;
                try {
                    if (!canSend()) return;
                    var current = video.currentSrc || video.src || '';
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'VIDEO_DETECTED',
                        reason: reason || 'unknown',
                        src: current,
                        pageUrl: window.location.href,
                        currentTime: Number(video.currentTime || 0),
                        paused: !!video.paused
                    }));
                } catch (e) {}
            }

            function sendIframeDetection(src, reason) {
                try {
                    if (!src || !canSend()) return;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'VIDEO_DETECTED',
                        reason: reason || 'iframe-detected',
                        src: src,
                        pageUrl: window.location.href,
                        currentTime: 0,
                        paused: false
                    }));
                } catch (e) {}
            }

            function scanForPlayingVideo() {
                try {
                    var vids = document.querySelectorAll('video');
                    for (var i = 0; i < vids.length; i++) {
                        var v = vids[i];
                        if (v && (v.currentSrc || v.src) && (!v.paused || v.readyState >= 3)) {
                            sendDetection(v, 'polling-playing-video');
                            return;
                        }
                    }
                } catch (e) {}
            }

            try {
                var originalPlay = HTMLMediaElement && HTMLMediaElement.prototype && HTMLMediaElement.prototype.play;
                if (originalPlay) {
                    HTMLMediaElement.prototype.play = function() {
                        sendDetection(this, 'play-hook');
                        return originalPlay.apply(this, arguments);
                    };
                }
            } catch (e) {}

            document.addEventListener('play', function(e) {
                if (e.target && e.target.tagName === 'VIDEO') {
                    sendDetection(e.target, 'play-event');
                }
            }, true);

            document.addEventListener('playing', function(e) {
                if (e.target && e.target.tagName === 'VIDEO') {
                    sendDetection(e.target, 'playing-event');
                }
            }, true);

            document.addEventListener('click', function(e) {
                try {
                    var el = e.target;
                    var text = '';
                    if (el) {
                        text = [
                            el.innerText || '',
                            el.textContent || '',
                            el.getAttribute && (el.getAttribute('aria-label') || ''),
                            el.id || '',
                            el.className || ''
                        ].join(' ').toLowerCase();
                    }
                    if (/play|watch|episode|movie|start|resume/.test(text)) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'PLAY_INTENT',
                            pageUrl: window.location.href
                        }));
                    }
                } catch (err) {}
            }, true);

            try {
                var observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        if (!m.addedNodes) return;
                        for (var i = 0; i < m.addedNodes.length; i++) {
                            var node = m.addedNodes[i];
                            if (!node || !node.querySelectorAll) continue;
                            if (node.tagName === 'IFRAME' && node.src) {
                                sendIframeDetection(node.src, 'mutation-iframe');
                                return;
                            }
                            var iframes = node.querySelectorAll('iframe');
                            for (var j = 0; j < iframes.length; j++) {
                                if (iframes[j] && iframes[j].src) {
                                    sendIframeDetection(iframes[j].src, 'mutation-iframe');
                                    return;
                                }
                            }
                            var videos = node.querySelectorAll('video');
                            for (var k = 0; k < videos.length; k++) {
                                sendDetection(videos[k], 'mutation-video');
                                return;
                            }
                        }
                    });
                });
                observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
            } catch (e) {}

            setInterval(function() {
                scanForPlayingVideo();
            }, 1200);
        })();
    `;

    const handleNavigationStateChange = (navState: any) => {
        const { url } = navState;
        setCurrentUrl(url);

        // 1. YouTube & Twitch: Auto-Intercept
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            navigation.replace('PartyRoom', { contentUrl: url, partyId: generatePartyId(), userName });
            return;
        }
        if (url.includes('twitch.tv/')) {
            if (url !== 'https://m.twitch.tv/' && !url.includes('/search') && !url.includes('/directory')) {
                navigation.replace('PartyRoom', { contentUrl: url, partyId: generatePartyId(), userName });
                return;
            }
        }
        // Nolbox should only auto-jump after actual playback detection.

        // 2. Generic Sites: Reset detection on nav change
        if (url !== detectedVideo?.pageUrl) {
            hasAutoNavigated.current = false;
            setDetectedVideo(null);
        }
    };

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'PLAY_INTENT') {
                const url = typeof data.pageUrl === 'string' ? data.pageUrl : currentUrl;
                if (ENABLE_NOLBOX && url.includes('nolbox.in')) {
                    lastNolboxPlayIntentAt.current = Date.now();
                    setDetectedVideo({ src: '', pageUrl: url });
                }
                return;
            }
            if (data.type === 'VIDEO_DETECTED') {
                const payload = { src: data.src, pageUrl: data.pageUrl };
                setDetectedVideo(payload);

                const isNolbox = ENABLE_NOLBOX && typeof data.pageUrl === 'string' && data.pageUrl.includes('nolbox.in');
                if (isNolbox && !hasAutoNavigated.current) {
                    const reason = typeof data.reason === 'string' ? data.reason : '';
                    const currentTime = Number(data.currentTime || 0);
                    const paused = Boolean(data.paused);
                    const recentlyIntendedPlay = Date.now() - lastNolboxPlayIntentAt.current < 15000;
                    const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : currentUrl;
                    const pageHasPlayerHash = hasNolboxPlayerHash(pageUrl);
                    const src = typeof data.src === 'string' ? data.src : '';
                    const isVidkingSrc = /vidking\.net/i.test(src);
                    const definitePlaybackReason =
                        reason === 'playing-event' ||
                        reason === 'polling-playing-video' ||
                        reason === 'mutation-video' ||
                        ((reason === 'play-event' || reason === 'play-hook') && (!paused || currentTime > 0.2));

                    const iframePlaybackReason =
                        reason === 'mutation-iframe' &&
                        (isVidkingSrc || pageHasPlayerHash) &&
                        (recentlyIntendedPlay || pageHasPlayerHash);

                    hasAutoNavigated.current = true;
                    const hasPlayableSrc =
                        src.startsWith('http') &&
                        !src.startsWith('blob:') &&
                        !src.includes('.m3u8') &&
                        !src.includes('googleads') &&
                        !src.includes('doubleclick');
                    const playbackLikely =
                        definitePlaybackReason ||
                        iframePlaybackReason ||
                        currentTime > 0.2 ||
                        (isNolboxPlaybackUrl(pageUrl) && recentlyIntendedPlay);

                    if (!playbackLikely) {
                        hasAutoNavigated.current = false;
                        return;
                    }

                    const targetUrl = hasPlayableSrc ? src : pageUrl;
                    navigation.replace('PartyRoom', { contentUrl: targetUrl, partyId: generatePartyId(), userName });
                }
            }
        } catch (e) { }
    };

    const handleWatchDetected = () => {
        if (!detectedVideo) return;

        // Logic: 
        // If src ends in .mp4/.m3u8, send src (Direct Player).
        // Otherwise, send pageUrl (Web Player).
        const isDirect = detectedVideo.src && (detectedVideo.src.endsWith('.mp4') || detectedVideo.src.endsWith('.m3u8'));
        const targetUrl = isDirect ? detectedVideo.src : detectedVideo.pageUrl;
        const newPartyId = Math.random().toString(36).substring(2, 8).toUpperCase();

        navigation.replace('PartyRoom', { contentUrl: targetUrl, partyId: newPartyId, userName });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <BlurView intensity={90} tint="dark" style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <Ionicons name="close-circle" size={32} color="white" />
                </TouchableOpacity>
                <View style={styles.urlBar}>
                    <Ionicons name="lock-closed" size={12} color="#888" style={{ marginRight: 6 }} />
                    <Text numberOfLines={1} style={styles.urlText}>{currentUrl}</Text>
                </View>
                <TouchableOpacity style={styles.menuBtn}>
                    <Ionicons name="ellipsis-horizontal-circle" size={32} color="white" />
                </TouchableOpacity>
            </BlurView>

            {progress < 1 && (
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
            )}

            <WebView
                source={{ uri: startUrl }}
                style={{ flex: 1, backgroundColor: '#000' }}
                onNavigationStateChange={handleNavigationStateChange}
                onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
                startInLoadingState={true}
                injectedJavaScript={snifferScript}
                onMessage={handleMessage}
                renderLoading={() => (
                    <View style={StyleSheet.absoluteFill}>
                        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 50 }} />
                    </View>
                )}
                allowsInlineMediaPlayback={true}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
            />

            {/* FLOATING ACTION BUTTON FOR DETECTED VIDEO */}
            {detectedVideo && (
                <TouchableOpacity style={styles.fab} onPress={handleWatchDetected}>
                    <Ionicons name="play" size={24} color="white" />
                    <Text style={styles.fabText}>
                        {detectedVideo.src ? 'Watch Found Video' : 'Watch Current Page'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        paddingTop: 50,
        paddingBottom: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    closeBtn: { padding: 4 },
    menuBtn: { padding: 4 },

    urlBar: {
        flex: 1,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        marginHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10
    },
    urlText: { color: 'white', fontSize: 12, fontWeight: '600', opacity: 0.8 },

    progressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' },
    progressFill: { height: '100%', backgroundColor: '#34C759' },

    fab: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: '#34C759',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6
    },
    fabText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});
