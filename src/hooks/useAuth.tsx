import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { type UserRole, hasRole } from "@/lib/roleUtils";
import { initialRecoveryIntent } from "@/lib/authRecovery";

interface StaffUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  organization_id: number;
  auth_id: string | null;
  scope_restricted?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  staffUser: StaffUser | null;
  staffRoles: UserRole[];
  recoveryRequested: boolean;
  finishRecovery: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isInstructor: boolean;
  isFrontdesk: boolean;
  isAdminOrManager: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [staffRoles, setStaffRoles] = useState<UserRole[]>([]);
  const [recoveryRequested, setRecoveryRequested] = useState(initialRecoveryIntent.requested);

  useEffect(() => {
    let active = true;
    let currentAuthId: string | null | undefined;
    let revision = 0;
    let receivedEvent = false;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      const authId = nextSession?.user.id ?? null;
      // SIGNED_IN also fires on tab focus. Do not unmount the current workflow.
      if (currentAuthId === authId) return;
      currentAuthId = authId;
      const request = ++revision;
      setStaffUser(null);
      setStaffRoles([]);
      setLoading(!!authId);
      if (!authId) return;
      const isCurrent = () => active && revision === request;
      // Keep database calls outside Supabase's auth callback lock.
      setTimeout(async () => {
        if (!isCurrent()) return;
        try {
          const { data: staff, error } = await supabase.from("users")
            .select("id, name, email, phone, photo, organization_id, auth_id, scope_restricted")
            .eq("auth_id", authId).maybeSingle();
          if (error) throw error;
          if (!staff || !isCurrent()) return;
          const { data: roles, error: roleError } = await supabase.from("user_roles")
            .select("id, role_id, organization_id, is_primary, roles(name, type)")
            .eq("user_id", staff.id).eq("organization_id", staff.organization_id);
          if (roleError) throw roleError;
          if (isCurrent()) {
            setStaffUser(staff as StaffUser);
            setStaffRoles((roles || []) as unknown as UserRole[]);
          }
        } catch {
          // Missing or unreadable authorization never grants implicit admin access.
          if (isCurrent()) { setStaffUser(null); setStaffRoles([]); }
        } finally {
          if (isCurrent()) setLoading(false);
        }
      }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedEvent = true;
      if (event === "PASSWORD_RECOVERY") setRecoveryRequested(true);
      if (event === "SIGNED_OUT") setRecoveryRequested(false);
      applySession(nextSession);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!receivedEvent) applySession(error ? null : data.session);
    }).catch(() => { if (!receivedEvent) applySession(null); });
    return () => { active = false; revision++; subscription.unsubscribe(); };
  }, []);

  const isAdmin = hasRole(staffRoles, "admin");
  const isManager = hasRole(staffRoles, "manager");
  const isInstructor = hasRole(staffRoles, "instructor");
  const isFrontdesk = hasRole(staffRoles, "frontdesk");
  const isAdminOrManager = isAdmin || isManager;

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setStaffUser(null);
    setStaffRoles([]);
  };

  return (
    <AuthContext.Provider value={{
      session, user, loading, staffUser, staffRoles, recoveryRequested,
      finishRecovery: () => setRecoveryRequested(false),
      isAdmin, isManager, isInstructor, isFrontdesk, isAdminOrManager,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
