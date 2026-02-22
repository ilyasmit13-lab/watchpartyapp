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

    const theme = isDarkMode
        ? {
            bg: '#000',
            card: '#111',
            border: '#222',
            text: '#fff',
            subtext: '#888',
            inputPlaceholder: '#666',
            iconBg: 'rgba(255,255,255,0.05)',
            divider: '#222',
            modalBg: '#1a1a1a',
            modalOverlay: 'rgba(0,0,0,0.8)',
            settingsBtn: '#1A1A1A',
            inputBg: '#111',
            inputBorder: '#222',
            inputIcon: '#666',
        }
        : {
            bg: '#F4F6FA',
            card: '#FFFFFF',
            border: '#DCE3EF',
            text: '#0E1628',
            subtext: '#5A6478',
            inputPlaceholder: '#8B95AA',
            iconBg: '#F1F4FA',
            divider: '#DCE3EF',
            modalBg: '#FFFFFF',
            modalOverlay: 'rgba(15,23,42,0.28)',
            settingsBtn: '#EEF2F9',
            inputBg: '#FFFFFF',
            inputBorder: '#DCE3EF',
            inputIcon: '#8B95AA',
        };

    const handleAppSelect = (app: any) => {
        navigation.navigate('Browser', { startUrl: app.url, userName });
    };



    const handleJoinParty = () => {
        if (!joinId.trim()) return;
        // Proceed to Party Room with existing ID
        navigation.navigate('PartyRoom', { partyId: joinId.trim(), userName });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.greeting, { color: theme.text }]}>Start Watching</Text>
                    <Text style={[styles.subtitle, { color: theme.subtext }]}>Choose an app to browse</Text>
                </View>
                <TouchableOpacity style={styles.userBadge} onPress={() => setShowSettings(true)}>
                    <TouchableOpacity
                        onPress={() => setIsDarkMode((prev) => !prev)}
                        style={[styles.themeToggle, { backgroundColor: theme.settingsBtn, borderColor: theme.border }]}
                    >
                        <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={15} color={isDarkMode ? '#F59E0B' : '#4F46E5'} />
                    </TouchableOpacity>
                    <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>{userName[0]?.toUpperCase()}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <ScrollView contentContainerStyle={styles.content}>

                {/* Join Party Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Join a Party</Text>
                </View>
                <View style={[styles.searchContainer, { marginBottom: 20, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                    <Ionicons name="people" size={20} color={theme.inputIcon} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Enter Party ID (e.g. 1234)"
                        placeholderTextColor={theme.inputPlaceholder}
                        value={joinId}
                        onChangeText={setJoinId}
                    />
                    <TouchableOpacity style={[styles.goBtn, { backgroundColor: '#34C759' }]} onPress={handleJoinParty}>
                        <Text style={{ fontWeight: 'bold', color: 'white' }}>JOIN</Text>
                    </TouchableOpacity>
                </View>



                {/* Vertical App List */}
                <View style={styles.listContainer}>
                    {VISIBLE_APPS.map((app, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.appRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                            onPress={() => handleAppSelect(app)}
                        >
                            <View style={[styles.rowIconContainer, { backgroundColor: theme.iconBg }]}>
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
                            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
                        </TouchableOpacity>
                    ))}
                </View>

                {ENABLE_NOLBOX && (
                    <View style={styles.footerCard}>
                        <Text style={styles.footerTitle}>Tip</Text>
                        <Text style={styles.footerText}>
                            For Nolbox, start the show in browser and Enlyn will auto-detect playback and launch your party room.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Settings Modal */}
            <Modal visible={showSettings} animationType="fade" transparent={true}>
                <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.modalBg, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Account Settings</Text>
                        <View style={styles.settingRow}>
                            <Text style={[styles.settingLabel, { color: theme.subtext }]}>Logged in as</Text>
                            <Text style={[styles.settingValue, { color: theme.text }]}>{userName}</Text>
                        </View>
                        <View style={styles.settingRow}>
                            <Text style={[styles.settingLabel, { color: theme.subtext }]}>Theme</Text>
                            <TouchableOpacity
                                onPress={() => setIsDarkMode((prev) => !prev)}
                                style={[styles.modalThemeBtn, { borderColor: theme.border, backgroundColor: theme.settingsBtn }]}
                            >
                                <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={14} color={isDarkMode ? '#F59E0B' : '#4F46E5'} />
                                <Text style={[styles.modalThemeBtnText, { color: theme.text }]}>{isDarkMode ? 'Dark' : 'Light'}</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSettings(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20
    },
    greeting: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    subtitle: { color: '#888', fontSize: 14, marginTop: 4 },

    userBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 6, paddingLeft: 8, borderRadius: 20, borderWidth: 1, borderColor: '#222', gap: 8 },
    themeToggle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1
    },
    userName: { color: 'white', fontWeight: '600', marginRight: 8 },
    avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    divider: { height: 1, backgroundColor: '#222', marginHorizontal: 20, marginBottom: 20 },

    content: { paddingHorizontal: 20, paddingBottom: 18, flexGrow: 1 },
    sectionHeader: { marginBottom: 10, marginTop: 10 },
    sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 6,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: '#222'
    },
    searchIcon: { marginLeft: 10, marginRight: 8 },
    searchInput: { flex: 1, color: 'white', fontSize: 16, height: 44 },
    goBtn: { backgroundColor: 'white', width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    listContainer: { gap: 12, marginBottom: 14 },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#222'
    },
    rowIconContainer: {
        width: 50, height: 50,
        borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
        backgroundColor: '#000'
    },
    appLogo: { width: 32, height: 32 },
    nolboxLogo: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F40416',
        justifyContent: 'center',
        alignItems: 'center',
    },
    nolboxLogoText: { color: 'white', fontSize: 22, fontWeight: '800', lineHeight: 24 },
    rowContent: { flex: 1 },
    appName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    appUrl: { color: '#666', fontSize: 12, marginTop: 2 },
    footerCard: {
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 14,
        backgroundColor: '#0E1711',
        padding: 14,
        marginBottom: 8,
    },
    footerTitle: { color: '#A4FF8A', fontSize: 13, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
    footerText: { color: '#D6DFD8', fontSize: 13, lineHeight: 18 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#1a1a1a', width: '80%', borderRadius: 20, padding: 24, borderWidth: 1 },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    settingLabel: { color: '#888' },
    settingValue: { color: 'white', fontWeight: 'bold' },
    modalThemeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999
    },
    modalThemeBtnText: { fontSize: 12, fontWeight: '700' },
    modalCloseBtn: { backgroundColor: '#333', padding: 12, borderRadius: 12, alignItems: 'center' },
    modalCloseText: { color: 'white', fontWeight: 'bold' },
});
