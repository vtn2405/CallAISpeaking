'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getGuestId, rotateGuestId } from '@/lib/identity';
import { migrateGuestToUser } from '@/lib/historyRepository';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wrap inside try-catch to prevent crashing if env vars are missing
    try {
      const supabase = createClient();

      const loadSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching session:', error);
        }
        
        setUser(session?.user ?? null);
        setSession(session);
        setIsLoading(false);
      };

      loadSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null);
          setSession(session);

          // Handle guest -> user migration on successful sign-in
          if (event === 'SIGNED_IN' && session?.user) {
            const guestId = getGuestId();
            if (guestId) {
              await migrateGuestToUser(guestId, session.user.id);
              rotateGuestId();
            }
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    } catch (e) {
      console.warn('Supabase not configured, skipping auth provider init.', e);
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
