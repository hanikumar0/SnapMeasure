import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user, isGuest, loginAsGuest } = useAuth();
    const theme = useTheme();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert("Required", "Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                Alert.alert("Account Created", "Welcome to SnapMeasure AI!");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            router.replace('/(tabs)/home');
        } catch (error: any) {
            Alert.alert("auth Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = async () => {
        setLoading(true);
        await loginAsGuest();
        router.replace('/(tabs)/home');
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={StyleSheet.absoluteFill}
            />

            {/* Background Glows (consistent with landing) */}
            <View style={[styles.glow, { top: -100, right: -100, backgroundColor: '#6200ee' }]} />
            <View style={[styles.glow, { bottom: -150, left: -100, backgroundColor: '#9c27b0', opacity: 0.2 }]} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.header}>
                        <View style={styles.logoCircle}>
                            <Text style={{ fontSize: 40 }}>📐</Text>
                        </View>
                        <Text variant="displaySmall" style={styles.title}>
                            {isSignUp ? "Create Account" : "Welcome Back"}
                        </Text>
                        <Text style={styles.subtitle}>
                            {isSignUp ? "Start measuring with AI precision" : "Sign in to access your projects"}
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.cardContainer}>
                        <View style={styles.glassCard}>
                            <BlurView intensity={Platform.OS === 'web' ? 100 : 40} style={StyleSheet.absoluteFill} tint="dark" />

                            {(user || isGuest) && (
                                <Surface style={styles.sessionPill} elevation={0}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <IconButton icon="account-check" iconColor="#4ade80" size={20} />
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Session Active</Text>
                                    </View>
                                    <Button compact mode="contained" buttonColor="#4ade80" textColor="#000" onPress={() => router.replace('/(tabs)/home')}>
                                        GO TO DASHBOARD
                                    </Button>
                                </Surface>
                            )}

                            <View style={styles.form}>
                                <TextInput
                                    label="Email Address"
                                    value={email}
                                    onChangeText={setEmail}
                                    mode="flat"
                                    style={styles.input}
                                    textColor="white"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    activeUnderlineColor="#4ade80"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                <TextInput
                                    label="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    mode="flat"
                                    secureTextEntry
                                    style={styles.input}
                                    textColor="white"
                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                    activeUnderlineColor="#4ade80"
                                />

                                <Button
                                    mode="contained"
                                    onPress={handleAuth}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.mainButton}
                                    buttonColor="#fff"
                                    textColor="#000"
                                    contentStyle={{ height: 56 }}
                                    labelStyle={{ fontWeight: '900', letterSpacing: 1 }}
                                >
                                    {isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}
                                </Button>

                                <Button
                                    mode="text"
                                    onPress={() => setIsSignUp(!isSignUp)}
                                    textColor="rgba(255,255,255,0.6)"
                                    style={{ marginTop: 8 }}
                                >
                                    {isSignUp ? "ALREADY HAVE AN ACCOUNT? LOGIN" : "NEW TO SNAPMEASURE? SIGN UP"}
                                </Button>
                            </View>

                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <Button
                                mode="outlined"
                                onPress={handleGuest}
                                style={styles.guestButton}
                                textColor="white"
                                icon="incognito"
                            >
                                CONTINUE AS GUEST
                            </Button>
                        </View>
                    </Animated.View>

                    <View style={styles.footer}>
                        <Text style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: 12 }}>
                            By continuing, you agree to our Terms & Privacy Policy
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    glow: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    title: {
        fontWeight: '900',
        color: 'white',
        textAlign: 'center',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginTop: 8,
    },
    cardContainer: {
        width: '100%',
    },
    glassCard: {
        borderRadius: 32,
        overflow: 'hidden',
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sessionPill: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: 'transparent',
        height: 60,
    },
    mainButton: {
        marginTop: 12,
        borderRadius: 16,
        ...Platform.select({
            web: { boxShadow: '0 8px 20px rgba(255,255,255,0.2)' },
            default: { elevation: 4 }
        })
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.3)',
        paddingHorizontal: 16,
        fontWeight: 'bold',
        fontSize: 12,
    },
    guestButton: {
        borderRadius: 16,
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
    },
    footer: {
        marginTop: 40,
    }
});
