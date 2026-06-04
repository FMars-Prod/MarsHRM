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
import { Building2, Sparkles } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, Timestamp } from 'firebase/firestore';
import { format, isToday } from 'date-fns';
import Image from 'next/image';
import { AutomatedReportSender } from '@/components/geohrm/automated-report-sender';

type LeaveRequest = {
  status: string;
};
type Announcement = {
  id: string;
};
type EventItem = {
  date: Timestamp;
}
type LocationRequest = {
  status: string;
};
type SupportTicket = {
  employeeId: string;
  lastUpdatedDate?: Timestamp;
}
type AttendanceApprovalRequest = {
  status: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);

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
    if (userRole === 'Team Lead') {
      q = query(q, where("status", "==", "Pending"));
    } else if (userRole === 'HR Manager') {
      q = query(q, where("status", "in", ["Pending HR Approval"]));
    } else if (userRole === 'CEO/Admin') {
       q = query(q, where("status", "in", ["Pending", "Pending HR Approval"]));
    } else {
      return null;
    }
    return q;
  }, [firestore, user, userRole]);

  const { data: leaveRequests } = useCollection<LeaveRequest>(leaveRequestsQuery);
  const pendingLeaveCount = leaveRequests?.length || 0;

  const allAnnouncementsQuery = useMemoFirebase(
    () => user ? collection(firestore, 'announcements') : null,
    [firestore, user]
  );
  const { data: allAnnouncements } = useCollection<Announcement>(allAnnouncementsQuery);
  
  const readAnnouncementsQuery = useMemoFirebase(
    () => user ? collection(firestore, `users/${user.uid}/readAnnouncements`) : null,
    [user, firestore]
  );
  const { data: readAnnouncements } = useCollection<{id: string}>(readAnnouncementsQuery);

  const locationRequestsQuery = useMemoFirebase(() => {
    if (!isPrivileged || !user) return null;
    return query(collection(firestore, "location_change_requests"), where("status", "==", "pending"));
  }, [firestore, isPrivileged, user]);
  const { data: locationRequests } = useCollection<LocationRequest>(locationRequestsQuery);
  const pendingLocationRequestsCount = locationRequests?.length || 0;

  const attRequestsQuery = useMemoFirebase(() => {
    if (!isPrivileged || !user) return null;
    return query(collection(firestore, "attendanceApprovalRequests"), where("status", "==", "Pending"));
  }, [firestore, isPrivileged, user]);
  const { data: attRequests } = useCollection<AttendanceApprovalRequest>(attRequestsQuery);
  const pendingAttRequestsCount = attRequests?.length || 0;

  useEffect(() => {
    if (allAnnouncements && readAnnouncements) {
      const readIds = new Set(readAnnouncements.map(a => a.id));
      const unreadCount = allAnnouncements.filter(a => !readIds.has(a.id)).length;
      setUnreadAnnouncements(unreadCount);
    }
  }, [allAnnouncements, readAnnouncements]);

  const eventsQuery = useMemoFirebase(
    () => user ? collection(firestore, 'events') : null,
    [firestore, user]
  );
  const { data: events } = useCollection<EventItem>(eventsQuery);
  const todaysEventsCount = useMemo(() => {
    if (!events) return 0;
    return events.filter(e => e.date && isToday(e.date.toDate())).length;
  }, [events]);

  const ticketQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid));
  }, [firestore, user]);
  const { data: userTickets } = useCollection<SupportTicket>(ticketQuery);

  const ticketUpdateCount = useMemo(() => {
    if (!userTickets) return 0;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return userTickets.filter(t => {
      if (!t.lastUpdatedDate) return false;
      const updateTime = t.lastUpdatedDate.toDate ? t.lastUpdatedDate.toDate() : new Date(t.lastUpdatedDate);
      return updateTime > twentyFourHoursAgo;
    }).length;
  }, [userTickets]);

  const totalNotifications = pendingLeaveCount + unreadAnnouncements + todaysEventsCount + pendingLocationRequestsCount + ticketUpdateCount + pendingAttRequestsCount;

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border/50">
          <div className="flex items-center gap-3 p-3">
            <div className="bg-primary text-white p-2 rounded-xl shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="font-black text-lg tracking-tighter text-white uppercase">MarsHRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav 
            userRole={userRole}
            pendingLeaveCount={pendingLeaveCount}
            unreadAnnouncementsCount={unreadAnnouncements}
            todaysEventsCount={todaysEventsCount}
            pendingLocationRequestsCount={pendingLocationRequestsCount}
            pendingAttRequestsCount={pendingAttRequestsCount}
            ticketUpdateCount={ticketUpdateCount}
            totalNotificationsCount={totalNotifications}
          />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/50">
          <UserNav user={user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4">
          <SidebarTrigger />
          <div className="flex-1">
             <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-3" />
                <span className="text-[10px] font-black uppercase tracking-widest">{format(new Date(), 'EEEE, MMMM dd')}</span>
             </div>
          </div>
          <AutomatedReportSender />
        </header>
        <main className="flex-1 p-4 overflow-x-hidden">
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
