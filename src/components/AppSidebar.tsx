import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Upload, FileText, Download, Settings, FileStack } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const items = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Upload", url: "/app/upload", icon: Upload },
  { title: "Documents", url: "/app/documents", icon: FileText },
  { title: "Export", url: "/app/export", icon: Download },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, role } = useAuth();

  const isActive = (url: string) =>
    url === "/app" ? pathname === "/app" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold shadow-sm">
            <FileStack className="h-5 w-5 text-gold-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-base font-semibold text-sidebar-foreground">
                AsyncDoc
              </span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                Processing Suite
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-2">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{user.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-primary">
              {role ?? "user"}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
