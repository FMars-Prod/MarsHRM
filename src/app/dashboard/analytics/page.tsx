
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, query, where, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, differenceInSeconds, startOfDay, endOfDay, parse, startOfMonth, endOfMonth, eachDayOfInterval, min, max, isBefore, startOfWeek, endOfWeek } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Download, Calendar as CalendarIcon, Edit, StickyNote, MapPin, RotateCcw, Share2, FileText, Sun, ShieldAlert, LogOut, LogIn, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { type DateRange } from "react-day-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { setDocumentNonBlocking } from '@/firebase';

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
  lunchOutTime?: Timestamp;
  lunchInTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'holiday' | 'non_compliance';
  checkInNotes?: string;
  checkOutNotes?: string;
  locationCheckInLatitude?: number;
  locationCheckInLongitude?: number;
  locationCheckOutLatitude?: number;
  locationCheckOutLongitude?: number;
  locationLunchOutLatitude?: number;
  locationLunchOutLongitude?: number;
  locationLunchInLatitude?: number;
  locationLunchInLongitude?: number;
  isOutOfRange?: boolean;
};

type FilterMode = "day" | "month" | "range" | "this_week" | "prev_week" | "all";

const statusColors: Record<string, string> = {
    present: 'text-green-600 border-green-600/50 bg-green-50',
    late: 'text-yellow-600 border-yellow-600/50 bg-yellow-50',
    absent: 'text-red-600 border-red-600/50 bg-red-50',
    on_leave: 'text-blue-600 border-blue-600/50 bg-blue-50',
    holiday: 'text-slate-600 border-slate-600/50 bg-slate-50',
    non_compliance: 'text-orange-600 border-orange-600/50 bg-orange-50',
};

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
  const [editableAttendance, setEditableAttendance] = React.useState({
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
    const now = new Date();
    switch (filterMode) {
      case 'day':
        start = date ? startOfDay(date) : null;
        end = date ? endOfDay(date) : null;
        break;
      case 'month':
        start = month ? startOfMonth(month) : null;
        end = month ? endOfMonth(month) : null;
        break;
      case 'this_week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'prev_week':
        const prev = subDays(now, 7);
        start = startOfWeek(prev, { weekStartsOn: 1 });
        end = endOfWeek(prev, { weekStartsOn: 1 });
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
  
  const handleExportPdf = () => {
    if (!mergedData || mergedData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    const doc = new jsPDF();
    const now = format(new Date(), 'PPP');
    
    doc.setFontSize(18);
    doc.text("MarsHRM - Employee Attendance Report", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Employee: ${selectedUser?.firstName} ${selectedUser?.lastName}`, 14, 30);
    doc.text(`Generated on: ${now}`, 14, 35);
    
    const body = mergedData.map(rec => [
        format(rec.checkInTime?.toDate() || new Date(rec.id), 'MMM d, yyyy'),
        rec.status.replace('_', ' '),
        rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--',
        (rec as any).lunchOutTime ? format((rec as any).lunchOutTime.toDate(), 'p') : '--:--',
        (rec as any).lunchInTime ? format((rec as any).lunchInTime.toDate(), 'p') : '--:--',
        rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--',
        rec.totalBreakDuration ? formatDuration(rec.totalBreakDuration) : '0h 0m'
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Date', 'Status', 'In', 'L-Out', 'L-In', 'Out', 'Break']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [138, 43, 226] }
    });

    doc.save(`Attendance_${selectedUser?.firstName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      <PageHeader title="Employee Analytics" description="Precise attendance verification and location mapping." />
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="w-full sm:w-auto sm:min-w-64">
            <Select onValueChange={(val) => setSelectedUserId(val)} value={selectedUserId}>
                <SelectTrigger><SelectValue placeholder={areUsersLoading ? "Loading..." : "Select employee"} /></SelectTrigger>
                <SelectContent>{users?.map(u => (<SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>))}</SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filterMode === 'day' ? 'default' : 'outline'} size="sm" onClick={() => { setDate(new Date()); setFilterMode('day'); }}>Today</Button>
          <Button variant={filterMode === 'this_week' ? 'default' : 'outline'} size="sm" onClick={() => setFilterMode('this_week')}>This Week</Button>
          <Button variant={filterMode === 'prev_week' ? 'default' : 'outline'} size="sm" onClick={() => setFilterMode('prev_week')}>Prev Week</Button>
          <Popover>
            <PopoverTrigger asChild>
                <Button variant={filterMode === 'range' ? 'default' : 'outline'} size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" /> Range
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={(r) => { setRange(r); setFilterMode('range'); }} initialFocus />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                     const headers = ['Date', 'Status', 'In', 'Out', 'Break'];
                     const csv = [headers.join(','), ...mergedData!.map(r => [format(r.checkInTime?.toDate() || new Date(r.id), 'yyyy-MM-dd'), r.status, r.checkInTime ? format(r.checkInTime.toDate(), 'HH:mm') : '', r.checkOutTime ? format(r.checkOutTime.toDate(), 'HH:mm') : '', r.totalBreakDuration || 0].join(','))].join('\n');
                     const blob = new Blob([csv], { type: 'text/csv' });
                     const url = URL.createObjectURL(blob);
                     const a = document.createElement('a'); a.href = url; a.download = 'attendance.csv'; a.click();
                }}>CSV Spreadsheet</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>Professional PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isAttendanceLoading ? (
         <div className="border rounded-lg p-6 min-h-[400px] flex items-center justify-center">Loading records...</div>
      ) : (
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <Card><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Work Hours</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{stats.totalHours} hrs</div></CardContent></Card>
            <Card><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Break Time</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{stats.totalBreakHours} hrs</div></CardContent></Card>
            <Card className="border-orange-200"><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Non-Compliance</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold text-orange-700">{stats.nonCompliance}</div></CardContent></Card>
            <Card><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Holidays</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{stats.totalHolidays}</div></CardContent></Card>
            <Card><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Leaves</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{stats.totalLeaves}</div></CardContent></Card>
            <Card><CardHeader className="p-4"><CardTitle className="text-sm font-medium">Late Days</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{stats.lateDays}</div></CardContent></Card>
        </div>
        <Card>
            <CardHeader><CardTitle>Detailed Attendance Log</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Log In</TableHead>
                                <TableHead>L-Out</TableHead>
                                <TableHead>L-In</TableHead>
                                <TableHead>Log Out</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mergedData?.map((rec) => {
                                const statusDetail = statusColors[rec.status] || 'text-muted-foreground border-muted';
                                return (
                                    <TableRow key={rec.id}>
                                        <TableCell className="font-medium whitespace-nowrap">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                        <TableCell><Badge variant="outline" className={cn("capitalize font-bold px-2 py-0.5", statusDetail)}>{rec.status.replace('_', ' ')}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</span>
                                                {rec.locationCheckInLatitude && (
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckInLatitude},${rec.locationCheckInLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 text-primary transition-transform hover:scale-125"/>
                                                    </Link>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono">{(rec as any).lunchOutTime ? format((rec as any).lunchOutTime.toDate(), 'p') : '--:--'}</span>
                                                {rec.locationLunchOutLatitude && (
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationLunchOutLatitude},${rec.locationLunchOutLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 text-yellow-600 transition-transform hover:scale-125"/>
                                                    </Link>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono">{(rec as any).lunchInTime ? format((rec as any).lunchInTime.toDate(), 'p') : '--:--'}</span>
                                                {rec.locationLunchInLatitude && (
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationLunchInLatitude},${rec.locationLunchInLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 text-blue-600 transition-transform hover:scale-125"/>
                                                    </Link>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono">{rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}</span>
                                                {rec.locationCheckOutLatitude && (
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${rec.locationCheckOutLatitude},${rec.locationCheckOutLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 text-purple-600 transition-transform hover:scale-125"/>
                                                    </Link>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell><TooltipProvider><Tooltip><TooltipTrigger><StickyNote className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors"/></TooltipTrigger><TooltipContent><p className="max-w-xs">{rec.checkInNotes || rec.checkOutNotes || "No notes"}</p></TooltipContent></Tooltip></TooltipProvider></TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
      )}
    </>
  );
};

export default AnalyticsPage;
