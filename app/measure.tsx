import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import * as Sharing from 'expo-sharing';
import { addDoc, collection } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import Animated, { FadeInDown, runOnJS, SharedValue, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';


const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(SvgText);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

function VoiceRipple() {
    const r1 = useSharedValue(0);
    const r2 = useSharedValue(0);

    useEffect(() => {
        r1.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);
        setTimeout(() => {
            r2.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);
        }, 750);
    }, []);

    const style1 = useAnimatedStyle(() => ({
        width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: '#a78bfa',
        position: 'absolute', opacity: 1 - r1.value, transform: [{ scale: r1.value * 2 }]
    }));
    const style2 = useAnimatedStyle(() => ({
        width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: '#a78bfa',
        position: 'absolute', opacity: 1 - r2.value, transform: [{ scale: r2.value * 2 }]
    }));

    return (
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View style={style1} />
            <Animated.View style={style2} />
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#a78bfa', elevation: 10, justifyContent: 'center', alignItems: 'center' }}>
                <IconButton icon="microphone" iconColor="white" size={40} />
            </View>
        </View>
    );
}

const MATERIAL_COVERAGE = {
    paint: 10, // 10 sq meters per liter
    tiles: 0.09, // 0.3m x 0.3m tile = 0.09 sq meters per tile
    concrete: 0.1, // cubic meters per standard bag
};

const FURNITURE_PRESETS = [
    { id: 'sofa', name: 'Sofa (3-Seater)', w: 220, h: 90, d: 100, icon: 'sofa' },
    { id: 'fridge', name: 'Double Door Fridge', w: 90, h: 180, d: 80, icon: 'fridge-outline' },
    { id: 'bed', name: 'Queen Size Bed', w: 155, h: 50, d: 205, icon: 'bed-empty' },
    { id: 'desk', name: 'Office Desk', w: 140, h: 75, d: 70, icon: 'table-furniture' },
];

export default function MeasureScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const router = useRouter();
    const { projectId } = useLocalSearchParams();
    const { width, height } = useWindowDimensions(); // Auto-updates on rotation

    const [distanceText, setDistanceText] = useState("0 cm");
    const [dimensionsText, setDimensionsText] = useState({ width: "0 cm", height: "0 cm", extra: "" }); // added extra for Area/Vol
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState("Tap 'Auto' to scan");
    // Updated modes: Distance, Area, Volume, Height, Room, Level, Furniture
    const [mode, setMode] = useState<'distance' | 'area' | 'volume' | 'height' | 'room' | 'level' | 'furniture'>('distance');
    const [unit, setUnit] = useState<'cm' | 'm' | 'inch' | 'ft'>('cm');
    const [tilt, setTilt] = useState(0);
    const [pitch, setPitch] = useState(0);
    const [confidence, setConfidence] = useState<number | null>(null); // Measurement confidence
    const [label, setLabel] = useState("Package #1");
    const [aiContext, setAiContext] = useState<{ object: string, suggestion: string } | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [galleryImage, setGalleryImage] = useState<string | null>(null);
    const [showEstimator, setShowEstimator] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<'paint' | 'tiles' | 'concrete'>('paint');
    const [selectedFurniture, setSelectedFurniture] = useState(FURNITURE_PRESETS[0]);
    const [isListening, setIsListening] = useState(false);
    const [lastVoiceCommand, setLastVoiceCommand] = useState("");
    const viewRef = useRef<View>(null);
    const { user, isGuest } = useAuth();
    const theme = useTheme();

    // Pulse animation for dimensions
    const pulseValue = useSharedValue(1);
    useEffect(() => {
        pulseValue.value = withRepeat(
            withSequence(
                withSpring(1.05, { damping: 10, stiffness: 100 }),
                withSpring(1, { damping: 10, stiffness: 100 })
            ),
            -1, // Repeat indefinitely
            true // Reverse animation on each repeat
        );
    }, []); // Run once on mount

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseValue.value }]
    }));

    const MODES = [
        { id: 'distance', icon: 'vector-line', label: 'Distance' },
        { id: 'height', icon: 'human-male', label: 'Height' },
        { id: 'room', icon: 'home-floor-2', label: 'Room' },
        { id: 'area', icon: 'vector-square', label: 'Area' },
        { id: 'volume', icon: 'cube-outline', label: 'Volume' },
        { id: 'furniture', icon: 'sofa', label: 'Fit Check' },
        { id: 'level', icon: 'angle-acute', label: 'Level' }
    ];

    const saveToCloud = async () => {
        if (!user || isGuest) return;
        try {
            await addDoc(collection(db, `users/${user.uid}/measurements`), {
                mode,
                dimensions: dimensionsText,
                label: mode === 'volume' ? label : '',
                date: new Date().toISOString(),
                projectId: projectId || null
            });
            Alert.alert("Saved to Cloud", "Measurement synced successfully.");
        } catch (e: any) {
            Alert.alert("Sync Error", e.message);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            setGalleryImage(result.assets[0].uri);
            setScanStatus("Measuring Gallery Image");
        }
    };

    const calculateEstimate = () => {
        const areaStr = dimensionsText.extra.match(/[\d.]+/)?.[0];
        const areaNum = parseFloat(areaStr || "0");

        if (selectedMaterial === 'paint') {
            const liters = (areaNum / MATERIAL_COVERAGE.paint).toFixed(1);
            return `${liters} Liters of Paint`;
        } else if (selectedMaterial === 'tiles') {
            const count = Math.ceil(areaNum / MATERIAL_COVERAGE.tiles);
            return `${count} Tiles (30x30cm)`;
        } else if (selectedMaterial === 'concrete') {
            const volStr = dimensionsText.extra.match(/Volume: ([\d.]+)/)?.[1];
            const volNum = parseFloat(volStr || "0");
            const bags = Math.ceil(volNum / MATERIAL_COVERAGE.concrete);
            return `${bags} Bags (Standard)`;
        }
        return "N/A";
    };

    const processVoiceCommand = (command: string) => {
        setLastVoiceCommand(command);
        const cmd = command.toLowerCase();

        if (cmd.includes("scan") || cmd.includes("measure") || cmd.includes("auto")) {
            startAutoScan();
        } else if (cmd.includes("save") || cmd.includes("cloud")) {
            saveToCloud();
        } else if (cmd.includes("export") || cmd.includes("share")) {
            setShowExportMenu(true);
        } else if (cmd.includes("level")) {
            setMode('level');
        } else if (cmd.includes("distance")) {
            setMode('distance');
        } else if (cmd.includes("area")) {
            setMode('area');
        } else if (cmd.includes("volume")) {
            setMode('volume');
        } else if (cmd.includes("furniture") || cmd.includes("fit")) {
            setMode('furniture');
        }
    };

    const toggleVoice = () => {
        if (!isListening) {
            setIsListening(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setTimeout(() => {
                const commands = ["Scan the room", "Save this measurement", "Switch to Level mode", "Check furniture fit"];
                const randomCmd = commands[Math.floor(Math.random() * commands.length)];
                processVoiceCommand(randomCmd);

                setTimeout(() => {
                    setIsListening(false);
                    setLastVoiceCommand("");
                }, 1500);
            }, 2000);
        } else {
            setIsListening(false);
        }
    };

    const handleExport = async (type: 'image' | 'pdf' | 'csv' | 'blueprint') => {
        try {
            if (type === 'image') {
                const uri = await captureRef(viewRef, {
                    format: 'png',
                    quality: 0.8,
                });
                await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Image' });
            } else if (type === 'pdf') {
                const html = `
                    <html>
                        <head>
                            <style>
                                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 40px; line-height: 1.6; }
                                .header { border-bottom: 2px solid #6200ee; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                                .logo { color: #6200ee; font-size: 24px; font-weight: bold; }
                                .title { font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #000; }
                                .metadata { color: #666; font-size: 14px; margin-bottom: 40px; }
                                .card { background: #f8f9fa; border-radius: 12px; padding: 25px; border: 1px solid #eee; margin-bottom: 30px; }
                                .card-title { font-size: 18px; font-weight: bold; color: #6200ee; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
                                .dimension-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                                .dimension-label { font-weight: bold; color: #555; }
                                .dimension-value { font-family: 'Courier New', Courier, monospace; font-weight: bold; font-size: 18px; }
                                .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                                .highlight { color: #6200ee; font-weight: bold; }
                            </style>
                        </head>
                        <body>
                            <div class="header">
                                <div class="logo">📐 SnapMeasure Pro</div>
                                <div style="text-align: right;">
                                    <div class="title">Measurement Certificate</div>
                                    <div class="metadata">Generated on ${new Date().toLocaleString()}</div>
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-title">Session Details</div>
                                <div class="dimension-row">
                                    <span class="dimension-label">Measurement Mode</span>
                                    <span class="dimension-value highlight">${mode.toUpperCase()}</span>
                                </div>
                                <div class="dimension-row">
                                    <span class="dimension-label">Object Label</span>
                                    <span class="dimension-value">${label || 'Unnamed Object'}</span>
                                </div>
                                ${projectId ? `
                                <div class="dimension-row">
                                    <span class="dimension-label">Linked Project ID</span>
                                    <span class="dimension-value">${projectId}</span>
                                </div>` : ''}
                            </div>

                            <div class="card">
                                <div class="card-title">Dimensions & Analysis</div>
                                <div class="dimension-row">
                                    <span class="dimension-label">Primary Dimension / Distance</span>
                                    <span class="dimension-value">${mode === 'distance' || mode === 'height' ? distanceText : dimensionsText.width}</span>
                                </div>
                                ${mode !== 'distance' && mode !== 'height' ? `
                                <div class="dimension-row">
                                    <span class="dimension-label">Secondary Dimension</span>
                                    <span class="dimension-value">${dimensionsText.height}</span>
                                </div>` : ''}
                                ${dimensionsText.extra ? `
                                <div class="dimension-row">
                                    <span class="dimension-label">Calculated Metrics (Area/Vol)</span>
                                    <span class="dimension-value">${dimensionsText.extra}</span>
                                </div>` : ''}
                            </div>

                            <div class="footer">
                                This document is an automated measurement report generated via SnapMeasure AR Technology. 
                                Accuracy depends on device calibration and surface lighting conditions.
                                <br/>© ${new Date().getFullYear()} SnapMeasure AI. All rights reserved.
                            </div>
                        </body>
                    </html>
                `;
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Pro Report', UTI: 'com.adobe.pdf' });
            } else if (type === 'csv') {
                const csvContent = `Date,Mode,Width,Height,Extra\n${new Date().toISOString()},${mode},${dimensionsText.width},${dimensionsText.height},${dimensionsText.extra}`;
                const uri = ((FileSystem as any).documentDirectory || '') + 'measurement.csv';
                await FileSystem.writeAsStringAsync(uri, csvContent);
                await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Share Data', UTI: 'public.comma-separated-values-text' });
            } else if (type === 'blueprint') {
                const svgContent = `
                    <svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="white" />
                        <g stroke="#000" stroke-width="2" fill="none">
                            <rect x="200" y="150" width="400" height="300" stroke="#6200ee" stroke-width="4" />
                            <line x1="200" y1="460" x2="600" y2="460" stroke="#000" stroke-dasharray="5,5" />
                            <text x="400" y="480" font-family="Arial" font-size="16" text-anchor="middle" fill="#000">Width: ${dimensionsText.width}</text>
                            <line x1="180" y1="150" x2="180" y2="450" stroke="#000" stroke-dasharray="5,5" />
                            <text x="160" y="300" font-family="Arial" font-size="16" text-anchor="middle" transform="rotate(-90 160 300)" fill="#000">Height: ${dimensionsText.height}</text>
                        </g>
                        <text x="400" y="50" font-family="Arial" font-size="24" text-anchor="middle" font-weight="bold">SnapMeasure Architectural Schematic</text>
                        <text x="400" y="80" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">Mode: ${mode.toUpperCase()} | Generated: ${new Date().toLocaleDateString()}</text>
                        <text x="400" y="550" font-family="Arial" font-size="12" text-anchor="middle" fill="#999">© SnapMeasure AI Pro - Advanced AR Spatial Mapping</text>
                    </svg>
                `;
                const uri = ((FileSystem as any).documentDirectory || '') + 'blueprint.svg';
                await FileSystem.writeAsStringAsync(uri, svgContent);
                await Sharing.shareAsync(uri, { mimeType: 'image/svg+xml', dialogTitle: 'Share Blueprint', UTI: 'public.svg-image' });
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Export failed', error.message || 'Unknown error');
        }
        setShowExportMenu(false);
    };

    const p1 = useSharedValue({ x: 100, y: 300 }); // Initial placeholders
    const p2 = useSharedValue({ x: 250, y: 300 });
    const p3 = useSharedValue({ x: 100, y: 450 });
    const p4 = useSharedValue({ x: 100, y: 150 });

    // Initialize points relative to screen size on mount/resize
    useEffect(() => {
        p1.value = { x: width * 0.3, y: height * 0.4 };
        p2.value = { x: width * 0.7, y: height * 0.4 };
        p3.value = { x: width * 0.3, y: height * 0.6 };
        p4.value = { x: width * 0.3, y: height * 0.2 };
    }, [width, height]);

    // Device Motion for "Screen Motion" / Leveling
    useEffect(() => {
        let subscription: any = null;

        const startMotion = async () => {
            if (Platform.OS === 'web') return;
            try {
                const isAvailable = await DeviceMotion.isAvailableAsync();
                if (!isAvailable) {
                    console.warn("DeviceMotion is not available on this platform/device");
                    return;
                }

                subscription = DeviceMotion.addListener(({ rotation }) => {
                    if (rotation) {
                        const roll = rotation.gamma * (180 / Math.PI);
                        const pitchAngle = rotation.beta * (180 / Math.PI);

                        // Haptic "Snap" when perfectly level
                        if (Math.abs(roll) < 0.5 && Math.abs(roll) > 0.1) {
                            runOnJS(Haptics.selectionAsync)();
                        }

                        setTilt(roll);
                        setPitch(pitchAngle);
                    }
                });
                DeviceMotion.setUpdateInterval(100);
            } catch (err) {
                console.error("Error starting DeviceMotion:", err);
            }
        };

        startMotion();

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    // Calibration State
    const [scale, setScale] = useState(0.05); // px to cm
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [refObj, setRefObj] = useState<'card' | 'a4' | 'money'>('card');

    // Reference Sizes (width in cm)
    const REF_SIZES = {
        card: 8.56, // Standard ID-1
        a4: 21.0,   // A4 Width
        money: 15.6 // US Dollar Bill (approx)
    };

    useDerivedValue(() => {
        const x1 = p1.value.x;
        const y1 = p1.value.y;
        const x2 = p2.value.x;
        const y2 = p2.value.y;

        // Convert to selected unit
        let ratio = 1;
        let unitLabel = unit;

        switch (unit) {
            case 'cm': ratio = 1; break;
            case 'm': ratio = 0.01; break;
            case 'inch': ratio = 0.3937; break;
            case 'ft': ratio = 0.0328; break;
        }

        const distPx = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const wPx = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const dPx = Math.sqrt((p3.value.x - x1) ** 2 + (p3.value.y - y1) ** 2);
        const hPx = Math.sqrt((p4.value.x - x1) ** 2 + (p4.value.y - y1) ** 2);

        // Calibration Mode: Show Reference Object Size
        if (isCalibrating) {
            const currentCm = wPx * scale; // Show what current scale thinks it is
            runOnJS(setDimensionsText)({
                width: `${currentCm.toFixed(2)} cm`,
                height: `Target: ${REF_SIZES[refObj]} cm`,
                extra: `Align points to width of object`
            });
            return;
        }

        // Perspective Correction Simulation
        const absPitch = Math.abs(pitch);
        let correctionFactor = 1;
        if (absPitch > 15 && absPitch < 75) {
            const angleRad = (absPitch * Math.PI) / 180;
            correctionFactor = Math.min(1.5, 1 / Math.sin(angleRad));
        }

        // Real-world values using dynamic scale
        const distVal = distPx * scale * ratio * correctionFactor;
        const wVal = wPx * scale * ratio;
        const dVal = dPx * scale * ratio * correctionFactor;
        const hVal = hPx * scale * ratio;

        if (mode === 'distance') {
            runOnJS(setDistanceText)(`${distVal.toFixed(2)} ${unitLabel}`);
        } else if (mode === 'height') {
            runOnJS(setDistanceText)(`${hVal.toFixed(2)} ${unitLabel}`); // Vertical height
        } else if (mode === 'room') {
            // Room Mode: Treat P1-P2 as "Wall Length"
            const wallLength = distVal;
            const floorArea = (wallLength * wallLength).toFixed(2);
            const ceiling = (unit === 'm' || unit === 'cm') ? '2.4 m' : '8.0 ft';

            runOnJS(setDimensionsText)({
                width: `${wallLength.toFixed(2)} ${unitLabel}`,
                height: `Ceiling: ${ceiling}`,
                extra: `Floor Area: ${floorArea} ${unitLabel}²`
            });
        } else if (mode === 'area') {
            const area = (wVal * dVal).toFixed(2);
            runOnJS(setDimensionsText)({
                width: `W: ${wVal.toFixed(1)} ${unitLabel}`,
                height: `L: ${dVal.toFixed(1)} ${unitLabel}`,
                extra: `Area: ${area} ${unitLabel}²`
            });
        } else if (mode === 'furniture') {
            const fW = selectedFurniture.w;
            const fH = selectedFurniture.h;
            const fD = selectedFurniture.d;

            // Fit check: Is current measured space enough for selected furniture?
            const fitStatus = (wVal >= fW * ratio && dVal >= fD * ratio && hVal >= fH * ratio) ? "✅ Fits" : "⚠️ Too Tight";

            runOnJS(setDimensionsText)({
                width: `${selectedFurniture.name}`,
                height: `${fW}x${fD}x${fH} cm`,
                extra: fitStatus
            });
        } else {
            const vol = (wVal * dVal * hVal).toFixed(2);
            const shippingStatus = (wVal + dVal + hVal) > (unit === 'cm' ? 300 : 130) ? "⚠️ Oversize" : "✅ Standard";

            runOnJS(setDimensionsText)({
                width: `${wVal.toFixed(1)}x${dVal.toFixed(1)}`,
                height: `H: ${hVal.toFixed(1)}`,
                extra: `${vol} ${unitLabel}³ | ${shippingStatus}`
            });
        }
    }, [mode, unit, scale, isCalibrating, refObj, pitch]);

    const pan1 = Gesture.Pan()
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        })
        .onChange((e: any) => {
            p1.value = { x: p1.value.x + e.changeX, y: p1.value.y + e.changeY };
        });

    const pan2 = Gesture.Pan()
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        })
        .onChange((e: any) => {
            p2.value = { x: p2.value.x + e.changeX, y: p2.value.y + e.changeY };
        });

    const pan3 = Gesture.Pan()
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        })
        .onChange((e: any) => {
            p3.value = { x: p3.value.x + e.changeX, y: p3.value.y + e.changeY };
        });

    const pan4 = Gesture.Pan()
        .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        })
        .onChange((e: any) => {
            p4.value = { x: p4.value.x + e.changeX, y: p4.value.y + e.changeY };
        });

    const lineProps = useAnimatedProps(() => ({
        x1: p1.value.x,
        y1: p1.value.y,
        x2: p2.value.x,
        y2: p2.value.y,
    }));

    const boxProps = useAnimatedProps(() => {
        // We keep this for logic but don't render Rect anymore
        const x = Math.min(p1.value.x, p2.value.x);
        const y = Math.min(p1.value.y, p2.value.y);
        const w = Math.abs(p2.value.x - p1.value.x);
        const h = Math.abs(p2.value.y - p1.value.y);
        return { x, y, width: w, height: h };
    });

    // Crosshair Props for "Visualizing H & V" without a "Box"
    const crossHairH = useAnimatedProps(() => ({
        x1: p1.value.x,
        y1: (p1.value.y + p2.value.y) / 2,
        x2: p2.value.x,
        y2: (p1.value.y + p2.value.y) / 2
    }));

    const crossHairV = useAnimatedProps(() => ({
        x1: (p1.value.x + p2.value.x) / 2,
        y1: p1.value.y,
        x2: (p1.value.x + p2.value.x) / 2,
        y2: p2.value.y
    }));

    // 3D BOX RENDERING LOGIC
    const boxBaseProps = useAnimatedProps(() => {
        const p1x = p1.value.x;
        const p1y = p1.value.y;
        const p2x = p2.value.x;
        const p2y = p2.value.y;
        const p3x = p3.value.x;
        const p3y = p3.value.y;
        const p4x = p2x + (p3x - p1x);
        const p4y = p2y + (p3y - p1y);

        return {
            points: `${p1x},${p1y} ${p2x},${p2y} ${p4x},${p4y} ${p3x},${p3y}`
        };
    });

    const boxTopProps = useAnimatedProps(() => {
        const heightOff = p4.value.y - p1.value.y;
        const p1x = p1.value.x;
        const p1y = p1.value.y + heightOff;
        const p2x = p2.value.x;
        const p2y = p2.value.y + heightOff;
        const p3x = p3.value.x;
        const p3y = p3.value.y + heightOff;
        const p4x = p2x + (p3x - p1x);
        const p4y = (p2.value.y + heightOff) + (p3y - p1y);

        return {
            points: `${p1x},${p1y} ${p2x},${p2y} ${p4x},${p4y} ${p3x},${p3y}`
        };
    });

    const [featurePoints, setFeaturePoints] = useState<{ x: number, y: number, opacity: number }[]>([]);

    // Scanning Simulation Effect: Generate "AI Feature Points"
    useEffect(() => {
        let interval: number;
        if (isScanning) {
            interval = setInterval(() => {
                const numPoints = 8;
                const newPoints = Array.from({ length: numPoints }).map(() => ({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    opacity: Math.random()
                }));
                setFeaturePoints(newPoints);
            }, 150);
        } else {
            setFeaturePoints([]);
        }
        return () => clearInterval(interval);
    }, [isScanning, width, height]);

    const calibrateScale = () => {
        // Current pixel width between points
        const wPx = Math.abs(p2.value.x - p1.value.x);
        if (wPx < 10) return; // Ignore if too small

        const targetCm = REF_SIZES[refObj];
        const newScale = targetCm / wPx;

        setScale(newScale);
        setIsCalibrating(false);
        setScanStatus("Calibrated Successfully");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    // Simulates an object detection scan (e.g. via ML Kit)
    const startAutoScan = () => {
        if (isScanning) return;
        setIsScanning(true);
        setConfidence(null);
        setAiContext(null);

        const isHeightMode = mode === 'height';
        const isVolMode = mode === 'volume';
        const isRoomMode = mode === 'room';

        if (!isHeightMode && !isVolMode && !isRoomMode) setMode('area');

        const absTilt = Math.abs(tilt);
        const surfaceType = (absTilt > 60) ? "Vertical Surface" : "Flat Surface";

        let scanMsg = `Analyzing ${surfaceType}...`;
        if (isHeightMode) scanMsg = "Detecting Pose...";
        if (isVolMode) scanMsg = "Locating Box...";
        if (isRoomMode) scanMsg = "Mapping Room Perimeter...";

        setScanStatus(scanMsg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        setTimeout(() => {
            if (isHeightMode) setScanStatus("Identifying Head & Feet...");
            else if (isVolMode) setScanStatus("Detecting Corners (AI)...");
            else if (isRoomMode) setScanStatus("Scanning Floor Plan...");
            else setScanStatus("Analyzing Contours & Edges...");
        }, 800);

        setTimeout(() => {
            if (isHeightMode) setScanStatus("Calculating Stature...");
            else if (isVolMode) setScanStatus("Computing Volume...");
            else if (isRoomMode) setScanStatus("Estimating Ceiling Height...");
            else setScanStatus("Estimating Dimensions...");
        }, 1600);

        setTimeout(() => {
            setIsScanning(false);
            const score = Math.floor(Math.random() * (99 - 85) + 85);
            setConfidence(score);

            // AI Intelligence Simulation
            let detectedObj = "Object";
            let suggestion = "Tap to edit dimensions";

            if (isHeightMode) {
                detectedObj = "Person (Standing)";
                suggestion = "Ensure feet are visible";
            } else if (isVolMode) {
                const packages = ["Shipping Box", "Wooden Crate", "Suitcase"];
                detectedObj = packages[Math.floor(Math.random() * packages.length)];
                suggestion = "Check corner alignment";
            } else if (isRoomMode) {
                detectedObj = "Room Perimeter";
                suggestion = "Scan from corner for best accuracy";
            } else {
                const objects = ["Dining Table", "Office Chair", "Monitor", "Door Frame", "Window"];
                detectedObj = objects[Math.floor(Math.random() * objects.length)];
                suggestion = "Align with straight edges";
            }
            setAiContext({ object: detectedObj, suggestion });

            if (isRoomMode) setScanStatus("Room Mapped Successfully");
            else if (isVolMode) setScanStatus(`Package Identified`);
            else setScanStatus(isHeightMode ? `Subject Identified (${score}%)` : `Object Detected: ${detectedObj}`);


            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const cX = width / 2;
            const cY = height / 2;

            if (isHeightMode) {
                const personHeight = height * 0.8;
                p1.value = withSpring({ x: cX, y: cY - personHeight / 2 });
                p2.value = withSpring({ x: cX, y: cY + personHeight / 2 });
            } else if (isRoomMode) {
                // Snap to Floor Width (Wall to Wall)
                const roomWidth = width * 0.9;
                p1.value = withSpring({ x: cX - roomWidth / 2, y: cY + height * 0.3 }); // Floor level left
                p2.value = withSpring({ x: cX + roomWidth / 2, y: cY + height * 0.3 }); // Floor level right
            } else {
                const boxWidth = width * 0.75;
                const boxHeight = height * 0.55;
                p1.value = withSpring({ x: cX - boxWidth / 2, y: cY - boxHeight / 2 });
                p2.value = withSpring({ x: cX + boxWidth / 2, y: cY + boxHeight / 2 });
            }
        }, 2500);
    };

    if (!permission) return <View />;
    if (!permission.granted) {
        return (
            <View className="flex-1 justify-center items-center bg-black p-4">
                <Text style={{ color: 'white', marginBottom: 20, textAlign: 'center' }}>
                    Camera permission is required to measure objects.
                </Text>
                <Button mode="contained" onPress={requestPermission}>Grant Permission</Button>
                <Button mode="text" textColor="white" onPress={() => router.back()} style={{ marginTop: 20 }}>Cancel</Button>
            </View>
        );
    }

    // Dynamic rotation of the level indicator based on tilt
    const levelStyle = {
        transform: [{ rotate: `${-tilt}deg` }]
    };

    const isLevel = Math.abs(tilt) < 5; // Tolerance for green level

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container} ref={viewRef} collapsable={false}>
                {galleryImage ? (
                    <Image source={{ uri: galleryImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                    <CameraView style={StyleSheet.absoluteFill} facing="back" />
                )}

                {/* Interaction Layer */}
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <Svg height={height} width={width} style={StyleSheet.absoluteFill} pointerEvents="none">
                        {mode === 'distance' ? (
                            <AnimatedLine animatedProps={lineProps} stroke="white" strokeWidth="2" strokeDasharray="5, 5" />
                        ) : mode === 'area' ? (
                            <AnimatedPolygon
                                animatedProps={boxBaseProps}
                                fill="rgba(98, 0, 238, 0.2)"
                                stroke="white"
                                strokeWidth="2"
                                strokeDasharray="5, 5"
                            />
                        ) : mode === 'volume' ? (
                            <>
                                {/* 3D BOX RENDERING */}
                                <AnimatedPolygon animatedProps={boxBaseProps} fill="rgba(98, 0, 238, 0.1)" stroke="white" strokeWidth="1" />
                                <AnimatedPolygon animatedProps={boxTopProps} fill="rgba(98, 0, 238, 0.3)" stroke="white" strokeWidth="2" />

                                {/* Vertical Connecting Lines */}
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p1.value.x, y1: p1.value.y, x2: p1.value.x, y2: p1.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="white" strokeWidth="1" strokeDasharray="2, 4"
                                />
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p2.value.x, y1: p2.value.y, x2: p2.value.x, y2: p2.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="white" strokeWidth="1" strokeDasharray="2, 4"
                                />
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p3.value.x, y1: p3.value.y, x2: p3.value.x, y2: p3.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="white" strokeWidth="1" strokeDasharray="2, 4"
                                />
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({
                                        x1: p2.value.x + (p3.value.x - p1.value.x),
                                        y1: p2.value.y + (p3.value.y - p1.value.y),
                                        x2: p2.value.x + (p3.value.x - p1.value.x),
                                        y2: p2.value.y + (p3.value.y - p1.value.y) + (p4.value.y - p1.value.y)
                                    }))}
                                    stroke="white" strokeWidth="1" strokeDasharray="2, 4"
                                />
                            </>
                        ) : mode === 'furniture' ? (
                            <>
                                <AnimatedPolygon animatedProps={boxBaseProps} fill="rgba(74, 222, 128, 0.2)" stroke="#4ade80" strokeWidth="2" strokeDasharray="5, 5" />
                                <AnimatedPolygon animatedProps={boxTopProps} fill="rgba(74, 222, 128, 0.4)" stroke="#4ade80" strokeWidth="3" />

                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p1.value.x, y1: p1.value.y, x2: p1.value.x, y2: p1.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="#4ade80" strokeWidth="2"
                                />
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p2.value.x, y1: p2.value.y, x2: p2.value.x, y2: p2.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="#4ade80" strokeWidth="2"
                                />
                                <AnimatedLine
                                    animatedProps={useAnimatedProps(() => ({ x1: p3.value.x, y1: p3.value.y, x2: p3.value.x, y2: p3.value.y + (p4.value.y - p1.value.y) }))}
                                    stroke="#4ade80" strokeWidth="2"
                                />
                            </>
                        ) : (
                            <>
                                {/* Crosshair Visualization: H & V Lines instead of Box */}
                                <AnimatedLine animatedProps={crossHairH} stroke="white" strokeWidth="2" strokeDasharray="5, 5" />
                                <AnimatedLine animatedProps={crossHairV} stroke="white" strokeWidth="2" strokeDasharray="5, 5" />
                            </>
                        )}

                        {/* Simulated Scanning Line (Intelligent Point Cloud) */}
                        {isScanning && (
                            <>
                                <Line
                                    x1="0" y1={height / 2} x2={width} y2={height / 2}
                                    stroke="#00ff00" strokeWidth="2" strokeDasharray="10, 5"
                                    opacity="0.6"
                                />
                                {/* Render AI Feature Points */}
                                {featurePoints.map((pt, i) => (
                                    <Circle
                                        key={i}
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={4}
                                        fill="#00ff00"
                                        opacity={pt.opacity}
                                    />
                                ))}
                            </>
                        )}
                    </Svg>

                    {/* Touch Handles - We map gestures to View circles that sit on top */}
                    {/* Reanimated views for handles with conditional opacity during scan */}
                    {!isScanning && (
                        <>
                            <AnimatedHandle point={p1} gesture={pan1} />
                            <AnimatedHandle point={p2} gesture={pan2} />
                            {(mode === 'area' || mode === 'volume' || mode === 'furniture') && (
                                <AnimatedHandle point={p3} gesture={pan3} />
                            )}
                            {(mode === 'volume' || mode === 'furniture') && (
                                <AnimatedHandle point={p4} gesture={pan4} />
                            )}
                        </>
                    )}
                </View>

                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
                    {/* Voice Overlay HUD */}
                    {isListening && (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]} pointerEvents="auto">
                            <VoiceRipple />
                            <View style={{ position: 'absolute', bottom: 150, alignItems: 'center' }}>
                                <Text style={{ color: '#a78bfa', fontWeight: '900', fontSize: 24, letterSpacing: 2, textAlign: 'center' }}>
                                    {lastVoiceCommand || "LISTENING..."}
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>AI Voice Assistant Active</Text>
                            </View>
                        </View>
                    )}

                    {mode === 'furniture' && (
                        <View style={{ position: 'absolute', top: 120, width: '100%', paddingHorizontal: 20 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                {FURNITURE_PRESETS.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => setSelectedFurniture(item)}
                                        style={{
                                            padding: 12,
                                            borderRadius: 20,
                                            backgroundColor: selectedFurniture.id === item.id ? '#4ade80' : 'rgba(255,255,255,0.2)',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.3)'
                                        }}
                                    >
                                        <Text style={{ fontSize: 16 }}>
                                            {item.icon === 'sofa' ? '🛋️' :
                                                item.icon === 'fridge-outline' ? '❄️' :
                                                    item.icon === 'bed-empty' ? '🛏️' : '🖥️'}
                                        </Text>
                                        <Text style={{ color: selectedFurniture.id === item.id ? 'black' : 'white', fontWeight: 'bold' }}>{item.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {mode === 'level' ? (
                        <View style={{ alignItems: 'center', width: '100%' }}>
                            {/* Pro Protractor / Inclinometer View */}
                            <Animated.View style={[{
                                width: 280,
                                height: 280,
                                borderRadius: 140,
                                borderWidth: 3,
                                borderColor: isLevel ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                overflow: 'hidden'
                            }]}>
                                <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />

                                {/* 3D AXIS GIZMO / HUD */}
                                <Svg height="280" width="280" style={{ position: 'absolute' }}>
                                    <G transform="translate(140, 140)">
                                        {/* Compass Ring */}
                                        <Circle r="120" stroke="white" strokeWidth="1" strokeDasharray="2, 4" opacity="0.3" fill="none" />

                                        {/* Dynamic Crosshairs */}
                                        <Line x1="-130" y1="0" x2="130" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                        <Line x1="0" y1="-130" x2="0" y2="130" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                                        {/* Degree Marks */}
                                        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                                            <G key={deg} transform={`rotate(${deg})`}>
                                                <Line y1="-120" y2="-130" stroke="white" strokeWidth="2" />
                                                <SvgText x="5" y="-105" fill="white" fontSize="10" opacity="0.5">{deg}°</SvgText>
                                            </G>
                                        ))}
                                    </G>
                                </Svg>

                                {/* Active Level Needle / Bubble */}
                                <Animated.View style={[{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: isLevel ? '#4ade80' : 'white',
                                    shadowColor: isLevel ? '#4ade80' : 'white',
                                    shadowRadius: 15,
                                    shadowOpacity: 0.8,
                                    elevation: 20,
                                    borderWidth: 5,
                                    borderColor: 'rgba(0,0,0,0.1)'
                                }, {
                                    transform: [
                                        { translateX: (tilt / 45) * 80 },
                                        { translateY: (pitch / 45) * 80 }
                                    ]
                                }]} />

                                <View style={{ position: 'absolute', bottom: 40, alignItems: 'center' }}>
                                    <Text style={{
                                        fontSize: 56,
                                        fontWeight: '900',
                                        color: isLevel ? '#4ade80' : 'white',
                                        textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                        textShadowOffset: { width: -1, height: 1 },
                                        textShadowRadius: 10
                                    }}>
                                        {Math.abs(Math.round(tilt))}°
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 10, letterSpacing: 2 }}>PRECISION ANGLE</Text>
                                </View>
                            </Animated.View>
                        </View>
                    ) : (
                        <>
                            {/* Central Bubble Level (Compact) */}
                            <View style={[
                                styles.levelContainer,
                                { transform: [{ rotate: `${-tilt}deg` }] }
                            ]}>
                                <View style={[
                                    styles.levelBubble,
                                    { backgroundColor: isLevel ? '#4ade80' : 'rgba(255,255,255,0.8)' }
                                ]} />
                            </View>

                            {/* Auto Tilt Correction Indicator (Appears when phone is tilted fwd/back) */}
                            {Math.abs(pitch) > 15 && (
                                <View style={{ position: 'absolute', top: '15%', overflow: 'hidden', borderRadius: 20 }}>
                                    <BlurView intensity={80} tint="dark" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                                        <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 12 }}>
                                            📐 Perspective Correction Active
                                        </Text>
                                    </BlurView>
                                </View>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.uiOverlay} pointerEvents="box-none">
                    {/* NEW DYNAMIC MODE SELECTOR */}
                    <View style={{ width: '100%', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 40 : 0 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}
                        >
                            <BlurView intensity={60} tint="dark" style={{ flexDirection: 'row', borderRadius: 30, padding: 4, overflow: 'hidden' }}>
                                {MODES.map(m => (
                                    <TouchableOpacity
                                        key={m.id}
                                        onPress={() => setMode(m.id as any)}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 24,
                                            backgroundColor: mode === m.id ? theme.colors.primary : 'transparent',
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginRight: 4
                                        }}
                                    >
                                        <IconButton icon={m.icon} size={18} iconColor={mode === m.id ? 'white' : 'white'} style={{ margin: 0, padding: 0 }} />
                                        {mode === m.id && (
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 4 }}>{m.label}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </BlurView>
                        </ScrollView>
                    </View>

                    {/* Header with Glassmorphic Pill */}
                    <View style={styles.header}>
                        <BlurView intensity={40} tint="light" style={{ borderRadius: 24, overflow: 'hidden' }}>
                            <IconButton
                                icon="close"
                                iconColor="black"
                                size={24}
                                onPress={() => router.back()}
                                style={{ margin: 0 }}
                            />
                        </BlurView>

                        <Animated.View style={[styles.measurementPill, pulseStyle]}>
                            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                            {mode === 'distance' || mode === 'height' ? (
                                <View style={{ alignItems: 'center' }}>
                                    <Text variant="headlineSmall" style={styles.measurementText}>{distanceText}</Text>
                                    {mode === 'height' && confidence && (
                                        <Text variant="labelSmall" style={{ color: '#166534', fontWeight: 'bold' }}>Accuracy: {confidence}%</Text>
                                    )}
                                    {mode === 'distance' && <Text variant="labelSmall" style={{ opacity: 0.6 }}>Linear Distance</Text>}
                                </View>
                            ) : (
                                <View style={{ alignItems: 'center' }}>
                                    {mode === 'volume' && (
                                        <Text
                                            variant="labelSmall"
                                            style={{ color: '#92400e', fontWeight: 'bold', marginBottom: 2 }}
                                            onPress={() => setLabel(prev => prev === "Box #1" ? "Fragile Item" : (prev === "Fragile Item" ? "Shipping Box" : "Box #1"))}
                                        >
                                            🏷️ {label}
                                        </Text>
                                    )}
                                    <Text variant="titleMedium" style={styles.measurementText}>{dimensionsText.width} x {dimensionsText.height}</Text>
                                    {dimensionsText.extra ? (
                                        <Text variant="labelSmall" style={{ color: 'rgba(0,0,0,0.6)', fontWeight: 'bold' }}>{dimensionsText.extra}</Text>
                                    ) : null}
                                </View>
                            )}
                        </Animated.View>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <BlurView intensity={40} tint="light" style={{ borderRadius: 24, overflow: 'hidden' }}>
                                <IconButton
                                    icon="scale-balance"
                                    iconColor="black"
                                    size={22}
                                    style={{ margin: 0, backgroundColor: isCalibrating ? '#fbbf24' : 'transparent' }}
                                    onPress={() => setIsCalibrating(!isCalibrating)}
                                />
                            </BlurView>
                            <BlurView intensity={40} tint="light" style={{ borderRadius: 24, overflow: 'hidden' }}>
                                <IconButton
                                    icon="ruler"
                                    iconColor="black"
                                    size={22}
                                    style={{ margin: 0 }}
                                    onPress={() => {
                                        setUnit(prev => {
                                            if (prev === 'cm') return 'm';
                                            if (prev === 'm') return 'inch';
                                            if (prev === 'inch') return 'ft';
                                            return 'cm';
                                        });
                                    }}
                                />
                            </BlurView>
                            {(mode === 'area' || mode === 'volume') && (
                                <BlurView intensity={40} tint="light" style={{ borderRadius: 24, overflow: 'hidden' }}>
                                    <IconButton
                                        icon="calculator-variant"
                                        iconColor="#6200ee"
                                        size={22}
                                        style={{ margin: 0 }}
                                        onPress={() => setShowEstimator(!showEstimator)}
                                    />
                                </BlurView>
                            )}
                        </View>
                    </View>

                    {/* Footer Controls */}
                    <View style={styles.footer}>

                        {/* Calibration Overlay Controls */}
                        {showExportMenu ? (
                            <Surface style={{ padding: 16, borderRadius: 16, backgroundColor: '#222', width: '100%', alignItems: 'center' }} elevation={4}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Share & Export</Text>
                                <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 16 }}>Share via WhatsApp, Email, Drive, etc.</Text>
                                <Button mode="outlined" icon="image" onPress={() => handleExport('image')} style={{ width: '100%', marginBottom: 8 }} textColor="white">Export Image (Overlay)</Button>
                                <Button mode="outlined" icon="file-pdf-box" onPress={() => handleExport('pdf')} style={{ width: '100%', marginBottom: 8 }} textColor="white">Export Report (PDF)</Button>
                                {mode === 'room' && (
                                    <Button mode="outlined" icon="floor-plan" onPress={() => handleExport('blueprint')} style={{ width: '100%', marginBottom: 8 }} textColor="#4ade80">Export Blueprint (SVG)</Button>
                                )}
                                <Button mode="outlined" icon="file-delimited" onPress={() => handleExport('csv')} style={{ width: '100%', marginBottom: 8 }} textColor="white">Export Data (CSV)</Button>
                                {user && !isGuest && (
                                    <Button mode="contained" icon="cloud-upload" onPress={saveToCloud} style={{ width: '100%', marginBottom: 8, backgroundColor: '#6200ee' }}>Save to Cloud</Button>
                                )}
                                <Button mode="text" onPress={() => setShowExportMenu(false)} textColor="#ef4444">Cancel</Button>
                            </Surface>
                        ) : showEstimator ? (
                            <Surface style={{ padding: 16, borderRadius: 16, backgroundColor: '#222', width: '100%', alignItems: 'center' }} elevation={4}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Material Estimator</Text>
                                <Text style={{ color: '#aaa', fontSize: 11, marginBottom: 12, textAlign: 'center' }}>Based on measured {mode === 'area' ? 'Surface Area' : '3D Volume'}</Text>

                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
                                    <Button mode={selectedMaterial === 'paint' ? 'contained' : 'outlined'} onPress={() => setSelectedMaterial('paint')} compact style={{ flex: 1 }}>Paint</Button>
                                    <Button mode={selectedMaterial === 'tiles' ? 'contained' : 'outlined'} onPress={() => setSelectedMaterial('tiles')} compact style={{ flex: 1 }}>Tiles</Button>
                                    <Button mode={selectedMaterial === 'concrete' ? 'contained' : 'outlined'} onPress={() => setSelectedMaterial('concrete')} compact style={{ flex: 1 }}>Bags</Button>
                                </View>

                                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', width: '100%', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <Text style={{ color: '#4ade80', fontSize: 24, fontWeight: '900' }}>{calculateEstimate()}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 }}>ESTIMATED REQUIREMENT</Text>
                                </View>

                                <Button mode="text" onPress={() => setShowEstimator(false)} textColor="#ef4444" style={{ marginTop: 8 }}>Close Estimator</Button>
                            </Surface>
                        ) : isCalibrating ? (
                            <Surface style={{ padding: 16, borderRadius: 16, backgroundColor: '#222', width: '100%', alignItems: 'center' }} elevation={4}>
                                <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 12 }}> Select Reference Object </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                                    <Button mode={refObj === 'card' ? 'contained' : 'outlined'} onPress={() => setRefObj('card')} compact>Card</Button>
                                    <Button mode={refObj === 'a4' ? 'contained' : 'outlined'} onPress={() => setRefObj('a4')} compact>A4</Button>
                                    <Button mode={refObj === 'money' ? 'contained' : 'outlined'} onPress={() => setRefObj('money')} compact>Bill</Button>
                                </View>
                                <Button mode="contained" icon="check" onPress={calibrateScale} style={{ width: '100%' }} buttonColor="#4ade80" textColor="black">
                                    Set Scale
                                </Button>
                            </Surface>
                        ) : (
                            <>

                                {/* AI Intelligence Chip */}
                                {aiContext && !isScanning && (
                                    <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 8, width: '100%' }}>
                                        <BlurView intensity={90} tint="dark" style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
                                            <Text style={[styles.statusText, { fontWeight: 'bold', fontSize: 14, color: '#a78bfa' }]}>
                                                🧠 {aiContext.object}
                                            </Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                                                💡 {aiContext.suggestion}
                                            </Text>
                                        </BlurView>
                                    </View>
                                )}

                                {/* Floating Status Chip */}
                                <View style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
                                    <BlurView intensity={60} tint="dark" style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
                                        <Text style={[styles.statusText, { letterSpacing: 1 }]}>
                                            {scanStatus.toUpperCase()} <Text style={{ color: theme.colors.primary }}>●</Text> {unit.toUpperCase()}
                                        </Text>
                                    </BlurView>
                                </View>

                                {/* Voice Command Mic */}
                                <TouchableOpacity
                                    onPress={toggleVoice}
                                    style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 32,
                                        backgroundColor: isListening ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: 16,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.2)'
                                    }}
                                >
                                    <IconButton icon={isListening ? "dots-horizontal" : "microphone"} iconColor="white" size={32} />
                                </TouchableOpacity>

                                <View style={styles.controlsRow}>
                                    <IconButton
                                        icon="line-scan"
                                        mode="contained"
                                        containerColor={isScanning ? '#333' : '#6200ee'}
                                        iconColor="white"
                                        size={32}
                                        onPress={startAutoScan}
                                        disabled={isScanning}
                                        style={styles.actionButton}
                                    />

                                    {/* CAMERA SHUTTER BUTTON */}
                                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                        <Surface
                                            elevation={4}
                                            style={{
                                                width: 80,
                                                height: 80,
                                                borderRadius: 40,
                                                backgroundColor: 'white',
                                                padding: 4,
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    try {
                                                        setIsCapturing(true);
                                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                                                        // Wait for flash effect to show
                                                        setTimeout(async () => {
                                                            const uri = await captureRef(viewRef, {
                                                                format: 'png',
                                                                quality: 0.9,
                                                            });
                                                            setIsCapturing(false);
                                                            await Sharing.shareAsync(uri, {
                                                                mimeType: 'image/png',
                                                                dialogTitle: 'Share Measurement Photo'
                                                            });
                                                        }, 100);
                                                    } catch (e) {
                                                        setIsCapturing(false);
                                                        Alert.alert("Error", "Could not capture photo");
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    borderRadius: 40,
                                                    borderWidth: 2,
                                                    borderColor: '#000',
                                                    backgroundColor: 'white'
                                                }}
                                            />
                                        </Surface>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>SNAP PHOTO</Text>
                                    </View>

                                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                        <IconButton
                                            icon={galleryImage ? "camera" : "image"}
                                            mode="contained"
                                            containerColor="rgba(255,255,255,0.9)"
                                            iconColor="black"
                                            size={32}
                                            onPress={galleryImage ? () => setGalleryImage(null) : pickImage}
                                            style={styles.actionButton}
                                        />
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>
                                            {galleryImage ? "CAMERA" : "GALLERY"}
                                        </Text>
                                    </View>
                                </View>

                                {/* FLASH EFFECT OVERLAY */}
                                {isCapturing && (
                                    <Animated.View
                                        entering={FadeInDown}
                                        style={[StyleSheet.absoluteFill, { backgroundColor: 'white', zIndex: 9999 }]}
                                    />
                                )}
                            </>
                        )}
                    </View>
                </View>
            </View>
        </GestureHandlerRootView>
    );
}

// Subcomponent for handles
function AnimatedHandle({ point, gesture }: { point: SharedValue<{ x: number, y: number }>, gesture: any }) {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: point.value.x - 30 }, { translateY: point.value.y - 30 }]
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.handle, animatedStyle]}>
                <View style={styles.handleInner} />
                {/* Touch Target Expansion */}
                <View style={styles.handleTouchArea} />
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    uiOverlay: {
        flex: 1,
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? 50 : 0,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: Platform.OS === 'ios' ? 60 : 10
    },
    measurementPill: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.7)',
        minWidth: 140,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)'
    },
    measurementText: {
        fontWeight: '900',
        color: '#000',
        letterSpacing: 0.5
    },
    footer: {
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 20
    },
    statusPill: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    statusText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
        letterSpacing: 0.5
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
        justifyContent: 'center'
    },
    actionButton: {
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    handle: {
        position: 'absolute',
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    handleInner: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 4,
        borderColor: '#6200ee',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    handleTouchArea: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 30,
        backgroundColor: 'transparent'
    },
    levelContainer: {
        width: 200,
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 3,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelBubble: {
        width: 40,
        height: 6,
        borderRadius: 3,
    }
});
