
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
  UserCheck,
  Building2,
} from "lucide-react";
import React from "react";

const groups = [
  {
    label: "SECTION 01 STRATEGIC HUB",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "totalNotificationsCount" },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "SECTION 02 WORKFORCE",
    links: [
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/attendance-requests", label: "Range Approvals", icon: UserCheck, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingAttRequestsCount" },
      { href: "/dashboard/location-requests", label: "WFH Precision", icon: MapPinned, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingLocationRequestsCount" },
      { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "pendingLeaveCount" },
      { href: "/dashboard/documents", label: "Documents", icon: FileBox, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/branches", label: "Branches", icon: Building2, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/users", label: "Manage Users", icon: Building, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/org-structure", label: "Org. Structure", icon: Network, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "SECTION 03 OPERATIONS",
    links: [
      { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/monitor", label: "Monitor", icon: Activity, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/assets", label: "Assets", icon: Laptop, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/payslips", label: "Payslips", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "SECTION 04 COMMUNICATION",
    links: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "unreadAnnouncementsCount" },
      { href: "/dashboard/events", label: "Events", icon: PartyPopper, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "todaysEventsCount" },
      { href: "/dashboard/holidays", label: "Holidays", icon: CalendarDays, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/issues", label: "Support Desk", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "ticketUpdateCount" },
    ]
  },
  {
    label: "SECTION 05 SYSTEM",
    links: [
      { href: "/dashboard/report-templates", label: "Report Templates", icon: LayoutTemplate, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/settings", label: "System Settings", icon: Settings, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/profile", label: "Profile", icon: User, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
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
    unreadAnnouncementsCount,
    todaysEventsCount,
    pendingLocationRequestsCount,
    pendingAttRequestsCount,
    ticketUpdateCount,
    totalNotificationsCount,
  };

  return (
    <>
      {groups.map((group) => {
        const visibleLinks = group.links.filter(link => link.roles.includes(userRole));
        if (visibleLinks.length === 0) return null;

        return (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40 px-2 py-4 h-auto">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleLinks.map((link) => {
                  const badgeCount = link.badgeKey ? badgeCounts[link.badgeKey] : 0;
                  const isActive = pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard');
                  
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
                        <Link href={link.href}>
                          <link.icon className="size-4" />
                          <span className="font-bold">{link.label}</span>
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
