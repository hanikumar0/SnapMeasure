import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HelpScreen() {
    const router = useRouter();
    const theme = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 24, paddingHorizontal: 16 }}>
                    How to use SnapMeasure
                </Text>

                <Animated.View entering={FadeInDown.delay(100).springify()}>
                    <HelpCard
                        step="1"
                        title="Calibrate (Important!)"
                        desc="For best accuracy, place a known object like a Credit Card or A4 paper next to what you want to measure. Tap the scale icon ⚖️ and select the object to calibrate."
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).springify()}>
                    <HelpCard
                        step="2"
                        title="Scanning"
                        desc="Tap the 'Auto Detect' button. Move your phone slowly. The AI will try to detect surfaces and objects. Haptic feedback will guide you."
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).springify()}>
                    <HelpCard
                        step="3"
                        title="Manual Adjustment"
                        desc="Drag the white measurement points to the exact edges of your object. The measurement updates in real-time."
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).springify()}>
                    <HelpCard
                        step="4"
                        title="Modes"
                        desc="Use the icons to switch modes: Linear Distance 📏, Area 🔲 (for floors/walls), Volume 📦 (for boxes), and Height 🧍 (for people)."
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(500).springify()}>
                    <HelpCard
                        step="5"
                        title="Save & Share"
                        desc="Tap 'Save' to export an image, PDF report, or sync to the cloud (requires login)."
                    />
                </Animated.View>

                <View style={{ height: 40 }} />

                <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 20 }}>
                    Got it!
                </Button>
            </ScrollView>
        </View>
    );
}

function HelpCard({ step, title, desc }: { step: string, title: string, desc: string }) {
    const theme = useTheme();
    return (
        <Card style={{ marginBottom: 16, marginHorizontal: 16 }} elevation={2}>
            <Card.Content style={{ flexDirection: 'row', gap: 16 }}>
                <View style={[styles.stepCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>{step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 4 }}>{title}</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{desc}</Text>
                </View>
            </Card.Content>
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingVertical: 24,
    },
    stepCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
