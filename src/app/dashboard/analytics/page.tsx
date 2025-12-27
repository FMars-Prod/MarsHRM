
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser, setDocumentNonBlocking } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, subDays, differenceInSeconds, startOfDay, endOfDay, parse, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Download, Calendar as CalendarIcon, Edit, StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type User = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
}

type AttendanceRecord = {
  id: string;
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  checkInNotes?: string;
  checkOutNotes?: string;
};

type EditableAttendance = {
    status: 'present' | 'late' | 'absent' | 'on_leave';
    checkInTime: string;
    checkOutTime: string;
    totalBreakDuration: string;
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

type FilterMode = "day" | "month" | "all";

const AnalyticsPage = () => {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<Date>(new Date());
  const [month, setMonth] = React.useState<Date | null>(null);
  const [filterMode, setFilterMode] = React.useState<FilterMode>("day");

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editableAttendance, setEditableAttendance] = React.useState<EditableAttendance>({
      status: 'present',
      checkInTime: '',
      checkOutTime: '',
      totalBreakDuration: '0',
  });

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  const currentUserRole = (currentUserData as any)?.role;
  const isAdmin = currentUserRole === 'CEO/Admin' || currentUserRole === 'HR Manager' || currentUserRole === 'Team Lead';

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const attendanceQuery = useMemoFirebase(() => {
    if (!selectedUserId) return null;

    let start: Date;
    let end: Date;

    switch (filterMode) {
      case 'day':
        if (!date) return null;
        start = startOfDay(date);
        end = endOfDay(date);
        break;
      case 'month':
        if (!month) return null;
        start = startOfMonth(month);
        end = endOfMonth(month);
        break;
      case 'all':
        return query(
          collection(firestore, `users/${selectedUserId}/attendances`),
          orderBy('checkInTime', 'desc')
        );
      default:
        return null;
    }
    
    return query(
      collection(firestore, `users/${selectedUserId}/attendances`),
      where('checkInTime', '>=', start),
      where('checkInTime', '<=', end),
      orderBy('checkInTime', 'desc')
    );
  }, [firestore, selectedUserId, date, month, filterMode]);


  const { data: attendanceData, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const weeklyChartQuery = useMemoFirebase(() => {
    if(!selectedUserId) return null;
    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    const today = endOfDay(new Date());
    return query(
        collection(firestore, `users/${selectedUserId}/attendances`),
        where('checkInTime', '>=', sevenDaysAgo),
        where('checkInTime', '<=', today),
        orderBy('checkInTime', 'asc')
    );
  }, [firestore, selectedUserId]);
  const {data: weeklyAttendance} = useCollection<AttendanceRecord>(weeklyChartQuery);

  React.useEffect(() => {
      if (attendanceData && attendanceData.length > 0 && filterMode === 'day') {
          const record = attendanceData[0];
          setEditableAttendance({
              status: record.status,
              checkInTime: record.checkInTime ? format(record.checkInTime.toDate(), 'HH:mm') : '',
              checkOutTime: record.checkOutTime ? format(record.checkOutTime.toDate(), 'HH:mm') : '',
              totalBreakDuration: record.totalBreakDuration ? (record.totalBreakDuration / 60).toString() : '0',
          });
      } else {
          setEditableAttendance({ status: 'absent', checkInTime: '', checkOutTime: '', totalBreakDuration: '0' });
      }
  }, [attendanceData, isEditDialogOpen, filterMode]);


  const stats = React.useMemo(() => {
    if (!attendanceData) return { totalHours: '0.0', totalBreakHours: '0.0', totalLeaves: 0, lateDays: 0 };
    let totalWorkSeconds = 0, totalBreakSeconds = 0, lateDays = 0, onLeaveDays = 0;
    attendanceData.forEach(rec => {
      if (rec.checkInTime && rec.checkOutTime) {
        const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
        totalWorkSeconds += workSeconds - (rec.totalBreakDuration || 0);
        totalBreakSeconds += rec.totalBreakDuration || 0;
      }
      if (rec.status === 'late') lateDays++;
      if (rec.status === 'on_leave') onLeaveDays++;
    });
    return {
      totalHours: (totalWorkSeconds / 3600).toFixed(1),
      totalBreakHours: (totalBreakSeconds / 3600).toFixed(1),
      totalLeaves: onLeaveDays,
      lateDays,
    };
  }, [attendanceData]);
  
  const chartData = React.useMemo(() => {
      if (!weeklyAttendance) return [];
      
      const dataMap = new Map<string, { work: number, break: number }>();

      weeklyAttendance.forEach(rec => {
          if (rec.checkInTime) {
              const day = format(rec.checkInTime.toDate(), 'yyyy-MM-dd');
              let workHours = 0, breakHours = 0;
              if (rec.checkOutTime) {
                  workHours = (differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0)) / 3600;
                  breakHours = (rec.totalBreakDuration || 0) / 3600;
              }
              const existing = dataMap.get(day) || { work: 0, break: 0 };
              dataMap.set(day, {
                  work: existing.work + workHours,
                  break: existing.break + breakHours
              });
          }
      });
      
      return Array.from(dataMap.entries()).map(([date, values]) => ({
          date: format(new Date(date), 'EEE, MMM d'),
          work: parseFloat(values.work.toFixed(2)),
          break: parseFloat(values.break.toFixed(2)),
      })).reverse();
  }, [weeklyAttendance]);


  const userAvatar = PlaceHolderImages.find((image) => image.id === 'user-avatar-1');

  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  const handleExport = () => {
    if (!attendanceData || attendanceData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    const headers = ['Date', 'Clock In', 'Clock Out', 'Work Duration', 'Break Duration', 'Status', 'Clock In Notes', 'Clock Out Notes'];
    const csvRows = [
        headers.join(','),
        ...attendanceData.map(rec => {
            let workDuration = 0;
            if (rec.checkInTime && rec.checkOutTime) {
                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkOutTime.toDate()) - (rec.totalBreakDuration || 0);
            }
            const row = [
                rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "PP")}"` : "N/A",
                rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "p")}"` : "N/A",
                rec.checkOutTime ? `"${format(rec.checkOutTime.toDate(), "p")}"` : "N/A",
                `"${formatDuration(workDuration)}"`,
                `"${formatDuration(rec.totalBreakDuration || 0)}"`,
                `"${rec.status}"`,
                `"${rec.checkInNotes || ''}"`,
                `"${rec.checkOutNotes || ''}"`,
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
    if (filterMode === 'day' && date) datePart = format(date, 'yyyy-MM-dd');
    if (filterMode === 'month' && month) datePart = format(month, 'yyyy-MM');
    if (filterMode === 'all') datePart = 'all_time';

    link.setAttribute('download', `${selectedUser?.firstName}_${selectedUser?.lastName}_attendance_${datePart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleAttendanceUpdate = () => {
      if (!selectedUserId || !date) return;

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
      };

      setDocumentNonBlocking(attendanceRef, payload, { merge: true });
      toast({ title: "Attendance Updated", description: "The record has been saved." });
      setIsEditDialogOpen(false);
  }
  
  const getFilterPeriodText = () => {
      if (filterMode === 'day' && date) return format(date, 'MMM d, yyyy');
      if (filterMode === 'month' && month) return format(month, 'MMMM yyyy');
      if (filterMode === 'all') return 'All time';
      return 'Selected period';
  }
  
  return (
    <>
      <PageHeader title="Employee Analytics" description="Select an employee to view their performance and attendance." />

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="w-full sm:w-auto sm:min-w-64">
            <Select onValueChange={setSelectedUserId} value={selectedUserId || ''}>
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
          <Button variant={filterMode === 'day' && date && format(date, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'} onClick={() => { setDate(subDays(new Date(), 1)); setFilterMode('day'); }}>Yesterday</Button>
           <Button variant={filterMode === 'month' && month && format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 'default' : 'outline'} onClick={() => { setMonth(new Date()); setFilterMode('month'); }}>This Month</Button>
          <Button variant={filterMode === 'month' && month && format(month, 'yyyy-MM') === format(subMonths(new Date(), 1), 'yyyy-MM') ? 'default' : 'outline'} onClick={() => { setMonth(subMonths(new Date(), 1)); setFilterMode('month'); }}>Last Month</Button>
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
          <Button variant={filterMode === 'all' ? 'default' : 'outline'} onClick={() => setFilterMode('all')}>{filterMode === 'all' ? "Viewing Full History" : "View Full History"}</Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && selectedUserId && filterMode === 'day' && (
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
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleAttendanceUpdate}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <Button onClick={handleExport} disabled={!selectedUserId || !attendanceData || attendanceData.length === 0}>
                <Download className="mr-2 h-4 w-4"/>
                Export CSV
            </Button>
        </div>
      </div>

      {!selectedUserId ? (
        <div className="border rounded-lg p-6 min-h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Please select an employee to view their analytics.</p>
        </div>
      ) : isAttendanceLoading ? (
         <div className="border rounded-lg p-6 min-h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading attendance data...</p>
        </div>
      ) : (
      <div className="grid gap-6">
        {selectedUser && (
          <Card>
            <CardHeader className="flex flex-col items-center text-center sm:flex-row sm:text-left gap-4 space-y-0 p-4 sm:p-6">
              <Avatar className="h-20 w-20">
                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={selectedUser.firstName} />}
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
                        <CardDescription>Work vs. Break hours over the last 7 days.</CardDescription>
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
                    <CardHeader>
                        <CardTitle>Attendance Log</CardTitle>
                        <CardDescription>{filterMode === 'all' ? "Full activity history for the selected employee." : `Activity for ${getFilterPeriodText()}.`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TooltipProvider>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Time (In/Out)</TableHead>
                                            <TableHead>Duration (Work/Break)</TableHead>
                                            <TableHead>Status</TableHead>
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
                                            <TableRow key={rec.id}>
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
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            rec.status === 'present' && 'text-green-600 border-green-600/50',
                                                            rec.status === 'late' && 'text-yellow-600 border-yellow-600/50',
                                                            rec.status === 'absent' && 'text-red-600 border-red-600/50',
                                                            rec.status === 'on_leave' && 'text-blue-600 border-blue-600/50',
                                                        )}
                                                    >{rec.status}</Badge>
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

    