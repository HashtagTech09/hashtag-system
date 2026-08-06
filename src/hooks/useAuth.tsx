import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { type UserRole, hasRole } from "@/lib/roleUtils";

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

  const fetchStaffData = async (authId: string) => {
    try {
      const { data: staffData } = await supabase
        .from("users")
        .select("id, name, email, phone, photo, organization_id, auth_id, scope_restricted")
        .eq("auth_id", authId)
        .single();

      if (staffData) {
        setStaffUser(staffData as StaffUser);
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("id, role_id, organization_id, is_primary, roles(name, type)")
          .eq("user_id", staffData.id);
        setStaffRoles((rolesData || []) as unknown as UserRole[]);
      } else {
        setStaffUser(null);
        setStaffRoles([]);
      }
    } catch {
      setStaffUser(null);
      setStaffRoles([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid Supabase client deadlock
        setTimeout(() => {
          fetchStaffData(session.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setStaffUser(null);
        setStaffRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchStaffData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
      session, user, loading, staffUser, staffRoles,
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
