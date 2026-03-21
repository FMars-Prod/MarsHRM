'use client';

import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { PageHeader } from "@/components/geohrm/page-header";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview for today."
        className="animate-fade-in-up"
      />
      
      <DashboardReminder />

      {isAdminOrHR && (
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <DailyMonitorWidget />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Attendance Widget takes up 2/3 of the space for more focus */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <AttendanceWidget />
        </div>
        
        {/* Events Widget stays sidebar on desktop */}
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <EventsWidget />
        </div>

        {/* Action items moved to a smaller sidebar-like column */}
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <ActionItemsWidget />
        </div>

        {/* My Activity moved down and spans 2 columns */}
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <WorkHoursSummaryWidget />
        </div>
      </div>
    </div>
  );
}
