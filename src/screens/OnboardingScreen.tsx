import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig';

export const OnboardingScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter your email and password.");
            return;
        }

        setLoading(true);
        let authError = null;

        if (isLogin) {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            authError = error;
        } else {
            if (!name.trim()) {
                Alert.alert("Error", "Please enter a display name for signing up.");
                setLoading(false);
                return;
            }
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });
            authError = error;
        }

        setLoading(false);

        if (authError) {
            Alert.alert("Authentication Error", authError.message);
        } else {
            // We succeed, move to CreateParty screen
            // Or if they didn't provide a name (because they logged in), we should grab it or just use their email.
            const displayName = name.trim() || email.split('@')[0];
            navigation.replace('CreateParty', { userName: displayName });
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        // This attempts to use Supabase OAuth. In a bare RN app it opens a browser.
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: 'enlyn://' // Expected redirect
            }
        });
        setLoading(false);
        if (error) {
            Alert.alert("Google Auth Error", error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.glowA} />
            <View style={styles.glowB} />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        <View style={styles.heroCard}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="sparkles" size={32} color="#0E111B" />
                            </View>
                            <Text style={styles.eyebrow}>WatchParty</Text>
                            <Text style={styles.title}>Welcome to Enlyn</Text>
                            <Text style={styles.subtitle}>Sync movies, shows, and streams with your friends.</Text>
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

                        <View style={styles.formOuter}>
                            <Text style={styles.formTitle}>{isLogin ? "Log in to your account" : "Create an account"}</Text>

                            {!isLogin && (
                                <TextInput
                                    style={styles.input}
                                    placeholder="Display Name"
                                    placeholderTextColor="#6E7380"
                                    value={name}
                                    onChangeText={setName}
                                    autoCorrect={false}
                                />
                            )}

                            <TextInput
                                style={styles.input}
                                placeholder="Email address"
                                placeholderTextColor="#6E7380"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                autoCorrect={false}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#6E7380"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleAuth}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>{loading ? "Please wait..." : (isLogin ? "Log In" : "Sign Up")}</Text>
                                {!loading && <Ionicons name="arrow-forward" size={18} color="#0E111B" />}
                            </TouchableOpacity>

                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleAuth}
                                disabled={loading}
                            >
                                <Ionicons name="logo-google" size={18} color="white" />
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <View style={styles.toggleRow}>
                                <Text style={styles.toggleText}>
                                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                                </Text>
                                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                                    <Text style={styles.toggleLink}>{isLogin ? "Sign up" : "Log in"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05070D' },
    scrollContent: { flexGrow: 1, justifyContent: 'center' },
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
    content: { padding: 22, gap: 20 },
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
    formOuter: { width: '100%', marginTop: 10 },
    formTitle: { color: '#E2E8F0', marginBottom: 16, fontSize: 18, fontWeight: '700', marginLeft: 2 },
    input: {
        backgroundColor: '#111827',
        color: 'white',
        padding: 16,
        borderRadius: 14,
        fontSize: 16,
        marginBottom: 14,
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
        marginTop: 6
    },
    buttonDisabled: { backgroundColor: '#44516B', opacity: 0.7 },
    buttonText: { color: '#0E111B', fontSize: 16, fontWeight: '800' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#1F2937' },
    dividerText: { color: '#6E7380', paddingHorizontal: 12, fontSize: 12, fontWeight: '600' },

    googleButton: {
        backgroundColor: '#111827',
        flexDirection: 'row',
        padding: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#273247'
    },
    googleButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

    toggleRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, paddingBottom: 20 },
    toggleText: { color: '#8FA0C0', fontSize: 14 },
    toggleLink: { color: '#A4FF8A', fontSize: 14, fontWeight: '700' },
});
