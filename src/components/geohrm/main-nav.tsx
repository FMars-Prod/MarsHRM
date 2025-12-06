"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarOff,
  MessageSquareWarning,
  ShieldCheck,
  BookUser,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock },
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff },
  { href: "/dashboard/issues", label: "Issues", icon: MessageSquareWarning },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: BookUser, adminOnly: true },
];

export function MainNav() {
  const pathname = usePathname();

  // For this scaffold, we'll assume an admin role to show all links.
  // In a real app, this would come from a user session.
  const userRole = 'admin';

  return (
    <SidebarMenu>
      {links.map((link) => {
        if (link.adminOnly && userRole !== 'admin') {
          return null;
        }
        const isActive = pathname === link.href;
        return (
          <SidebarMenuItem key={link.href}>
            <Link href={link.href} legacyBehavior passHref>
              <SidebarMenuButton isActive={isActive} tooltip={link.label}>
                <link.icon />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
