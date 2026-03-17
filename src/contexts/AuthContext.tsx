import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

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
  currentUser: SupabaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) fetchProfile(user);
      else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) fetchProfile(user);
      else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(user: SupabaseUser) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .single();

      if (error && error.code === 'PGRST116') { // Not found
        const adminEmails = ['arkelly147@gmail.com', 'kelly111992@gmail.com', user.email];
        const isAdmin = adminEmails.includes(user.email || '');
        const newProfile: UserProfile = {
          uid: user.id,
          name: user.user_metadata.full_name || user.user_metadata.name || 'Usuario Desconocido',
          email: user.email || '',
          role: isAdmin ? 'admin' : 'agent',
          status: 'active',
          createdAt: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            uid: newProfile.uid,
            name: newProfile.name,
            email: newProfile.email,
            role: newProfile.role,
            status: newProfile.status,
            created_at: newProfile.createdAt
          }]);

        if (insertError) console.error("Error creating user profile:", insertError);
        setUserProfile(newProfile);
      } else if (data) {
        setUserProfile({
          uid: data.uid,
          name: data.name,
          email: data.email,
          role: data.role,
          status: data.status,
          createdAt: data.created_at
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  }

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
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
