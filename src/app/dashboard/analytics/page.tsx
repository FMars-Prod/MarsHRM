
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, query, where, orderBy, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { format, subDays, differenceInSeconds, startOfDay, endOfDay, parse, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, differenceInDays } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Download, Calendar as CalendarIcon, Edit, StickyNote, MapPin, RotateCcw, Users, Share2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';
import { type DateRange } from "react-day-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
}

type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName?: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  checkInNotes?: string;
  checkOutNotes?: string;
  locationCheckInLatitude?: number;
  locationCheckInLongitude?: number;
  isOutOfRange?: boolean;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: string;
};

type EditableAttendance = {
    status: 'present' | 'late' | 'absent' | 'on_leave';
    checkInTime: string;
    checkOutTime: string;
    totalBreakDuration: string;
    checkInNotes: string;
    checkOutNotes: string;
}

const chartConfig = {
  work: {
    label: "Work",
    color: "hsl(var(--chart-1))",
  },
  break: {
    label: "Break",
    color: "hsl(var(--chart-2))",
  },
} satisfies React.ComponentProps<typeof ChartContainer>['config'];

type FilterMode = "day" | "month" | "range" | "all";

const AnalyticsPage = () => {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = React.useState<string | 'all'>('all');
  const [date, setDate] = React.useState<Date>(new Date());
  const [month, setMonth] = React.useState<Date | null>(null);
  const [range, setRange] = React.useState<DateRange | undefined>();
  const [filterMode, setFilterMode] = React.useState<FilterMode>("day");

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editableAttendance, setEditableAttendance] = React.useState<EditableAttendance>({
      status: 'present',
      checkInTime: '',
      checkOutTime: '',
      totalBreakDuration: '0',
      checkInNotes: '',
      checkOutNotes: '',
  });

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  const currentUserRole = (currentUserData as any)?.role;
  const isAdmin = currentUserRole === 'CEO/Admin' || currentUserRole === 'HR Manager' || currentUserRole === 'Team Lead';
  
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const selectedUser = selectedUserId !== 'all' ? users?.find(u => u.id === selectedUserId) : null;

  const { start, end } = React.useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;

    switch (filterMode) {
      case 'day':
        start = date ? startOfDay(date) : null;
        end = date ? endOfDay(date) : null;
        break;
      case 'month':
        start = month ? startOfMonth(month) : null;
        end = month ? endOfMonth(month) : null;
        break;
      case 'range':
        start = range?.from ? startOfDay(range.from) : null;
        end = range?.to ? endOfDay(range.to) : (range?.from ? endOfDay(range.from) : null);
        break;
      default:
        start = null;
        end = null;
        break;
    }
    return { start, end };
  }, [date, month, range, filterMode]);
  
  const [attendanceData, setAttendanceData] = React.useState<AttendanceRecord[] | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!firestore || areUsersLoading || !users) return;
      setIsAttendanceLoading(true);

      try {
        let q;
        const startTs = start ? Timestamp.fromDate(start) : null;
        const endTs = end ? Timestamp.fromDate(end) : null;

        if (selectedUserId === 'all') {
          // Global view uses collectionGroup
          if (filterMode === 'all') {
            q = query(collectionGroup(firestore, 'attendances'), orderBy('checkInTime', 'desc'));
          } else if (startTs && endTs) {
            q = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', startTs), where('checkInTime', '<=', endTs), orderBy('checkInTime', 'desc'));
          } else {
            setAttendanceData([]);
            setIsAttendanceLoading(false);
            return;
          }
        } else {
          // Individual view
          const colRef = collection(firestore, `users/${selectedUserId}/attendances`);
          if (filterMode === 'all') {
            q = query(colRef, orderBy('checkInTime', 'desc'));
          } else if (startTs && endTs) {
            q = query(colRef, where('checkInTime', '>=', startTs), where('checkInTime', '<=', endTs), orderBy('checkInTime', 'desc'));
          } else {
            setAttendanceData([]);
            setIsAttendanceLoading(false);
            return;
          }
        }

        const snap = await getDocs(q);
        const records = snap.docs.map(doc => {
          const data = doc.data() as AttendanceRecord;
          const user = users.find(u => u.id === data.employeeId);
          return {
            ...data,
            id: doc.id,
            employeeName: user ? `${user.firstName} ${user.lastName}` : 'Unknown'
          };
        });
        setAttendanceData(records);
      } catch (e: any) {
        console.error("Error fetching analytics data:", e);
        if (e.code === 'failed-precondition') {
            toast({
                variant: 'destructive',
                title: 'Index Required',
                description: 'Organization-wide sorting requires a specific Firestore index. Please click the link in the developer console to enable it.'
            });
        } else {
            toast({ variant: 'destructive', title: 'Data load failed' });
        }
      } finally {
        setIsAttendanceLoading(false);
      }
    };

    fetchData();
  }, [firestore, selectedUserId, start, end, filterMode, users, areUsersLoading, toast]);

  const [leaveData, setLeaveData] = React.useState<LeaveRequest[] | null>(null);
  React.useEffect(() => {
    const fetchLeaves = async () => {
        if (!firestore) return;
        let q = query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved'));
        if (selectedUserId !== 'all') {
            q = query(q, where('employeeId', '==', selectedUserId));
        }
        const snap = await getDocs(q);
        setLeaveData(snap.docs.map(d => ({ ...d.data(), id: d.id } as LeaveRequest)));
    };
    fetchLeaves();
  }, [firestore, selectedUserId]);

  const stats = React.useMemo(() => {
    if (!attendanceData) return { totalHours: '0.0', totalBreakHours: '0.0', totalLeaves: 0, lateDays: 0 };
    let totalWorkSeconds = 0, totalBreakSeconds = 0, lateDays = 0;
    attendanceData.forEach(rec => {
      if (rec.checkInTime && rec.checkOutTime) {
        const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
        totalWorkSeconds += workSeconds - (rec.totalBreakDuration || 0);
        totalBreakSeconds += rec.totalBreakDuration || 0;
      }
      if (rec.status === 'late') lateDays++;
    });

    let onLeaveDays = 0;
    if (leaveData && (start || end || filterMode === 'all')) {
        leaveData.forEach(leave => {
            const leaveStart = leave.startDate.toDate();
            const leaveEnd = leave.endDate.toDate();
            
            if (filterMode === 'all') {
                onLeaveDays += differenceInDays(leaveEnd, leaveStart) + 1;
            } else if(start && end) {
                const interval = { start: leaveStart, end: leaveEnd };
                const daysInPeriod = eachDayOfInterval({start, end});
                daysInPeriod.forEach(day => {
                    if (isWithinInterval(day, interval)) {
                        onLeaveDays++;
                    }
                });
            }
        });
    }

    return {
      totalHours: (totalWorkSeconds / 3600).toFixed(1),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(1),
      totalLeaves: onLeaveDays,
      lateDays,
    };
  }, [attendanceData, leaveData, start, end, filterMode]);
  
  const chartData = React.useMemo(() => {
      if (!attendanceData) return [];
      
      const dataMap = new Map<string, { work: number, break: number }>();
      const last7Days = eachDayOfInterval({ start: startOfDay(subDays(new Date(), 6)), end: endOfDay(new Date()) });
      
      last7Days.forEach(day => dataMap.set(format(day, 'yyyy-MM-dd'), { work: 0, break: 0 }));

      attendanceData.forEach(rec => {
          if (rec.checkInTime) {
              const day = format(rec.checkInTime.toDate(), 'yyyy-MM-dd');
              if (dataMap.has(day)) {
                  let workHours = 0, breakHours = 0;
                  if (rec.checkOutTime) {
                      workHours = (differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0)) / 3600;
                      breakHours = (rec.totalBreakDuration || 0) / 3600;
                  }
                  const existing = dataMap.get(day)!;
                  dataMap.set(day, { work: existing.work + workHours, break: existing.break + breakHours });
              }
          }
      });
      
      return Array.from(dataMap.entries()).map(([date, values]) => ({
          date: format(new Date(date), 'EEE, MMM d'),
          work: parseFloat(values.work.toFixed(2)),
          break: parseFloat(values.break.toFixed(2)),
      }));
  }, [attendanceData]);


  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  const getFilterPeriodText = () => {
    if (filterMode === 'day' && date) return format(date, 'MMM d, yyyy');
    if (filterMode === 'month' && month) return format(month, 'MMMM yyyy');
    if (filterMode === 'range' && range?.from) {
        if (range.to) {
            return `${format(range.from, "LLL dd, y")} - ${format(range.to, "LLL dd, y")}`;
        }
        return format(range.from, "LLL dd, y");
    }
    if (filterMode === 'all') return 'All time';
    return 'Selected period';
  }

  const handleExport = () => {
    if (!attendanceData || attendanceData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    const headers = ['Employee', 'Date', 'Time (In/Out)', 'Duration (Work/Break)', 'Status', 'Location', 'Notes'];
    const csvRows = [
        headers.join(','),
        ...attendanceData.map(rec => {
            let workDuration = 0;
            if (rec.checkInTime && rec.checkOutTime) {
                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
            }

            const timeInOut = rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "p")} / ${rec.checkOutTime ? format(rec.checkOutTime.toDate(), "p") : '--:--'}"` : "N/A";
            const durationWorkBreak = `"${formatDuration(workDuration)} / ${formatDuration(rec.totalBreakDuration || 0)}"`;
            const location = rec.locationCheckInLatitude && rec.locationCheckInLongitude ? `"${rec.locationCheckInLatitude}, ${rec.locationCheckInLongitude}"` : "N/A";
            const statusStr = rec.isOutOfRange ? `${rec.status} (Out of Range)` : rec.status;
            const notes = `"${((rec.checkInNotes || '') + ' ' + (rec.checkOutNotes || '')).trim().replace(/"/g, '""')}"`;


            const row = [
                `"${rec.employeeName}"`,
                rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "PP")}"` : "N/A",
                timeInOut,
                durationWorkBreak,
                `"${statusStr}"`,
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
    
    let datePart = 'data';
    if (filterMode === 'day' && date) {
        datePart = format(date, 'yyyy-MM-dd');
    } else if (filterMode === 'month' && month) {
        datePart = format(month, 'yyyy-MM');
    } else if (filterMode === 'range' && range?.from) {
        const fromDate = format(range.from, 'yyyy-MM-dd');
        const toDate = range.to ? format(range.to, 'yyyy-MM-dd') : fromDate;
        datePart = `${fromDate}_to_${toDate}`;
    } else if (filterMode === 'all') {
        datePart = 'all_time';
    }


    link.setAttribute('download', `FortuMars_FullAttendanceReport_${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportPdf = () => {
    if (!attendanceData || attendanceData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    
    const doc = new jsPDF();
    const reportDate = format(new Date(), 'PPP');
    const period = getFilterPeriodText();
    const employeeName = selectedUserId === 'all' ? 'Organization Overview' : `${selectedUser?.firstName} ${selectedUser?.lastName}`;

    const addPageContent = (data: any) => {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("FortuMars AI Technologies & Business Solutions.", doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
    };

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Attendance Analytics Report - ${reportDate}`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Employee: ${employeeName}`, 14, 48);
    doc.text(`Period: ${period}`, 14, 53);

    // Add Stats Summary
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Summary Stats", 14, 62);
    doc.setFontSize(9);
    doc.text(`Total Work Hours: ${stats.totalHours} hrs`, 14, 68);
    doc.text(`Total Break Time: ${stats.totalBreakHours} hrs`, 70, 68);
    doc.text(`Late Days: ${stats.lateDays}`, 130, 68);
    doc.text(`Leaves: ${stats.totalLeaves}`, 170, 68);

    const headers = [['Employee', 'Date', 'Time (In/Out)', 'Duration (Work/Break)', 'Status', 'Notes']];
    const body = attendanceData.map(rec => {
        let workDuration = 0;
        if (rec.checkInTime && rec.checkOutTime) {
            workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
        }
        
        const timeIn = rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--';
        const timeOut = rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
        const statusStr = rec.isOutOfRange ? `${rec.status} (Out of Range)` : rec.status;
        const notes = ((rec.checkInNotes || '') + ' ' + (rec.checkOutNotes || '')).trim();

        return [
            rec.employeeName || 'N/A',
            rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A',
            `${timeIn} / ${timeOut}`,
            `${formatDuration(workDuration)} / ${formatDuration(rec.totalBreakDuration || 0)}`,
            statusStr,
            notes
        ];
    });

    autoTable(doc, {
        startY: 75,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [39, 55, 70] },
        styles: { fontSize: 8 },
        columnStyles: {
            5: { cellWidth: 40 }
        },
        didDrawPage: addPageContent,
        margin: { top: 50 },
    });

    addPageContent({ settings: { margin: { left: 14 } } });

    doc.save(`Attendance_Report_${employeeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleAttendanceUpdate = () => {
      if (selectedUserId === 'all' || !date) return;

      const attendanceId = format(date, 'yyyy-MM-dd');
      const attendanceRef = doc(firestore, `users/${selectedUserId}/attendances/${attendanceId}`);
      
      const checkInDateTime = editableAttendance.checkInTime ? parse(editableAttendance.checkInTime, 'HH:mm', date) : null;
      const checkOutDateTime = editableAttendance.checkOutTime ? parse(editableAttendance.checkOutTime, 'HH:mm', date) : null;

      const payload: any = {
          id: attendanceId,
          employeeId: selectedUserId,
          status: editableAttendance.status,
          checkInTime: checkInDateTime ? Timestamp.fromDate(checkInDateTime) : null,
          checkOutTime: checkOutDateTime ? Timestamp.fromDate(checkOutDateTime) : null,
          totalBreakDuration: parseInt(editableAttendance.totalBreakDuration) * 60 || 0,
          checkInNotes: editableAttendance.checkInNotes,
          checkOutNotes: editableAttendance.checkOutNotes,
      };

      setDocumentNonBlocking(attendanceRef, payload, { merge: true });
      toast({ title: "Attendance Updated", description: "The record has been saved." });
      setIsEditDialogOpen(false);
  }

  const handleResetDay = () => {
    if (selectedUserId === 'all' || !date) return;
    const attendanceId = format(date, 'yyyy-MM-dd');
    const attendanceRef = doc(firestore, `users/${selectedUserId}/attendances/${attendanceId}`);
    deleteDocumentNonBlocking(attendanceRef);
    toast({ title: "Day Reset", description: `Attendance for ${selectedUser?.firstName} on ${format(date, "PPP")} has been reset.` });
    setIsEditDialogOpen(false);
  }
  
  return (
    <>
      <PageHeader title="Employee Analytics" description="Analyze performance and attendance across the entire organization." />

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="w-full sm:w-auto sm:min-w-64">
            <Select onValueChange={(val) => setSelectedUserId(val as any)} value={selectedUserId}>
                <SelectTrigger>
                    <SelectValue placeholder={areUsersLoading ? "Loading users..." : "Select an employee"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {users?.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filterMode === 'day' && date && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'} onClick={() => { setDate(new Date()); setFilterMode('day'); }}>Today</Button>
          <Button variant={filterMode === 'day' && date && format(date, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'} onClick={() => { setDate(subDays(new Date(), 1)); setFilterMode('day'); }}>Yesterday</Button>
           <Button variant={filterMode === 'month' && month && format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 'default' : 'outline'} onClick={() => { setMonth(new Date()); setFilterMode('month'); }}>This Month</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant={"outline"} className={cn("w-full md:w-[200px] justify-start text-left font-normal", filterMode !== 'day' && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date && filterMode === 'day' ? format(date, "MMMM do, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => { if(d) { setDate(d); setFilterMode('day'); } }} initialFocus />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
                <Button id="daterange" variant={"outline"} className={cn("w-full md:w-[280px] justify-start text-left font-normal", filterMode !== 'range' && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range?.from ? (
                        range.to ? (
                            <>{format(range.from, "LLL dd")} - {format(range.to, "LLL dd, y")}</>
                        ) : (
                            format(range.from, "LLL dd, y")
                        )
                    ) : (
                        <span>Pick a date range</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={range?.from}
                    selected={range}
                    onSelect={(r) => {
                        setRange(r);
                        setFilterMode('range');
                    }}
                    numberOfMonths={2}
                />
            </PopoverContent>
          </Popover>
          <Button variant={filterMode === 'all' ? 'default' : 'outline'} onClick={() => setFilterMode('all')}>{filterMode === 'all' ? "Viewing Full History" : "View Full History"}</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && selectedUserId !== 'all' && filterMode === 'day' && (
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="secondary">
                            <Edit className="mr-2 h-4 w-4"/>
                            Edit Attendance
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Attendance for {selectedUser?.firstName}</DialogTitle>
                            <DialogDescription>
                                Manually adjust the record for {date && format(date, "PPP")}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="check-in">Clock In Time</Label>
                                    <Input id="check-in" type="time" value={editableAttendance.checkInTime} onChange={(e) => setEditableAttendance(prev => ({...prev, checkInTime: e.target.value}))}/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="check-out">Clock Out Time</Label>
                                    <Input id="check-out" type="time" value={editableAttendance.checkOutTime} onChange={(e) => setEditableAttendance(prev => ({...prev, checkOutTime: e.target.value}))}/>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="break">Total Break (minutes)</Label>
                                <Input id="break" type="number" value={editableAttendance.totalBreakDuration} onChange={(e) => setEditableAttendance(prev => ({...prev, totalBreakDuration: e.target.value}))}/>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select value={editableAttendance.status} onValueChange={(value) => setEditableAttendance(prev => ({...prev, status: value as any}))}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="present">Present</SelectItem>
                                        <SelectItem value="late">Late</SelectItem>
                                        <SelectItem value="absent">Absent</SelectItem>
                                        <SelectItem value="on_leave">On Leave</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="checkin-notes">Clock In Notes</Label>
                                <Textarea id="checkin-notes" value={editableAttendance.checkInNotes} onChange={(e) => setEditableAttendance(prev => ({...prev, checkInNotes: e.target.value}))} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="checkout-notes">Clock Out Notes</Label>
                                <Textarea id="checkout-notes" value={editableAttendance.checkOutNotes} onChange={(e) => setEditableAttendance(prev => ({...prev, checkOutNotes: e.target.value}))} />
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-between">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <RotateCcw className="mr-2 h-4 w-4"/>
                                        Reset Day
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will delete the attendance record for {selectedUser?.firstName} on {date ? format(date, 'PPP') : 'this day'}. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetDay}>Confirm Reset</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <div className="flex gap-2">
                              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                              <Button onClick={handleAttendanceUpdate}>Save Changes</Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={isAttendanceLoading || !attendanceData || attendanceData.length === 0}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        CSV for Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPdf}>
                        <FileText className="mr-2 h-4 w-4" />
                        PDF Document
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {isAttendanceLoading ? (
         <div className="border rounded-lg p-6 min-h-[400px] flex items-center justify-center">
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
                <p>Syncing attendance records...</p>
            </div>
        </div>
      ) : (
      <div className="grid gap-6">
        {selectedUserId === 'all' ? (
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className="p-3 bg-primary text-primary-foreground rounded-lg">
                        <Users className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl">Organization Overview</CardTitle>
                        <CardDescription>Aggregated analytics for all active employees.</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        ) : selectedUser && (
          <Card>
            <CardHeader className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-4 space-y-0 p-4 sm:p-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback>{selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{selectedUser.firstName} {selectedUser.lastName}</CardTitle>
                <CardDescription>{selectedUser.jobTitle} - {selectedUser.department}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Work Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalHours} hrs</div>
                    <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Break Time</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalBreakHours} hrs</div>
                     <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Leaves</CardTitle>
                    <CalendarOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeaves}</div>
                    <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Late Days</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lateDays}</div>
                     <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Last 7 Days Work Hours</CardTitle>
                        <CardDescription>Work vs. Break hours for the past week.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                       <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                            <BarChart accessibilityLayer data={chartData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 3)} />
                                <YAxis unit="h" />
                                 <ChartTooltip 
                                    cursor={false}
                                    content={<ChartTooltipContent formatter={(value) => `${(value as number).toFixed(1)}h`} />}
                                />
                                <Bar dataKey="work" fill="var(--color-work)" radius={[4, 4, 0, 0]} name="Work" />
                                <Bar dataKey="break" fill="var(--color-break)" radius={[4, 4, 0, 0]} name="Break" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-3">
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                            <CardTitle>Attendance Log</CardTitle>
                            <CardDescription>{filterMode === 'all' ? "Full history." : `Activity for ${getFilterPeriodText()}.`}</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={isAttendanceLoading || !attendanceData || attendanceData.length === 0}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Log
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExport}>
                                    CSV for Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportPdf}>
                                    PDF Document
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                        <TooltipProvider>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {selectedUserId === 'all' && <TableHead>Employee</TableHead>}
                                            <TableHead>Date</TableHead>
                                            <TableHead>Time (In/Out)</TableHead>
                                            <TableHead>Duration (Work/Break)</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceData?.map((rec) => {
                                            let workDuration = 0;
                                            if (rec.checkInTime && rec.checkOutTime) {
                                                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                                            }
                                            const notes = (rec.checkInNotes ? `In: ${rec.checkInNotes}` : '') + 
                                                          (rec.checkOutNotes ? `\nOut: ${rec.checkOutNotes}` : '');
                                            
                                            return (
                                            <TableRow key={`${rec.employeeId}-${rec.id}`}>
                                                {selectedUserId === 'all' && <TableCell className="font-medium whitespace-nowrap">{rec.employeeName}</TableCell>}
                                                <TableCell className="font-medium whitespace-nowrap">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div>{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</div>
                                                    <div>{rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>{formatDuration(workDuration)}</div>
                                                    <div className="text-xs text-muted-foreground">{formatDuration(rec.totalBreakDuration || 0)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                rec.status === 'present' && 'text-green-600 border-green-600/50',
                                                                rec.status === 'late' && 'text-yellow-600 border-yellow-600/50',
                                                                rec.status === 'absent' && 'text-red-600 border-red-600/50',
                                                                rec.status === 'on_leave' && 'text-blue-600 border-blue-600/50',
                                                            )}
                                                        >{rec.status}</Badge>
                                                        {rec.isOutOfRange && (
                                                            <Badge variant="destructive" className="text-[10px] py-0 h-4 px-1.5 font-normal">Out of Range</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                  {rec.locationCheckInLatitude && rec.locationCheckInLongitude ? (
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank" rel="noopener noreferrer">
                                                            <MapPin className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                                                        </Link>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>View on Google Maps</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  ) : (
                                                    <span className="text-muted-foreground/50">-</span>
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                    {notes.trim() ? (
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <StickyNote className="h-5 w-5 text-muted-foreground" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="whitespace-pre-wrap max-w-xs">{notes.trim()}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <span className="text-muted-foreground/50">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                        </TooltipProvider>
                         {(!attendanceData || attendanceData.length === 0) && (
                            <div className="text-center py-10 text-muted-foreground">
                                No attendance records found for this period.
                            </div>
                         )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
      )}
    </>
  );
};

export default AnalyticsPage;
