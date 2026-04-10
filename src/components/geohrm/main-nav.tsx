
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarOff,
  MessageSquareWarning,
  ShieldCheck,
  User,
  Megaphone,
  PartyPopper,
  Users,
  Building,
  BarChart2,
  FileText,
  Activity,
  MapPin,
  ClipboardCheck,
} from "lucide-react";
import React from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/profile", label: "Profile", icon: User, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "pendingLeaveCount" },
  { href: "/dashboard/attendance-requests", label: "Attendance Requests", icon: ClipboardCheck, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingAttendanceRequestsCount" },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "unreadAnnouncementsCount" },
  { href: "/dashboard/events", label: "Events", icon: PartyPopper, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "todaysEventsCount" },
  { href: "/dashboard/payslips", label: "Payslips", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/issues", label: "Issues", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/monitor", label: "Monitor", icon: Activity, roles: ['HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/users", label: "Manage Users", icon: Building, roles: ['HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/location-requests", label: "Location Requests", icon: MapPin, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingLocationRequestsCount" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2, roles: ['HR Manager', 'CEO/Admin'] },
];

interface MainNavProps {
  userRole: string;
  pendingLeaveCount?: number;
  unreadAnnouncementsCount?: number;
  todaysEventsCount?: number;
  pendingLocationRequestsCount?: number;
  pendingAttendanceRequestsCount?: number;
}

export function MainNav({ 
  userRole,
  pendingLeaveCount = 0,
  unreadAnnouncementsCount = 0,
  todaysEventsCount = 0,
  pendingLocationRequestsCount = 0,
  pendingAttendanceRequestsCount = 0
}: MainNavProps) {
  const pathname = usePathname();

  const badgeCounts: { [key: string]: number } = {
    pendingLeaveCount,
    unreadAnnouncementsCount,
    todaysEventsCount,
    pendingLocationRequestsCount,
    pendingAttendanceRequestsCount
  };

  return (
    <SidebarMenu>
      {links.map((link) => {
        if (!link.roles.includes(userRole)) {
          return null;
        }

        const badgeCount = link.badgeKey ? badgeCounts[link.badgeKey] : 0;
        
        const isActive = pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard');
        
        return (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
              <Link href={link.href}>
                <link.icon />
                <span>{link.label}</span>
                {badgeCount > 0 && <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
