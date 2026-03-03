'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, differenceInSeconds } from 'date-fns';
import { User, UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, Download, AlertTriangle, Share2, FileText, Mail, MessageSquare, Users } from 'lucide-react';
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
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';


type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
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
      if (!users || users.length === 0) {
        if (!usersLoading) {
            setSummary(prev => ({ ...prev, isLoading: false }));
        }
        return;
      };

      setSummary(prev => ({ ...prev, isLoading: true }));

      const selectedDayStart = startOfDay(date);
      const selectedDayEnd = endOfDay(date);

      // 1. Fetch today's attendance records using a collectionGroup query
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

      // 2. Fetch approved leaves that cover today
      const leavesQuery = query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved'));
      const leavesSnapshot = await getDocs(leavesQuery);
      const allApprovedLeaves = leavesSnapshot.docs.map(doc => doc.data() as LeaveRequest);
      
      const onLeaveTodayIds = new Set<string>();
      allApprovedLeaves.forEach(leave => {
        const leaveInterval = { start: leave.startDate.toDate(), end: leave.endDate.toDate() };
        if (isWithinInterval(date, leaveInterval)) {
          onLeaveTodayIds.add(leave.employeeId);
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
            // PRIORITY: Out of Range should be the top category if detected
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
          // Exclude admins/CEOs from being marked as absent
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
    };

    fetchMonitorData();
  }, [users, usersLoading, firestore, date]);
  
  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleExport = () => {
    const { present, late, absent, onLeave, outOfRange, isLoading } = summary;
    if (isLoading || (!present.length && !late.length && !absent.length && !onLeave.length && !outOfRange.length)) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There is no status information for the selected date.",
      });
      return;
    }

    const allUsersWithStatus = [
      ...present.map(u => ({ ...u, status: 'Present' })),
      ...late.map(u => ({ ...u, status: 'Late' })),
      ...outOfRange.map(u => ({ ...u, status: 'Out of Range' })),
      ...absent.map(u => ({ ...u, status: 'Absent' })),
      ...onLeave.map(u => ({ ...u, status: 'On Leave' })),
    ];

    const headers = ['Status', 'First Name', 'Last Name', 'Job Title', 'Date', 'Time (In/Out)', 'Duration (Work/Break)', 'Location', 'Notes'];
    const csvRows = [
      headers.join(','),
      ...allUsersWithStatus.map(user => {
        const rec = attendanceRecords.get(user.id);
        let workDuration = 0;
        let timeInOut = "N/A";
        let durationWorkBreak = "N/A";
        let location = "N/A";
        let notes = "";
        const recordDate = `"${format(date, "PP")}"`;

        if (rec && rec.checkInTime) {
            if (rec.checkOutTime) {
                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
            }
            timeInOut = `"${format(rec.checkInTime.toDate(), "p")} / ${rec.checkOutTime ? format(rec.checkOutTime.toDate(), "p") : '--:--'}"`;
            durationWorkBreak = `"${formatDuration(workDuration)} / ${formatDuration(rec.totalBreakDuration || 0)}"`;
            location = rec.locationCheckInLatitude && rec.locationCheckInLongitude ? `"${rec.locationCheckInLatitude}, ${rec.locationCheckInLongitude}"` : "N/A";
            notes = `"${((rec.checkInNotes || '') + ' ' + (rec.checkOutNotes || '')).trim().replace(/"/g, '""')}"`;
        } else if (user.status === 'On Leave') {
            notes = '"On Approved Leave"';
        } else if (user.status === 'Absent') {
            notes = '"Absent"';
        }

        const row = [
          `"${user.status}"`,
          `"${user.firstName}"`,
          `"${user.lastName}"`,
          `"${user.jobTitle}"`,
          recordDate,
          timeInOut,
          durationWorkBreak,
          location,
          notes,
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `daily_monitor_${format(date, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleShare = (platform: 'email' | 'whatsapp' | 'teams') => {
    if (summary.isLoading) {
      toast({ variant: 'destructive', title: 'Data not ready', description: 'Please wait for the summary to load.' });
      return;
    }

    const reportDate = format(date, 'PPP');
    const generatorName = currentUserData ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : 'System';

    let reportText = `FortuMars - Daily Attendance Summary\n`;
    reportText += `Date: ${reportDate}\n`;
    reportText += `Generated by: ${generatorName}\n\n`;

    const createSection = (title: string, users: UserData[], includeTime: boolean = false) => {
        if (users.length === 0) return '';
        let section = `${title} (${users.length})\n`;
        users.forEach(u => {
            const rec = attendanceRecords.get(u.id);
            const timeIn = rec?.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--';
            const timeOut = rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
            const breakTime = rec?.totalBreakDuration ? formatDuration(rec.totalBreakDuration) : '0m';
            
            const detailStr = includeTime ? ` (In: ${timeIn} / Out: ${timeOut} - Break: ${breakTime})` : '';
            section += `- ${u.firstName} ${u.lastName}${detailStr}\n`;
        });
        return section + '\n';
    };

    reportText += createSection('Present', summary.present, true);
    reportText += createSection('Late', summary.late, true);
    reportText += createSection('Out of Range', summary.outOfRange, true);
    reportText += createSection('Absent', summary.absent);
    reportText += createSection('On Leave', summary.onLeave);

    const encodedText = encodeURIComponent(reportText);

    let url = '';
    if (platform === 'email') {
      url = `mailto:?subject=Daily Attendance Summary - ${reportDate}&body=${encodedText}`;
    } else if (platform === 'whatsapp') {
      const whatsAppNumber = '+916381808782';
      url = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    } else if (platform === 'teams') {
      url = `https://teams.microsoft.com/l/chat/0/0?users=&message=${encodedText}`;
    }
    
    window.open(url, '_blank');
  };

  const handleExportPdf = () => {
    if (summary.isLoading) {
      toast({ variant: 'destructive', title: 'Data not ready', description: 'Please wait for the summary to load.' });
      return;
    }
    
    const doc = new jsPDF();
    const reportDate = format(date, 'PPP');
    const generatorName = currentUserData ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : 'System';

    const addPageContent = (data: any) => {
        // Header
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("FortuMars AI Technologies & Business Solutions.", doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    };

    // First page title and info
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Daily Attendance Summary - ${reportDate}`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated by: ${generatorName}`, 14, 48);

    let finalY = 55;

    const addSection = (title: string, users: UserData[], statusLabel: string, includeTime: boolean = false) => {
      if (users.length > 0) {
        const body = users.map(u => {
            const rec = attendanceRecords.get(u.id);
            const clockIn = (rec && rec.checkInTime && typeof rec.checkInTime.toDate === 'function') ? format(rec.checkInTime.toDate(), 'p') : '--:--';
            const clockOut = (rec && rec.checkOutTime && typeof rec.checkOutTime.toDate === 'function') ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
            const breakTime = (rec && rec.totalBreakDuration) ? formatDuration(rec.totalBreakDuration) : '0m';
            
            const detailLine = includeTime 
                ? `${u.firstName} ${u.lastName} - ${statusLabel} - In: ${clockIn} / Out: ${clockOut} - Break: ${breakTime}`
                : `${u.firstName} ${u.lastName} - ${statusLabel}`;
            
            return [detailLine];
        });

        autoTable(doc, {
          startY: finalY,
          head: [[{ content: `${title} (${users.length})`, styles: { fontStyle: 'bold', fontSize: 12, halign: 'left', fillColor: [240,240,240], textColor: 0 } }]],
          body: [],
          theme: 'plain',
          didDrawPage: addPageContent,
          margin: { top: 50 },
        });

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY,
          head: [['Employee Status Details']],
          body: body,
          theme: 'striped',
          headStyles: { fillColor: [39, 55, 70] },
          didDrawPage: addPageContent,
          margin: { top: 50 },
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;
      }
    };
    
    addSection('Present', summary.present, 'Present', true);
    addSection('Late', summary.late, 'Late', true);
    addSection('Out of Range', summary.outOfRange, 'Out of Range', true);
    addSection('Absent', summary.absent, 'Absent', false);
    addSection('On Leave', summary.onLeave, 'On Leave', false);
    
    addPageContent({ settings: { margin: { left: 14 } } });

    doc.save(`daily_report_${format(date, 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <span>{title}</span>
            <span className="ml-auto text-lg font-semibold">{users.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <div className="space-y-3">
            {users.map(user => (
              <Link href={`/dashboard/analytics?userId=${user.id}`} key={user.id} className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted transition-colors">
                <Avatar className="h-9 w-9">
                  {user.avatar && <span className="text-xl">{user.avatar}</span>}
                  <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user.jobTitle}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No employees in this category today.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader title="Daily Monitor" description={`An overview of employee status for ${format(date, 'MMMM d, yyyy')}.`}>
        <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setDate(new Date())}>Today</Button>
            <Button variant="outline" onClick={() => setDate(subDays(new Date(), 1))}>Yesterday</Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-[240px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={summary.isLoading}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share / Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPdf}>
                        <FileText className="mr-2 h-4 w-4" />
                        Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Share Summary via</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleShare('email')}>
                        <Mail className="mr-2 h-4 w-4"/> 
                        Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                        <MessageSquare className="mr-2 h-4 w-4"/>
                        WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare('teams')}>
                        <Users className="mr-2 h-4 w-4"/>
                        Microsoft Teams
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </PageHeader>
      
      {summary.isLoading ? (
        <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <div className="relative h-16 w-48 animate-pulse">
                    <Image
                      src="https://fortumars.com/fortumarslogo.png"
                      alt="FortuMars Logo"
                      fill
                      style={{ objectFit: 'contain' }}
                      priority
                    />
                </div>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <UserListCard title="Present" users={summary.present} Icon={UserCheck} iconColor="text-green-500" />
          <UserListCard title="Late" users={summary.late} Icon={UserX} iconColor="text-yellow-500" />
          <UserListCard title="Out of Range" users={summary.outOfRange} Icon={AlertTriangle} iconColor="text-orange-500" />
          <UserListCard title="Absent" users={summary.absent} Icon={UserRoundX} iconColor="text-red-500" />
          <UserListCard title="On Leave" users={summary.onLeave} Icon={User} iconColor="text-blue-500" />
        </div>
      )}
    </>
  );
};

export default MonitorPage;
