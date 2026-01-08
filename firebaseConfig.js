import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported } from "firebase/analytics";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
    getAuth,
    getReactNativePersistence,
    initializeAuth
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Real Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCxcYes_tPMSEgIiFi1_62DzuCye1M9A9k".trim(),
    authDomain: "snapmeasure-58f58.firebaseapp.com".trim(),
    projectId: "snapmeasure-58f58".trim(),
    storageBucket: "snapmeasure-58f58.firebasestorage.app".trim(),
    messagingSenderId: "910226245742".trim(),
    appId: "1:910226245742:web:b7d901d1dd2a430424be7f".trim(),
    measurementId: "G-8GB96R9Z5B".trim()
};

// Initialize Firebase
console.log("[Firebase] Initializing project:", firebaseConfig.projectId);
console.log("[Firebase] API Key length:", firebaseConfig.apiKey.length);

/** @type {import('firebase/app').FirebaseApp} */
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
    if (app.options.apiKey !== firebaseConfig.apiKey) {
        console.warn("[Firebase] WARNING: App already exists with a DIFFERENT API key. Try restarting your bundler with '-c'.");
    }
}

// Initialize Analytics
// Note: getAnalytics(app) only works if the platform supports it (Web). 
// I've wrapped it in a support check to prevent the Android app from crashing.
let analytics;
isSupported().then(yes => {
    if (yes) analytics = getAnalytics(app);
});

// Initialize Auth
/** @type {import('firebase/auth').Auth} */
let auth;
if (Platform.OS === 'web') {
    auth = getAuth(app);
} else {
    // For Native (Android/iOS), we use the persistence-enabled version
    try {
        if (AsyncStorage) {
            auth = initializeAuth(app, {
                persistence: getReactNativePersistence(AsyncStorage)
            });
        } else {
            console.warn("[Firebase] AsyncStorage not found, using memory persistence.");
            auth = getAuth(app);
        }
    } catch (e) {
        console.error("[Firebase] initializeAuth error:", e);
        auth = getAuth(app);
    }
}

const db = getFirestore(app);

export { analytics, auth, db };

