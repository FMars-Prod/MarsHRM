'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Activity, Download, Users, Clock, UserCheck as UserCheckIcon, UserRoundX, MapPin, ShieldAlert, ChevronRight, Home, Signal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string;
  avatar?: string;
  role?: string;
  isWfhAllowed?: boolean;
};

type AttendanceRecord = {
  employeeId: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late';
  isOutOfRange?: boolean;
  isAtHome?: boolean;
};

type LeaveRequest = {
  employeeId: string;
  status: 'Approved';
  startDate: Timestamp;
  endDate: Timestamp;
};

type MemberWithStatus = UserData & { att?: AttendanceRecord };

export function DailyMonitorWidget() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const [summary, setSummary] = React.useState({
    office: [] as MemberWithStatus[],
    wfhActive: [] as MemberWithStatus[],
    wfhAbsent: [] as MemberWithStatus[],
    absent: [] as MemberWithStatus[],
    onLeave: [] as MemberWithStatus[],
    outOfRange: [] as MemberWithStatus[],
    isLoading: true,
  });
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: MemberWithStatus[], color: string, icon: React.ReactNode } | null>(null);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isExecutive = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD';
  
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: fleetUsers, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const complianceQuery = useMemoFirebase(() => query(collection(firestore, 'compliance_reports')), [firestore]);
  const { data: complianceReports } = useCollection<any>(complianceQuery);

  const complianceCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (complianceReports) {
      complianceReports.forEach(r => {
        counts[r.employeeId] = (counts[r.employeeId] || 0) + 1;
      });
    }
    return counts;
  }, [complianceReports]);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
      if (!fleetUsers || fleetUsers.length === 0 || !firestore) {
        if (!usersLoading) setSummary(prev => ({ ...prev, isLoading: false }));
        return;
      };

      setSummary(prev => ({ ...prev, isLoading: true }));

      try {
        const now = new Date();
        const selectedDayStart = startOfDay(now);
        const selectedDayEnd = endOfDay(now);

        const attendanceQuery = query(
          collectionGroup(firestore, 'attendances'),
          where('checkInTime', '>=', selectedDayStart),
          where('checkInTime', '<=', selectedDayEnd)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        const attendanceMap = new Map<string, AttendanceRecord>();
        attendanceSnapshot.docs.forEach(doc => {
            const data = doc.data() as AttendanceRecord;
            attendanceMap.set(data.employeeId, data);
        });

        const leavesQuery = query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved'));
        const leavesSnapshot = await getDocs(leavesQuery);
        const allApprovedLeaves = leavesSnapshot.docs.map(doc => doc.data() as LeaveRequest);
        
        const onLeaveTodayIds = new Set<string>();
        allApprovedLeaves.forEach(leave => {
          const leaveStart = leave.startDate?.toDate();
          const leaveEnd = leave.endDate?.toDate();
          if (leaveStart && leaveEnd) {
            const leaveInterval = { start: leaveStart, end: leaveEnd };
            if (isWithinInterval(now, leaveInterval)) onLeaveTodayIds.add(leave.employeeId);
          }
        });
        
        const office: MemberWithStatus[] = [];
        const wfhActive: MemberWithStatus[] = [];
        const wfhAbsent: MemberWithStatus[] = [];
        const onLeaveUsers: MemberWithStatus[] = [];
        const absentUsers: MemberWithStatus[] = [];
        const outOfRangeUsers: MemberWithStatus[] = [];

        fleetUsers.forEach(u => {
          const att = attendanceMap.get(u.id);
          const isWfhUser = u.isWfhAllowed;

          if (att) {
              if (att.isAtHome) wfhActive.push({ ...u, att });
              else if (att.isOutOfRange) outOfRangeUsers.push({ ...u, att });
              else office.push({ ...u, att });
          } else if (onLeaveTodayIds.has(u.id)) {
            onLeaveUsers.push(u);
          } else {
            if (isWfhUser) wfhAbsent.push(u);
            else absentUsers.push(u);
          }
        });
        
        setSummary({ office, wfhActive, wfhAbsent, onLeave: onLeaveUsers, absent: absentUsers, outOfRange: outOfRangeUsers, isLoading: false });
      } catch (error: any) {
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchMonitorData();
  }, [fleetUsers, usersLoading, firestore]);
  
  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    const reportDate = format(new Date(), 'PPP');
    pdfDoc.setFontSize(16);
    pdfDoc.text("Today's Status", 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Date: ${reportDate}`, 14, 28);
    const body = [
        ...summary.office.map(u => [`${u.firstName} ${u.lastName}`, 'Present', 'Office']),
        ...summary.wfhActive.map(u => [`${u.firstName} ${u.lastName}`, 'Active', 'Home']),
        ...summary.wfhAbsent.map(u => [`${u.firstName} ${u.lastName}`, 'No Login', 'Home']),
        ...summary.absent.map(u => [`${u.firstName} ${u.lastName}`, 'Absent', 'Office']),
    ];
    autoTable(pdfDoc, { startY: 35, head: [['Name', 'Status', 'Type']], body, theme: 'striped', headStyles: { fillColor: [107, 33, 168] } });
    pdfDoc.save(`attendance_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const StatusCard = ({ title, count, Icon, iconColor, onClick, gradient }: any) => (
    <Card className={cn("group hover:bg-muted/50 transition-all cursor-pointer border-none ring-1 ring-border/50 rounded-none overflow-hidden", gradient)} onClick={onClick}>
      <CardHeader className="p-3 pb-0.5">
        <div className="flex items-center justify-between">
            <div className={cn("p-1.5 rounded-none", iconColor)}><Icon className="h-3 w-3" /></div>
            <span className="text-xl font-black">{count}</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0.5">
          <p className="text-[10px] font-black uppercase tracking-tight text-foreground/80">{title}</p>
      </CardContent>
    </Card>
  );

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
        <Card className="animate-fade-in-up bg-white border-none shadow-sm rounded-none overflow-hidden">
            <CardHeader className="p-4 pb-1">
                <div className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                        <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                            <Activity className="size-3.5" /> Daily Monitor
                        </CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="rounded-none h-7 px-3 font-black uppercase text-[8px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50">
                        <Download className="mr-1 size-2.5" /> PDF
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-1">
                {summary.isLoading ? (
                    <div className="grid grid-cols-5 gap-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 rounded-none bg-muted animate-pulse" />))}</div>
                ) : (
                    <div className="grid grid-cols-5 gap-2">
                        <SheetTrigger asChild>
                            <StatusCard title="Office" count={summary.office.length} Icon={UserCheckIcon} iconColor="bg-emerald-500 text-white" gradient="bg-emerald-50/20" onClick={() => setSheetContent({title: "AT OFFICE", users: summary.office, color: "text-emerald-600", icon: <UserCheckIcon className="size-3"/>})} />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <StatusCard title="WFH" count={summary.wfhActive.length} Icon={Home} iconColor="bg-sky-500 text-white" gradient="bg-sky-50/20" onClick={() => setSheetContent({title: "HOME ACTIVE", users: summary.wfhActive, color: "text-sky-600", icon: <Home className="size-3"/>})} />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <StatusCard title="Pending" count={summary.wfhAbsent.length} Icon={Signal} iconColor="bg-amber-500 text-white" gradient="bg-amber-50/20" onClick={() => setSheetContent({title: "HOME PENDING", users: summary.wfhAbsent, color: "text-amber-600", icon: <Signal className="size-3"/>})} />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <StatusCard title="Absent" count={summary.absent.length} Icon={UserRoundX} iconColor="bg-rose-500 text-white" gradient="bg-rose-50/20" onClick={() => setSheetContent({title: "OFFICE ABSENT", users: summary.absent, color: "text-rose-600", icon: <UserRoundX className="size-3"/>})} />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <StatusCard title="Leave" count={summary.onLeave.length} Icon={Clock} iconColor="bg-indigo-500 text-white" gradient="bg-indigo-50/20" onClick={() => setSheetContent({title: "ON LEAVE", users: summary.onLeave, color: "text-indigo-600", icon: <Clock className="size-3"/>})} />
                        </SheetTrigger>
                    </div>
                )}
            </CardContent>
        </Card>

        {sheetContent && (
            <SheetContent className="rounded-none border-none shadow-2xl w-full sm:max-w-md p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-4 border-b bg-white shrink-0">
                    <SheetTitle className={cn("text-lg font-black uppercase tracking-tighter flex items-center gap-2", sheetContent.color)}>
                        {sheetContent.icon} {sheetContent.title}
                    </SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2 pb-10">
                        {sheetContent.users.map(member => (
                            <Link key={member.id} href={`/dashboard/users/${member.id}`} className="block">
                                <div className="p-3 border-none ring-1 ring-border/50 rounded-none bg-white hover:bg-primary/5 transition-colors cursor-pointer group shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-left">
                                        <Avatar className="h-8 w-8 rounded-none">
                                            <AvatarImage src={member.avatar} />
                                            <AvatarFallback className="font-bold text-[10px] rounded-none">{member.firstName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-black text-xs group-hover:text-primary transition-colors uppercase leading-none">{member.firstName} {member.lastName}</p>
                                            <p className="text-[8px] font-bold uppercase opacity-50 mt-1">{member.jobTitle}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="size-3 text-muted-foreground opacity-20 group-hover:opacity-100" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        )}
    </Sheet>
  );
};
