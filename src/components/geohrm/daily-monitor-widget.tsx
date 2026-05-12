
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, differenceInSeconds } from 'date-fns';
import { Building2, User, UserCheck, UserX, UserRoundX, Download, Share2, Mail, MessageSquare, Users, FileText, AlertTriangle, Phone, Home, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';


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
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[], nudgeType?: 'missing_login' | 'missing_logout' } | null>(null);

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

        users.forEach(u => {
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
          atHome: atHomeUsers,
          isLoading: false,
        });
      } catch (error: any) {
        console.error("Widget monitor error:", error);
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchMonitorData();
  }, [users, usersLoading, firestore]);
  
  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleExport = () => {
    const { present, late, absent, onLeave, outOfRange, atHome, isLoading } = summary;
    if (isLoading || (!present.length && !late.length && !absent.length && !onLeave.length && !outOfRange.length && !atHome.length)) {
      toast({ variant: "destructive", title: "No data to export" });
      return;
    }

    const allUsersWithStatus = [
      ...present.map(u => ({ ...u, status: 'Present' })),
      ...late.map(u => ({ ...u, status: 'Late' })),
      ...outOfRange.map(u => ({ ...u, status: 'Out of Range' })),
      ...atHome.map(u => ({ ...u, status: 'At Home' })),
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
        const recordDate = `"${format(new Date(), "PP")}"`;

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
    link.setAttribute('download', `daily_monitor_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleShare = (platform: 'email' | 'whatsapp' | 'teams') => {
    if (summary.isLoading) {
      toast({ variant: 'destructive', title: 'Data not ready' });
      return;
    }

    const reportDate = format(new Date(), 'PPP');
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
    reportText += createSection('Logged in at Home', summary.atHome, true);
    reportText += createSection('Late', summary.late, true);
    reportText += createSection('Out of Range', summary.outOfRange, true);
    reportText += createSection('Absent', summary.absent);
    reportText += createSection('On Leave', summary.onLeave);

    const encodedText = encodeURIComponent(reportText);

    let url = '';
    if (platform === 'email') {
      url = `mailto:?subject=Daily Attendance Summary&body=${encodedText}`;
    } else if (platform === 'whatsapp') {
      url = `https://wa.me/?text=${encodedText}`;
    } else if (platform === 'teams') {
      url = `https://teams.microsoft.com/l/chat/0/0?users=&message=${encodedText}`;
    }
    
    window.open(url, '_blank');
  };

  const handleNudgeWhatsApp = (user: UserData, nudgeType?: 'missing_login' | 'missing_logout') => {
      if (!user.phoneNumber) {
          toast({ variant: 'destructive', title: 'No phone number', description: 'Please add a phone number in User Management.' });
          return;
      }
      
      const message = nudgeType === 'missing_login' 
        ? `Hello ${user.firstName}, you haven't clocked in today. Please log in to MarsHRM now.`
        : `Hello ${user.firstName}, please don't forget to update your work report and clock out.`;
      
      const cleanNumber = user.phoneNumber.replace(/\D/g, '');
      const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleExportPdf = () => {
    if (summary.isLoading) {
      toast({ variant: 'destructive', title: 'Data not ready' });
      return;
    }
    
    const pdfDoc = new jsPDF();
    const now = new Date();
    const reportDate = format(now, 'PPP');
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
            const clockIn = (rec && rec.checkInTime && typeof rec.checkInTime.toDate === 'function') ? format(rec.checkInTime.toDate(), 'p') : '--:--';
            const clockOut = (rec && rec.checkOutTime && typeof rec.checkOutTime.toDate === 'function') ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
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
          head: [['Employee Status Details']],
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
    addSection('Logged in at Home', summary.atHome, 'At Home', true);
    addSection('Late', summary.late, 'Late', true);
    addSection('Out of Range', summary.outOfRange, 'Out of Range', true);
    addSection('Absent', summary.absent, 'Absent', false);
    addSection('On Leave', summary.onLeave, 'On Leave', false);
    
    addPageContent({ settings: { margin: { left: 14 } } });

    pdfDoc.save(`daily_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const UserListCard = ({ title, users, Icon, iconColor, onClick, gradient }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; onClick: () => void; gradient: string }) => (
    <Card className={cn("hover:bg-muted/50 transition-all duration-300 cursor-pointer hover:shadow-md border-none ring-1 ring-border/50", gradient)} onClick={onClick}>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-white/50", iconColor)}>
                <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">{title}</span>
            <span className="ml-auto text-xl font-bold">{users.length}</span>
        </CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
        <Card className="animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline text-xl">Daily Team Monitor</CardTitle>
                        <CardDescription>A real-time overview of your team's status for today, {format(new Date(), 'MMMM d')}.</CardDescription>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={summary.isLoading} className="bg-white/50">
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
            </CardHeader>
            <CardContent>
            {summary.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                    <Building2 className="h-10 w-10 animate-pulse text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <SheetTrigger asChild>
                    <UserListCard 
                        title="Present" 
                        users={summary.present} 
                        Icon={UserCheck} 
                        iconColor="text-green-600" 
                        gradient="bg-gradient-to-br from-green-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "Present (In-Office)", users: summary.present})} 
                    />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard 
                        title="Logged at Home" 
                        users={summary.atHome} 
                        Icon={Home} 
                        iconColor="text-blue-600" 
                        gradient="bg-gradient-to-br from-blue-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "WFH Log-ins", users: summary.atHome})} 
                    />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard 
                        title="Late" 
                        users={summary.late} 
                        Icon={UserX} 
                        iconColor="text-yellow-600" 
                        gradient="bg-gradient-to-br from-yellow-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "Arrived Late", users: summary.late})} 
                    />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard 
                        title="Out of Range" 
                        users={summary.outOfRange} 
                        Icon={AlertTriangle} 
                        iconColor="text-orange-600" 
                        gradient="bg-gradient-to-br from-orange-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "Out of Range", users: summary.outOfRange})} 
                    />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard 
                        title="Absent" 
                        users={summary.absent} 
                        Icon={UserRoundX} 
                        iconColor="text-red-600" 
                        gradient="bg-gradient-to-br from-red-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "Absent Today", users: summary.absent, nudgeType: 'missing_login'})} 
                    />
                  </SheetTrigger>
                   <SheetTrigger asChild>
                    <UserListCard 
                        title="On Leave" 
                        users={summary.onLeave} 
                        Icon={User} 
                        iconColor="text-slate-600" 
                        gradient="bg-gradient-to-br from-slate-500/10 to-white/50"
                        onClick={() => setSheetContent({title: "On Leave", users: summary.onLeave})} 
                    />
                   </SheetTrigger>
                </div>
            )}
            </CardContent>
        </Card>

        {sheetContent && (
            <SheetContent className="flex flex-col">
                <SheetHeader>
                    <SheetTitle>{sheetContent.title} ({sheetContent.users.length})</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 -mx-6">
                  <div className="py-4 px-6 space-y-3">
                     {sheetContent.users.length > 0 ? (
                        sheetContent.users.map(user => {
                            const rec = attendanceRecords.get(user.id);
                            return (
                                <div key={user.id} className="flex flex-col p-3 rounded-2xl hover:bg-muted transition-colors border group">
                                    <div className="flex items-center justify-between">
                                        <Link href={`/dashboard/users/${user.id}`} className="flex items-center gap-3 flex-1">
                                            <Avatar className="h-9 w-9">
                                                {user.avatar && <span className="text-xl">{user.avatar}</span>}
                                                <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                                                <p className="text-xs text-muted-foreground">{user.jobTitle}</p>
                                            </div>
                                        </Link>
                                        <div className="flex gap-2">
                                            {rec?.locationCheckInLatitude && (
                                                <Button asChild variant="ghost" size="icon" className="text-primary hover:bg-primary/10">
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                        <MapPin className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}
                                            {sheetContent.nudgeType && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleNudgeWhatsApp(user, sheetContent.nudgeType)}
                                                    title="Nudge via WhatsApp"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {rec?.checkInNotes && (
                                        <p className="mt-2 text-[10px] italic text-muted-foreground bg-white/50 p-2 rounded-lg border border-dashed">
                                            "{rec.checkInNotes}"
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No employees in this category.</p>
                    )}
                  </div>
                </ScrollArea>
            </SheetContent>
        )}
    </Sheet>
  );
};
