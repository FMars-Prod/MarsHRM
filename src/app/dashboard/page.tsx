
'use client';

import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, limit, where } from "firebase/firestore";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";
import { ProfileBentoCard } from "@/components/geohrm/profile-bento-card";
import { MissionHeatmapWidget } from "@/components/geohrm/mission-heatmap-widget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, MessageSquareWarning, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  
  const userRole = (currentUserData as any)?.role;
  const isCEO = userRole === 'CEO/Admin';
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const complianceQuery = useMemoFirebase(() => isCEO ? query(collection(firestore, 'compliance_reports'), orderBy('timestamp', 'desc'), limit(1)) : null, [isCEO, firestore]);
  const { data: latestCompliance } = useCollection(complianceQuery);
  const hasCriticalAlert = latestCompliance && latestCompliance.length > 0;

  const ticketQuery = useMemoFirebase(() => {
    if (!currentUser) return null;
    return query(collection(firestore, "issue_reports"), where("employeeId", "==", currentUser.uid));
  }, [firestore, currentUser]);
  const { data: userTickets } = useCollection<any>(ticketQuery);

  const recentTicketUpdates = React.useMemo(() => {
    if (!userTickets) return [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return userTickets.filter(t => {
      if (!t.lastUpdatedDate) return false;
      const updateTime = t.lastUpdatedDate.toDate ? t.lastUpdatedDate.toDate() : new Date(t.lastUpdatedDate);
      return updateTime > twentyFourHoursAgo;
    });
  }, [userTickets]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-open-sans">
      {/* Command Greeting Header */}
      <div className="flex flex-col gap-1 mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{format(new Date(), 'EEEE, MMMM dd')}</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
              {greeting}, {currentUserData?.firstName || 'Strategist'} ,
          </h1>
          <p className="text-sm font-medium text-muted-foreground">Welcome to the tactical grid. Your fleet operations are synchronized.</p>
      </div>

      {/* Dynamic Notifications */}
      {isCEO && hasCriticalAlert && latestCompliance?.[0] && (
          <Alert className="mb-6 bg-red-50 border-red-200 animate-pulse rounded-2xl border-2">
              <ShieldAlert className="size-4 text-red-600" />
              <AlertTitle className="text-red-700 font-black uppercase text-xs tracking-widest">Protocol Alert: Executive Review Required</AlertTitle>
              <AlertDescription className="flex justify-between items-center mt-2">
                  <p className="text-red-800 text-sm font-medium">A high-priority compliance report has been filed for <span className="font-black">{latestCompliance[0].employeeName}</span>.</p>
                  <Link href="/dashboard/compliance" className="text-red-600 font-black uppercase text-[10px] underline underline-offset-4">Review Detail</Link>
              </AlertDescription>
          </Alert>
      )}

      {recentTicketUpdates.length > 0 && (
          <Alert className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-2xl">
              <MessageSquareWarning className="size-4 text-blue-600" />
              <AlertTitle className="text-blue-700 font-black uppercase text-xs tracking-widest">Support Desk Update</AlertTitle>
              <AlertDescription className="flex justify-between items-center mt-2">
                  <p className="text-blue-800 text-sm font-medium">Your support ticket "<span className="font-black">{recentTicketUpdates[0].title}</span>" has been updated to <span className="font-black">{recentTicketUpdates[0].status}</span>.</p>
                  <Link href="/dashboard/issues" className="text-blue-600 font-black uppercase text-[10px] underline underline-offset-4">View Updates</Link>
              </AlertDescription>
          </Alert>
      )}

      <DashboardReminder />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 animate-fade-in-up">
              <ProfileBentoCard />
          </div>
          <div className="lg:col-span-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <MissionHeatmapWidget />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <AttendanceWidget />
          </div>
      </div>

      {isAdminOrHR && (
        <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <DailyMonitorWidget />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <ActionItemsWidget />
        </div>

        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <WorkHoursSummaryWidget />
        </div>
      </div>
      
      <div className="grid gap-6">
          <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
            <EventsWidget />
          </div>
      </div>
    </div>
  );
}
