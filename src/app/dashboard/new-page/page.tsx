
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltipContent } from '@/components/ui/chart';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, subDays, differenceInSeconds, startOfDay, endOfDay } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from '@/firebase/firestore/use-collection';


type User = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
}

type AttendanceRecord = {
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave';
};

const AnalyticsPage = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const selectedUser = users?.find(u => u.id === selectedUserId);

  const attendanceQuery = useMemoFirebase(() => {
    if (!selectedUserId || !dateRange?.from || !dateRange?.to) return null;
    return query(
      collection(firestore, `users/${selectedUserId}/attendances`),
      where('checkInTime', '>=', startOfDay(dateRange.from)),
      where('checkInTime', '<=', endOfDay(dateRange.to)),
      orderBy('checkInTime', 'desc')
    );
  }, [firestore, selectedUserId, dateRange]);
  const { data: attendanceData, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const weeklyAttendanceData = React.useMemo(() => {
    if (!attendanceData) return [];
    const weekAgo = subDays(new Date(), 7);
    return attendanceData.filter(rec => rec.checkInTime && rec.checkInTime.toDate() >= weekAgo);
  }, [attendanceData]);

  const userAvatar = PlaceHolderImages.find((image) => image.id === 'user-avatar-1');

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
      return Array.from({ length: 7 }).map((_, i) => {
          const day = subDays(new Date(), 6 - i);
          const rec = weeklyAttendanceData.find(d => d.checkInTime && format(d.checkInTime.toDate(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
          let workHours = 0, breakHours = 0;
          if (rec?.checkInTime && rec?.checkOutTime) {
              workHours = (differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0)) / 3600;
              breakHours = (rec.totalBreakDuration || 0) / 3600;
          }
          return {
              date: format(day, 'EEE'),
              work: parseFloat(workHours.toFixed(2)),
              break: parseFloat(breakHours.toFixed(2)),
          }
      });
  }, [weeklyAttendanceData]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  const handleExport = () => {
    if (!attendanceData || attendanceData.length === 0) {
        toast({ variant: 'destructive', title: 'No data to export' });
        return;
    }
    const headers = ['Date', 'Clock In', 'Clock Out', 'Work Duration', 'Break Duration', 'Status'];
    const csvRows = [
        headers.join(','),
        ...attendanceData.map(rec => {
            let workDuration = 0;
            if (rec.checkInTime && rec.checkOutTime) {
                workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
            }
            const row = [
                rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "PP")}"` : "N/A",
                rec.checkInTime ? `"${format(rec.checkInTime.toDate(), "p")}"` : "N/A",
                rec.checkOutTime ? `"${format(rec.checkOutTime.toDate(), "p")}"` : "N/A",
                `"${formatDuration(workDuration)}"`,
                `"${formatDuration(rec.totalBreakDuration || 0)}"`,
                `"${rec.status}"`,
            ];
            return row.join(',');
        })
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${selectedUser?.firstName}_${selectedUser?.lastName}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <PageHeader title="Employee Analytics" description="Select an employee to view their performance and attendance." />

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-64">
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
        <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full md:w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                  ) : (
                    format(dateRange.from, "LLL dd, y")
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
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleExport} disabled={!selectedUserId || !attendanceData || attendanceData.length === 0}>
            <Download className="mr-2 h-4 w-4"/>
            Export CSV
          </Button>
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
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
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
                    <p className="text-xs text-muted-foreground">in selected range</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Break Time</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalBreakHours} hrs</div>
                    <p className="text-xs text-muted-foreground">in selected range</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Days on Leave</CardTitle>
                    <CalendarOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeaves}</div>
                    <p className="text-xs text-muted-foreground">in selected range</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Late Days</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lateDays}</div>
                    <p className="text-xs text-muted-foreground">in selected range</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Weekly Work Hours</CardTitle>
                        <CardDescription>Work vs. Break hours over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis unit="h" />
                                 <Tooltip 
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                    content={<ChartTooltipContent formatter={(value) => `${value}h`} indicator="dot" />}
                                />
                                <Bar dataKey="work" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Work" />
                                <Bar dataKey="break" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Break" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Attendance Log</CardTitle>
                        <CardDescription>A detailed log of the user's activity within the selected date range.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Clock In/Out</TableHead>
                                    <TableHead>Work</TableHead>
                                    <TableHead>Break</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceData?.map((rec, i) => {
                                    let workDuration = 0;
                                    if (rec.checkInTime && rec.checkOutTime) {
                                        workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                                    }
                                    return (
                                    <TableRow key={rec.id}>
                                        <TableCell className="font-medium">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                        <TableCell>
                                          {rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}
                                          {' / '}
                                          {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                        </TableCell>
                                        <TableCell>{formatDuration(workDuration)}</TableCell>
                                        <TableCell>{formatDuration(rec.totalBreakDuration || 0)}</TableCell>
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
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                         {(!attendanceData || attendanceData.length === 0) && (
                            <div className="text-center py-10 text-muted-foreground">
                                No attendance records found for the selected period.
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
