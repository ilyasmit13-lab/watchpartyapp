import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Dimensions, Image, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        name: 'Netflix',
        url: 'https://www.netflix.com',
        logo: 'https://img.icons8.com/color/480/netflix.png',
        color: '#E50914'
    },
    {
        name: 'Crunchyroll',
        url: 'https://www.crunchyroll.com',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Crunchyroll_2018_symbol.svg/1024px-Crunchyroll_2018_symbol.svg.png',
        color: '#F47521'
    },
];

export const CreatePartyScreen = ({ navigation, route }: any) => {
    const { userName = 'Guest' } = route.params || {};

    const [joinId, setJoinId] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    const handleAppSelect = (app: any) => {
        navigation.navigate('Browser', { startUrl: app.url });
    };



    const handleJoinParty = () => {
        if (!joinId.trim()) return;
        // Proceed to Party Room with existing ID
        navigation.navigate('PartyRoom', { partyId: joinId.trim() });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Start Watching</Text>
                    <Text style={styles.subtitle}>Choose an app to browse</Text>
                </View>
                <TouchableOpacity style={styles.userBadge} onPress={() => setShowSettings(true)}>
                    <Text style={styles.userName}>{userName}</Text>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarLetter}>{userName[0]?.toUpperCase()}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ScrollView contentContainerStyle={styles.content}>

                {/* Join Party Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Join a Party</Text>
                </View>
                <View style={[styles.searchContainer, { marginBottom: 20 }]}>
                    <Ionicons name="people" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Enter Party ID (e.g. 1234)"
                        placeholderTextColor="#666"
                        value={joinId}
                        onChangeText={setJoinId}
                    />
                    <TouchableOpacity style={[styles.goBtn, { backgroundColor: '#34C759' }]} onPress={handleJoinParty}>
                        <Text style={{ fontWeight: 'bold', color: 'white' }}>JOIN</Text>
                    </TouchableOpacity>
                </View>



                {/* Vertical App List */}
                <View style={styles.listContainer}>
                    {APPS.map((app, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.appRow}
                            onPress={() => handleAppSelect(app)}
                        >
                            <View style={[styles.rowIconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Image source={{ uri: app.logo }} style={styles.appLogo} resizeMode="contain" />
                            </View>
                            <View style={styles.rowContent}>
                                <Text style={styles.appName}>{app.name}</Text>
                                <Text style={styles.appUrl}>{new URL(app.url).hostname}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#444" />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Settings Modal */}
            <Modal visible={showSettings} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Account Settings</Text>
                        <View style={styles.settingRow}>
                            <Text style={styles.settingLabel}>Logged in as</Text>
                            <Text style={styles.settingValue}>{userName}</Text>
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

    userBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 6, paddingLeft: 12, borderRadius: 20, borderWidth: 1, borderColor: '#222' },
    userName: { color: 'white', fontWeight: '600', marginRight: 8 },
    avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    divider: { height: 1, backgroundColor: '#222', marginHorizontal: 20, marginBottom: 20 },

    content: { paddingHorizontal: 20 },
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

    listContainer: { gap: 12 },
    appRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        padding: 12,
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
    rowContent: { flex: 1 },
    appName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    appUrl: { color: '#666', fontSize: 12, marginTop: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#1a1a1a', width: '80%', borderRadius: 20, padding: 24 },
    modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    settingLabel: { color: '#888' },
    settingValue: { color: 'white', fontWeight: 'bold' },
    modalCloseBtn: { backgroundColor: '#333', padding: 12, borderRadius: 12, alignItems: 'center' },
    modalCloseText: { color: 'white', fontWeight: 'bold' },
});
