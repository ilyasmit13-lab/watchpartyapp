import React, { useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Text, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export const BrowserScreen = ({ route, navigation }: any) => {
    const { startUrl = 'https://m.youtube.com' } = route.params || {};
    const [progress, setProgress] = useState(0);
    const [currentUrl, setCurrentUrl] = useState(startUrl);
    const [detectedVideo, setDetectedVideo] = useState<{ src?: string, pageUrl: string } | null>(null);

    // INJECTED JS TO SNIFF VIDEOS
    const snifferScript = `
        (function() {
            document.addEventListener('play', function(e) {
                if(e.target.tagName === 'VIDEO') {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'VIDEO_DETECTED',
                        src: e.target.src,
                        pageUrl: window.location.href
                    }));
                }
            }, true);
        })();
    `;

    const handleNavigationStateChange = (navState: any) => {
        const { url } = navState;
        setCurrentUrl(url);

        // Helper to generate ID
        const generatePartyId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

        // 1. YouTube & Twitch: Auto-Intercept
        if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
            navigation.replace('PartyRoom', { contentUrl: url, partyId: generatePartyId() });
            return;
        }
        if (url.includes('twitch.tv/')) {
            if (url !== 'https://m.twitch.tv/' && !url.includes('/search') && !url.includes('/directory')) {
                navigation.replace('PartyRoom', { contentUrl: url, partyId: generatePartyId() });
                return;
            }
        }

        // 2. Generic Sites: Reset detection on nav change
        if (url !== detectedVideo?.pageUrl) {
            setDetectedVideo(null);
        }
    };

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'VIDEO_DETECTED') {
                // If it's a blob, we usually can't play it directly in another webview easily without keeping session.
                // But we can try to pass the Page URL and use a "Web Player" mode.
                // If it's an mp4 loop, we can pass the src.
                setDetectedVideo({ src: data.src, pageUrl: data.pageUrl });
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

        navigation.replace('PartyRoom', { contentUrl: targetUrl, partyId: newPartyId });
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
                    <Text style={styles.fabText}>Watch Found Video</Text>
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
