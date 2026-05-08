
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { collection, doc, query, where, orderBy, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSunday, isValid } from 'date-fns';
import { MapPin, Calendar as CalendarIcon, FileDown, AreaChart as AreaChartIcon, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import Link from 'next/link';

type User = { id: string; firstName: string; lastName: string; jobTitle: string; department: string; };

const chartConfig = {
  present: { label: "Present", color: "#22c55e" },
  late: { label: "Late", color: "#eab308" },
  absent: { label: "Absent", color: "#ef4444" },
} satisfies ChartConfig;

export default function AnalyticsPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = React.useState<string>("all");
  const [attendanceData, setAttendanceData] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  React.useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const start = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });

        let q;
        if (selectedUserId === 'all') {
            q = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', Timestamp.fromDate(start)));
        } else {
            q = query(collection(firestore, `users/${selectedUserId}/attendances`), where('checkInTime', '>=', Timestamp.fromDate(start)));
        }

        const snap = await getDocs(q);
        setAttendanceData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        toast({ variant: 'destructive', title: 'Data sync failed' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [selectedUserId, firestore]);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Organizational Analytics" description="High-fidelity performance metrics with Sunday exclusion logic.">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[240px] rounded-full h-11"><SelectValue placeholder="Select Scope" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Organization Overview</SelectItem>
                {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
            </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid gap-6">
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                    <AreaChartIcon className="size-5 text-primary" />
                    High-Fidelity Trend Audit (7-Day)
                </CardTitle>
                <CardDescription>Sundays are excluded from tactical reporting logic.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {selectedUserId !== 'all' && (
            <Card className="border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle>Tactical Event Log</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Clock In</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-right">Verification</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendanceData.map((rec, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-bold">{rec.checkInTime && isValid(rec.checkInTime.toDate()) ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : '...'}</TableCell>
                                    <TableCell className="font-mono text-xs">{rec.checkInTime && isValid(rec.checkInTime.toDate()) ? format(rec.checkInTime.toDate(), 'p') : '--:--'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("rounded-full uppercase text-[9px] font-black", rec.status === 'present' ? 'text-green-600 border-green-200' : 'text-yellow-600 border-yellow-200')}>
                                            {rec.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {rec.isOutOfRange && <Badge className="bg-red-100 text-red-700 text-[8px] uppercase">Out of Range</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
