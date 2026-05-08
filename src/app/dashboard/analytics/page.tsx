
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSunday, isValid, isAfter, isBefore, differenceInSeconds } from 'date-fns';
import { MapPin, Calendar as CalendarIcon, AreaChart as AreaChartIcon, ExternalLink, Clock, Briefcase, CalendarOff, AlertTriangle, Coffee, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import Link from 'next/link';

type User = { id: string; firstName: string; lastName: string; jobTitle: string; department: string; };
type Holiday = { id: string; date: Timestamp; title: string; };
type LeaveRequest = { id: string; employeeId: string; startDate: Timestamp; endDate: Timestamp; status: string; };
type Attendance = { 
    id: string; 
    employeeId: string; 
    checkInTime?: Timestamp; 
    checkOutTime?: Timestamp; 
    lunchOutTime?: Timestamp; 
    lunchInTime?: Timestamp;
    locationCheckInLatitude?: number;
    locationCheckInLongitude?: number;
    locationCheckOutLatitude?: number;
    locationCheckOutLongitude?: number;
    locationLunchOutLatitude?: number;
    locationLunchOutLongitude?: number;
    locationLunchInLatitude?: number;
    locationLunchInLongitude?: number;
    status: string;
    isOutOfRange?: boolean;
    totalBreakDuration?: number;
};

const chartConfig = {
  present: { label: "Present", color: "#22c55e" },
  late: { label: "Late", color: "#eab308" },
  absent: { label: "Absent", color: "#ef4444" },
} satisfies ChartConfig;

const MapPinLink = ({ lat, lng, time }: { lat?: number, lng?: number, time?: string }) => {
    if (!lat || !lng || !time) return <span className="text-muted-foreground/30">—</span>;
    return (
        <div className="flex items-center gap-1.5 group">
            <span className="font-mono text-[10px] font-bold">{time}</span>
            <Link 
                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} 
                target="_blank"
                className="opacity-40 group-hover:opacity-100 transition-opacity"
            >
                <MapPin className="size-3 text-primary" />
            </Link>
        </div>
    );
};

export default function AnalyticsPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = React.useState<string>("all");
  const [attendanceData, setAttendanceData] = React.useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const holidaysQuery = useMemoFirebase(() => query(collection(firestore, 'holidays')), [firestore]);
  const { data: holidays } = useCollection<Holiday>(holidaysQuery);

  const leavesQuery = useMemoFirebase(() => query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved')), [firestore]);
  const { data: leaves } = useCollection<LeaveRequest>(leavesQuery);

  React.useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const start = startOfDay(subDays(now, 14)); // View last 14 days

        let q;
        if (selectedUserId === 'all') {
            q = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', Timestamp.fromDate(start)));
        } else {
            q = query(collection(firestore, `users/${selectedUserId}/attendances`), where('checkInTime', '>=', Timestamp.fromDate(start)));
        }

        const snap = await getDocs(q);
        setAttendanceData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
      } catch (e) {
        toast({ variant: 'destructive', title: 'Data sync failed' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [selectedUserId, firestore, toast]);

  const trendData = React.useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).filter(d => !isSunday(d));
    return days.map(day => {
        const dayStr = format(day, 'EEE, MMM d');
        const dayRecs = attendanceData.filter(r => r.checkInTime && isSameDay(r.checkInTime.toDate(), day));
        return {
            date: dayStr,
            present: dayRecs.filter(r => r.status === 'present').length,
            late: dayRecs.filter(r => r.status === 'late').length,
            absent: (users?.length || 0) - dayRecs.length
        };
    });
  }, [attendanceData, users]);

  const getDayStatus = (user: User, day: Date) => {
      const today = startOfDay(new Date());
      if (isAfter(day, today)) return { status: 'future', label: '—', color: 'bg-muted/10 text-muted-foreground' };

      const att = attendanceData.find(a => a.employeeId === user.id && isSameDay(a.checkInTime?.toDate() || new Date(0), day));
      if (att) {
          if (att.checkInTime && !att.checkOutTime && isBefore(day, today)) {
              return { status: 'non-compliance', label: 'Non-Compliance', color: 'bg-orange-100 text-orange-700 border-orange-200' };
          }
          return { 
              status: att.status, 
              label: att.status.toUpperCase(), 
              color: att.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200' 
          };
      }

      const holiday = holidays?.find(h => isSameDay(h.date.toDate(), day));
      if (holiday) return { status: 'holiday', label: 'Holiday', color: 'bg-slate-100 text-slate-700 border-slate-200' };

      const leave = leaves?.find(l => l.employeeId === user.id && isWithinLeave(day, l));
      if (leave) return { status: 'leave', label: 'On Leave', color: 'bg-blue-100 text-blue-700 border-blue-200' };

      if (isSunday(day)) return { status: 'sunday', label: 'Sunday', color: 'bg-muted/30 text-muted-foreground border-transparent' };

      return { status: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' };
  };

  const isWithinLeave = (day: Date, leave: LeaveRequest) => {
      const d = startOfDay(day);
      const start = startOfDay(leave.startDate.toDate());
      const end = startOfDay(leave.endDate.toDate());
      return (d >= start && d <= end);
  };

  const userStats = React.useMemo(() => {
      if (selectedUserId === 'all' || !users) return null;
      const user = users.find(u => u.id === selectedUserId);
      if (!user) return null;

      const userAtts = attendanceData.filter(a => a.employeeId === user.id);
      let totalWorkSec = 0;
      let totalBreakSec = 0;
      let nonCompliance = 0;

      userAtts.forEach(a => {
          if (a.checkInTime && a.checkOutTime) {
              const diff = differenceInSeconds(a.checkOutTime.toDate(), a.checkInTime.toDate());
              const brk = a.totalBreakDuration || 0;
              totalWorkSec += (diff - brk);
              totalBreakSec += brk;
          }
          if (a.checkInTime && !a.checkOutTime && isBefore(a.checkInTime.toDate(), startOfDay(new Date()))) {
              nonCompliance++;
          }
      });

      const userLeaves = leaves?.filter(l => l.employeeId === user.id).reduce((acc, l) => {
          const days = eachDayOfInterval({ start: l.startDate.toDate(), end: l.endDate.toDate() }).length;
          return acc + days;
      }, 0) || 0;

      const range = eachDayOfInterval({ start: startOfDay(subDays(new Date(), 14)), end: startOfDay(new Date()) });
      const sunCount = range.filter(d => isSunday(d)).length;
      const holCount = holidays?.filter(h => isSameDay(h.date.toDate(), new Date())).length || 0;

      return {
          leaves: userLeaves,
          workHours: (totalWorkSec / 3600).toFixed(1),
          breakHours: (totalBreakSec / 3600).toFixed(1),
          holidays: holidays?.length || 0,
          sundays: sunCount,
          nonCompliance
      };
  }, [selectedUserId, attendanceData, leaves, holidays, users]);

  const gridData = React.useMemo(() => {
      const range = eachDayOfInterval({ start: subDays(new Date(), 7), end: new Date() }).reverse();
      if (selectedUserId !== 'all' && users) {
          const user = users.find(u => u.id === selectedUserId);
          if (!user) return [];
          return range.map(day => {
              const att = attendanceData.find(a => a.employeeId === user.id && isSameDay(a.checkInTime?.toDate() || new Date(0), day));
              const statusInfo = getDayStatus(user, day);
              return {
                  date: day,
                  employeeName: `${user.firstName} ${user.lastName}`,
                  status: statusInfo,
                  att
              };
          });
      }

      // Organization Overview: Show all entries for last 7 days
      return attendanceData
        .filter(a => isAfter(a.checkInTime?.toDate() || new Date(0), subDays(new Date(), 7)))
        .sort((a, b) => (b.checkInTime?.toMillis() || 0) - (a.checkInTime?.toMillis() || 0))
        .map(att => {
            const user = users?.find(u => u.id === att.employeeId);
            const statusInfo = user ? getDayStatus(user, att.checkInTime!.toDate()) : { label: '?', color: '' };
            return {
                date: att.checkInTime!.toDate(),
                employeeName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
                status: statusInfo,
                att
            };
        });
  }, [selectedUserId, users, attendanceData, holidays, leaves]);

  return (
    <div className="space-y-6">
      <PageHeader title="Organizational Analytics" description="High-fidelity performance metrics with geofenced verification.">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[240px] rounded-full h-11"><SelectValue placeholder="Select Scope" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Organization Overview</SelectItem>
                {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
            </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid gap-6">
        {selectedUserId !== 'all' && userStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Leaves" value={userStats.leaves} icon={CalendarOff} color="text-blue-600" />
                <StatCard label="Work Hours" value={userStats.workHours} icon={Clock} color="text-green-600" />
                <StatCard label="Break Time" value={userStats.breakHours} icon={Coffee} color="text-yellow-600" />
                <StatCard label="Holidays" value={userStats.holidays} icon={Briefcase} color="text-slate-600" />
                <StatCard label="Sundays" value={userStats.sundays} icon={CalendarIcon} color="text-muted-foreground" />
                <StatCard label="Non-Compliance" value={userStats.nonCompliance} icon={AlertTriangle} color="text-orange-600" />
            </div>
        )}

        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <AreaChartIcon className="size-5 text-primary" />
                    7-Day Tactical Trend
                </CardTitle>
                <CardDescription>Sundays are excluded from trend calculations.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.1}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="present" stroke="#22c55e" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={3} stackId="1" />
                        <Area type="monotone" dataKey="late" stroke="#eab308" fillOpacity={1} fill="url(#colorLate)" strokeWidth={3} stackId="1" />
                        <Area type="monotone" dataKey="absent" stroke="#ef4444" fillOpacity={0.05} fill="#ef4444" strokeWidth={1} stackId="1" />
                        <Legend verticalAlign="bottom" align="right" iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>

        <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Info className="size-5 text-primary" />
                    Granular Analytics Grid
                </CardTitle>
                <CardDescription>Verified log with time-stamped geolocation pins.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Date & Employee</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Status</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Log In</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">L-Out</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">L-In</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Log Out</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center animate-pulse font-medium text-muted-foreground">Syncing data log...</TableCell></TableRow>
                            ) : gridData.length > 0 ? (
                                gridData.map((row, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell className="py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{format(row.date, 'MMM d, yyyy')}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase">{row.employeeName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Badge variant="outline" className={cn("rounded-full uppercase text-[9px] font-black tracking-widest", row.status.color)}>
                                                {row.status.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <MapPinLink 
                                                lat={row.att?.locationCheckInLatitude} 
                                                lng={row.att?.locationCheckInLongitude} 
                                                time={row.att?.checkInTime ? format(row.att.checkInTime.toDate(), 'p') : undefined} 
                                            />
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <MapPinLink 
                                                lat={row.att?.locationLunchOutLatitude} 
                                                lng={row.att?.locationLunchOutLongitude} 
                                                time={row.att?.lunchOutTime ? format(row.att.lunchOutTime.toDate(), 'p') : undefined} 
                                            />
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <MapPinLink 
                                                lat={row.att?.locationLunchInLatitude} 
                                                lng={row.att?.locationLunchInLongitude} 
                                                time={row.att?.lunchInTime ? format(row.att.lunchInTime.toDate(), 'p') : undefined} 
                                            />
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <MapPinLink 
                                                lat={row.att?.locationCheckOutLatitude} 
                                                lng={row.att?.locationCheckOutLongitude} 
                                                time={row.att?.checkOutTime ? format(row.att.checkOutTime.toDate(), 'p') : undefined} 
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No tactical data found for this period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) {
    return (
        <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
                    <Icon className="size-4" />
                </div>
                <div>
                    <p className="text-xl font-black">{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

