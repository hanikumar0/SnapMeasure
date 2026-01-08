import { deleteUser, onAuthStateChanged, signInAnonymously, signOut, User } from 'firebase/auth';
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';

interface AuthContextType {
    user: User | null;
    isGuest: boolean;
    loading: boolean;
    loginAsGuest: () => Promise<void>;
    logout: () => Promise<void>;
    deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isGuest: false,
    loading: true,
    loginAsGuest: async () => { },
    logout: async () => { },
    deleteUserAccount: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        let authFinished = false;

        const unsubscribe = onAuthStateChanged(auth, (usr) => {
            console.log("[Auth] State changed:", usr?.uid);
            authFinished = true;
            setUser(usr);
            setIsGuest(usr ? usr.isAnonymous : false);
            setLoading(false);
        });

        // Safety timeout to prevent getting stuck on splash screen
        const timer = setTimeout(() => {
            if (!authFinished) {
                console.warn("[Auth] Firebase authentication timed out. Proceeding as guest/unauthenticated.");
                setLoading(false);
            }
        }, 6000);

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const loginAsGuest = async () => {
        try {
            await signInAnonymously(auth);
        } catch (e) {
            console.error(e);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error(e);
        }
    };

    const deleteUserAccount = async () => {
        if (!auth.currentUser) return;
        try {
            const uid = auth.currentUser.uid;
            const querySnapshot = await getDocs(collection(db, `users/${uid}/measurements`));
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            await deleteUser(auth.currentUser);
        } catch (e) {
            console.error("Error deleting account:", e);
            throw e;
        }
    };

    return (
        <AuthContext.Provider value={{ user, isGuest, loading, loginAsGuest, logout, deleteUserAccount }}>
            {children}
        </AuthContext.Provider>
    );
};
