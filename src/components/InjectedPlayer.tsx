import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface InjectedPlayerProps {
    videoId: string;
    isPlaying: boolean;
    onReady?: () => void;
    onProgress?: (currentTime: number, duration: number) => void;
    seekTo?: number | null;
    onError?: (err: string) => void;
}

export const InjectedPlayer = ({ videoId, isPlaying, seekTo, onReady, onProgress, onError }: InjectedPlayerProps) => {
    const webViewRef = useRef<WebView>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                body { margin: 0; padding: 0; background-color: #000; overflow: hidden; display: flex; justify-content: center; alignItems: center; height: 100vh; }
                #player { width: 100%; height: 100%; }
            </style>
        </head>
        <body>
            <div id="player"></div>
            <script>
                var tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                var player;
                var timeInterval;

                function onYouTubeIframeAPIReady() {
                    player = new YT.Player('player', {
                        height: '100%',
                        width: '100%',
                        videoId: '${videoId}',
                        playerVars: {
                            'playsinline': 1,
                            'controls': 0,
                            'rel': 0,
                            'modestbranding': 1,
                            'fs': 0,
                            'iv_load_policy': 3,
                            'autohide': 1,
                            'showinfo': 0
                        },
                        events: {
                            'onReady': onPlayerReady,
                            'onStateChange': onPlayerStateChange,
                            'onError': onPlayerError
                        }
                    });
                }

                function onPlayerReady(event) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY', duration: player.getDuration() }));
                    startTimeMonitor();
                }

                function onPlayerStateChange(event) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STATE', data: event.data }));
                }

                function onPlayerError(event) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', data: event.data }));
                }

                function startTimeMonitor() {
                    clearInterval(timeInterval);
                    timeInterval = setInterval(() => {
                        if (player && player.getCurrentTime) {
                            var currentTime = player.getCurrentTime();
                            var duration = player.getDuration();
                            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TIME', currentTime: currentTime, duration: duration }));
                        }
                    }, 500);
                }

                document.addEventListener('message', function(event) { handleCommand(JSON.parse(event.data)); });
                window.addEventListener('message', function(event) { handleCommand(JSON.parse(event.data)); });

                function handleCommand(cmd) {
                    if (!player) return;
                    if (cmd.action === 'play') player.playVideo();
                    if (cmd.action === 'pause') player.pauseVideo();
                    if (cmd.action === 'seek') player.seekTo(cmd.seconds, true);
                }
            </script>
        </body>
        </html>
    `;

    // Sync Play/Pause
    useEffect(() => {
        if (!isPlayerReady) return;
        const command = isPlaying
            ? JSON.stringify({ action: 'play' })
            : JSON.stringify({ action: 'pause' });
        webViewRef.current?.injectJavaScript(`handleCommand(${command}); true;`);
    }, [isPlaying, isPlayerReady]);

    // Handle External Seek Trigger
    useEffect(() => {
        if (seekTo !== null && seekTo !== undefined && isPlayerReady) {
            webViewRef.current?.injectJavaScript(`handleCommand(${JSON.stringify({ action: 'seek', seconds: seekTo })}); true;`);
        }
    }, [seekTo, isPlayerReady]);

    const handleMessage = (event: any) => {
        try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'READY') {
                setIsPlayerReady(true);
                if (onReady) onReady();
            }
            if (msg.type === 'TIME' && onProgress) {
                onProgress(msg.currentTime, msg.duration);
            }
            if (msg.type === 'ERROR') {
                if (onError) onError(`YouTube Error Code: ${msg.data}`);
            }
        } catch (e) { }
    };

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent, baseUrl: 'https://youtube.com' }}
                style={{ flex: 1, backgroundColor: 'black' }}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
            />
            {!isPlayerReady && (
                <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    loadingOverlay: {
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center'
    }
});
