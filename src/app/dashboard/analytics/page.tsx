
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSunday, isValid, isAfter, isBefore, differenceInSeconds, startOfMonth, endOfMonth, subWeeks, subMonths, isToday } from 'date-fns';
import { MapPin, Calendar as CalendarIcon, AreaChart as AreaChartIcon, ExternalLink, Clock, Briefcase, CalendarOff, AlertTriangle, Coffee, Info, Filter, Activity, FileDown, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, BarChart } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type User = { id: string; firstName: string; lastName: string; jobTitle: string; department: string; role?: string; isDemoAccount?: boolean; };
type Holiday = { id: string; date: Timestamp; title: string; };
type LeaveRequest = { id: string; employeeId: string; startDate: Timestamp; endDate: Timestamp; status: string; };
type Attendance = { 
    id: string; 
    employeeId: string; 
    checkInTime?: Timestamp; 
    checkOutTime?: Timestamp; 
    lunchOutTime?: Timestamp; 
    lunchInTime?: Timestamp;
    breakOutTime?: Timestamp;
    breakInTime?: Timestamp;
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
    isAtHome?: boolean;
    totalBreakDuration?: number;
};

const orgChartConfig = {
  present: { label: "Present", color: "#22c55e" },
  late: { label: "Late", color: "#eab308" },
  absent: { label: "Absent", color: "#ef4444" },
} satisfies ChartConfig;

const userChartConfig = {
  workHours: { label: "Work Hours", color: "hsl(var(--primary))" },
  breakHours: { label: "Break Time", color: "hsl(var(--accent))" },
} satisfies ChartConfig;

// Helper functions
const isWithinInterval = (start: Date, end: Date, range: {start: Date, end: Date}) => {
    return (start <= range.end && end >= range.start);
};

const isWithinLeave = (day: Date, leave: LeaveRequest) => {
    const d = startOfDay(day);
    const start = startOfDay(leave.startDate.toDate());
    const end = startOfDay(leave.endDate.toDate());
    return (d >= start && d <= end);
};

const formatSecondsToHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

const MapPinLink = ({ lat, lng, time }: { lat?: number, lng?: number, time?: string }) => {
    if (!time) return <span className="text-muted-foreground/30">—</span>;
    return (
        <div className="flex items-center gap-1.5 group">
            <span className="font-mono text-[10px] font-bold">{time}</span>
            {lat && lng ? (
                <Link 
                    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} 
                    target="_blank"
                    className="opacity-40 group-hover:opacity-100 transition-opacity"
                >
                    <MapPin className="size-3 text-primary" />
                </Link>
            ) : null}
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

  // Filter States - Default to Today
  const [dateFilter, setDateFilter] = React.useState<string>("today");
  const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const holidaysQuery = useMemoFirebase(() => query(collection(firestore, 'holidays')), [firestore]);
  const { data: holidays } = useCollection<Holiday>(holidaysQuery);

  const leavesQuery = useMemoFirebase(() => query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved')), [firestore]);
  const { data: leaves } = useCollection<LeaveRequest>(leavesQuery);

  const dateRange = React.useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateFilter) {
        case 'today':
            start = startOfDay(now);
            end = endOfDay(now);
            break;
        case 'yesterday':
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
            break;
        case 'this-week':
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfDay(now);
            break;
        case 'prev-week':
            start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
            end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
            break;
        case 'prev-month':
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
            break;
        case 'custom-date':
            start = startOfDay(new Date(customStartDate));
            end = endOfDay(new Date(customStartDate));
            break;
        case 'custom-range':
            start = startOfDay(new Date(customStartDate));
            end = endOfDay(new Date(customEndDate));
            break;
        default: // today
            start = startOfDay(now);
            end = endOfDay(now);
            break;
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  React.useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        let q;
        if (selectedUserId === 'all') {
            q = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', Timestamp.fromDate(dateRange.start)), where('checkInTime', '<=', Timestamp.fromDate(dateRange.end)));
        } else {
            q = query(collection(firestore, `users/${selectedUserId}/attendances`), where('checkInTime', '>=', Timestamp.fromDate(dateRange.start)), where('checkInTime', '<=', Timestamp.fromDate(dateRange.end)));
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
  }, [selectedUserId, firestore, toast, dateRange]);

  const trendData = React.useMemo(() => {
    const isSingleDay = isSameDay(dateRange.start, dateRange.end);
    const trendStart = isSingleDay ? subDays(dateRange.start, 6) : dateRange.start;
    const trendEnd = dateRange.end;

    const days = eachDayOfInterval({ start: trendStart, end: trendEnd }).filter(d => !isSunday(d));
    
    const expectedUsers = users?.filter(u => 
        u.role !== 'CEO/Admin' && 
        u.role !== 'HR Manager' && 
        !u.isDemoAccount
    ) || [];
    const expectedCount = expectedUsers.length;

    return days.map(day => {
        const dayStr = format(day, 'EEE, MMM d');
        const dayRecs = attendanceData.filter(r => r.checkInTime && isSameDay(r.checkInTime.toDate(), day));
        
        if (selectedUserId === 'all') {
            const dayPresent = dayRecs.filter(r => r.status === 'present' && expectedUsers.some(u => u.id === r.employeeId)).length;
            const dayLate = dayRecs.filter(r => r.status === 'late' && expectedUsers.some(u => u.id === r.employeeId)).length;
            return {
                date: dayStr,
                present: dayPresent,
                late: dayLate,
                absent: Math.max(0, expectedCount - dayPresent - dayLate)
            };
        } else {
            const att = dayRecs[0];
            let workHours = 0;
            let breakHours = 0;
            if (att?.checkInTime && att?.checkOutTime) {
                const diff = differenceInSeconds(att.checkOutTime.toDate(), att.checkInTime.toDate());
                const brk = att.totalBreakDuration || 0;
                workHours = (diff - brk) / 3600;
                breakHours = brk / 3600;
            }
            return {
                date: dayStr,
                workHours: parseFloat(workHours.toFixed(2)),
                breakHours: parseFloat(breakHours.toFixed(2))
            };
        }
    });
  }, [attendanceData, users, dateRange, selectedUserId]);

  const getDayStatusLocal = (user: User, day: Date) => {
      const today = startOfDay(new Date());
      if (isAfter(day, today)) return { status: 'future', label: '—', color: 'bg-muted/10 text-muted-foreground' };

      const att = attendanceData.find(a => a.employeeId === user.id && isSameDay(a.checkInTime?.toDate() || new Date(0), day));
      if (att) {
          if (att.checkInTime && !att.checkOutTime && isBefore(day, today)) {
              return { status: 'non-compliance', label: 'Non-Compliance', color: 'bg-orange-100 text-orange-700 border-orange-200' };
          }
          
          let label = att.status.toUpperCase();
          let color = att.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
          let icon = null;

          if (att.isAtHome) {
              label = "HOME";
              color = "bg-blue-100 text-blue-700 border-blue-200";
              icon = <Home className="size-2 mr-1" />;
          } else if (att.isOutOfRange) {
              label = "OUT OF RANGE";
              color = "bg-orange-100 text-orange-700 border-orange-200";
              icon = <AlertTriangle className="size-2 mr-1" />;
          }

          return { 
              status: att.status, 
              label, 
              color,
              icon
          };
      }

      const holiday = holidays?.find(h => isSameDay(h.date.toDate(), day));
      if (holiday) return { status: 'holiday', label: 'Holiday', color: 'bg-slate-100 text-slate-700 border-slate-200' };

      const leave = leaves?.find(l => l.employeeId === user.id && isWithinLeave(day, l));
      if (leave) return { status: 'leave', label: 'On Leave', color: 'bg-blue-100 text-blue-700 border-blue-200' };

      if (isSunday(day)) return { status: 'sunday', label: 'Sunday', color: 'bg-muted/30 text-muted-foreground border-transparent' };

      return { status: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' };
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

      const userLeaves = leaves?.filter(l => l.employeeId === user.id && isWithinInterval(l.startDate.toDate(), l.endDate.toDate(), dateRange)).reduce((acc, l) => {
          const start = isBefore(l.startDate.toDate(), dateRange.start) ? dateRange.start : l.startDate.toDate();
          const end = isAfter(l.endDate.toDate(), dateRange.end) ? dateRange.end : l.endDate.toDate();
          const days = eachDayOfInterval({ start, end }).length;
          return acc + days;
      }, 0) || 0;

      const rangeDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const sunCount = rangeDays.filter(d => isSunday(d)).length;
      const holCount = holidays?.filter(h => rangeDays.some(d => isSameDay(h.date.toDate(), d))).length || 0;

      return {
          leaves: userLeaves,
          workHours: (totalWorkSec / 3600).toFixed(1),
          breakHours: (totalBreakSec / 3600).toFixed(1),
          holidays: holCount,
          sundays: sunCount,
          nonCompliance
      };
  }, [selectedUserId, attendanceData, leaves, holidays, users, dateRange]);

  const gridData = React.useMemo(() => {
      const range = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).reverse();
      const expectedUsers = users?.filter(u => u.role !== 'CEO/Admin' && u.role !== 'HR Manager' && !u.isDemoAccount) || [];

      // If viewing all, show every day and every expected user for that day
      if (selectedUserId === 'all') {
          const results: any[] = [];
          range.forEach(day => {
              expectedUsers.forEach(user => {
                  const att = attendanceData.find(a => a.employeeId === user.id && isSameDay(a.checkInTime?.toDate() || new Date(0), day));
                  const statusInfo = getDayStatusLocal(user, day);
                  results.push({
                      date: day,
                      employeeName: `${user.firstName} ${user.lastName}`,
                      employeeId: user.id,
                      status: statusInfo,
                      att
                  });
              });
          });
          return results;
      }

      // If viewing individual
      const user = users?.find(u => u.id === selectedUserId);
      if (!user) return [];
      return range.map(day => {
          const att = attendanceData.find(a => a.employeeId === user.id && isSameDay(a.checkInTime?.toDate() || new Date(0), day));
          const statusInfo = getDayStatusLocal(user, day);
          return {
              date: day,
              employeeName: `${user.firstName} ${user.lastName}`,
              employeeId: user.id,
              status: statusInfo,
              att
          };
      });
  }, [selectedUserId, users, attendanceData, holidays, leaves, dateRange]);

  const handleExportPdf = () => {
    if (selectedUserId === 'all' || !users) {
        toast({ variant: 'destructive', title: 'Export Restricted', description: 'Please select an individual employee to generate a performance audit PDF.' });
        return;
    }

    const user = users.find(u => u.id === selectedUserId);
    if (!user || !userStats) return;

    const pdfDoc = new jsPDF();
    const dateRangeStr = `${format(dateRange.start, 'PPP')} - ${format(dateRange.end, 'PPP')}`;

    pdfDoc.setFontSize(16);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("FortuMars AI Technologies & Business Solutions.", pdfDoc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    pdfDoc.setFontSize(12);
    pdfDoc.setTextColor(100);
    pdfDoc.text("Individual Performance Audit Report", pdfDoc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
    
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(0);
    pdfDoc.text(`Employee: ${user.firstName} ${user.lastName}`, 14, 45);
    pdfDoc.text(`Designation: ${user.jobTitle}`, 14, 50);
    pdfDoc.text(`Department: ${user.department}`, 14, 55);
    pdfDoc.text(`Audit Period: ${dateRangeStr}`, 14, 60);
    pdfDoc.text(`Generated On: ${format(new Date(), 'PP p')}`, 14, 65);

    pdfDoc.setFontSize(11);
    pdfDoc.text("Strategic Metrics Summary:", 14, 75);
    
    const summaryData = [
        ["Total Work Hours (Net)", `${userStats.workHours} h`],
        ["Total Break Volume", `${userStats.breakHours} h`],
        ["Leaves Taken", `${userStats.leaves}`],
        ["Non-Compliance Days", `${userStats.nonCompliance}`],
        ["Holidays", `${userStats.holidays}`],
        ["Sundays", `${userStats.sundays}`]
    ];

    autoTable(pdfDoc, {
        startY: 80,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] },
        margin: { left: 14, right: 14 }
    });

    const logStartY = (pdfDoc as any).lastAutoTable.finalY + 15;
    pdfDoc.text("Granular Attendance Log:", 14, logStartY);

    const logBody = gridData.map(row => {
        const dateStr = format(row.date, 'MMM d, yyyy');
        const status = row.status.label;
        const checkIn = row.att?.checkInTime ? format(row.att.checkInTime.toDate(), 'p') : '-';
        const breakTotal = row.att?.totalBreakDuration ? formatSecondsToHours(row.att.totalBreakDuration) : '-';
        const checkOut = row.att?.checkOutTime ? format(row.att.checkOutTime.toDate(), 'p') : '-';
        
        return [dateStr, status, checkIn, breakTotal, checkOut];
    });

    autoTable(pdfDoc, {
        startY: logStartY + 5,
        head: [['Date', 'Status', 'Log In', 'Total Break', 'Log Out']],
        body: logBody,
        theme: 'grid',
        headStyles: { fillColor: [39, 55, 70] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
    });

    const pageCount = pdfDoc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdfDoc.setPage(i);
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(150);
        pdfDoc.text(`Page ${i} of ${pageCount} - MarsHRM Proprietary Performance Data`, 14, pdfDoc.internal.pageSize.height - 10);
    }

    pdfDoc.save(`Performance_Audit_${user.firstName}_${user.lastName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Organizational Analytics" description="High-fidelity performance metrics with absentee identification and geofenced verification.">
        <div className="flex flex-wrap gap-2">
            {selectedUserId !== 'all' && (
                <Button variant="outline" className="rounded-full h-11 bg-white/50" onClick={handleExportPdf}>
                    <FileDown className="size-4 mr-2" />
                    Download PDF
                </Button>
            )}
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[200px] rounded-full h-11"><SelectValue placeholder="Scope" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Organization Overview</SelectItem>
                    {users?.filter(u => u.firstName && u.lastName).map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px] rounded-full h-11">
                    <div className="flex items-center gap-2">
                        <Filter className="size-3.5 opacity-50" />
                        <SelectValue placeholder="Timeline" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Presets</SelectLabel>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this-week">This Week</SelectItem>
                        <SelectItem value="prev-week">Previous Week</SelectItem>
                        <SelectItem value="prev-month">Previous Month</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                        <SelectLabel>Custom</SelectLabel>
                        <SelectItem value="custom-date">Select Date</SelectItem>
                        <SelectItem value="custom-range">Select Range</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>

            {(dateFilter === 'custom-date' || dateFilter === 'custom-range') && (
                <div className="flex gap-2 items-center">
                    <Input 
                        type="date" 
                        value={customStartDate} 
                        onChange={e => setCustomStartDate(e.target.value)} 
                        className="h-11 rounded-xl w-40 bg-white/50 border-none ring-1 ring-border/50" 
                    />
                    {dateFilter === 'custom-range' && (
                        <>
                            <span className="text-[10px] font-black uppercase text-muted-foreground">to</span>
                            <Input 
                                type="date" 
                                value={customEndDate} 
                                onChange={e => setCustomEndDate(e.target.value)} 
                                className="h-11 rounded-xl w-40 bg-white/50 border-none ring-1 ring-border/50" 
                            />
                        </>
                    )}
                </div>
            )}
        </div>
      </PageHeader>

      <div className="grid gap-6">
        {selectedUserId !== 'all' && userStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Leaves" value={userStats.leaves} icon={CalendarOff} color="text-blue-600" />
                <StatCard label="Work Hours" value={userStats.workHours} icon={Clock} color="text-green-600" />
                <StatCard label="Break Volume" value={userStats.breakHours} icon={Coffee} color="text-yellow-600" />
                <StatCard label="Holidays" value={userStats.holidays} icon={Briefcase} color="text-slate-600" />
                <StatCard label="Sundays" value={userStats.sundays} icon={CalendarIcon} color="text-muted-foreground" />
                <StatCard label="Non-Compliance" value={userStats.nonCompliance} icon={AlertTriangle} color="text-orange-600" />
            </div>
        )}

        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                    {selectedUserId === 'all' ? <AreaChartIcon className="size-5 text-primary" /> : <Activity className="size-5 text-primary" />}
                    {selectedUserId === 'all' ? 'Tactical Trend Analysis' : 'Individual Productivity Analysis'}
                </CardTitle>
                <CardDescription>
                    {selectedUserId === 'all' ? 'Sundays are excluded from trend calculations.' : 'Visualization of daily work vs break hours.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                {selectedUserId === 'all' ? (
                    <ChartContainer config={orgChartConfig} className="h-full w-full">
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
                ) : (
                    <ChartContainer config={userChartConfig} className="h-full w-full">
                        <BarChart data={trendData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} unit="h" />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="workHours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="breakHours" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                            <Legend verticalAlign="bottom" align="right" iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>

        <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <Info className="size-5 text-primary" />
                    Granular Analytics Grid
                </CardTitle>
                <CardDescription>Verified log with time-stamped geolocation pins and absentee tracking.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Date & Employee</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Status</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Log In</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Total Break</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Log Out</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse font-medium text-muted-foreground">Syncing data log...</TableCell></TableRow>
                            ) : gridData.length > 0 ? (
                                gridData.map((row, i) => (
                                    <TableRow key={i} className="border-border/50">
                                        <TableCell className="py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{format(row.date, 'MMM d, yyyy')}</span>
                                                {row.employeeId ? (
                                                    <Link href={`/dashboard/users/${row.employeeId}`} className="text-[10px] text-muted-foreground font-medium uppercase hover:text-primary transition-colors">
                                                        {row.employeeName}
                                                    </Link>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase">{row.employeeName}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Badge variant="outline" className={cn("rounded-full uppercase text-[9px] font-black tracking-widest gap-1", (row.status as any).color)}>
                                                {(row.status as any).icon}
                                                {(row.status as any).label}
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
                                            <div className="flex items-center gap-1.5">
                                                <Coffee className="size-3 text-amber-500 opacity-50" />
                                                <span className="font-mono text-[10px] font-bold">
                                                    {row.att?.totalBreakDuration ? formatSecondsToHours(row.att.totalBreakDuration) : '—'}
                                                </span>
                                            </div>
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
                                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No tactical data found for this period.</TableCell></TableRow>
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
