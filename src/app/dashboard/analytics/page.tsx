'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, differenceInSeconds, startOfDay, endOfDay, parse, startOfMonth, endOfMonth, eachDayOfInterval, min, max, isBefore } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Download, Calendar as CalendarIcon, Edit, StickyNote, MapPin, RotateCcw, Share2, FileText, Sun, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';

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
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'holiday' | 'non_compliance';
  checkInNotes?: string;
  checkOutNotes?: string;
  locationCheckInLatitude?: number;
  locationCheckInLongitude?: number;
  isOutOfRange?: boolean;
};

type EditableAttendance = {
    status: 'present' | 'late' | 'absent' | 'on_leave';
    checkInTime: string;
    checkOutTime: string;
    totalBreakDuration: string;
    checkInNotes: string;
    checkOutNotes: string;
}

type FilterMode = "day" | "month" | "range" | "all";

const ENABLE_MANUAL_EDIT = false;

const AnalyticsPage = () => {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [date, setDate] = React.useState<Date>(new Date());
  const [month, setMonth] = React.useState<Date | null>(null);
  const [range, setRange] = React.useState<DateRange | undefined>();
  const [filterMode, setFilterMode] = React.useState<FilterMode>("day");

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingDate, setEditingDate] = React.useState<Date | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<string | null>(null);
  const [editingEmployeeName, setEditingEmployeeName] = React.useState("");
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
  const userRole = (currentUserData as any)?.role;
  const isAdmin = userRole === 'CEO/Admin' || userRole === 'HR Manager' || userRole === 'Team Lead';
  
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  React.useEffect(() => {
    if (!selectedUserId && users && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const selectedUser = users?.find(u => u.id === selectedUserId) || null;

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
      if (!firestore || areUsersLoading || !users || !selectedUserId) return;
      setIsAttendanceLoading(true);

      try {
        let q;
        const startTs = start ? Timestamp.fromDate(start) : null;
        const endTs = end ? Timestamp.fromDate(end) : null;

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

        const snap = await getDocs(q);
        const records = snap.docs.map(doc => {
          const data = doc.data() as AttendanceRecord;
          const user = users.find(u => u.id === data.employeeId);
          
          const recordDate = data.checkInTime?.toDate() || new Date(data.id);
          const isPastDate = isBefore(startOfDay(recordDate), startOfDay(new Date()));
          const hasCheckInNoCheckOut = data.checkInTime && !data.checkOutTime;
          
          return {
            ...data,
            id: doc.id,
            employeeName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            status: (isPastDate && hasCheckInNoCheckOut) ? 'non_compliance' : data.status
          };
        });
        setAttendanceData(records);
      } catch (e: any) {
        console.error("Error fetching analytics data:", e);
        toast({ variant: 'destructive', title: 'Data load failed' });
      } finally {
        setIsAttendanceLoading(false);
      }
    };

    fetchData();
  }, [firestore, selectedUserId, start, end, filterMode, users, areUsersLoading, toast]);

  const mergedData = React.useMemo(() => {
    if (!attendanceData || !users || !selectedUser) return null;
    
    let rangeStart = start;
    let rangeEnd = end;

    if (filterMode === 'all' && attendanceData.length > 0) {
        const timestamps = attendanceData.map(a => a.checkInTime?.toDate()).filter(Boolean) as Date[];
        if (timestamps.length > 0) {
            rangeStart = startOfDay(min(timestamps));
            rangeEnd = endOfDay(max(timestamps));
        }
    }

    if (!rangeStart || !rangeEnd) return attendanceData;

    const daysInPeriod = eachDayOfInterval({start: rangeStart, end: rangeEnd});
    const result: AttendanceRecord[] = [];
    
    const attendanceMap = new Map<string, AttendanceRecord>();
    attendanceData.forEach(a => {
        const dayStr = format(a.checkInTime?.toDate() || new Date(a.id), 'yyyy-MM-dd');
        attendanceMap.set(dayStr, a);
    });

    daysInPeriod.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const existing = attendanceMap.get(dayStr);
        
        if (existing) {
            result.push(existing);
        } else {
            const isSunday = day.getDay() === 0;
            result.push({
                id: dayStr,
                employeeId: selectedUser.id,
                employeeName: `${selectedUser.firstName} ${selectedUser.lastName}`,
                status: isSunday ? 'holiday' : 'on_leave',
                checkInTime: Timestamp.fromDate(day),
            } as any);
        }
    });
    
    return result.sort((a, b) => (b.checkInTime?.toMillis() || 0) - (a.checkInTime?.toMillis() || 0));
  }, [attendanceData, start, end, filterMode, selectedUser, users]);

  const stats = React.useMemo(() => {
    if (!mergedData) return { totalHours: '0.0', totalBreakHours: '0.0', totalLeaves: 0, lateDays: 0, totalHolidays: 0, nonCompliance: 0 };
    
    let totalWorkSeconds = 0, totalBreakSeconds = 0, lateDays = 0, onLeaveDays = 0, holidayDays = 0, nonCompliance = 0;
    
    mergedData.forEach(rec => {
      if (rec.status === 'present' || rec.status === 'late') {
          if (rec.checkInTime && rec.checkOutTime) {
            const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
            totalWorkSeconds += workSeconds - (rec.totalBreakDuration || 0);
            totalBreakSeconds += rec.totalBreakDuration || 0;
          }
          if (rec.status === 'late') lateDays++;
      } else if (rec.status === 'on_leave') {
          onLeaveDays++;
      } else if (rec.status === 'holiday') {
          holidayDays++;
      } else if (rec.status === 'non_compliance') {
          nonCompliance++;
      }
    });

    return {
      totalHours: (totalWorkSeconds / 3600).toFixed(1),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(1),
      totalLeaves: onLeaveDays,
      lateDays,
      totalHolidays: holidayDays,
      nonCompliance
    };
  }, [mergedData]);

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
            return `${format(range.from, "LLL dd")} - ${format(range.to, "LLL dd, y")}`;
        }
        return format(range.from, "LLL dd, y");
    }
    if (filterMode === 'all') return 'All time';
    return 'Selected period';
  }

  const handleExport = () => {
    if (!mergedData || mergedData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    const headers = ['Employee', 'Date', 'Time (In/Out)', 'Duration (Work/Break)', 'Status', 'Location', 'Notes'];
    const csvRows = [
        headers.join(','),
        ...mergedData.map(rec => {
            let workDuration = 0;
            if (rec.checkInTime && rec.checkOutTime) {
                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
            }

            const isPresent = rec.status === 'present' || rec.status === 'late';
            const timeInOut = isPresent && rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "p")} / ${rec.checkOutTime ? format(rec.checkOutTime.toDate(), "p") : '--:--'}"` : "N/A";
            const durationWorkBreak = !isPresent ? "N/A" : `"${formatDuration(workDuration)} / ${formatDuration(rec.totalBreakDuration || 0)}"`;
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

    link.setAttribute('download', `AttendanceReport_${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportPdf = () => {
    if (!mergedData || mergedData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    
    const doc = new jsPDF();
    const reportDate = format(new Date(), 'PPP');
    const period = getFilterPeriodText();
    const employeeName = `${selectedUser?.firstName} ${selectedUser?.lastName}`;

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

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Summary Stats", 14, 62);
    doc.setFontSize(9);
    doc.text(`Total Work Hours: ${stats.totalHours} hrs`, 14, 68);
    doc.text(`Total Break Time: ${stats.totalBreakHours} hrs`, 70, 68);
    doc.text(`Late Days: ${stats.lateDays}`, 130, 68);
    doc.text(`Non-Compliance: ${stats.nonCompliance}`, 170, 68);
    doc.text(`Missed (Leave): ${stats.totalLeaves}`, 14, 73);
    doc.text(`Holidays (Sundays): ${stats.totalHolidays}`, 70, 73);

    const headers = [['Employee', 'Date', 'Time (In/Out)', 'Duration (Work/Break)', 'Status', 'Notes']];
    const body = mergedData.map(rec => {
        let workDuration = 0;
        const isPresent = rec.status === 'present' || rec.status === 'late';
        if (isPresent && rec.checkInTime && rec.checkOutTime) {
            workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
        }
        
        const timeIn = (rec.checkInTime && isPresent) ? format(rec.checkInTime.toDate(), 'p') : '--:--';
        const timeOut = (rec.checkOutTime && isPresent) ? format(rec.checkOutTime.toDate(), 'p') : '--:--';
        const statusStr = rec.isOutOfRange ? `${rec.status} (Out of Range)` : rec.status.replace('_', ' ');
        const notes = ((rec.checkInNotes || '') + ' ' + (rec.checkOutNotes || '')).trim();

        return [
            rec.employeeName || 'N/A',
            rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A',
            `${timeIn} / ${timeOut}`,
            !isPresent ? 'N/A' : `${formatDuration(workDuration)} / ${formatDuration(rec.totalBreakDuration || 0)}`,
            statusStr,
            notes,
            rec.status
        ];
    });

    autoTable(doc, {
        startY: 80,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [39, 55, 70] },
        styles: { fontSize: 8 },
        columnStyles: {
            5: { cellWidth: 40 }
        },
        columns: [0, 1, 2, 3, 4, 5],
        didParseCell: (data) => {
            if (data.section === 'body') {
                const rowStatus = data.row.raw[6];
                const colors: Record<string, [number, number, number]> = {
                    present: [240, 253, 244],
                    late: [255, 251, 235],
                    absent: [254, 242, 242],
                    non_compliance: [255, 247, 237],
                    on_leave: [239, 246, 255],
                    holiday: [250, 245, 255],
                };
                if (colors[rowStatus]) {
                    data.cell.styles.fillColor = colors[rowStatus];
                }
            }
        },
        didDrawPage: addPageContent,
        margin: { top: 50 },
    });

    addPageContent({ settings: { margin: { left: 14 } } });
    doc.save(`Attendance_Report_${employeeName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleEditClick = (rec: AttendanceRecord) => {
      const recDate = rec.checkInTime ? rec.checkInTime.toDate() : new Date(rec.id);
      setEditingDate(recDate);
      setEditingEmployeeId(rec.employeeId);
      setEditingEmployeeName(rec.employeeName || "Employee");
      
      setEditableAttendance({
          status: (['holiday', 'on_leave', 'non_compliance'].includes(rec.status) ? 'absent' : rec.status) as any,
          checkInTime: rec.checkInTime && rec.status !== 'holiday' && rec.status !== 'on_leave' ? format(rec.checkInTime.toDate(), 'HH:mm') : '',
          checkOutTime: rec.checkOutTime && rec.status !== 'holiday' && rec.status !== 'on_leave' ? format(rec.checkOutTime.toDate(), 'HH:mm') : '',
          totalBreakDuration: ((rec.totalBreakDuration || 0) / 60).toString(),
          checkInNotes: rec.checkInNotes || '',
          checkOutNotes: rec.checkOutNotes || '',
      });
      setIsEditDialogOpen(true);
  }

  const handleAttendanceUpdate = () => {
      if (!editingEmployeeId || !editingDate) return;

      const attendanceId = format(editingDate, 'yyyy-MM-dd');
      const attendanceRef = doc(firestore, `users/${editingEmployeeId}/attendances/${attendanceId}`);
      
      const checkInDateTime = editableAttendance.checkInTime ? parse(editableAttendance.checkInTime, 'HH:mm', editingDate) : null;
      const checkOutDateTime = editableAttendance.checkOutTime ? parse(editableAttendance.checkOutTime, 'HH:mm', editingDate) : null;

      const payload: any = {
          id: attendanceId,
          employeeId: editingEmployeeId,
          status: editableAttendance.status,
          checkInTime: checkInDateTime ? Timestamp.fromDate(checkInDateTime) : null,
          checkOutTime: checkOutDateTime ? Timestamp.fromDate(checkOutDateTime) : null,
          totalBreakDuration: parseInt(editableAttendance.totalBreakDuration) * 60 || 0,
          checkInNotes: editableAttendance.checkInNotes,
          checkOutNotes: editableAttendance.checkOutNotes,
      };

      setDocumentNonBlocking(attendanceRef, payload, { merge: true });
      toast({ title: "Attendance Updated", description: `Record for ${editingEmployeeName} saved.` });
      setIsEditDialogOpen(false);
  }

  return (
    <>
      <PageHeader title="Employee Analytics" description="Analyze performance and attendance for team members." className="animate-fade-in-up" />

      <div className="flex flex-wrap items-center gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="w-full sm:w-auto sm:min-w-64">
            <Select onValueChange={(val) => setSelectedUserId(val)} value={selectedUserId}>
                <SelectTrigger>
                    <SelectValue placeholder={areUsersLoading ? "Loading users..." : "Select an employee"} />
                </SelectTrigger>
                <SelectContent>
                    {users?.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filterMode === 'day' && date && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'} onClick={() => { setDate(new Date()); setFilterMode('day'); }}>Today</Button>
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
          <Button variant={filterMode === 'all' ? 'default' : 'outline'} onClick={() => setFilterMode('all')}>{filterMode === 'all' ? "Full History" : "View Full History"}</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        {selectedUser && (
          <Card className="animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '200ms' }}>
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Work Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalHours} hrs</div>
                    <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Break Time</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalBreakHours} hrs</div>
                     <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
            <Card className="border-orange-200 bg-gradient-to-br from-orange-500/10 to-transparent border-none ring-1 ring-orange-200/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Non-Compliance</CardTitle>
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-700">{stats.nonCompliance}</div>
                    <p className="text-xs text-muted-foreground">Missing log-outs</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Holidays</CardTitle>
                    <Sun className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalHolidays}</div>
                    <p className="text-xs text-muted-foreground">Sundays in period</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Leaves</CardTitle>
                    <CalendarOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeaves}</div>
                    <p className="text-xs text-muted-foreground">Missed working days</p>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Late Days</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lateDays}</div>
                     <p className="text-xs text-muted-foreground">{getFilterPeriodText()}</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="lg:col-span-3">
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                            <CardTitle>Attendance & Leave Log</CardTitle>
                            <CardDescription>{filterMode === 'all' ? "Full history." : `Activity for ${getFilterPeriodText()}.`}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <TooltipProvider>
                            <div className="overflow-x-auto rounded-lg border bg-white/50 backdrop-blur-sm">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Time (In/Out)</TableHead>
                                            <TableHead>Duration (Work/Break)</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Notes</TableHead>
                                            {isAdmin && ENABLE_MANUAL_EDIT && <TableHead className="text-right">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mergedData?.map((rec) => {
                                            let workDuration = 0;
                                            const isPresent = rec.status === 'present' || rec.status === 'late';
                                            if (isPresent && rec.checkInTime && rec.checkOutTime) {
                                                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                                            }
                                            const notes = (rec.checkInNotes ? `In: ${rec.checkInNotes}` : '') + 
                                                          (rec.checkOutNotes ? `\nOut: ${rec.checkOutNotes}` : '');
                                            
                                            const gradientClass = cn(
                                                rec.status === 'present' && 'bg-gradient-to-r from-green-50 to-transparent dark:from-green-950/20',
                                                rec.status === 'late' && 'bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-950/20',
                                                rec.status === 'absent' && 'bg-gradient-to-r from-red-50 to-transparent dark:from-red-950/20',
                                                rec.status === 'non_compliance' && 'bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20',
                                                rec.status === 'on_leave' && 'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/20',
                                                rec.status === 'holiday' && 'bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950/20',
                                            );

                                            return (
                                            <TableRow key={`${rec.employeeId}-${rec.id}`} className={gradientClass}>
                                                <TableCell className="font-medium whitespace-nowrap">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {rec.status === 'holiday' || rec.status === 'on_leave' ? (
                                                        <span className="text-muted-foreground italic">{rec.status === 'holiday' ? 'Holiday' : 'On Leave'}</span>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground w-6">In:</span>
                                                                <span>{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground w-6">Out:</span>
                                                                <span className={cn(!rec.checkOutTime && rec.status === 'non_compliance' && "text-orange-600 font-semibold")}>
                                                                    {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {rec.status === 'holiday' || rec.status === 'on_leave' || (rec.status === 'non_compliance' && !rec.checkOutTime) ? (
                                                        <span className="text-muted-foreground">-</span>
                                                    ) : (
                                                        <>
                                                            <div>{formatDuration(workDuration)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatDuration(rec.totalBreakDuration || 0)}</div>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                rec.status === 'present' && 'text-green-600 border-green-600/50 bg-green-50/50',
                                                                rec.status === 'late' && 'text-yellow-600 border-yellow-600/50 bg-yellow-50/50',
                                                                rec.status === 'absent' && 'text-red-600 border-red-600/50 bg-red-50/50',
                                                                rec.status === 'non_compliance' && 'text-orange-600 border-orange-600/50 bg-orange-50/50',
                                                                rec.status === 'on_leave' && 'text-blue-600 border-blue-600/50 bg-blue-50/50',
                                                                rec.status === 'holiday' && 'text-purple-600 border-purple-600/50 bg-purple-50/50',
                                                            )}
                                                        >
                                                            {rec.status === 'holiday' ? 'Holiday' : rec.status.replace('_', ' ')}
                                                        </Badge>
                                                        {rec.isOutOfRange && (
                                                            <Badge variant="destructive" className="text-[10px] py-0 h-4 px-1.5 font-normal uppercase">Out of Range</Badge>
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
                                                                <StickyNote className={cn("h-5 w-5 transition-colors", rec.status === 'non_compliance' ? 'text-orange-500' : 'text-muted-foreground')} />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="whitespace-pre-wrap max-w-xs">{notes.trim()}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <span className="text-muted-foreground/50">-</span>
                                                    )}
                                                </TableCell>
                                                {isAdmin && ENABLE_MANUAL_EDIT && (
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(rec)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                        </TooltipProvider>
                         {(!mergedData || mergedData.length === 0) && (
                            <div className="text-center py-10 text-muted-foreground">
                                No records found for this period.
                            </div>
                         )}
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
      )}

      {/* Manual Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Edit Attendance: {editingEmployeeName}</DialogTitle>
                  <DialogDescription>
                      Manually adjust the record for {editingDate && format(editingDate, "PPP")}.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
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
                  {(editableAttendance.status === 'present' || editableAttendance.status === 'late') && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="check-in">Check In Time</Label>
                            <Input id="check-in" type="time" value={editableAttendance.checkInTime} onChange={(e) => setEditableAttendance(prev => ({...prev, checkInTime: e.target.value}))}/>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="check-out">Check Out Time</Label>
                            <Input id="check-out" type="time" value={editableAttendance.checkOutTime} onChange={(e) => setEditableAttendance(prev => ({...prev, checkOutTime: e.target.value}))}/>
                        </div>
                    </div>
                  )}
                  <div className="grid gap-2">
                      <Label htmlFor="break">Total Break (minutes)</Label>
                      <Input id="break" type="number" value={editableAttendance.totalBreakDuration} onChange={(e) => setEditableAttendance(prev => ({...prev, totalBreakDuration: e.target.value}))}/>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="checkin-notes">Adjustment Remarks</Label>
                      <Textarea id="checkin-notes" placeholder="Reason for manual correction..." value={editableAttendance.checkInNotes} onChange={(e) => setEditableAttendance(prev => ({...prev, checkInNotes: e.target.value}))} />
                  </div>
              </div>
              <DialogFooter>
                  <div className="flex gap-2 ml-auto">
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleAttendanceUpdate}>Save Changes</Button>
                  </div>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

export default AnalyticsPage;
