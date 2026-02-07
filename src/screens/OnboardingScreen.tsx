import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export const OnboardingScreen = ({ navigation }: any) => {
    const [name, setName] = useState('');

    const handleContinue = () => {
        if (name.trim()) {
            navigation.replace('CreateParty', { userName: name });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="film-outline" size={60} color="#fff" />
                </View>

                <Text style={styles.title}>Welcome to Enlyn</Text>
                <Text style={styles.subtitle}>Watch together with friends</Text>

                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.form}>
                    <Text style={styles.label}>What should we call you?</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#666"
                        value={name}
                        onChangeText={setName}
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={[styles.button, !name.trim() && styles.buttonDisabled]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.buttonText}>Get Started</Text>
                        <Ionicons name="arrow-forward" size={20} color="black" />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    iconContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: '#111',
        justifyContent: 'center', alignItems: 'center', marginBottom: 24, alignSelf: 'center'
    },
    title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 48 },
    form: { width: '100%' },
    label: { color: 'white', marginBottom: 12, fontSize: 16, fontWeight: '600', marginLeft: 4 },
    input: {
        backgroundColor: '#1a1a1a',
        color: 'white',
        padding: 18,
        borderRadius: 12,
        fontSize: 18,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333'
    },
    button: {
        backgroundColor: 'white',
        flexDirection: 'row',
        padding: 18,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8
    },
    buttonDisabled: { backgroundColor: '#333', opacity: 0.7 },
    buttonText: { color: 'black', fontSize: 18, fontWeight: 'bold' }
});
