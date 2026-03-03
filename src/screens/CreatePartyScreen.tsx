import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Dimensions, Image, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ENABLE_NOLBOX } from '../config/features';

const { width } = Dimensions.get('window');

const APPS = [
    {
        name: 'YouTube',
        url: 'https://m.youtube.com',
        logo: 'https://img.icons8.com/color/480/youtube-play.png',
        color: '#FF0000'
    },
    {
        name: 'Twitch',
        url: 'https://m.twitch.tv',
        logo: 'https://img.icons8.com/color/480/twitch--v1.png',
        color: '#9146FF'
    },
    {
        name: 'Nolbox',
        url: 'https://nolbox.in/#home',
        logo: '',
        isCustomLogo: true,
        color: '#34C759'
    },
    {
        name: 'Google Drive',
        url: 'https://drive.google.com/drive/my-drive',
        logo: 'https://img.icons8.com/color/480/google-drive--v1.png',
        color: '#4285F4'
    },
    {
        name: 'Netflix',
        url: 'https://www.netflix.com',
        logo: 'https://img.icons8.com/color/480/netflix.png',
        color: '#E50914'
    },
    {
        name: 'Crunchyroll',
        url: 'https://www.crunchyroll.com',
        logo: 'https://img.icons8.com/color/480/crunchyroll.png',
        color: '#F47521'
    },
];

const VISIBLE_APPS = APPS.filter((app: any) => ENABLE_NOLBOX || app.name !== 'Nolbox');

export const CreatePartyScreen = ({ navigation, route }: any) => {
    const { userName = 'Guest' } = route.params || {};

    const [joinId, setJoinId] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const theme = {
        bg: isDarkMode ? '#05070D' : '#F8FAFC',
        text: isDarkMode ? 'white' : '#0F172A',
        subtext: isDarkMode ? '#8FA0C0' : '#64748B',
        card: isDarkMode ? '#0D1220' : '#FFFFFF',
        cardBorder: isDarkMode ? '#1E2433' : '#E2E8F0',
        input: isDarkMode ? '#161B22' : '#F1F5F9',
        inputBorder: isDarkMode ? '#2D3748' : '#CBD5E1',
        iconBg: isDarkMode ? '#1A1D24' : '#E2E8F0',
        modalOverlay: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.4)',
        modalBg: isDarkMode ? '#0D1117' : '#FFFFFF',
    };

    const handleAppSelect = (app: any) => {
        navigation.navigate('Browser', { startUrl: app.url, userName });
    };

    const handleJoinParty = () => {
        if (!joinId.trim()) return;
        navigation.navigate('PartyRoom', { partyId: joinId.trim(), userName });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            <View style={[styles.glowA, !isDarkMode && { opacity: 0.3 }]} />
            <View style={[styles.glowB, !isDarkMode && { opacity: 0.3 }]} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
                <View>
                    <Text style={[styles.greeting, { color: theme.text }]}>Start Watching</Text>
                    <Text style={[styles.subtitle, { color: theme.subtext }]}>Choose an app to browse</Text>
                </View>
                <TouchableOpacity style={[styles.userBadge, { backgroundColor: theme.input, borderColor: theme.inputBorder }]} onPress={() => setShowSettings(true)}>
                    <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>{userName[0]?.toUpperCase()}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Join Party Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Join a Party</Text>
                </View>
                <View style={[styles.searchContainer, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
                    <Ionicons name="people" size={20} color={theme.subtext} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Enter Party ID (e.g. 1234)"
                        placeholderTextColor={theme.subtext}
                        value={joinId}
                        onChangeText={setJoinId}
                    />
                    <TouchableOpacity style={styles.goBtn} onPress={handleJoinParty}>
                        <Ionicons name="arrow-forward" size={20} color="#0E111B" />
                    </TouchableOpacity>
                </View>

                {/* Vertical App List */}
                <View style={styles.listContainer}>
                    {VISIBLE_APPS.map((app, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.appRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                            onPress={() => handleAppSelect(app)}
                        >
                            <View style={[styles.rowIconContainer, { backgroundColor: app.name === 'Twitch' ? (isDarkMode ? '#2A1847' : '#EAE3F7') : (app.name === 'Google Drive' ? (isDarkMode ? '#1A2A47' : '#E6F0FD') : theme.iconBg) }]}>
                                {app.isCustomLogo ? (
                                    <View style={styles.nolboxLogo}>
                                        <Text style={styles.nolboxLogoText}>N</Text>
                                    </View>
                                ) : (
                                    <Image source={{ uri: app.logo }} style={styles.appLogo} resizeMode="contain" />
                                )}
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={[styles.appName, { color: theme.text }]}>{app.name}</Text>
                                <Text style={[styles.appUrl, { color: theme.subtext }]}>{new URL(app.url).hostname}</Text>
                            </View>
                            <View style={[styles.goArrowCircle, { backgroundColor: theme.inputBorder }]}>
                                <Ionicons name="chevron-forward" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {ENABLE_NOLBOX && (
                    <View style={[styles.footerCard, !isDarkMode && { backgroundColor: '#EFFFF4', borderColor: '#C3F2D4' }]}>
                        <Ionicons name="bulb" size={18} color={isDarkMode ? "#A4FF8A" : "#34C759"} style={{ marginBottom: 6 }} />
                        <Text style={[styles.footerTitle, !isDarkMode && { color: '#34C759' }]}>Tip</Text>
                        <Text style={[styles.footerText, !isDarkMode && { color: '#166534' }]}>
                            For Nolbox, start the show in browser and Enlyn will auto-detect playback and launch your party room.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Settings Modal */}
            <Modal visible={showSettings} animationType="slide" transparent={true}>
                <View style={[styles.modalOverlayWrapper, { backgroundColor: theme.modalOverlay }]}>
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSettings(false)} />
                    <View style={[styles.modalContent, { backgroundColor: theme.modalBg, borderColor: theme.cardBorder }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.cardBorder }]}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Account Profile</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.subtext} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingRow}>
                            <Text style={[styles.settingLabel, { color: theme.subtext }]}>Logged in as</Text>
                            <View style={[styles.nameBadge, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}>
                                <Text style={[styles.settingValue, { color: theme.text }]}>{userName}</Text>
                            </View>
                        </View>

                        <View style={styles.settingRow}>
                            <Text style={[styles.settingLabel, { color: theme.subtext }]}>Theme Match</Text>
                            <TouchableOpacity
                                onPress={() => setIsDarkMode(!isDarkMode)}
                                style={[styles.modalThemeBtn, { backgroundColor: theme.input, borderColor: theme.inputBorder }]}
                            >
                                <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={15} color={isDarkMode ? '#F59E0B' : '#4F46E5'} />
                                <Text style={[styles.settingValue, { color: theme.text, fontSize: 13, marginLeft: 6 }]}>{isDarkMode ? 'Dark' : 'Light'}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.logoutBtn} onPress={() => { setShowSettings(false); navigation.replace('Onboarding'); }}>
                            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05070D' },
    glowA: {
        position: 'absolute',
        top: -80,
        right: -40,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
    },
    glowB: {
        position: 'absolute',
        top: '40%',
        left: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2937'
    },
    greeting: { color: 'white', fontSize: 26, fontWeight: '800' },
    subtitle: { color: '#8FA0C0', fontSize: 14, marginTop: 4, fontWeight: '500' },

    userBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', padding: 6, paddingLeft: 14, borderRadius: 24, borderWidth: 1, borderColor: '#2D3748', gap: 10 },
    userName: { color: 'white', fontWeight: '700', fontSize: 13 },
    avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: '#000', fontWeight: '900', fontSize: 14 },

    content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, flexGrow: 1 },
    sectionHeader: { marginBottom: 12 },
    sectionTitle: { color: 'white', fontSize: 18, fontWeight: '800' },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161B22',
        borderRadius: 20,
        padding: 8,
        paddingLeft: 12,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#2D3748'
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: 'white', fontSize: 16, height: 44 },
    goBtn: { backgroundColor: '#A4FF8A', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

    listContainer: { gap: 14, marginBottom: 24 },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0D1220',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1E2433'
    },
    rowIconContainer: {
        width: 54, height: 54,
        borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
    },
    appLogo: { width: 36, height: 36 },
    nolboxLogo: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F40416',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nolboxLogoText: { color: 'white', fontSize: 24, fontWeight: '900', lineHeight: 28 },
    rowContent: { flex: 1 },
    appName: { color: 'white', fontWeight: '800', fontSize: 17, marginBottom: 2 },
    appUrl: { color: '#8FA0C0', fontSize: 13, fontWeight: '500' },

    goArrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },

    footerCard: {
        borderWidth: 1,
        borderColor: '#1C2B1D',
        borderRadius: 18,
        backgroundColor: 'rgba(52, 199, 89, 0.08)',
        padding: 16,
    },
    footerTitle: { color: '#A4FF8A', fontSize: 13, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase' },
    footerText: { color: '#A3B8A8', fontSize: 13, lineHeight: 20, fontWeight: '500' },

    modalOverlayWrapper: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { backgroundColor: '#0D1117', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderWidth: 1, borderColor: '#1F2937', paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1F2937', marginBottom: 20 },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: '800' },

    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    settingLabel: { color: '#8FA0C0', fontWeight: '600', fontSize: 15 },
    nameBadge: { backgroundColor: '#161B22', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2D3748' },
    settingValue: { color: 'white', fontWeight: '800', fontSize: 15 },
    modalThemeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },

    logoutBtn: { backgroundColor: 'rgba(255, 59, 48, 0.1)', flexDirection: 'row', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)' },
    logoutText: { color: '#FF3B30', fontWeight: '800', fontSize: 16 },
});
