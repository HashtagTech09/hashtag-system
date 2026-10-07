import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  Layers,
  CalendarDays,
  CreditCard,
  UserCheck,
  ClipboardList,
  Settings,
  LogOut,
  Zap,
  FileUp,
  FileWarning,
  ClipboardCheck,
  BadgeCheck,
  ClipboardPlus,
  MessageSquareQuote,
} from "lucide-react";
import { useApplicationCasesCount } from "@/hooks/useApplicationCasesCount";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const allMainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "manager", "instructor", "frontdesk"] },
  { title: "My Classes", url: "/instructor", icon: ClipboardCheck, roles: ["instructor"] },
  { title: "Studios", url: "/studios", icon: Building2, roles: ["admin", "manager", "frontdesk"] },
  { title: "Users", url: "/users", icon: Users, roles: ["admin", "manager"] },
  { title: "Students", url: "/students", icon: GraduationCap, roles: ["admin", "manager", "instructor", "frontdesk"] },
  { title: "Batches", url: "/batches", icon: Layers, roles: ["admin", "manager"] },
  { title: "Plan Cycles", url: "/plan-cycles", icon: CalendarDays, roles: ["admin", "manager"] },
];

const allOperationItems = [
  { title: "Registration Portal", url: "/portal/register", icon: ClipboardPlus, roles: ["admin", "manager", "frontdesk"] },
  { title: "Enrollments", url: "/enrollments", icon: ClipboardList, roles: ["admin", "manager", "frontdesk"] },
  { title: "Application Cases", url: "/application-cases", icon: FileWarning, roles: ["admin", "manager"] },
  { title: "Promotion Requests", url: "/promotion-requests", icon: BadgeCheck, roles: ["admin", "manager", "instructor"] },
  { title: "Drop-ins", url: "/drop-ins", icon: Zap, roles: ["admin", "manager", "frontdesk"] },
  { title: "Payments", url: "/payments", icon: CreditCard, roles: ["admin", "manager", "frontdesk"] },
  { title: "Attendance", url: "/attendance", icon: UserCheck, roles: ["admin", "manager", "instructor", "frontdesk"] },
  { title: "Class Feedback", url: "/class-feedback", icon: MessageSquareQuote, roles: ["admin", "manager", "instructor"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin", "manager"] },
  { title: "Import Data", url: "/import", icon: FileUp, roles: ["admin", "manager"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, staffUser, staffRoles, isAdminOrManager, isAdmin } = useAuth();
  const { pendingCount } = useApplicationCasesCount();

  const roleNames = staffRoles.map(r => r.roles?.name).filter(Boolean) as string[];
  const scopedManager = !isAdmin && roleNames.includes("manager") && (staffUser as any)?.scope_restricted === true;
  const showAll = isAdminOrManager && !scopedManager;
  const hiddenForScopedManagers = new Set(["/users", "/plan-cycles", "/settings", "/import"]);

  const filterByRole = (items: typeof allMainItems) => {
    const roleFiltered = showAll ? items : items.filter(item => item.roles.some(r => roleNames.includes(r)));
    return scopedManager ? roleFiltered.filter(item => !hiddenForScopedManagers.has(item.url)) : roleFiltered;
  };

  const mainItems = filterByRole(allMainItems);
  const operationItems = filterByRole(allOperationItems);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 mb-2">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src="/favicon.png" alt="Hashtag" className="h-6 w-6" />
              <h2 className="text-lg font-bold font-display">Hashtag</h2>
            </div>
          )}
          {collapsed && <img src="/favicon.png" alt="Hashtag" className="h-6 w-6" />}
        </div>

        {mainItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end={item.url === "/"}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {operationItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operationItems.map((item) => {
                  const showBadge = item.url === "/application-cases" && pendingCount > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && (
                            <span className="flex-1 flex items-center justify-between">
                              <span>{item.title}</span>
                              {showBadge && (
                                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
                                  {pendingCount}
                                </span>
                              )}
                            </span>
                          )}
                          {collapsed && showBadge && (
                            <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold">
                              {pendingCount}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
