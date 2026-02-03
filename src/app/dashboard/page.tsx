
'use client';

import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { AnnouncementsWidget } from "@/components/geohrm/announcements-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { PageHeader } from "@/components/geohrm/page-header";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Welcome back, here's your overview for today."
      >
      </PageHeader>
      
      {isAdminOrHR && (
        <div className="mb-6">
          <DailyMonitorWidget />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <AttendanceWidget />
          <ActionItemsWidget />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <WorkHoursSummaryWidget />
          <AnnouncementsWidget />
        </div>
        <div className="lg:col-span-1">
          <EventsWidget />
        </div>
      </div>
    </>
  );
}
