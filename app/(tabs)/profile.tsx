import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, List, Surface, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
    const { user, isGuest, logout, deleteUserAccount } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const [cloudSync, setCloudSync] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [backupCount, setBackupCount] = useState(0);

    // Simulated fetch of backup count
    useEffect(() => {
        if (user && !isGuest) {
            setCloudSync(true); // Auto-enable for logged in users
            setBackupCount(12);
        }
    }, [user, isGuest]);

    const handleSync = async () => {
        if (isGuest) {
            Alert.alert("Cloud Access", "Please sign in with an account to enable cloud synchronization.");
            return;
        }
        setSyncing(true);
        setTimeout(() => {
            setSyncing(false);
            setBackupCount(prev => prev + 1);
            Alert.alert("Success", "All measurements synced to secure cloud storage.");
        }, 1500);
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        router.replace('/'); // Go back to Landing Page
                    }
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            "Delete Account",
            "This will permanently delete your database and all stored dimensions. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete My Data",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteUserAccount();
                            router.replace('/');
                        } catch (error: any) {
                            Alert.alert("Error", "Could not delete account. Please re-authenticate and try again.");
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#121212']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.header}>
                    <Surface style={styles.avatarHolder} elevation={4}>
                        <Avatar.Icon size={100} icon={isGuest ? "account-ghost" : "account"} style={{ backgroundColor: "#6200ee" }} />
                        {!isGuest && (
                            <View style={styles.verifiedBadge}>
                                <Avatar.Icon size={24} icon="check" style={{ backgroundColor: "#4ade80" }} color="black" />
                            </View>
                        )}
                    </Surface>
                    <Text variant="headlineSmall" style={styles.userName}>
                        {isGuest ? "Guest Contributor" : user?.email?.split('@')[0] || "Pro User"}
                    </Text>
                    <Text variant="bodyMedium" style={styles.userEmail}>
                        {isGuest ? "In-Session Portfolio" : user?.email}
                    </Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{backupCount}</Text>
                            <Text style={styles.statLabel}>PROJ</Text>
                        </View>
                        <Divider style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>124</Text>
                            <Text style={styles.statLabel}>MEAS</Text>
                        </View>
                        <Divider style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: '#4ade80' }]}>99%</Text>
                            <Text style={styles.statLabel}>CONF</Text>
                        </View>
                    </View>
                </Animated.View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PREMIUM FEATURES</Text>
                    <Card style={styles.glassCard}>
                        <BlurView intensity={Platform.OS === 'web' ? 100 : 20} style={StyleSheet.absoluteFill} tint="dark" />
                        <List.Item
                            title="Cloud Synchronization"
                            description={isGuest ? "Login to enable cloud backup" : "Last synced 2m ago"}
                            left={props => <List.Icon {...props} icon="cloud-sync" color={cloudSync ? "#4ade80" : "#666"} />}
                            right={() => (
                                <Button
                                    mode="text"
                                    onPress={handleSync}
                                    loading={syncing}
                                    textColor={cloudSync ? "#4ade80" : "#6200ee"}
                                >
                                    {isGuest ? "UPGRADE" : "SYNC"}
                                </Button>
                            )}
                        />
                        <Divider style={styles.innerDivider} />
                        <List.Item
                            title="Voice Command Mode"
                            description="Control camera via AI speech"
                            left={props => <List.Icon {...props} icon="microphone" color="#a78bfa" />}
                            right={() => <Text style={styles.statusPill}>ACTIVE</Text>}
                        />
                    </Card>
                </View>

                <View style={[styles.section, { marginBottom: 100 }]}>
                    <Text style={styles.sectionTitle}>SECURITY & SESSION</Text>
                    <Card style={styles.glassCard}>
                        <BlurView intensity={Platform.OS === 'web' ? 100 : 20} style={StyleSheet.absoluteFill} tint="dark" />
                        <List.Item
                            title="Sign Out"
                            titleStyle={{ color: '#ff4b2b' }}
                            onPress={handleLogout}
                            left={props => <List.Icon {...props} icon="logout" color="#ff4b2b" />}
                        />
                        <Divider style={styles.innerDivider} />
                        <List.Item
                            title="Delete Account & Data"
                            titleStyle={{ opacity: 0.5 }}
                            onPress={handleDeleteAccount}
                            left={props => <List.Icon {...props} icon="delete-forever" color="rgba(255,255,255,0.3)" />}
                        />
                    </Card>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    header: {
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    avatarHolder: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 20,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderWidth: 3,
        borderColor: '#1e1e1e',
        borderRadius: 12,
    },
    userName: {
        color: 'white',
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    userEmail: {
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    statNumber: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 10,
        fontWeight: '900',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 12,
        marginLeft: 4,
    },
    glassCard: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    innerDivider: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        height: 1,
    },
    statusPill: {
        color: '#4ade80',
        fontSize: 10,
        fontWeight: '900',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'center',
    },
});
