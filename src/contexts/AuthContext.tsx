import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'agent';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }
      
      // We have a user, let's render the app immediately while we fetch the profile
      setLoading(false);
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        } else {
          // Create new user profile
          // Default to agent, unless it's the specific admin email
          const isAdmin = user.email === 'arkelly147@gmail.com';
          const newProfile: UserProfile = {
            uid: user.uid,
            name: user.displayName || 'Usuario Desconocido',
            email: user.email || '',
            role: isAdmin ? 'admin' : 'agent',
            status: 'active',
            createdAt: new Date().toISOString()
          };
          
          try {
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          } catch (error) {
            console.error("Error creating user profile:", error);
            // If creation fails (e.g., due to rules), we might just be an unauthorized user
            // But we should still set the profile so the app doesn't hang!
            setUserProfile(newProfile);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        // Fallback profile if we can't read from Firestore
        const isAdmin = user.email === 'arkelly147@gmail.com';
        setUserProfile({
          uid: user.uid,
          name: user.displayName || 'Usuario Desconocido',
          email: user.email || '',
          role: isAdmin ? 'admin' : 'agent',
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, signInWithGoogle, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
