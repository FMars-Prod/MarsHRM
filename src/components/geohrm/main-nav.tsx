
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
  LayoutTemplate,
  ShieldCheck,
  CalendarDays,
  FileBox,
  Laptop,
  Network,
  Settings,
  ListTodo,
  MapPinned,
  UserCheck,
} from "lucide-react";
import React from "react";

const groups = [
  {
    label: "STRATEGIC HUB",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "totalNotificationsCount" },
      { href: "/dashboard/todo", label: "To-Do List", icon: ListTodo, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "pendingTodoCount" },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "WORKFORCE",
    links: [
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/attendance-requests", label: "Range Approvals", icon: UserCheck, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingAttRequestsCount" },
      { href: "/dashboard/location-requests", label: "WFH Precision", icon: MapPinned, roles: ['HR Manager', 'CEO/Admin'], badgeKey: "pendingLocationRequestsCount" },
      { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "pendingLeaveCount" },
      { href: "/dashboard/documents", label: "Documents", icon: FileBox, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/users", label: "Manage Users", icon: Building, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/org-structure", label: "Org. Structure", icon: Network, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    ]
  },
  {
    label: "OPERATIONS",
    links: [
      { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/monitor", label: "Monitor", icon: Activity, roles: ['HR Manager', 'CEO/Admin'] },
      { href: "/dashboard/assets", label: "Assets", icon: Laptop, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
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
  pendingTodoCount?: number;
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
  pendingTodoCount = 0,
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
    pendingTodoCount,
    totalNotificationsCount,
  };

  return (
    <>
      {groups.map((group, index) => {
        const visibleLinks = group.links.filter(link => link.roles.includes(userRole));
        if (visibleLinks.length === 0) return null;

        const sectionNumber = (index + 1).toString().padStart(2, '0');

        return (
          <SidebarGroup key={group.label}>
            <div className="px-4 py-2">
                <span className="text-[9px] font-black text-primary/40 tracking-[0.3em] block mb-1">SECTION {sectionNumber}</span>
                <SidebarGroupLabel className="text-[10px] font-black tracking-widest text-muted-foreground/60 p-0 h-auto">
                    {group.label}
                </SidebarGroupLabel>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleLinks.map((link) => {
                  const badgeCount = link.badgeKey ? badgeCounts[link.badgeKey] : 0;
                  const isActive = pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard');
                  
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
                        <Link href={link.href}>
                          <link.icon />
                          <span>{link.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {link.badgeKey && badgeCount > 0 && (
                        <SidebarMenuBadge className="bg-primary text-primary-foreground font-black rounded-full text-[9px] h-5 min-w-[1.25rem] flex items-center justify-center border-2 border-sidebar shadow-lg">
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
