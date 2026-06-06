'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Activity, Download, Users, Clock, UserCheck as UserCheckIcon, UserRoundX, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string;
  avatar?: string;
  role?: string;
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
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    outOfRange: [] as UserData[],
    atHome: [] as UserData[],
    isLoading: true,
  });
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[], color: string } | null>(null);

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: fleetUsers, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

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
        
        const lateUsers: UserData[] = [];
        const onLeaveUsers: UserData[] = [];
        const presentUsers: UserData[] = [];
        const absentUsers: UserData[] = [];
        const outOfRangeUsers: UserData[] = [];
        const atHomeUsers: UserData[] = [];

        fleetUsers.forEach(u => {
          const att = attendanceMap.get(u.id);
          if (att) {
              if (att.isAtHome) atHomeUsers.push(u);
              else if (att.isOutOfRange) outOfRangeUsers.push(u);
              else if (att.status === 'late') lateUsers.push(u);
              else presentUsers.push(u);
          } else if (onLeaveTodayIds.has(u.id)) {
            onLeaveUsers.push(u);
          } else {
            if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') absentUsers.push(u);
          }
        });
        
        setSummary({
          late: lateUsers,
          absent: absentUsers,
          onLeave: onLeaveUsers,
          present: presentUsers,
          outOfRange: outOfRangeUsers,
          atHome: atHomeUsers,
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
        ...summary.present.map(u => [`${u.firstName} ${u.lastName}`, 'Present', 'Office']),
        ...summary.late.map(u => [`${u.firstName} ${u.lastName}`, 'Late', 'Office']),
        ...summary.outOfRange.map(u => [`${u.firstName} ${u.lastName}`, 'Remote', 'Field']),
        ...summary.absent.map(u => [`${u.firstName} ${u.lastName}`, 'Absent', 'Not Logged In']),
    ];

    autoTable(pdfDoc, {
        startY: 35,
        head: [['Employee', 'Status', 'Location']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });

    pdfDoc.save(`attendance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor, onClick, gradient, description }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; onClick: () => void; gradient: string; description: string }) => (
    <Card className={cn("group hover:bg-muted/50 transition-all duration-300 cursor-pointer border-none ring-1 ring-border/50 rounded-2xl overflow-hidden", gradient)} onClick={onClick}>
      <CardHeader className="p-4 pb-1">
        <div className="flex items-center justify-between">
            <div className={cn("p-2 rounded-xl shadow-sm transition-transform group-hover:scale-105", iconColor)}>
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
        <Card className="animate-fade-in-up bg-white border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="p-6 pb-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <Activity className="size-4" /> Daily Attendance Monitor
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Attendance status for {format(new Date(), 'MMM dd')}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="rounded-xl h-9 px-4 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50">
                        <Download className="mr-1.5 h-3 w-3" />
                        Download PDF
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-6 pt-2">
                {summary.isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="At Office" 
                                users={summary.present} 
                                Icon={UserCheckIcon} 
                                iconColor="bg-emerald-500 text-white" 
                                gradient="bg-gradient-to-br from-emerald-50/30 to-white"
                                description="Logged in at office"
                                onClick={() => setSheetContent({title: "AT OFFICE", users: summary.present, color: "text-emerald-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Late" 
                                users={summary.late} 
                                Icon={Clock} 
                                iconColor="bg-amber-500 text-white" 
                                gradient="bg-gradient-to-br from-amber-50/30 to-white"
                                description="Logged in late"
                                onClick={() => setSheetContent({title: "LATE LOGINS", users: summary.late, color: "text-amber-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Remote" 
                                users={summary.outOfRange} 
                                Icon={MapPin} 
                                iconColor="bg-sky-500 text-white" 
                                gradient="bg-gradient-to-br from-sky-50/30 to-white"
                                description="Working remotely"
                                onClick={() => setSheetContent({title: "REMOTE STAFF", users: summary.outOfRange, color: "text-sky-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Absent" 
                                users={summary.absent} 
                                Icon={UserRoundX} 
                                iconColor="bg-rose-500 text-white" 
                                gradient="bg-gradient-to-br from-rose-50/30 to-white"
                                description="Not logged in today"
                                onClick={() => setSheetContent({title: "NOT LOGGED IN", users: summary.absent, color: "text-rose-600"})} 
                            />
                        </SheetTrigger>
                    </div>
                )}
            </CardContent>
        </Card>

        {sheetContent && (
            <SheetContent className="rounded-l-3xl border-none shadow-2xl w-full sm:max-w-md p-0 overflow-hidden">
                <SheetHeader className="p-6 border-b bg-white">
                    <SheetTitle className={cn("text-xl font-black uppercase tracking-tighter", sheetContent.color)}>{sheetContent.title}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-3">
                     {sheetContent.users.map(member => (
                        <Card key={member.id} className="border-none ring-1 ring-border/50 rounded-xl p-4 bg-white">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 rounded-lg">
                                    <AvatarImage src={member.avatar} />
                                    <AvatarFallback className="font-bold">{member.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-black text-sm">{member.firstName} {member.lastName}</p>
                                    <p className="text-[10px] font-bold uppercase opacity-50">{member.jobTitle}</p>
                                </div>
                            </div>
                        </Card>
                     ))}
                  </div>
                </ScrollArea>
            </SheetContent>
        )}
    </Sheet>
  );
};
