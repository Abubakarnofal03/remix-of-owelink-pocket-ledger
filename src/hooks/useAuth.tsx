import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types/database";
import { normalizeToE164, phoneToEmail } from "@/lib/phoneUtils";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  currency: string;
  signUp: (email: string, password: string, username: string, phoneNumber: string, currency?: string) => Promise<{ error: Error | null }>;
  signIn: (phoneNumber: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: Record<string, unknown>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const currency = (profile?.settings as any)?.currency || DEFAULT_CURRENCY;

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }

        if (event === "SIGNED_OUT") {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string, phoneNumber: string, userCurrency: string = DEFAULT_CURRENCY) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Normalize phone number to E.164 format
    const normalizedPhone = normalizeToE164(phoneNumber);
    // Generate email from digits for consistent auth
    const authEmail = phoneToEmail(normalizedPhone);

    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          phone_number: normalizedPhone,
          settings: { currency: userCurrency },
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (phoneNumber: string, password: string) => {
    const email = phoneToEmail(phoneNumber);
    const digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

    if (digitsOnly.length < 8) {
      return { error: new Error("Enter a valid phone number") };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const friendly =
        error.message?.toLowerCase().includes("invalid login")
          ? "Incorrect phone number or password"
          : error.message;
      return { error: new Error(friendly) };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const updateSettings = async (newSettings: Record<string, unknown>) => {
    if (!profile) return { error: new Error("No profile") };

    const currentSettings = (profile.settings as Record<string, unknown>) || {};
    const mergedSettings = { ...currentSettings, ...newSettings };

    const { error } = await supabase
      .from("profiles")
      .update({ settings: mergedSettings as any })
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, settings: mergedSettings });
    }

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      currency,
      signUp, 
      signIn, 
      signOut, 
      refreshProfile,
      updateSettings 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
