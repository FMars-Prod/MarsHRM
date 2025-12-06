
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
  BookUser,
  User,
  Megaphone,
  PartyPopper,
  Users,
  Building,
  BarChart2,
} from "lucide-react";
import { teamData } from "@/lib/data";
import React from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/profile", label: "Profile", icon: User, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badge: "1" },
  { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badge: "3" },
  { href: "/dashboard/events", label: "Events", icon: PartyPopper, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badge: "2" },
  { href: "/dashboard/issues", label: "Issues", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/team", label: "Team", icon: Users, roles: ['Team Lead'] },
  { href: "/dashboard/users", label: "Manage Users", icon: Building, roles: ['HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/new-page", label: "Analytics", icon: BarChart2, roles: ['HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck, roles: ['HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: BookUser, roles: ['CEO/Admin'] },
];

export function MainNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();

  const pendingReportsCount = React.useMemo(() => {
    const today = new Date().toLocaleDateString();
    return teamData.filter(
      (member) =>
        !member.reports.some(
          (report) => new Date(report.date).toLocaleDateString() === today
        )
    ).length;
  }, []);

  return (
    <SidebarMenu>
      {links.map((link) => {
        if (!link.roles.includes(userRole) || link.label === "New Page" && link.roles.includes('Member')) {
          return null;
        }

        let badgeContent = link.badge;
        if (link.href === "/dashboard/team" && pendingReportsCount > 0) {
            badgeContent = String(pendingReportsCount);
        }

        const isActive = pathname.startsWith(link.href) && (link.href !== '/dashboard' || pathname === '/dashboard');
        
        if (link.label === "Analytics" && !['HR Manager', 'CEO/Admin'].includes(userRole)) {
            return null;
        }

        return (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={link.label}>
              <Link href={link.href}>
                <link.icon />
                <span>{link.label}</span>
                {badgeContent && <SidebarMenuBadge>{badgeContent}</SidebarMenuBadge>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
