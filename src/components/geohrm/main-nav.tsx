
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarOff,
  MessageSquareWarning,
  User,
  Megaphone,
  PartyPopper,
  Users,
  Building,
  BarChart2,
  PlusCircle,
  FileText,
  Activity,
  LayoutTemplate,
  ShieldCheck,
  CalendarDays,
  FileBox,
  Laptop,
  Network,
  Settings,
  MapPinned,
  MapPin,
  UserCheck,
  Building2,
  ListTodo,
  Banknote,
  Briefcase,
  TrendingUp,
  Zap,
  DollarSign,
  Beaker,
  CheckCircle2,
  BarChart3,
  UserIcon,
  Video,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import React from "react";

// Define Tactical Role Tiers
const EXEC_ROLES = ['HR Manager', 'CEO/MD', 'CEO/Admin'];
const LEAD_ROLES = ['Team Lead', ...EXEC_ROLES];
const ALL_ROLES = ['Member', ...LEAD_ROLES];

const groups = [
  {
    label: "HOME",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES, badgeKey: "totalNotificationsCount" },
      { href: "https://studio--studio-6104224101-c3e7e.us-central1.hosted.app/", label: "Admin Desk", icon: ShieldCheck, roles: EXEC_ROLES },
      { href: "/dashboard/reports", label: "Workforce Reports", icon: FileText, roles: ALL_ROLES },
      { href: "/dashboard/todo", label: "Task Centre", icon: ListTodo, roles: ALL_ROLES },
    ]
  },
  {
    label: "BUSINESS",
    links: [
      { href: "/dashboard/clients", label: "Client Management", icon: Users, roles: EXEC_ROLES },
      { href: "/dashboard/projects", label: "Projects", icon: Briefcase, roles: EXEC_ROLES },
      { href: "/dashboard/pipeline", label: "Sales Pipeline", icon: TrendingUp, roles: EXEC_ROLES },
      { href: "/dashboard/marketing", label: "Marketing", icon: Zap, roles: EXEC_ROLES },
      { href: "/dashboard/finance", label: "Finance", icon: DollarSign, roles: EXEC_ROLES },
      { href: "/dashboard/training", label: "Training", icon: Beaker, roles: ALL_ROLES },
    ]
  },
  {
    label: "WORKFORCE",
    links: [
      { href: "/dashboard/users", label: "Employees", icon: UserIcon, roles: EXEC_ROLES },
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ALL_ROLES },
      { href: "/dashboard/leave", label: "Leave Management", icon: CalendarOff, roles: ALL_ROLES, badgeKey: "pendingLeaveCount" },
      { href: "/dashboard/payslips", label: "Payroll", icon: Banknote, roles: ALL_ROLES },
      { href: "/dashboard/analytics", label: "Performance", icon: BarChart3, roles: EXEC_ROLES },
    ]
  },
  {
    label: "ORGANIZATION",
    links: [
      { href: "/dashboard/branches", label: "Offices", icon: Building2, roles: EXEC_ROLES },
      { href: "/dashboard/departments", label: "Departments", icon: Building, roles: EXEC_ROLES },
      { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ALL_ROLES },
      { href: "/dashboard/org-structure", label: "Organization Chart", icon: Network, roles: ALL_ROLES },
      { href: "/dashboard/assets", label: "Asset Management", icon: Laptop, roles: ALL_ROLES },
    ]
  },
  {
    label: "OPERATIONS",
    links: [
      { href: "/dashboard/attendance-export", label: "Attendance Records Export", icon: FileSpreadsheet, roles: EXEC_ROLES },
      { href: "/dashboard/attendance-requests", label: "Approvals", icon: CheckCircle2, roles: LEAD_ROLES, badgeKey: "pendingAttRequestsCount" },
      { href: "/dashboard/documents", label: "Documents", icon: FileBox, roles: ALL_ROLES },
      { href: "/dashboard/compliance", label: "Complaints", icon: ShieldCheck, roles: EXEC_ROLES },
      { href: "/dashboard/monitor", label: "Activity Monitor", icon: Activity, roles: EXEC_ROLES },
    ]
  },
  {
    label: "COMMUNICATION",
    links: [
      { href: "/dashboard/announcements", label: "Company Feed", icon: Megaphone, roles: ALL_ROLES, badgeKey: "totalFeedNotifications" },
      { href: "/dashboard/meetings", label: "Meetings", icon: Video, roles: ALL_ROLES },
      { href: "/dashboard/holidays", label: "Holiday Calendar", icon: CalendarDays, roles: EXEC_ROLES },
      { href: "/dashboard/issues", label: "Support Centre", icon: MessageSquareWarning, roles: ALL_ROLES, badgeKey: "ticketUpdateCount" },
    ]
  },
  {
    label: "ADMINISTRATION",
    links: [
      { href: "/dashboard/geofence", label: "Geofence Control", icon: MapPin, roles: EXEC_ROLES },
      { href: "/dashboard/users", label: "User Management", icon: Settings, roles: EXEC_ROLES },
      { href: "/dashboard/report-templates", label: "Reports", icon: LayoutTemplate, roles: EXEC_ROLES },
      { href: "/dashboard/report-builder", label: "Report Builder", icon: Layers, roles: EXEC_ROLES },
      { href: "/dashboard/settings", label: "System Settings", icon: Settings, roles: EXEC_ROLES },
    ]
  },
  {
    label: "ACCOUNT",
    links: [
      { href: "/dashboard/profile", label: "My Profile", icon: User, roles: ALL_ROLES },
    ]
  }
];

interface MainNavProps {
  userRole: string;
  pendingLeaveCount?: number;
  unreadAnnouncementsCount?: number;
  todaysEventsCount?: number;
  pendingLocationRequestsCount?: number;
  pendingAttRequestsCount?: number;
  ticketUpdateCount?: number;
  totalNotificationsCount?: number;
}

export function MainNav({ 
  userRole,
  pendingLeaveCount = 0,
  unreadAnnouncementsCount = 0,
  todaysEventsCount = 0,
  pendingLocationRequestsCount = 0,
  pendingAttRequestsCount = 0,
  ticketUpdateCount = 0,
  totalNotificationsCount = 0,
}: MainNavProps) {
  const pathname = usePathname();

  const badgeCounts: { [key: string]: number } = {
    pendingLeaveCount,
    combinedNewsCount: unreadAnnouncementsCount,
    todaysEventsCount,
    pendingLocationRequestsCount,
    pendingAttRequestsCount,
    ticketUpdateCount,
    totalNotificationsCount,
    totalFeedNotifications: unreadAnnouncementsCount + todaysEventsCount,
  };

  return (
    <>
      {groups.map((group) => {
        const visibleLinks = group.links.filter(link => link.roles.includes(userRole));
        if (visibleLinks.length === 0) return null;

        return (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-2 py-4 h-auto">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleLinks.map((link) => {
                  const badgeCount = link.badgeKey ? badgeCounts[link.badgeKey] : 0;
                  const isActive = pathname === link.href;
                  
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
                        <Link 
                          href={link.href} 
                          target={link.href.startsWith('http') ? "_blank" : undefined}
                        >
                          <link.icon className="size-4" />
                          <span className="font-semibold">{link.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {link.badgeKey && badgeCount > 0 && (
                        <SidebarMenuBadge className="bg-primary text-primary-foreground font-black rounded-full text-[9px] h-4.5 min-w-[1.1rem] flex items-center justify-center border border-sidebar shadow-sm">
                            {badgeCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}
