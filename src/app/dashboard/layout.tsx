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
import { Building2, Sparkles, Search, Bell, HelpCircle, LayoutGrid, ChevronRight, LogOut, Loader2, Command, ShieldCheck, MapPin, ShieldAlert } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';
import { AutomatedReportSender } from '@/components/geohrm/automated-report-sender';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type LeaveRequest = {
  status: string;
  employeeName: string;
};
type Announcement = {
  id: string;
  title: string;
};
type EventItem = {
  date: Timestamp;
}
type LocationRequest = {
  status: string;
  employeeName: string;
};
type SupportTicket = {
  id: string;
  title: string;
  employeeId: string;
  lastUpdatedDate?: Timestamp;
}
type AttendanceApprovalRequest = {
  status: string;
  employeeName: string;
}

const SEARCHABLE_LINKS = [
    { label: "Dashboard", href: "/dashboard", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Analytics", href: "/dashboard/analytics", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Reports", href: "/dashboard/reports", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Attendance", href: "/dashboard/attendance", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Range Approvals", href: "/dashboard/attendance-requests", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "WFH Precision", href: "/dashboard/location-requests", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Leave Requests", href: "/dashboard/leave", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Documents", href: "/dashboard/documents", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Teams", href: "/dashboard/teams", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Branches", href: "/dashboard/branches", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Manage Users", href: "/dashboard/users", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Org. Structure", href: "/dashboard/org-structure", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Compliance", href: "/dashboard/compliance", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Monitor", href: "/dashboard/monitor", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Assets", href: "/dashboard/assets", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Payslips", href: "/dashboard/payslips", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "Announcements", href: "/dashboard/announcements", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "unreadAnnouncementsCount" },
    { label: "Events", href: "/dashboard/events", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "todaysEventsCount" },
    { label: "Holidays", href: "/dashboard/holidays", roles: ['HR Manager', 'CEO/Admin'] },
    { label: "Support Desk", href: "/dashboard/issues", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'], badgeKey: "ticketUpdateCount" },
    { label: "Profile Settings", href: "/dashboard/profile", roles: ['Member', 'Team Lead', 'HR Manager', 'CEO/Admin'] },
    { label: "System Settings", href: "/dashboard/settings", roles: ['HR Manager', 'CEO/Admin'] },
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);
  
  const userRole = (userData as any)?.role || 'Member';
  const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!user || !userRole) return null;
    let q = query(collection(firestore, "leave_requests"));
    if (userRole === 'Team Lead') q = query(q, where("status", "==", "Pending"));
    else if (userRole === 'HR Manager') q = query(q, where("status", "in", ["Pending HR Approval"]));
    else if (userRole === 'CEO/Admin') q = query(q, where("status", "in", ["Pending", "Pending HR Approval"]));
    else return null;
    return q;
  }, [firestore, user, userRole]);
  const { data: leaveRequests } = useCollection<LeaveRequest>(leaveRequestsQuery);

  const locationRequestsQuery = useMemoFirebase(() => {
    if (!isPrivileged || !user) return null;
    return query(collection(firestore, "location_change_requests"), where("status", "==", "pending"));
  }, [firestore, isPrivileged, user]);
  const { data: locationRequests } = useCollection<LocationRequest>(locationRequestsQuery);

  const attRequestsQuery = useMemoFirebase(() => {
    if (!isPrivileged || !user) return null;
    return query(collection(firestore, "attendanceApprovalRequests"), where("status", "==", "Pending"));
  }, [firestore, isPrivileged, user]);
  const { data: attRequests } = useCollection<AttendanceApprovalRequest>(attRequestsQuery);

  const allAnnouncementsQuery = useMemoFirebase(() => user ? collection(firestore, 'announcements') : null, [firestore, user]);
  const { data: allAnnouncements } = useCollection<Announcement>(allAnnouncementsQuery);
  
  const readAnnouncementsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/readAnnouncements`) : null, [user, firestore]);
  const { data: readAnnouncements } = useCollection<{id: string}>(readAnnouncementsQuery);

  useEffect(() => {
    if (allAnnouncements && readAnnouncements) {
      const readIds = new Set(readAnnouncements.map(a => a.id));
      const unreadCount = allAnnouncements.filter(a => !readIds.has(a.id)).length;
      setUnreadAnnouncements(unreadCount);
    }
  }, [allAnnouncements, readAnnouncements]);

  const eventsQuery = useMemoFirebase(() => user ? collection(firestore, 'events') : null, [firestore, user]);
  const { data: events } = useCollection<EventItem>(eventsQuery);
  const todaysEventsCount = useMemo(() => {
    if (!events) return 0;
    return events.filter(e => e.date && isToday(e.date.toDate())).length;
  }, [events]);

  const ticketQuery = useMemoFirebase(() => user ? query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid)) : null, [firestore, user]);
  const { data: userTickets } = useCollection<SupportTicket>(ticketQuery);
  const ticketUpdateCount = useMemo(() => {
    if (!userTickets) return 0;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return userTickets.filter(t => t.lastUpdatedDate && (t.lastUpdatedDate.toDate ? t.lastUpdatedDate.toDate() : new Date(t.lastUpdatedDate)) > twentyFourHoursAgo).length;
  }, [userTickets]);

  const totalNotifications = (leaveRequests?.length || 0) + unreadAnnouncements + todaysEventsCount + (locationRequests?.length || 0) + ticketUpdateCount + (attRequests?.length || 0);

  const filteredSearchLinks = useMemo(() => {
    return SEARCHABLE_LINKS.filter(link => 
        link.roles.includes(userRole) && 
        link.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, userRole]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    if (!user) return;
    setIsLoggingOut(true);
    setIsLogoutDialogOpen(false);

    try {
        const uRole = (userData as any)?.role || 'Member';
        const isPriv = uRole === 'HR Manager' || uRole === 'CEO/Admin';

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
                    description: "Protocol violation: Please submit your daily tactical report before logging out."
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
          <div className="relative h-20 w-56 animate-pulse drop-shadow-2xl">
            <Image
              src="https://fortumars.com/fortumarslogo.png"
              alt="FortuMars Logo"
              fill
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              priority
            />
          </div>
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
      <Sidebar>
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
      <SidebarInset className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/90 backdrop-blur-md px-6 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger className="rounded-none hover:bg-muted" />
            <Separator orientation="vertical" className="h-6" />
            
            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <DialogTrigger asChild>
                    <div className="relative w-full max-sm hidden sm:block max-w-sm group cursor-pointer">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div className="h-10 w-full pl-10 pr-4 flex items-center bg-muted/20 border-none ring-1 ring-border/50 rounded-none text-muted-foreground text-sm font-bold uppercase tracking-tight">
                            Command Search...
                        </div>
                    </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg p-0 rounded-none overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Menu Search</DialogTitle>
                        <DialogDescription>Search for dashboard modules and navigation links.</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center border-b px-4 h-14">
                        <Search className="mr-3 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Find mission module..." 
                            className="h-full border-none ring-0 focus-visible:ring-0 font-black uppercase text-sm" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ScrollArea className="max-h-[300px]">
                        <div className="p-4 space-y-1">
                            {filteredSearchLinks.map(link => (
                                <Link 
                                    href={link.href} 
                                    key={link.href} 
                                    onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                                    className="flex items-center justify-between p-3 hover:bg-primary/5 group transition-all border-l-4 border-transparent hover:border-primary"
                                >
                                    <span className="font-bold text-xs uppercase tracking-widest">{link.label}</span>
                                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-40" />
                                </Link>
                            ))}
                            {filteredSearchLinks.length === 0 && (
                                <p className="text-center py-8 text-[10px] font-black uppercase text-muted-foreground opacity-40">Zero Results Found</p>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-6">
             <div className="hidden lg:flex items-center gap-4">
                <Button asChild variant="ghost" size="sm" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">
                    <Link href="https://fortumars.com/os.html" target="_blank">
                        <LayoutGrid className="size-3.5" /> My Apps
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">
                    <Link href="/tutorial">
                        <HelpCircle className="size-3.5" /> Help
                    </Link>
                </Button>
             </div>

             <Separator orientation="vertical" className="h-6" />

             <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-none relative h-10 w-10">
                        <Bell className="size-5" />
                        {totalNotifications > 0 && (
                            <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full ring-2 ring-white" />
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md p-0 rounded-none border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Tactical Alerts</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Pending system signals</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px]">
                        <div className="p-4 space-y-4">
                            {totalNotifications === 0 ? (
                                <div className="py-12 text-center opacity-30 grayscale flex flex-col items-center">
                                    <ShieldCheck className="size-10 mb-2" />
                                    <p className="font-black uppercase text-[10px] tracking-widest">Protocol Clear</p>
                                </div>
                            ) : (
                                <>
                                    {leaveRequests?.map((req, i) => (
                                        <Link href="/dashboard/leave" key={i} className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-primary/5 transition-all group">
                                            <div className="size-8 bg-sky-500 text-white flex items-center justify-center rounded-none"><Command className="size-4"/></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase">Leave Approval</p>
                                                <p className="text-xs font-bold truncate">{req.employeeName} submitted a request</p>
                                            </div>
                                        </Link>
                                    ))}
                                    {attRequests?.map((req, i) => (
                                        <Link href="/dashboard/attendance-requests" key={i} className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-primary/5 transition-all group">
                                            <div className="size-8 bg-amber-500 text-white flex items-center justify-center rounded-none"><MapPin className="size-4"/></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase">Remote Approval</p>
                                                <p className="text-xs font-bold truncate">{req.employeeName} out of range</p>
                                            </div>
                                        </Link>
                                    ))}
                                    {allAnnouncements?.slice(0, 3).map((ann, i) => (
                                        <Link href="/dashboard/announcements" key={ann.id} className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-primary/5 transition-all group">
                                            <div className="size-8 bg-primary text-white flex items-center justify-center rounded-none"><Sparkles className="size-4"/></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase">Announcement</p>
                                                <p className="text-xs font-bold truncate">{ann.title}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                    <Separator />
                    <div className="p-4 bg-muted/10 text-center">
                        <Button asChild variant="link" className="text-[10px] font-black uppercase tracking-widest h-auto py-0">
                            <Link href="/dashboard">Access Command Hub</Link>
                        </Button>
                    </div>
                </DialogContent>
             </Dialog>

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
                <AlertDialogContent className="rounded-none border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                            <ShieldAlert className="size-5" /> Log Out?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Are you sure you want to log out? Please ensure your daily reports are submitted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                        <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="rounded-none font-black uppercase text-[10px] h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                            Log Out
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
             </AlertDialog>
          </div>
          <AutomatedReportSender />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
        <footer className="border-t py-4 px-6 bg-white/50 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                <p>© {new Date().getFullYear()} MarsHRM</p>
                <p>By FortuMars</p>
            </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
