
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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
  MapPin,
  ClipboardList,
  LayoutTemplate,
  ShieldCheck,
  CalendarDays,
  FileBox,
} from "lucide-react";
import React from "react";

const groups = [
  {
    label: "MAIN",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "https://studio--studio-6104224101-c3e7e.us-central1.hosted.app/", label: "Core Team Report", icon: ClipboardList, roles: ['Team Lead', 'HR Manager', 'CEO/Admin'], isExternal: true },
    ]
  },
  {
    label: "WORKFORCE",
    links: [
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "pendingLeaveCount" },
      { href: "/dashboard/documents", label: "Documents", icon: FileBox, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/location-requests", label: "WFH Requests", icon: MapPin, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingLocationRequestsCount" },
      { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/users", label: "Manage Users", icon: Building, roles: ['HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "OPERATIONS",
    links: [
      { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/monitor", label: "Monitor", icon: Activity, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/payslips", label: "Payslips", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "COMMUNICATION",
    links: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "unreadAnnouncementsCount" },
      { href: "/dashboard/events", label: "Events", icon: PartyPopper, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "todaysEventsCount" },
      { href: "/dashboard/holidays", label: "Holidays", icon: CalendarDays, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/issues", label: "Support Desk", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "ticketUpdateCount" },
    ]
  },
  {
    label: "SYSTEM",
    links: [
      { href: "/dashboard/report-templates", label: "Report Templates", icon: LayoutTemplate, roles: ['HR Manager', 'CEO/Admin'] },
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
  ticketUpdateCount?: number;
}

export function MainNav({ 
  userRole,
  pendingLeaveCount = 0,
  unreadAnnouncementsCount = 0,
  todaysEventsCount = 0,
  pendingLocationRequestsCount = 0,
  ticketUpdateCount = 0,
}: MainNavProps) {
  const pathname = usePathname();

  const badgeCounts: { [key: string]: number } = {
    pendingLeaveCount,
    unreadAnnouncementsCount,
    todaysEventsCount,
    pendingLocationRequestsCount,
    ticketUpdateCount,
  };

  return (
    <>
      {groups.map((group) => {
        const visibleLinks = group.links.filter(link => link.roles.includes(userRole));
        if (visibleLinks.length === 0) return null;

        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-black tracking-widest text-muted-foreground/60 px-4 py-2">
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
                        {link.isExternal ? (
                          <a href={link.href} target="_blank" rel="noopener noreferrer">
                            <link.icon />
                            <span>{link.label}</span>
                          </a>
                        ) : (
                          <Link href={link.href}>
                            <link.icon />
                            <span>{link.label}</span>
                            {badgeCount > 0 && <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>}
                          </Link>
                        )}
                      </SidebarMenuButton>
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
