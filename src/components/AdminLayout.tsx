import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { roleColors } from "@/lib/roleUtils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  const { user, staffUser, staffRoles } = useAuth();
  const roleNames = staffRoles.map(r => r.roles?.name).filter(Boolean) as string[];
  const displayName = staffUser?.name || user?.email || "Signed in";
  const displayEmail = staffUser?.email || user?.email || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border px-4 shrink-0">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold font-display truncate">{title}</h1>
            <div className="ml-auto flex items-center gap-2 min-w-0">
              <div className="hidden sm:flex flex-col items-end leading-tight min-w-0">
                <span className="text-sm font-medium truncate max-w-[180px]">{displayName}</span>
                {displayEmail && displayEmail !== displayName && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">{displayEmail}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 justify-end">
                {roleNames.length > 0 ? (
                  roleNames.map((r) => (
                    <Badge
                      key={r}
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 h-5 ${roleColors[r] || ""}`}
                    >
                      {r}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    no staff profile
                  </Badge>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
