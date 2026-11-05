'use client';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { MainNav } from '@/components/geohrm/main-nav';
import { UserNav } from '@/components/geohrm/user-nav';
import { Building2, Sparkles, Search, Bell, HelpCircle, LayoutGrid, ChevronRight, LogOut, Loader2, Command, ShieldCheck, MapPin, ShieldAlert, ListTodo, CheckCircle2, AlertCircle, Clock, CheckCircle, Megaphone, Calendar, LifeBuoy, UserCheck, ExternalLink } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, Timestamp, getDocs, or, and, orderBy, limit } from 'firebase/firestore';
import { format, isToday, startOfDay, endOfDay, isBefore, addDays, subDays } from 'date-fns';
import Image from 'next/image';
import { AutomatedReportSender } from '@/components/geohrm/automated-report-sender';
import { MeetingReminder } from '@/components/geohrm/meeting-reminder';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/context/branding-context';

const SEARCHABLE_LINKS = [
    { label: "Dashboard", href: "/dashboard", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Admin Desk", href: "https://studio--studio-6104224101-c3e7e.us-central1.hosted.app/", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Workforce Reports", href: "/dashboard/reports", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Task Centre", href: "/dashboard/todo", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Client Management", href: "/dashboard/clients", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Projects", href: "/dashboard/projects", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Sales Pipeline", href: "/dashboard/pipeline", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Marketing", href: "/dashboard/marketing", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Finance", href: "/dashboard/finance", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Training", href: "/dashboard/training", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Employees", href: "/dashboard/users", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Attendance", href: "/dashboard/attendance", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Leave Management", href: "/dashboard/leave", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Payroll", href: "/dashboard/payslips", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Performance", href: "/dashboard/analytics", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Offices", href: "/dashboard/branches", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Departments", href: "/dashboard/departments", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Teams", href: "/dashboard/teams", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Organization Chart", href: "/dashboard/org-structure", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Asset Management", href: "/dashboard/assets", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Notification Centre", href: "/dashboard/notifications", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Approvals", href: "/dashboard/attendance-requests", roles: ['Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Documents", href: "/dashboard/documents", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Complaints", href: "/dashboard/compliance", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Activity Monitor", href: "/dashboard/monitor", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Company Feed", href: "/dashboard/announcements", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Meetings", href: "/dashboard/meetings", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Holiday Calendar", href: "/dashboard/holidays", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Support Centre", href: "/dashboard/issues", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Geofence Control", href: "/dashboard/geofence", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Reports", href: "/dashboard/report-templates", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "Report Builder", href: "/dashboard/report-builder", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "System Settings", href: "/dashboard/settings", roles: ['HR Manager', 'CEO/MD', 'CEO/Admin'] },
    { label: "My Profile", href: "/dashboard/profile", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/MD', 'CEO/Admin'] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);
  
  const userRole = (userData as any)?.role || 'Member';
  const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const teamLeadQuery = useMemoFirebase(() => {
    if (!user || userRole !== 'Team Lead') return null;
    return query(collection(firestore, 'teams'), where('teamLeadId', '==', user.uid));
  }, [firestore, user, userRole]);
  const { data: teamsLed } = useCollection<any>(teamLeadQuery);

  const subordinateIds = useMemo(() => {
    const ids = new Set<string>();
    if (teamsLed) {
      teamsLed.forEach((t: any) => t.memberIds.forEach((id: string) => ids.add(id)));
    }
    if (user && allUsers) {
      allUsers.forEach((u: any) => {
        if (u.reportingHeadIds?.includes(user.uid)) ids.add(u.id);
      });
    }
    return Array.from(ids);
  }, [teamsLed, allUsers, user]);

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!user || !userRole) return null;
    let q = collection(firestore, "leave_requests");
    
    if (userRole === 'Team Lead') {
      if (subordinateIds.length > 0) {
        return query(q, where("status", "==", "Pending"), where("employeeId", "in", subordinateIds.slice(0, 30)));
      }
      return null;
    }
    
    if (userRole === 'HR Manager') return query(q, where("status", "==", "Pending HR Approval"));
    if (userRole === 'CEO/Admin' || userRole === 'CEO/MD') return query(q, where("status", "in", ["Pending", "Pending HR Approval"]));
    
    return null;
  }, [firestore, user, userRole, subordinateIds]);
  const { data: leaveRequests } = useCollection<any>(leaveRequestsQuery);

  const locationRequestsQuery = useMemoFirebase(() => {
    if (!isPrivileged || !user) return null;
    return query(collection(firestore, "location_change_requests"), where("status", "==", "pending"));
  }, [firestore, isPrivileged, user]);
  const { data: locationRequests } = useCollection<any>(locationRequestsQuery);

  const attRequestsQuery = useMemoFirebase(() => {
    if (!user || !userRole) return null;
    let q = collection(firestore, "attendanceApprovalRequests");

    if (userRole === 'Team Lead') {
      if (subordinateIds.length > 0) {
        return query(q, where("status", "==", "Pending"), where("employeeId", "in", subordinateIds.slice(0, 30)));
      }
      return null;
    }

    if (isPrivileged) {
      return query(q, where("status", "==", "Pending"));
    }

    return null;
  }, [firestore, isPrivileged, user, userRole, subordinateIds]);
  const { data: attRequests } = useCollection<any>(attRequestsQuery);

  const allAnnouncementsQuery = useMemoFirebase(() => user ? collection(firestore, 'announcements') : null, [firestore, user]);
  const { data: allAnnouncements } = useCollection<any>(allAnnouncementsQuery);
  
  const readAnnouncementsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/readAnnouncements`) : null, [user, firestore]);
  const { data: readAnnouncements } = useCollection<any>(readAnnouncementsQuery);

  useEffect(() => {
    if (allAnnouncements && readAnnouncements) {
      const readIds = new Set(readAnnouncements.map((a: any) => a.id));
      const unreadCount = allAnnouncements.filter((a: any) => !readIds.has(a.id)).length;
      setUnreadAnnouncements(unreadCount);
    }
  }, [allAnnouncements, readAnnouncements]);

  const eventsQuery = useMemoFirebase(() => user ? collection(firestore, 'events') : null, [firestore, user]);
  const { data: events } = useCollection<any>(eventsQuery);
  const todaysEventsCount = useMemo(() => {
    if (!events) return 0;
    return events.filter((e: any) => e.date && isToday(e.date.toDate())).length;
  }, [events]);

  const ticketQuery = useMemoFirebase(() => user ? query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid)) : null, [firestore, user]);
  const { data: userTickets } = useCollection<any>(ticketQuery);
  const ticketUpdateCount = useMemo(() => {
    if (!userTickets) return 0;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return userTickets.filter((t: any) => t.lastUpdatedDate && (t.lastUpdatedDate.toDate ? t.lastUpdatedDate.toDate() : new Date(t.lastUpdatedDate)) > twentyFourHoursAgo).length;
  }, [userTickets]);

  const todosQuery = useMemoFirebase(() => {
      if (!user) return null;
      return query(collection(firestore, "todos"), where("assignedTo", "==", user.uid), where("completed", "==", false));
  }, [firestore, user]);
  
  const { data: activeTodos } = useCollection<any>(todosQuery);
  const taskReminders = useMemo(() => {
    if (!activeTodos) return [];
    const now = new Date();
    const alertThreshold = addDays(now, 1);
    return activeTodos.filter((t: any) => t.dueDate && isBefore(t.dueDate.toDate(), alertThreshold));
  }, [activeTodos]);

  const completedTasksQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
        collection(firestore, "todos"),
        where("assignedBy", "==", user.uid),
        where("completed", "==", true),
        orderBy("completedAt", "desc"),
        limit(10)
    );
  }, [firestore, user]);
  const { data: completedTasks } = useCollection<any>(completedTasksQuery);

  const teamCompletedTasks = useMemo(() => {
    if (!completedTasks || !user) return [];
    const threshold = subDays(new Date(), 2); 
    return completedTasks.filter((t: any) => 
        t.assignedTo !== user.uid && 
        t.completedAt && (t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)) > threshold
    );
  }, [completedTasks, user]);

  const unreadAnnouncementsList = useMemo(() => {
    if (!allAnnouncements || !readAnnouncements) return [];
    const readIds = new Set(readAnnouncements.map((a: any) => a.id));
    return allAnnouncements.filter((a: any) => !readIds.has(a.id)).slice(0, 5);
  }, [allAnnouncements, readAnnouncements]);

  const todaysEventsList = useMemo(() => {
    if (!events) return [];
    return events.filter((e: any) => e.date && isToday(e.date.toDate())).slice(0, 5);
  }, [events]);

  const updatedTicketsList = useMemo(() => {
    if (!userTickets) return [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return userTickets.filter((t: any) => t.lastUpdatedDate && (t.lastUpdatedDate.toDate ? t.lastUpdatedDate.toDate() : new Date(t.lastUpdatedDate)) > twentyFourHoursAgo).slice(0, 5);
  }, [userTickets]);

  const totalNotifications = (leaveRequests?.length || 0) + unreadAnnouncements + todaysEventsCount + (locationRequests?.length || 0) + ticketUpdateCount + (attRequests?.length || 0) + taskReminders.length + teamCompletedTasks.length;

  const filteredSearchLinks = useMemo(() => {
    return SEARCHABLE_LINKS.filter(link => 
        link.roles.includes(userRole) && 
        link.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, userRole]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const { hideFortuMarsBranding } = useBranding();

  const handleLogout = async () => {
    if (!user) return;
    setIsLoggingOut(true);
    setIsLogoutDialogOpen(false);

    try {
        const uRole = (userData as any)?.role || 'Member';
        const isPriv = uRole === 'HR Manager' || uRole === 'CEO/Admin' || uRole === 'CEO/MD';

        if (!isPriv) {
            const todayS = startOfDay(new Date());
            const todayE = endOfDay(new Date());
            
            const q = query(
                collection(firestore, `users/${user.uid}/reports`),
                where('date', '>=', todayS),
                where('date', '<=', todayE)
            );

            const snap = await getDocs(q);
            if (snap.empty) {
                toast({
                    variant: 'destructive',
                    title: "Report Required",
                    description: "Please submit your daily work report before logging out."
                });
                router.push('/dashboard/reports');
                setIsLoggingOut(false);
                return;
            }
        }

        await auth.signOut();
        router.push('/login');
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Logout Interrupted' });
        setIsLoggingOut(false);
    }
  };

  if (isUserLoading || !user || isUserDocLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-purple-500 via-purple-800 to-indigo-950">
        <div className="flex flex-col items-center gap-6">
          {!hideFortuMarsBranding ? (
            <div className="relative h-20 w-56 animate-pulse drop-shadow-2xl">
              <Image
                src="https://fortumars.com/fortumarslogo.png"
                alt="Logo"
                fill
                style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
                priority
              />
            </div>
          ) : (
            <div className="size-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl animate-pulse">
              <Building2 className="size-8 text-white" />
            </div>
          )}
          <div className="space-y-2 text-center">
            <h2 className="text-white/90 text-lg font-black uppercase tracking-[0.2em] animate-fade-in-up">MarsHRM</h2>
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-white animate-progress-loading" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const employeeAvatar = (userData as any)?.avatar;
  const isUrl = employeeAvatar && employeeAvatar.startsWith('http');

  return (
    <SidebarProvider>
      <Sidebar className="z-40">
        <SidebarHeader className="border-b border-sidebar-border/50">
          <div className="flex items-center gap-3 p-3">
            <div className="bg-primary text-white p-2 rounded-none shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-black text-lg tracking-tighter text-white uppercase">MarsHRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav 
            userRole={userRole}
            pendingLeaveCount={leaveRequests?.length || 0}
            unreadAnnouncementsCount={unreadAnnouncements}
            todaysEventsCount={todaysEventsCount}
            pendingLocationRequestsCount={locationRequests?.length || 0}
            pendingAttRequestsCount={attRequests?.length || 0}
            ticketUpdateCount={ticketUpdateCount}
            totalNotificationsCount={totalNotifications}
          />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/50">
          <UserNav user={user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col min-h-screen z-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/90 backdrop-blur-md px-6 shadow-sm pointer-events-auto">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger className="rounded-none hover:bg-muted" />
            <Separator orientation="vertical" className="h-6" />
            
            <div className="relative w-full max-w-sm hidden sm:block group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Search menu..." 
                    className="h-10 w-full pl-10 pr-4 bg-muted/20 border-none ring-1 ring-border/50 rounded-none text-sm font-semibold uppercase tracking-tight" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-border/50 shadow-2xl overflow-hidden animate-fade-in-up">
                        <ScrollArea className="max-h-[300px]">
                            <div className="p-2 space-y-1">
                                {filteredSearchLinks.map(link => (
                                    <Link 
                                        href={link.href} 
                                        key={link.href} 
                                        onClick={() => setSearchQuery("")}
                                        className="flex items-center justify-between p-3 hover:bg-primary/5 group transition-all border-l-4 border-transparent hover:border-primary"
                                    >
                                        <span className="font-bold text-xs uppercase tracking-widest">{link.label}</span>
                                        <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-40" />
                                    </Link>
                                ))}
                                {filteredSearchLinks.length === 0 && (
                                    <p className="text-center py-6 text-[10px] font-bold uppercase text-muted-foreground opacity-40">No results</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
                <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
                   <PopoverTrigger asChild>
                       <Button variant="ghost" size="icon" className="rounded-none relative h-10 w-10">
                           <Bell className="size-5" />
                           {totalNotifications > 0 && (
                               <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full ring-2 ring-white" />
                           )}
                       </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-[380px] p-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden" align="end" sideOffset={12}>
                        <div className="p-4 px-5 border-b bg-gradient-to-r from-purple-50/80 via-white to-purple-50/50 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-primary flex items-center gap-1.5">
                                    <Bell className="size-4" /> Notifications
                                </h4>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">
                                    {totalNotifications} updates requiring attention
                                </p>
                            </div>
                            {isPrivileged && (
                                <Link 
                                    href="/dashboard/notifications" 
                                    onClick={() => setIsNotificationsOpen(false)}
                                    className="text-[10px] font-black uppercase text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md"
                                >
                                    Manage <ChevronRight className="size-3" />
                                </Link>
                            )}
                        </div>
                        <ScrollArea className="max-h-[460px]">
                            <div className="p-3 space-y-2">
                                {totalNotifications === 0 ? (
                                    <div className="py-12 text-center opacity-40 flex flex-col items-center">
                                        <CheckCircle2 className="size-10 mb-2 text-emerald-500" />
                                        <p className="font-bold uppercase text-[10px] tracking-widest text-slate-700">All caught up! System clear</p>
                                    </div>
                                ) : (
                                    <>
                                        {teamCompletedTasks.map((todo: any) => {
                                            const completedBy = allUsers?.find((u: any) => u.id === todo.assignedTo);
                                            return (
                                                <Link 
                                                   href="/dashboard/todo" 
                                                   key={todo.id}
                                                   onClick={() => setIsNotificationsOpen(false)}
                                                   className="flex items-start gap-3 p-3 bg-slate-50/80 hover:bg-emerald-50/70 transition-all border border-slate-100 hover:border-emerald-200 rounded-xl"
                                                >
                                                    <Avatar className="size-9 rounded-lg border border-slate-200 ring-1 ring-white shrink-0 mt-0.5">
                                                         <AvatarImage src={completedBy?.avatar} className="object-cover" />
                                                         <AvatarFallback className="bg-emerald-500 text-white text-[9px] font-black">{completedBy?.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0 text-left space-y-1">
                                                        <div className="flex justify-between items-center gap-2">
                                                             <Badge className="bg-emerald-100 text-emerald-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Task Done</Badge>
                                                             <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">{todo.completedAt ? format(todo.completedAt.toDate(), 'HH:mm') : ''}</span>
                                                        </div>
                                                        <p className="text-xs font-bold truncate text-slate-800">{todo.task}</p>
                                                        <p className="text-[9px] font-bold text-slate-500 truncate">By {todo.assignedToName || completedBy?.firstName || 'team member'}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                        {taskReminders.map((todo: any) => (
                                            <Link 
                                               href="/dashboard/todo" 
                                               key={todo.id}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-red-50/60 hover:bg-red-100/70 transition-all border border-red-100 rounded-xl"
                                            >
                                                <div className="size-8 bg-red-500 text-white flex items-center justify-center rounded-lg shrink-0"><Clock className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex justify-between items-center">
                                                        <Badge className="bg-red-100 text-red-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Deadline</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{todo.task}</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {leaveRequests?.map((req: any, i: number) => (
                                            <Link 
                                               href="/dashboard/leave" 
                                               key={"leave-" + (req.id || i)}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-indigo-50/60 hover:bg-indigo-100/70 transition-all border border-indigo-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-indigo-600 text-white flex items-center justify-center rounded-lg shrink-0"><Command className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-indigo-100 text-indigo-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Leave</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{req.employeeName || 'Employee'}</p>
                                                    <p className="text-[10px] font-medium text-slate-500 truncate">{req.category || 'Leave'}: {req.reason || 'Requested'}</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {attRequests?.map((req: any, i: number) => (
                                            <Link 
                                               href="/dashboard/attendance-requests" 
                                               key={"att-" + (req.id || i)}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-amber-50/60 hover:bg-amber-100/70 transition-all border border-amber-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-amber-500 text-white flex items-center justify-center rounded-lg shrink-0"><UserCheck className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-amber-100 text-amber-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Punch Approval</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{req.employeeName || 'Employee'}</p>
                                                    <p className="text-[10px] font-medium text-slate-500 truncate">{req.type || 'Punch'} • {req.reason || 'Needs punch approval'}</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {locationRequests?.map((req: any, i: number) => (
                                            <Link 
                                               href="/dashboard/location-requests" 
                                               key={"loc-" + (req.id || i)}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-purple-50/60 hover:bg-purple-100/70 transition-all border border-purple-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-purple-600 text-white flex items-center justify-center rounded-lg shrink-0"><MapPin className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-purple-100 text-purple-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Location Access</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{req.employeeName || 'Employee'}</p>
                                                    <p className="text-[10px] font-medium text-slate-500 truncate">WFH / Branch Request</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {unreadAnnouncementsList.map((ann: any) => (
                                            <Link 
                                               href="/dashboard/announcements?tab=announcements" 
                                               key={"ann-" + ann.id}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-blue-50/60 hover:bg-blue-100/70 transition-all border border-blue-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-blue-600 text-white flex items-center justify-center rounded-lg shrink-0"><Megaphone className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-blue-100 text-blue-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Company Feed</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{ann.title}</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {todaysEventsList.map((evt: any) => (
                                            <Link 
                                               href="/dashboard/announcements?tab=events" 
                                               key={"evt-" + evt.id}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-pink-50/60 hover:bg-pink-100/70 transition-all border border-pink-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-pink-500 text-white flex items-center justify-center rounded-lg shrink-0"><Calendar className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-pink-100 text-pink-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Event</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{evt.name}: {evt.event}</p>
                                                </div>
                                            </Link>
                                        ))}
                                        {updatedTicketsList.map((ticket: any) => (
                                            <Link 
                                               href="/dashboard/issues" 
                                               key={"ticket-" + ticket.id}
                                               onClick={() => setIsNotificationsOpen(false)}
                                               className="flex items-center gap-3 p-3 bg-orange-50/60 hover:bg-orange-100/70 transition-all border border-orange-100 rounded-xl group"
                                            >
                                                <div className="size-8 bg-orange-500 text-white flex items-center justify-center rounded-lg shrink-0"><LifeBuoy className="size-4"/></div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-orange-100 text-orange-800 border-none rounded-none text-[8px] font-black uppercase px-1.5 py-0">Support</Badge>
                                                    </div>
                                                    <p className="text-xs font-bold truncate text-slate-800 mt-0.5">{ticket.title || ticket.issueType || 'Ticket update'}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                        {isPrivileged && (
                            <div className="p-2.5 border-t bg-slate-50/80 text-center">
                                <Button asChild variant="ghost" size="sm" className="w-full text-xs font-black uppercase tracking-wider text-primary hover:bg-primary/5">
                                    <Link href="/dashboard/notifications" onClick={() => setIsNotificationsOpen(false)}>
                                        Open Notification Management <ExternalLink className="size-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </PopoverContent>
                </Popover>

                <Button asChild variant="ghost" size="icon" className="rounded-none h-10 w-10">
                    <Link href="/dashboard/todo">
                        <ListTodo className="size-5" />
                    </Link>
                </Button>

                {!hideFortuMarsBranding && (
                  <Button asChild variant="ghost" size="icon" className="rounded-none h-10 w-10">
                      <Link href="https://fortumars.com/os.html" target="_blank">
                          <LayoutGrid className="size-5" />
                      </Link>
                  </Button>
                )}

                <Button asChild variant="ghost" size="icon" className="rounded-none h-10 w-10">
                    <Link href="/tutorial">
                        <HelpCircle className="size-5" />
                    </Link>
                </Button>
             </div>

             <Separator orientation="vertical" className="h-6 mx-2" />

             <div className="flex items-center gap-4 group cursor-pointer" onClick={() => router.push('/dashboard/profile')}>
                <div className="hidden sm:flex flex-col items-end text-right">
                    <span className="font-black text-sm uppercase tracking-tight leading-none text-foreground group-hover:text-primary transition-colors">
                        {(userData as any)?.firstName} {(userData as any)?.lastName}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
                        {(userData as any)?.jobTitle}
                    </span>
                </div>
                <Avatar className="h-10 w-10 ring-2 ring-primary/20 ring-offset-2 transition-transform group-hover:scale-105">
                    {employeeAvatar ? (
                        isUrl ? <AvatarImage src={employeeAvatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 font-black">{employeeAvatar}</div>
                    ) : <AvatarFallback className="bg-primary/10 text-primary font-bold">{(userData as any)?.firstName?.[0]}</AvatarFallback>}
                </Avatar>
             </div>

             <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-none text-muted-foreground hover:text-red-600 transition-colors" disabled={isLoggingOut}>
                        {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader className="text-left">
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                            <ShieldAlert className="size-5" /> Log Out?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Are you sure you want to log out? Please ensure your work reports are submitted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="rounded-full font-bold uppercase text-[10px] h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                            Log Out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
             </AlertDialog>
          </div>
          <MeetingReminder />
          <AutomatedReportSender />
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden pointer-events-auto bg-gradient-to-br from-primary/5 via-[#F8FAFC] to-indigo-500/5">
          {children}
        </main>
        <footer className="border-t py-4 px-6 bg-white/50 backdrop-blur-sm pointer-events-auto">
            <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                <p>© {new Date().getFullYear()} MarsHRM</p>
                {!hideFortuMarsBranding && <p>By FortuMars</p>}
            </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
