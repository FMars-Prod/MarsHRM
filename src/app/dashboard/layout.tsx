
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
import { Building2 } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, Timestamp } from 'firebase/firestore';
import { isToday } from 'date-fns';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
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
            <h2 className="text-white/90 text-lg font-black uppercase tracking-[0.2em] animate-fade-in-up">Initializing MarsHRM</h2>
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
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <span className="font-headline text-lg font-semibold text-white">MarsHRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav 
            userRole={userRole}
            pendingLeaveCount={pendingLeaveCount}
            unreadAnnouncementsCount={unreadAnnouncements}
            todaysEventsCount={todaysEventsCount}
            pendingLocationRequestsCount={pendingLocationRequestsCount}
          />
        </SidebarContent>
        <SidebarFooter>
          <UserNav user={user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <SidebarTrigger />
          <div className="flex-1">
            <AutomatedReportSender />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
        <footer className="mt-auto border-t py-6 px-4 md:px-6 bg-white/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                <p>© {new Date().getFullYear()} MarsHRM. All rights reserved.</p>
                <p className="font-medium">Developed by FortuMars</p>
            </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
