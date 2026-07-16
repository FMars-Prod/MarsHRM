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
} from "lucide-react";
import React from "react";

const groups = [
  {
    label: "HOME",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "totalNotificationsCount" },
      { href: "https://studio--studio-6104224101-c3e7e.us-central1.hosted.app/", label: "Admin Hub", icon: ShieldCheck, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/reports", label: "Reports", icon: FileText, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/todo", label: "Tasks", icon: ListTodo, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    ]
  },
  {
    label: "BUSINESS",
    links: [
      { href: "/dashboard/clients", label: "Clients", icon: Users, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/meetings", label: "Meetings", icon: Video, roles: ['Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/projects", label: "Projects", icon: Briefcase, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/pipeline", label: "Sales Pipeline", icon: TrendingUp, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/marketing", label: "Marketing", icon: Zap, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/finance", label: "Finance", icon: DollarSign, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/training", label: "Training", icon: Beaker, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    ]
  },
  {
    label: "PEOPLE",
    links: [
      { href: "/dashboard/users", label: "People", icon: UserIcon, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "pendingLeaveCount" },
      { href: "/dashboard/payslips", label: "Payroll", icon: Banknote, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/analytics", label: "Performance", icon: BarChart3, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    ]
  },
  {
    label: "COMPANY",
    links: [
      { href: "/dashboard/branches", label: "Offices", icon: Building2, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/departments", label: "Departments", icon: Building, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/teams", label: "Teams", icon: Users, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/org-structure", label: "Structure", icon: Network, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/assets", label: "Assets", icon: Laptop, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    ]
  },
  {
    label: "WORK",
    links: [
      { href: "/dashboard/attendance-requests", label: "Approvals", icon: CheckCircle2, roles: ['Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "pendingAttRequestsCount" },
      { href: "/dashboard/documents", label: "Documents", icon: FileBox, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/compliance", label: "Rules", icon: ShieldCheck, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/monitor", label: "Daily Status", icon: Activity, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    ]
  },
  {
    label: "NEWS",
    links: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "unreadAnnouncementsCount" },
      { href: "/dashboard/events", label: "Events", icon: PartyPopper, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "todaysEventsCount" },
      { href: "/dashboard/holidays", label: "Holidays", icon: CalendarDays, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/issues", label: "Support", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'], badgeKey: "ticketUpdateCount" },
    ]
  },
  {
    label: "ADMIN",
    links: [
      { href: "/dashboard/users", label: "User Management", icon: Settings, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/report-templates", label: "Report Settings", icon: LayoutTemplate, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
      { href: "/dashboard/settings", label: "System Settings", icon: Settings, roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
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
