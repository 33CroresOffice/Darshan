import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { Profile, SebayatRegistration } from "@/types";

const CACHE_PROFILE_KEY = "@auth:profile";
const CACHE_REGISTRATION_KEY = "@auth:registration";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  registration: SebayatRegistration | null;
  // true once we have confirmed data from the server (or confirmed no row exists)
  registrationLoaded: boolean;
  loading: boolean;
  hasApprovedRegistration: boolean;
  sebayatRegistrationId: string | null;
  refreshProfile: () => Promise<void>;
  refreshRegistration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------- cache helpers ----------

async function readCachedProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

async function writeCachedProfile(p: Profile | null) {
  try {
    if (p) await AsyncStorage.setItem(CACHE_PROFILE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(CACHE_PROFILE_KEY);
  } catch {}
}

async function readCachedRegistration(): Promise<SebayatRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_REGISTRATION_KEY);
    return raw ? (JSON.parse(raw) as SebayatRegistration) : null;
  } catch {
    return null;
  }
}

async function writeCachedRegistration(r: SebayatRegistration | null) {
  try {
    if (r) await AsyncStorage.setItem(CACHE_REGISTRATION_KEY, JSON.stringify(r));
    else await AsyncStorage.removeItem(CACHE_REGISTRATION_KEY);
  } catch {}
}

// ---------- provider ----------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registration, setRegistration] = useState<SebayatRegistration | null>(null);
  // true once we have a confirmed server response (or confirmed no row exists)
  const [registrationLoaded, setRegistrationLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch profile from server; on success update state + cache.
  // On network failure keep whatever is already in state (caller pre-loaded cache).
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!error) {
        const p = data as Profile | null;
        setProfile(p);
        await writeCachedProfile(p);
        return p;
      }
    } catch {}
    return null;
  };

  // Fetch registration from server; on success update state + cache + mark loaded.
  // On network failure keep whatever is already in state.
  const fetchRegistration = async (userId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("sebayat_registrations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error) {
        const r = data as SebayatRegistration | null;
        setRegistration(r);
        await writeCachedRegistration(r);
        setRegistrationLoaded(true);
      }
    } catch {}
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  };

  const refreshRegistration = async () => {
    if (session?.user?.id) await fetchRegistration(session.user.id);
  };

  useEffect(() => {
    // Bootstrap: load cached profile/registration immediately so the UI is
    // never blank on first render, even offline. Then try to get a fresh
    // session and fetch live data.
    const bootstrap = async () => {
      // 1. Paint from cache right away
      const [cachedProfile, cachedRegistration] = await Promise.all([
        readCachedProfile(),
        readCachedRegistration(),
      ]);
      if (cachedProfile) setProfile(cachedProfile);
      if (cachedRegistration) {
        setRegistration(cachedRegistration);
        // Cache means we previously confirmed a row exists; treat as loaded
        // so the routing guard can act on it without waiting for the server.
        setRegistrationLoaded(true);
      }

      // 2. Try to get the live session — this may fail if offline
      let liveSession: Session | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        liveSession = data.session;
      } catch {
        // Offline on cold start: if we already painted cached data above the
        // user can continue; if no cache we just show the auth screen.
      }

      setSession(liveSession);

      if (liveSession?.user?.id) {
        // Fire live fetches; they update state only on success so an offline
        // failure leaves the cached values untouched.
        await Promise.allSettled([
          fetchProfile(liveSession.user.id),
          fetchRegistration(liveSession.user.id),
        ]);
      } else if (!liveSession) {
        // No session at all — clear any stale cache
        if (!cachedProfile && !cachedRegistration) {
          // nothing to clear
        } else {
          setProfile(null);
          setRegistration(null);
          setRegistrationLoaded(false);
          await Promise.all([writeCachedProfile(null), writeCachedRegistration(null)]);
        }
      }

      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setRegistration(null);
        setRegistrationLoaded(false);
        setLoading(false);
        // Clear caches on sign-out
        (async () => {
          await Promise.all([writeCachedProfile(null), writeCachedRegistration(null)]);
        })();
        return;
      }

      setSession(session);
      if (session?.user?.id) {
        setLoading(true);
        (async () => {
          await Promise.allSettled([
            fetchProfile(session.user.id),
            fetchRegistration(session.user.id),
          ]);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setRegistration(null);
        setRegistrationLoaded(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time profile updates via Supabase channel
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const profileSubscription = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          setProfile(updatedProfile);
          writeCachedProfile(updatedProfile);

          if (updatedProfile.is_active === false) {
            (async () => {
              await supabase.auth.signOut();
            })();
          }
        }
      )
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, [session?.user?.id]);

  const hasApprovedRegistration = registration?.approval_status === "approved";
  const sebayatRegistrationId = hasApprovedRegistration ? registration?.id ?? null : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        registration,
        registrationLoaded,
        loading,
        hasApprovedRegistration,
        sebayatRegistrationId,
        refreshProfile,
        refreshRegistration,
      }}
    >
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
