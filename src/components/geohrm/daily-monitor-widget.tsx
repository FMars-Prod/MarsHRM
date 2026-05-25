'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, differenceInSeconds } from 'date-fns';
import { Building2, User, UserCheck, UserCheck as UserCheckIcon, UserX, UserRoundX, Download, Share2, Mail, MessageSquare, Users, FileText, AlertTriangle, Phone, Home, MapPin, ChevronRight, LayoutGrid, Activity, ShieldCheck, Clock } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

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

  const handleNudgeWhatsApp = (member: UserData, nudgeType?: 'missing_login' | 'missing_logout') => {
      if (!member.phoneNumber) {
          toast({ variant: 'destructive', title: 'No phone number', description: 'Please add a phone number in User Management.' });
          return;
      }
      
      const message = nudgeType === 'missing_login' 
        ? `Hello ${member.firstName}, you haven't clocked in today. Please log in to MarsHRM now.`
        : `Hello ${member.firstName}, please don't forget to update your work report and clock out.`;
      
      const cleanNumber = member.phoneNumber.replace(/\D/g, '');
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
    addSection('Late', summary.late, 'Late', true);
    addSection('Out of Range', summary.outOfRange, 'Out of Range', true);
    addSection('Absent', summary.absent, 'Absent', false);
    addSection('On Leave', summary.onLeave, 'On Leave', false);
    
    addPageContent({ settings: { margin: { left: 14 } } });

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

  const isUrl = (str?: string) => str && str.startsWith('http');

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
                    <div className="flex gap-2 w-full sm:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={summary.isLoading} className="rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50 flex-1 sm:flex-none">
                                    <Share2 className="mr-2 h-3.5 w-3.5" />
                                    Dispatch Report
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl p-2 w-64">
                                <DropdownMenuItem onClick={handleExport} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><Download className="size-3.5" /> Sector Audit CSV</DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportPdf} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><FileText className="size-3.5" /> Sector Audit PDF</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black uppercase opacity-40">Tactical Sharing</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleShare('email')} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><Mail className="size-3.5"/> Email Registry</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare('whatsapp')} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><MessageSquare className="size-3.5"/> WhatsApp Comms</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleShare('teams')} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><Users className="size-3.5"/> MS Teams Channel</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
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

            <div className="px-8 pb-8 pt-0 border-t border-dashed border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                <div className="flex items-center gap-3 pt-6">
                    <div className="flex -space-x-2">
                        {summary.present.slice(0, 3).map(u => (
                            <Avatar key={u.id} className="size-6 border-2 border-white ring-1 ring-border/20 shadow-sm">
                                <AvatarImage src={u.avatar} />
                                <AvatarFallback className="text-[8px] font-black">{u.firstName?.[0]}</AvatarFallback>
                            </Avatar>
                        ))}
                        {summary.present.length > 3 && (
                            <div className="size-6 rounded-full bg-muted border-2 border-white ring-1 ring-border/20 flex items-center justify-center text-[7px] font-black">
                                +{summary.present.length - 3}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {summary.present.length} units online in current sector
                    </p>
                </div>
                <div className="flex items-center gap-2 pt-6">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-black uppercase rounded-full px-3 h-6">
                        <ShieldCheck className="size-2.5 mr-1.5" /> Tactical Verification Active
                    </Badge>
                </div>
            </div>
        </Card>

        {sheetContent && (
            <SheetContent className="flex flex-col rounded-l-[3rem] border-none shadow-2xl w-full sm:max-w-lg p-0 overflow-hidden font-open-sans">
                <SheetHeader className="p-8 border-b bg-white/80 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <SheetTitle className={cn("text-2xl font-black uppercase tracking-tighter", sheetContent.color)}>{sheetContent.title}</SheetTitle>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Fleet Roster Audit • {format(new Date(), 'PP')}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full h-8 px-4 font-black uppercase text-[10px] bg-muted/20 border-none">
                            {sheetContent.users.length} Records
                        </Badge>
                    </div>
                </SheetHeader>
                <ScrollArea className="flex-1 bg-secondary/5">
                  <div className="p-8 space-y-4">
                     {sheetContent.users.length > 0 ? (
                        sheetContent.users.map(member => {
                            const rec = attendanceRecords.get(member.id);
                            return (
                                <Card key={member.id} className="border-none ring-1 ring-border/50 rounded-2xl hover:shadow-lg transition-all duration-300 group overflow-hidden bg-white">
                                    <div className="p-5 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <Link href={`/dashboard/users/${member.id}`} className="flex items-center gap-4 flex-1">
                                                <Avatar className="h-12 w-12 rounded-xl ring-1 ring-border group-hover:ring-primary/20 transition-all shadow-sm">
                                                    {member.avatar ? (
                                                        isUrl(member.avatar) ? (
                                                            <AvatarImage src={member.avatar} className="object-cover" />
                                                        ) : (
                                                            <div className="h-full w-full bg-primary/5 flex items-center justify-center text-2xl">{member.avatar}</div>
                                                        )
                                                    ) : <AvatarFallback className="font-bold">{(member.firstName?.[0] || 'U')}{(member.lastName?.[0] || '')}</AvatarFallback>}
                                                </Avatar>
                                                <div>
                                                    <p className="font-black text-sm group-hover:text-primary transition-colors">{(member.firstName || 'Unknown')} {(member.lastName || '')}</p>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{member.jobTitle || 'Fleet Member'}</p>
                                                </div>
                                            </Link>
                                            <div className="flex gap-2">
                                                {rec?.locationCheckInLatitude && (
                                                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary hover:bg-primary/10 shadow-sm border">
                                                        <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                            <MapPin className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                )}
                                                {sheetContent.nudgeType && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50 shadow-sm border border-green-100"
                                                        onClick={() => handleNudgeWhatsApp(member, sheetContent.nudgeType)}
                                                    >
                                                        <Phone className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <div className="p-3 bg-muted/20 rounded-xl space-y-1">
                                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Clock In</p>
                                                <p className="font-mono text-xs font-bold text-foreground/80">{rec?.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</p>
                                            </div>
                                            <div className="p-3 bg-muted/20 rounded-xl space-y-1">
                                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Clock Out</p>
                                                <p className="font-mono text-xs font-bold text-foreground/80">{rec?.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</p>
                                            </div>
                                        </div>

                                        {rec?.checkInNotes && (
                                            <div className="mt-1 flex gap-3 p-4 rounded-xl bg-orange-50/30 border border-orange-100/50">
                                                <FileText className="size-4 text-orange-600 shrink-0" />
                                                <p className="text-[11px] italic font-medium leading-relaxed text-orange-900/70 line-clamp-2">
                                                    "{rec.checkInNotes}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })
                    ) : (
                        <div className="py-20 text-center opacity-30 grayscale flex flex-col items-center">
                            <LayoutGrid className="size-12 mb-4" />
                            <p className="font-black uppercase text-[11px] tracking-[0.3em]">Sector Empty</p>
                        </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-8 border-t bg-white">
                    <Button variant="outline" className="w-full rounded-full h-14 font-black uppercase text-[10px] tracking-widest shadow-lg" asChild>
                        <Link href="/dashboard/analytics">Download Sector Audit</Link>
                    </Button>
                </div>
            </SheetContent>
        )}
    </Sheet>
  );
};