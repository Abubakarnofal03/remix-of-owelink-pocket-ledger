import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types/database";
import { normalizeToE164, phoneToEmail } from "@/lib/phoneUtils";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

const PROFILE_STORAGE_KEY = "cached_profile";
const SESSION_STORAGE_KEY = "cached_session";
const LOGGED_IN_FLAG = "logged_in";

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

// Cache profile to localStorage for offline access
const cacheProfile = (profile: Profile | null) => {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      console.log('[Auth] Profile cached locally');
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[Auth] Failed to cache profile:', e);
  }
};

// Load cached profile from localStorage
const loadCachedProfile = (): Profile | null => {
  try {
    const cached = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (cached) {
      console.log('[Auth] Using cached profile');
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[Auth] Failed to load cached profile:', e);
  }
  return null;
};

// Cache session to localStorage for offline access
const cacheSession = (session: Session | null) => {
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: session.user,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      }));
      console.log('[Auth] Session cached locally');
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[Auth] Failed to cache session:', e);
  }
};

// Load cached session -- NEVER auto-expire; only cleared on explicit logout
const loadCachedSession = (): { user: User; session: Partial<Session> } | null => {
  try {
    const cached = localStorage.getItem(SESSION_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      console.log('[Auth] Using cached session');
      return { user: parsed.user, session: parsed };
    }
  } catch (e) {
    console.warn('[Auth] Failed to load cached session:', e);
  }
  return null;
};

// Check if user has explicitly logged in before
const isLoggedInFlag = (): boolean => {
  return localStorage.getItem(LOGGED_IN_FLAG) === 'true';
};

const setLoggedInFlag = () => {
  localStorage.setItem(LOGGED_IN_FLAG, 'true');
};

const clearLoggedInFlag = () => {
  localStorage.removeItem(LOGGED_IN_FLAG);
};

// Synchronously hydrate from cache so user is NEVER null for a logged-in user
const getInitialAuthState = () => {
  if (!isLoggedInFlag()) return { user: null, session: null, profile: null };
  const cachedSession = loadCachedSession();
  const cachedProfile = loadCachedProfile();
  return {
    user: cachedSession?.user ?? null,
    session: (cachedSession?.session as Session) ?? null,
    profile: cachedProfile,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialAuthState();
  const [user, setUser] = useState<User | null>(initial.user);
  const [session, setSession] = useState<Session | null>(initial.session);
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  // If we have cached state, skip loading entirely -- user sees app immediately
  const [loading, setLoading] = useState(!initial.user);

  const currency = (profile?.settings as any)?.currency || DEFAULT_CURRENCY;

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
        cacheProfile(data as Profile);
      } else if (error) {
        console.warn('[Auth] Failed to fetch profile from server:', error.message);
        const cached = loadCachedProfile();
        if (cached && cached.user_id === userId) {
          setProfile(cached);
        }
      }
    } catch (e) {
      console.warn('[Auth] Error fetching profile:', e);
      const cached = loadCachedProfile();
      if (cached && cached.user_id === userId) {
        setProfile(cached);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (currentSession?.user) {
          // Valid session -- update everything
          setSession(currentSession);
          setUser(currentSession.user);
          setLoggedInFlag();
          cacheSession(currentSession);

          const cached = loadCachedProfile();
          if (cached && cached.user_id === currentSession.user.id) {
            setProfile(cached);
          }
          setTimeout(() => {
            fetchProfile(currentSession.user.id);
          }, 0);
        } else if (event === "SIGNED_OUT") {
          // Only clear state on EXPLICIT sign out
          setProfile(null);
          cacheProfile(null);
          cacheSession(null);
          clearLoggedInFlag();
        } else if (isLoggedInFlag()) {
          // Session is null but user was logged in -- DO NOT set user to null
          // Just silently keep existing cached state; no state changes needed
          console.log('[Auth] Session null but logged_in flag set -- keeping cached state (no flash)');
        }
        // If not logged in and no session, do nothing (initial state is already null)
      }
    );

    // Refresh session periodically when online (every 10 minutes)
    const refreshSession = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (data?.session) {
          console.log('[Auth] Session refreshed successfully');
          cacheSession(data.session);
        } else if (error) {
          console.warn('[Auth] Session refresh failed:', error.message);
        }
      } catch (e) {
        console.warn('[Auth] Error refreshing session:', e);
      }
    };

    const refreshInterval = setInterval(() => {
      if (navigator.onLine && isLoggedInFlag()) {
        refreshSession();
      }
    }, 10 * 60 * 1000);

    // Timeout fallback for slow/offline connections
    const sessionTimeout = setTimeout(() => {
      if (loading && isLoggedInFlag()) {
        console.log('[Auth] Session check taking too long, using cached data');
        const cachedSession = loadCachedSession();
        if (cachedSession) {
          setUser(cachedSession.user);
          setSession(cachedSession.session as Session);
        }
        const cached = loadCachedProfile();
        if (cached) {
          setProfile(cached);
        }
        setLoading(false);
      }
    }, 2000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        setLoggedInFlag();
        cacheSession(session);
      }
      if (session?.user) {
        const cached = loadCachedProfile();
        if (cached && cached.user_id === session.user.id) {
          setProfile(cached);
          setLoading(false);
        }
        const fetchWithTimeout = async () => {
          const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000));
          await Promise.race([fetchProfile(session.user.id), timeoutPromise]);
          setLoading(false);
        };
        fetchWithTimeout();
      } else if (isLoggedInFlag()) {
        // Server returned no session but user previously logged in -- trust cache
        console.log('[Auth] No server session but logged_in flag set -- using cached data');
        const cachedSession = loadCachedSession();
        if (cachedSession) {
          setUser(cachedSession.user);
          setSession(cachedSession.session as Session);
          const cached = loadCachedProfile();
          if (cached && cached.user_id === cachedSession.user.id) {
            setProfile(cached);
          }
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    }).catch((e) => {
      console.warn('[Auth] Session check failed:', e);
      clearTimeout(sessionTimeout);
      if (isLoggedInFlag()) {
        const cachedSession = loadCachedSession();
        if (cachedSession) {
          console.log('[Auth] Network error - using cached session');
          setUser(cachedSession.user);
          setSession(cachedSession.session as Session);
        }
        const cached = loadCachedProfile();
        if (cached) {
          setProfile(cached);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(sessionTimeout);
      clearInterval(refreshInterval);
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, phoneNumber: string, userCurrency: string = DEFAULT_CURRENCY) => {
    const redirectUrl = `${window.location.origin}/`;
    const normalizedPhone = normalizeToE164(phoneNumber);
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

    if (!error) {
      setLoggedInFlag();
    }

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

    setLoggedInFlag();
    return { error: null };
  };

  const signOut = async () => {
    // Clear everything on explicit sign out
    clearLoggedInFlag();
    cacheProfile(null);
    cacheSession(null);
    // Clear biometric flag (credentials cleared separately by Settings/Auth)
    localStorage.removeItem('biometric_enabled');
    
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
      const updatedProfile = { ...profile, settings: mergedSettings };
      setProfile(updatedProfile);
      cacheProfile(updatedProfile as Profile);
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
