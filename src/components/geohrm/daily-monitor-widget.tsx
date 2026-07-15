
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

export function DailyMonitorWidget() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const [summary, setSummary] = React.useState({
    office: [] as UserData[], // Present + Late at branch
    wfhActive: [] as UserData[], // WFH checked in
    wfhAbsent: [] as UserData[], // WFH authorized but not checked in
    absent: [] as UserData[], // Office absent
    onLeave: [] as UserData[],
    outOfRange: [] as UserData[], // Remote/Field
    isLoading: true,
  });
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[], color: string, icon: React.ReactNode } | null>(null);

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
        if (!usersLoading) {
            setSummary(prev => ({ ...prev, isLoading: false }));
        }
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
            if (isWithinInterval(now, leaveInterval)) {
              onLeaveTodayIds.add(leave.employeeId);
            }
          }
        });
        
        const office: UserData[] = [];
        const wfhActive: UserData[] = [];
        const wfhAbsent: UserData[] = [];
        const onLeaveUsers: UserData[] = [];
        const absentUsers: UserData[] = [];
        const outOfRangeUsers: UserData[] = [];

        fleetUsers.forEach(u => {
          const isAdmin = u.role === 'CEO/Admin' || u.role === 'HR Manager';
          if (isAdmin) return;

          const att = attendanceMap.get(u.id);
          const isWfhUser = u.isWfhAllowed;

          if (att) {
              if (att.isAtHome) wfhActive.push(u);
              else if (att.isOutOfRange) outOfRangeUsers.push(u);
              else office.push(u);
          } else if (onLeaveTodayIds.has(u.id)) {
            onLeaveUsers.push(u);
          } else {
            if (isWfhUser) wfhAbsent.push(u);
            else absentUsers.push(u);
          }
        });
        
        setSummary({
          office,
          wfhActive,
          wfhAbsent,
          onLeave: onLeaveUsers,
          absent: absentUsers,
          outOfRange: outOfRangeUsers,
          isLoading: false,
        });
      } catch (error: any) {
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchMonitorData();
  }, [fleetUsers, usersLoading, firestore]);
  
  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    const reportDate = format(new Date(), 'PPP');
    const generatorName = currentUserData ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : 'System';

    pdfDoc.setFontSize(16);
    pdfDoc.text("Daily Attendance Summary", 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Date: ${reportDate} | Generated by: ${generatorName}`, 14, 28);

    const body = [
        ...summary.office.map(u => [`${u.firstName} ${u.lastName}`, 'Present', 'Office']),
        ...summary.wfhActive.map(u => [`${u.firstName} ${u.lastName}`, 'Active', 'WFH']),
        ...summary.wfhAbsent.map(u => [`${u.firstName} ${u.lastName}`, 'Not Logged In', 'WFH']),
        ...summary.outOfRange.map(u => [`${u.firstName} ${u.lastName}`, 'Remote', 'Field']),
        ...summary.absent.map(u => [`${u.firstName} ${u.lastName}`, 'Absent', 'Office']),
    ];

    autoTable(pdfDoc, {
        startY: 35,
        head: [['Employee', 'Status', 'Mode']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });

    pdfDoc.save(`attendance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor, onClick, gradient, description }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; onClick: () => void; gradient: string; description: string }) => (
    <Card className={cn("group hover:bg-muted/50 transition-all duration-300 cursor-pointer border-none ring-1 ring-border/50 rounded-none overflow-hidden", gradient)} onClick={onClick}>
      <CardHeader className="p-4 pb-1">
        <div className="flex items-center justify-between">
            <div className={cn("p-2 rounded-none shadow-sm transition-transform group-hover:scale-105", iconColor)}>
                <Icon className="h-4 w-4" />
            </div>
            <span className="text-2xl font-black">{users.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
          <p className="text-xs font-black uppercase tracking-tight text-foreground/80">{title}</p>
          <p className="text-[9px] font-bold uppercase text-muted-foreground/60 mt-0.5">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
        <Card className="animate-fade-in-up bg-white border-none shadow-sm rounded-none overflow-hidden">
            <CardHeader className="p-6 pb-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <Activity className="size-4" /> Daily Presence Monitor
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Workforce operational audit for {format(new Date(), 'MMM dd')}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="rounded-none h-9 px-4 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50">
                        <Download className="mr-1.5 h-3 w-3" />
                        Download PDF
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-6 pt-2">
                {summary.isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-24 rounded-none bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="At Office" 
                                users={summary.office} 
                                Icon={UserCheckIcon} 
                                iconColor="bg-emerald-500 text-white" 
                                gradient="bg-gradient-to-br from-emerald-50/30 to-white"
                                description="Logged in at branch"
                                onClick={() => setSheetContent({title: "OFFICE PRESENCE", users: summary.office, color: "text-emerald-600", icon: <UserCheckIcon className="size-4"/>})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="WFH: Active" 
                                users={summary.wfhActive} 
                                Icon={Home} 
                                iconColor="bg-sky-500 text-white" 
                                gradient="bg-gradient-to-br from-sky-50/30 to-white"
                                description="Logged in from home"
                                onClick={() => setSheetContent({title: "WFH ACTIVE", users: summary.wfhActive, color: "text-sky-600", icon: <Home className="size-4"/>})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="WFH: Pending" 
                                users={summary.wfhAbsent} 
                                Icon={Signal} 
                                iconColor="bg-amber-500 text-white" 
                                gradient="bg-gradient-to-br from-amber-50/30 to-white"
                                description="WFH expected, no login"
                                onClick={() => setSheetContent({title: "WFH PENDING", users: summary.wfhAbsent, color: "text-amber-600", icon: <Signal className="size-4"/>})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Absent" 
                                users={summary.absent} 
                                Icon={UserRoundX} 
                                iconColor="bg-rose-500 text-white" 
                                gradient="bg-gradient-to-br from-rose-50/30 to-white"
                                description="Office-bound, no login"
                                onClick={() => setSheetContent({title: "OFFICE ABSENT", users: summary.absent, color: "text-rose-600", icon: <UserRoundX className="size-4"/>})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="On Leave" 
                                users={summary.onLeave} 
                                Icon={Clock} 
                                iconColor="bg-indigo-500 text-white" 
                                gradient="bg-gradient-to-br from-indigo-50/30 to-white"
                                description="Approved leave requests"
                                onClick={() => setSheetContent({title: "ON LEAVE", users: summary.onLeave, color: "text-indigo-600", icon: <Clock className="size-4"/>})} 
                            />
                        </SheetTrigger>
                    </div>
                )}
            </CardContent>
        </Card>

        {sheetContent && (
            <SheetContent className="rounded-none border-none shadow-2xl w-full sm:max-w-md p-0 overflow-hidden">
                <SheetHeader className="p-6 border-b bg-white">
                    <SheetTitle className={cn("text-xl font-black uppercase tracking-tighter flex items-center gap-2", sheetContent.color)}>
                        {sheetContent.icon}
                        {sheetContent.title}
                    </SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-3">
                     {sheetContent.users.map(member => {
                        const complianceCount = complianceCounts[member.id] || 0;
                        return (
                            <Link key={member.id} href={`/dashboard/users/${member.id}`} className="block">
                                <Card className="border-none ring-1 ring-border/50 rounded-none p-4 bg-white hover:bg-primary/5 transition-colors cursor-pointer group shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 rounded-none">
                                                    <AvatarImage src={member.avatar} className="object-cover" />
                                                    <AvatarFallback className="font-bold rounded-none">{member.firstName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                {isExecutive && complianceCount > 0 && (
                                                    <div className="absolute -top-2 -right-2 bg-red-600 rounded-full size-5 flex items-center justify-center border-2 border-white animate-pulse z-10">
                                                        <span className="text-white font-black text-[9px]">{complianceCount}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-sm group-hover:text-primary transition-colors">{member.firstName} {member.lastName}</p>
                                                    {isExecutive && complianceCount > 0 && (
                                                        <ShieldAlert className="size-3 text-red-600 animate-pulse" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold uppercase opacity-50">{member.jobTitle}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="size-4 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Card>
                            </Link>
                        );
                     })}
                  </div>
                </ScrollArea>
            </SheetContent>
        )}
    </Sheet>
  );
};
