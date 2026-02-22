import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const OnboardingScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');

    const handleContinue = () => {
        if (name.trim()) {
            navigation.replace('CreateParty', { userName: name });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.glowA} />
            <View style={styles.glowB} />
            <View style={styles.content}>
                <View style={styles.heroCard}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="sparkles" size={32} color="#0E111B" />
                    </View>
                    <Text style={styles.eyebrow}>WatchParty</Text>
                    <Text style={styles.title}>Welcome to Enlyn</Text>
                    <Text style={styles.subtitle}>Sync movies, shows, and streams with your friends in seconds.</Text>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Ionicons name="videocam" size={14} color="#A4FF8A" />
                            <Text style={styles.badgeText}>Live rooms</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="chatbubble-ellipses" size={14} color="#A4FF8A" />
                            <Text style={styles.badgeText}>Instant chat</Text>
                        </View>
                    </View>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.form}>
                    <Text style={styles.label}>What should we call you?</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your display name"
                        placeholderTextColor="#6E7380"
                        value={name}
                        onChangeText={setName}
                        autoCorrect={false}
                        autoCapitalize="words"
                    />

                    <TouchableOpacity
                        style={[styles.button, !name.trim() && styles.buttonDisabled]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.buttonText}>Enter Lobby</Text>
                        <Ionicons name="arrow-forward" size={18} color="#0E111B" />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05070D' },
    glowA: {
        position: 'absolute',
        top: -80,
        right: -40,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(74, 222, 128, 0.18)',
    },
    glowB: {
        position: 'absolute',
        bottom: -120,
        left: -40,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(56, 189, 248, 0.14)',
    },
    content: { flex: 1, padding: 22, justifyContent: 'center', gap: 20 },
    heroCard: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E2433',
        backgroundColor: '#0D1220',
        padding: 22,
    },
    iconContainer: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#A4FF8A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    eyebrow: { color: '#8FA0C0', fontSize: 13, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: '800', color: 'white', marginBottom: 10 },
    subtitle: { fontSize: 15, lineHeight: 22, color: '#9AA4BA', marginBottom: 18 },
    badgeRow: { flexDirection: 'row', gap: 10 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141C2D',
        borderWidth: 1,
        borderColor: '#1F2A42',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        gap: 6,
    },
    badgeText: { color: '#D5DCEB', fontSize: 12, fontWeight: '600' },
    form: { width: '100%' },
    label: { color: '#E2E8F0', marginBottom: 10, fontSize: 14, fontWeight: '700', marginLeft: 2 },
    input: {
        backgroundColor: '#111827',
        color: 'white',
        padding: 16,
        borderRadius: 14,
        fontSize: 17,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#273247'
    },
    button: {
        backgroundColor: '#A4FF8A',
        flexDirection: 'row',
        padding: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    buttonDisabled: { backgroundColor: '#44516B', opacity: 0.7 },
    buttonText: { color: '#0E111B', fontSize: 16, fontWeight: '800' },
});
