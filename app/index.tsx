import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';

export default function LandingScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { user, loading, isGuest, loginAsGuest } = useAuth();

    // Auto-redirect removed to let user see landing page.
    // Instead, we handle "Already Logged In" state in the button action.

    const logoScale = useSharedValue(1);

    useEffect(() => {
        logoScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );
    }, []);

    const animatedLogoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoScale.value }]
    }));

    useEffect(() => {
        console.log("[LandingScreen] Mount - Auth Loading:", loading, "User:", user?.uid, "IsGuest:", isGuest);
        // Auto-redirect disabled to ensure Landing Page is visible for review/WOW factor.
        /*
        if (!loading && (user || isGuest)) {
            console.log("[LandingScreen] Auto-redirecting to dashboard due to existing session.");
            router.replace('/home');
        }
        */
    }, [loading, user, isGuest]);

    const [showRetry, setShowRetry] = React.useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) setShowRetry(true);
        }, 6000);
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) return (
        <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <ActivityIndicator size="large" color="#6200ee" />
            <Text style={{ color: 'white', marginTop: 20, opacity: 0.6 }}>Initializing SnapMeasure...</Text>

            {showRetry && (
                <Button
                    mode="text"
                    onPress={() => router.replace('/(tabs)/home')} // Fixed navigation target
                    textColor="#6200ee"
                    style={{ marginTop: 40 }}
                >
                    Stuck? Skip to Dashboard
                </Button>
            )}
        </View>
    );

    const handleGetStarted = () => {
        console.log("[LandingScreen] Get Started Pressed - Navigating to Login");
        // Always show login page to allow users to see the full onboarding experience
        router.push('/login');
    };

    const handleGuest = async () => {
        console.log("[LandingScreen] Guest login triggered");
        await loginAsGuest();
        router.replace('/(tabs)/home');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={StyleSheet.absoluteFill}
            />

            {/* Animated Background Glows */}
            <Animated.View style={[styles.glow, { top: -100, left: -100, backgroundColor: '#6200ee' }]} />
            <Animated.View style={[styles.glow, { bottom: -100, right: -100, backgroundColor: '#9c27b0', opacity: 0.3 }]} />

            <View style={styles.content}>
                {/* Hero Section */}
                <View style={styles.hero}>
                    <View style={styles.logoContainer}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.05)']}
                            style={StyleSheet.absoluteFill}
                        />
                        <Text style={{ fontSize: 64 }}>📏</Text>
                    </View>
                    <Text variant="displayMedium" style={styles.title}>
                        SnapMeasure <Text style={{ color: '#4ade80' }}>AI</Text>
                    </Text>
                    <Text variant="titleMedium" style={styles.subtitle}>
                        The Future of Precision Measurement
                    </Text>
                </View>

                {/* Features */}
                <View style={styles.features}>
                    <FeatureCard icon="camera-iris" title="AR Spatial Scan" desc="Measure anything in 3D space" />
                    <FeatureCard icon="brain" title="Intelligent Detection" desc="Auto-snaps to corners and edges" />
                </View>

                {/* Actions */}
                <Animated.View entering={FadeInDown.delay(700).springify()} style={styles.actions}>
                    <Button
                        mode="contained"
                        onPress={handleGetStarted}
                        style={styles.button}
                        buttonColor="#fff"
                        textColor="#000"
                        contentStyle={{ height: 64 }}
                        labelStyle={{ fontSize: 20, fontWeight: '900', letterSpacing: 1 }}
                    >
                        {user ? "OPEN DASHBOARD" : "GET STARTED"}
                    </Button>
                    <Button
                        mode="text"
                        onPress={handleGuest}
                        textColor="rgba(255,255,255,0.7)"
                    >
                        CONTINUE AS GUEST
                    </Button>
                    <Text
                        onPress={() => router.push('/(tabs)/home' as any)}
                        style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontWeight: 'bold', fontSize: 10, textDecorationLine: 'underline', marginTop: 10 }}
                    >
                        BYPASS TO DASHBOARD
                    </Text>
                </Animated.View>
            </View>
        </View>
    );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
    return (
        <View style={styles.glassCard}>
            <BlurView intensity={Platform.OS === 'web' ? 100 : 30} style={StyleSheet.absoluteFill} tint="dark" />
            <Surface elevation={0} style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 16, marginRight: 16 }}>
                <IconButton icon={icon} iconColor="#4ade80" size={24} style={{ margin: 0 }} />
            </Surface>
            <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: '900', color: 'white', letterSpacing: 0.5 }}>{title}</Text>
                <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '500', lineHeight: 16 }}>{desc}</Text>
            </View>
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
        justifyContent: 'space-between',
        padding: 32,
        paddingTop: 80,
    },
    glow: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        opacity: 0.4,
    },
    hero: {
        alignItems: 'center',
        marginTop: 40,
    },
    logoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontWeight: '900',
        color: 'white',
        fontSize: 48,
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    features: {
        gap: 16,
    },
    glassCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    actions: {
        gap: 20,
    },
    button: {
        borderRadius: 30,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 30px rgba(98, 0, 238, 0.4)'
            },
            default: {
                elevation: 8
            }
        })
    }
});
