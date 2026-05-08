
'use client';

import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { PageHeader } from "@/components/geohrm/page-header";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  const userRole = (currentUserData as any)?.role;
  const isCEO = userRole === 'CEO/Admin';
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  const complianceQuery = useMemoFirebase(() => isCEO ? query(collection(firestore, 'compliance_reports'), orderBy('timestamp', 'desc'), limit(1)) : null, [isCEO, firestore]);
  const { data: latestCompliance } = useCollection(complianceQuery);
  const hasCriticalAlert = latestCompliance && latestCompliance.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back, here's your overview for today."
        className="animate-fade-in-up"
      />
      
      {isCEO && hasCriticalAlert && (
          <Alert className="mb-6 bg-red-50 border-red-200 animate-pulse">
              <ShieldAlert className="size-4 text-red-600" />
              <AlertTitle className="text-red-700 font-black uppercase text-xs tracking-widest">Protocol Alert: Executive Review Required</AlertTitle>
              <AlertDescription className="flex justify-between items-center mt-2">
                  <p className="text-red-800 text-sm font-medium">A high-priority compliance report has been filed for <span className="font-black">{latestCompliance[0].employeeName}</span>.</p>
                  <Link href="/dashboard/compliance" className="text-red-600 font-black uppercase text-[10px] underline underline-offset-4">Review Detail</Link>
              </AlertDescription>
          </Alert>
      )}

      <DashboardReminder />

      {isAdminOrHR && (
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <DailyMonitorWidget />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <AttendanceWidget />
        </div>
        
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <ActionItemsWidget />
        </div>

        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <EventsWidget />
        </div>

        <div className="lg:col-span-1" />

        <div className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <WorkHoursSummaryWidget />
        </div>
      </div>
    </div>
  );
}
