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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/attendance", label: "Attendance", icon: Clock, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/leave", label: "Leave", icon: CalendarOff, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/issues", label: "Issues", icon: MessageSquareWarning, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/policies", label: "Policies", icon: ShieldCheck, roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
  { href: "/dashboard/audit-log", label: "Audit Log", icon: BookUser, roles: ['CEO/Admin', 'HR Manager'] },
];

export function MainNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => {
        if (!link.roles.includes(userRole)) {
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
