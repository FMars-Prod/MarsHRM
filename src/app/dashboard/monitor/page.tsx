
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, differenceInSeconds } from 'date-fns';
import { User, UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, Download, AlertTriangle, Share2, FileText, Mail, MessageSquare, Users, Phone, PieChart as PieChartIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

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
};

type LeaveRequest = {
  employeeId: string;
  status: 'Approved';
  startDate: Timestamp;
  endDate: Timestamp;
};

const MonitorPage = () => {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [date, setDate] = React.useState<Date>(new Date());
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    outOfRange: [] as UserData[],
    isLoading: true,
  });
  const [attendanceRecords, setAttendanceRecords] = React.useState<Map<string, AttendanceRecord>>(new Map());

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
      if (!users || users.length === 0 || !firestore) {
        if (!usersLoading) {
            setSummary(prev => ({ ...prev, isLoading: false }));
        }
        return;
      };

      setSummary(prev => ({ ...prev, isLoading: true }));

      try {
        const selectedDayStart = startOfDay(date);
        const selectedDayEnd = endOfDay(date);

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
            if (isWithinInterval(date, leaveInterval)) {
              onLeaveTodayIds.add(leave.employeeId);
            }
          }
        });
        
        const lateUsers: UserData[] = [];
        const onLeaveUsers: UserData[] = [];
        const presentUsers: UserData[] = [];
        const absentUsers: UserData[] = [];
        const outOfRangeUsers: UserData[] = [];

        users.forEach(u => {
          const att = attendanceMap.get(u.id);
          if (att) {
              if (att.isOutOfRange) {
                  outOfRangeUsers.push(u);
              } else if (att.status === 'late') {
                  lateUsers.push(u);
              } else {
                  presentUsers.push(u);
              }
          } else if (onLeaveTodayIds.has(u.id)) {
            onLeaveUsers.push(u);
          } else {
            if ((u as any).role !== 'CEO/Admin' && (u as any).role !== 'HR Manager') {
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
          isLoading: false,
        });
      } catch (error: any) {
        console.error("Monitor error:", error);
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchMonitorData();
  }, [users, usersLoading, firestore, date, toast]);
  
  const chartData = React.useMemo(() => {
    return [
      { name: 'Present', value: summary.present.length, color: 'hsl(var(--chart-5))' },
      { name: 'Late', value: summary.late.length, color: 'hsl(var(--chart-3))' },
      { name: 'Absent', value: summary.absent.length, color: 'hsl(var(--destructive))' },
      { name: 'On Leave', value: summary.onLeave.length, color: 'hsl(var(--chart-1))' },
      { name: 'Out of Range', value: summary.outOfRange.length, color: 'hsl(var(--chart-2))' },
    ].filter(d => d.value > 0);
  }, [summary]);

  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleExportPdf = () => {
    if (summary.isLoading) {
      toast({ variant: 'destructive', title: 'Data not ready' });
      return;
    }
    
    const pdfDoc = new jsPDF();
    const reportDate = format(date, 'PPP');
    const generatorName = currentUserData ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : 'System';

    const addPageContent = (data: any) => {
        pdfDoc.setFontSize(16);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text("FortuMars AI Technologies & Business Solutions.", pdfDoc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        const pageCount = pdfDoc.internal.getNumberOfPages();
        pdfDoc.setFontSize(8);
        pdfDoc.text(`Page ${pageCount}`, data.settings.margin.left, pdfDoc.internal.pageSize.height - 10);
    };

    pdfDoc.setFontSize(12);
    pdfDoc.setTextColor(100);
    pdfDoc.text(`Daily Attendance Summary - ${reportDate}`, pdfDoc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Generated by: ${generatorName}`, 14, 48);

    let finalY = 55;

    const addSection = (title: string, users: UserData[], statusLabel: string, includeTime: boolean = false) => {
      if (users.length > 0) {
        const body = users.map(u => {
            const rec = attendanceRecords.get(u.id);
            const clockIn = (rec && rec.checkInTime) ? format(rec.checkInTime.toDate(), 'p') : '--:--';
            const clockOut = (rec && rec.checkOutTime) ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
            const breakTime = (rec && rec.totalBreakDuration) ? formatDuration(rec.totalBreakDuration) : '0m';
            
            const detailLine = includeTime 
                ? `${u.firstName} ${u.lastName} - ${statusLabel} - In: ${clockIn} / Out: ${clockOut} - Break: ${breakTime}`
                : `${u.firstName} ${u.lastName} - ${statusLabel}`;
            
            return [detailLine];
        });

        autoTable(pdfDoc, {
          startY: finalY,
          head: [[{ content: `${title} (${users.length})`, styles: { fontStyle: 'bold', fontSize: 12, halign: 'left', fillColor: [240,240,240], textColor: 0 } }]],
          body: [],
          theme: 'plain',
          didDrawPage: addPageContent,
          margin: { top: 50 },
        });

        autoTable(pdfDoc, {
          startY: (pdfDoc as any).lastAutoTable.finalY,
          head: [['Status Details']],
          body: body,
          theme: 'striped',
          headStyles: { fillColor: [39, 55, 70] },
          didDrawPage: addPageContent,
          margin: { top: 50 },
        });
        finalY = (pdfDoc as any).lastAutoTable.finalY + 10;
      }
    };
    
    addSection('Present', summary.present, 'Present', true);
    addSection('Late', summary.late, 'Late', true);
    addSection('Out of Range', summary.outOfRange, 'Out of Range', true);
    addSection('Absent', summary.absent, 'Absent', false);
    addSection('On Leave', summary.onLeave, 'On Leave', false);
    
    addPageContent({ settings: { margin: { left: 14 } } });
    pdfDoc.save(`daily_report_${format(date, 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor, nudgeType }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; nudgeType?: 'missing_login' | 'missing_logout' }) => (
    <Card className="h-fit">
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-3 text-sm">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <span>{title}</span>
            <span className="ml-auto text-base font-bold">{users.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {users.length > 0 ? (
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between group p-1.5 -mx-1 rounded-md hover:bg-muted transition-colors">
                <Link href={`/dashboard/analytics?userId=${user.id}`} className="flex items-center gap-2 flex-1">
                    <Avatar className="h-7 w-7">
                    {user.avatar && <span className="text-sm">{user.avatar}</span>}
                    <AvatarFallback className="text-[10px]">{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                    <p className="font-semibold text-xs leading-tight">{user.firstName} {user.lastName}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{user.jobTitle}</p>
                    </div>
                </Link>
                {nudgeType && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => {
                            const cleanNumber = user.phoneNumber?.replace(/\D/g, '');
                            const msg = `Hello ${user.firstName}, you haven't clocked in today. Please log in immediately.`;
                            window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                    >
                        <Phone className="h-3 w-3" />
                    </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center py-2">No records found.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader title="Daily Monitor" description={`Real-time team status for ${format(date, 'MMMM d, yyyy')}.`}>
        <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Today</Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} size="sm" className={cn("w-[180px] justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(date, "PP")}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
            </Popover>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={summary.isLoading}><Share2 className="mr-2 h-4 w-4" /> Report</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPdf}><FileText className="mr-2 h-4 w-4" /> Download PDF Summary</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </PageHeader>
      
      {summary.isLoading ? (
        <div className="flex h-64 items-center justify-center"><Building2 className="h-10 w-10 animate-pulse text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                        <PieChartIcon className="size-5" />
                        Status Distribution
                    </CardTitle>
                    <CardDescription>Visual breakdown of current attendance.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                <UserListCard title="Out of Range" users={summary.outOfRange} Icon={AlertTriangle} iconColor="text-orange-500" />
                <UserListCard title="Absent Today" users={summary.absent} Icon={UserRoundX} iconColor="text-red-500" nudgeType="missing_login" />
                <UserListCard title="On Approved Leave" users={summary.onLeave} Icon={User} iconColor="text-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UserListCard title="Present (On Time)" users={summary.present} Icon={UserCheck} iconColor="text-green-500" />
            <UserListCard title="Late Arrivals" users={summary.late} Icon={UserX} iconColor="text-yellow-500" />
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorPage;
