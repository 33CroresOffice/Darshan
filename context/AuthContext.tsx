import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, SebayatRegistration } from "@/types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  registration: SebayatRegistration | null;
  loading: boolean;
  hasApprovedRegistration: boolean;
  sebayatRegistrationId: string | null;
  refreshProfile: () => Promise<void>;
  refreshRegistration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registration, setRegistration] = useState<SebayatRegistration | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
    return data as Profile | null;
  };

  const fetchRegistration = async (userId: string) => {
    const { data } = await supabase
      .from("sebayat_registrations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setRegistration(data as SebayatRegistration | null);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  };

  const refreshRegistration = async () => {
    if (session?.user?.id) {
      await fetchRegistration(session.user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setSession(session);
        Promise.all([
          fetchProfile(session.user.id),
          fetchRegistration(session.user.id),
        ]).finally(() => setLoading(false));
      } else {
        setSession(session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setRegistration(null);
        setLoading(false);
        return;
      }

      setSession(session);
      if (session?.user?.id) {
        setLoading(true);
        (async () => {
          await Promise.all([
            fetchProfile(session.user.id),
            fetchRegistration(session.user.id),
          ]);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setRegistration(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
