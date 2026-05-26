
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, differenceInSeconds } from 'date-fns';
import { Activity, Download, Share2, Mail, MessageSquare, Users, FileText, Phone, MapPin, ShieldCheck, Clock, UserCheck as UserCheckIcon, UserRoundX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  checkInNotes?: string;
  checkOutNotes?: string;
  locationCheckInLatitude?: number;
  locationCheckInLongitude?: number;
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
  const { toast } = useToast();
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    outOfRange: [] as UserData[],
    atHome: [] as UserData[],
    isLoading: true,
  });
  const [attendanceRecords, setAttendanceRecords] = React.useState<Map<string, AttendanceRecord>>(new Map());
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[], nudgeType?: 'missing_login' | 'missing_logout', color: string } | null>(null);

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
        setAttendanceRecords(attendanceMap);

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
              if (att.isAtHome) {
                  atHomeUsers.push(u);
              } else if (att.isOutOfRange) {
                  outOfRangeUsers.push(u);
              } else if (att.status === 'late') {
                  lateUsers.push(u);
              } else {
                  presentUsers.push(u);
              }
          } else if (onLeaveTodayIds.has(u.id)) {
            onLeaveUsers.push(u);
          } else {
            if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') {
               absentUsers.push(u);
            }
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
        console.error("Widget monitor error:", error);
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchMonitorData();
  }, [fleetUsers, usersLoading, firestore]);
  
  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleExportPdf = () => {
    const pdfDoc = new jsPDF();
    const reportDate = format(new Date(), 'PPP');
    const generatorName = currentUserData ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : 'System';

    pdfDoc.setFontSize(16);
    pdfDoc.text("FortuMars AI Technologies - Daily Summary", 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Date: ${reportDate} | Generated by: ${generatorName}`, 14, 28);

    const body = [
        ...summary.present.map(u => [`${u.firstName} ${u.lastName}`, 'Present', 'HQ Sector']),
        ...summary.late.map(u => [`${u.firstName} ${u.lastName}`, 'Late', 'HQ Sector']),
        ...summary.outOfRange.map(u => [`${u.firstName} ${u.lastName}`, 'Remote', 'Field']),
        ...summary.absent.map(u => [`${u.firstName} ${u.lastName}`, 'Absent', 'Unknown']),
    ];

    autoTable(pdfDoc, {
        startY: 35,
        head: [['Employee', 'Status', 'Location']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });

    pdfDoc.save(`daily_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor, onClick, gradient, description }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; onClick: () => void; gradient: string; description: string }) => (
    <Card className={cn("group hover:bg-muted/50 transition-all duration-500 cursor-pointer hover:shadow-xl border-none ring-1 ring-border/50 rounded-[2rem] overflow-hidden", gradient)} onClick={onClick}>
      <CardHeader className="p-6 pb-2">
        <div className="flex items-center justify-between">
            <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110", iconColor)}>
                <Icon className="h-5 w-5" />
            </div>
            <span className="text-3xl font-black tracking-tighter">{users.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
          <p className="text-sm font-black uppercase tracking-tight text-foreground/80">{title}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
        <Card className="animate-fade-in-up bg-white border-none shadow-xl rounded-[2.5rem] overflow-hidden font-open-sans">
            <CardHeader className="p-8 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2.5 text-primary">
                            <Activity className="size-5" /> Fleet Oversight Monitor
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">
                            Operational grid status: {format(new Date(), 'EEEE, dd MMMM')}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} className="rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50">
                        <Download className="mr-2 h-3.5 w-3.5" />
                        Audit PDF
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-8 pt-4">
                {summary.isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-32 rounded-[2rem] bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Onsite Fleet" 
                                users={summary.present} 
                                Icon={UserCheckIcon} 
                                iconColor="bg-emerald-500 text-white" 
                                gradient="bg-gradient-to-br from-emerald-50/50 to-white/50"
                                description="Units verified at HQ sector"
                                onClick={() => setSheetContent({title: "ONSITE FLEET", users: summary.present, color: "text-emerald-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Late Deployment" 
                                users={summary.late} 
                                Icon={Clock} 
                                iconColor="bg-amber-500 text-white" 
                                gradient="bg-gradient-to-br from-amber-50/50 to-white/50"
                                description="Delayed shift activation"
                                onClick={() => setSheetContent({title: "LATE DEPLOYMENT", users: summary.late, color: "text-amber-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Remote Base" 
                                users={summary.outOfRange} 
                                Icon={MapPin} 
                                iconColor="bg-sky-500 text-white" 
                                gradient="bg-gradient-to-br from-sky-50/50 to-white/50"
                                description="Field or remote operations"
                                onClick={() => setSheetContent({title: "REMOTE BASE", users: summary.outOfRange, color: "text-sky-600"})} 
                            />
                        </SheetTrigger>
                        <SheetTrigger asChild>
                            <UserListCard 
                                title="Off-Grid" 
                                users={summary.absent} 
                                Icon={UserRoundX} 
                                iconColor="bg-rose-500 text-white" 
                                gradient="bg-gradient-to-br from-rose-50/50 to-white/50"
                                description="Missing shift login"
                                onClick={() => setSheetContent({title: "OFF-GRID UNITS", users: summary.absent, nudgeType: 'missing_login', color: "text-rose-600"})} 
                            />
                        </SheetTrigger>
                    </div>
                )}
            </CardContent>
        </Card>

        {sheetContent && (
            <SheetContent className="rounded-l-[3rem] border-none shadow-2xl w-full sm:max-w-lg p-0 overflow-hidden font-open-sans">
                <SheetHeader className="p-8 border-b bg-white/80 backdrop-blur-md">
                    <SheetTitle className={cn("text-2xl font-black uppercase tracking-tighter", sheetContent.color)}>{sheetContent.title}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 bg-secondary/5">
                  <div className="p-8 space-y-4">
                     {sheetContent.users.map(member => (
                        <Card key={member.id} className="border-none ring-1 ring-border/50 rounded-2xl p-5 bg-white">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 rounded-xl">
                                    <AvatarImage src={member.avatar} />
                                    <AvatarFallback className="font-bold">{member.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-black text-sm">{member.firstName} {member.lastName}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{member.jobTitle}</p>
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
