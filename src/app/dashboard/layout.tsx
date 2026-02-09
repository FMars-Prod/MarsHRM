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

type LeaveRequest = {
  status: string;
};
type Announcement = {
  id: string;
};
type EventItem = {
  date: Timestamp;
}

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
      return null; // Members don't see a count
    }
    return q;
  }, [firestore, user, userRole]);

  const { data: leaveRequests } = useCollection<LeaveRequest>(leaveRequestsQuery);
  const pendingLeaveCount = leaveRequests?.length || 0;

  const allAnnouncementsQuery = useMemoFirebase(
    () => collection(firestore, 'announcements'),
    [firestore]
  );
  const { data: allAnnouncements } = useCollection<Announcement>(allAnnouncementsQuery);
  
  const readAnnouncementsQuery = useMemoFirebase(
    () => user ? collection(firestore, `users/${user.uid}/readAnnouncements`) : null,
    [user, firestore]
  );
  const { data: readAnnouncements } = useCollection<{id: string}>(readAnnouncementsQuery);

  useEffect(() => {
    if (allAnnouncements && readAnnouncements) {
      const readIds = new Set(readAnnouncements.map(a => a.id));
      const unreadCount = allAnnouncements.filter(a => !readIds.has(a.id)).length;
      setUnreadAnnouncements(unreadCount);
    }
  }, [allAnnouncements, readAnnouncements]);

  const eventsQuery = useMemoFirebase(
    () => collection(firestore, 'events'),
    [firestore]
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
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Building2 className="h-12 w-12 animate-pulse" />
          <p className="text-muted-foreground">Loading MarsHRM...</p>
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
            <span className="font-headline text-lg font-semibold">MarsHRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <MainNav 
            userRole={userRole}
            pendingLeaveCount={pendingLeaveCount}
            unreadAnnouncementsCount={unreadAnnouncements}
            todaysEventsCount={todaysEventsCount}
          />
        </SidebarContent>
        <SidebarFooter>
          <UserNav user={user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <SidebarTrigger />
          <div className="flex-1">
            {/* Placeholder for breadcrumbs or page title if needed */}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
        <footer className="border-t p-4 text-center text-xs text-muted-foreground">
            Developed by FortuMars
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
