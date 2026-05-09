
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, AlertTriangle, Utensils, LogIn, Phone, PieChart as PieChartIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pie, PieChart, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import Link from 'next/link';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string;
  avatar?: string;
  role?: string;
};

const CHART_COLORS = {
  present: '#22c55e',
  late: '#eab308',
  outOfRange: '#f97316',
  absent: '#ef4444',
};

const monitorChartConfig = {
  present: { label: "Present", color: CHART_COLORS.present },
  late: { label: "Late", color: CHART_COLORS.late },
  outOfRange: { label: "Out of Range", color: CHART_COLORS.outOfRange },
  absent: { label: "Absent", color: CHART_COLORS.absent },
} satisfies ChartConfig;

export default function MonitorPage() {
  const firestore = useFirestore();
  const [date, setDate] = React.useState<Date>(new Date());
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    present: [] as UserData[],
    outOfRange: [] as UserData[],
    lunchOut: [] as UserData[],
    noLunch: [] as UserData[],
    isLoading: true,
  });

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<UserData>(usersQuery);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
      if (!users || !firestore) return;
      setSummary(prev => ({ ...prev, isLoading: true }));
      try {
        const start = startOfDay(date);
        const end = endOfDay(date);
        const attSnap = await getDocs(query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', start), where('checkInTime', '<=', end)));
        const attMap = new Map();
        attSnap.docs.forEach(d => attMap.set(d.data().employeeId, d.data()));

        const present: UserData[] = [], late: UserData[] = [], outOfRange: UserData[] = [], lunchOut: UserData[] = [], noLunch: UserData[] = [], absent: UserData[] = [];

        users.forEach(u => {
            const att = attMap.get(u.id);
            if (att) {
                if (att.isOutOfRange) outOfRange.push(u);
                else if (att.status === 'late') late.push(u);
                else present.push(u);

                if (att.locationLunchOutLatitude && !att.locationLunchInLatitude) lunchOut.push(u);
                if (!att.locationLunchOutLatitude) noLunch.push(u);
            } else {
                if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') {
                    absent.push(u);
                }
            }
        });

        setSummary({ late, absent, present, outOfRange, lunchOut, noLunch, isLoading: false });
      } catch (e) {
        setSummary(prev => ({ ...prev, isLoading: false }));
      }
    };
    fetchMonitorData();
  }, [users, date, firestore]);

  const chartData = React.useMemo(() => [
    { name: 'Present', value: summary.present.length, fill: CHART_COLORS.present },
    { name: 'Late', value: summary.late.length, fill: CHART_COLORS.late },
    { name: 'Out of Range', value: summary.outOfRange.length, fill: CHART_COLORS.outOfRange },
    { name: 'Absent', value: summary.absent.length, fill: CHART_COLORS.absent },
  ].filter(d => d.value > 0), [summary]);

  const MonitorCard = ({ title, users, icon: Icon, color }: any) => (
    <Sheet>
        <SheetTrigger asChild>
            <Card className="cursor-pointer hover:bg-muted/50 transition-all border-none ring-1 ring-border/50">
                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", color)}><Icon className="size-5" /></div>
                        <span className="text-sm font-bold uppercase tracking-tight">{title}</span>
                    </div>
                    <span className="text-xl font-black">{users.length}</span>
                </CardHeader>
            </Card>
        </SheetTrigger>
        <SheetContent className="rounded-l-3xl shadow-2xl border-none">
            <SheetHeader><SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{title} ({users.length})</SheetTitle></SheetHeader>
            <ScrollArea className="h-full mt-4">
                <div className="space-y-3">
                    {users.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-colors border group">
                            <Link href={`/dashboard/users/${u.id}`} className="flex items-center gap-3">
                                <Avatar className="size-10 ring-1 ring-primary/20 ring-offset-2">
                                    {u.avatar ? <span className="text-2xl">{u.avatar}</span> : <AvatarFallback>{u.firstName?.[0]}</AvatarFallback>}
                                </Avatar>
                                <div><p className="text-sm font-bold group-hover:text-primary transition-colors">{u.firstName} {u.lastName}</p><p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{u.jobTitle}</p></div>
                            </Link>
                            <Button variant="ghost" size="icon" className="rounded-full text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => window.open(`https://wa.me/${u.phoneNumber?.replace(/\D/g,'')}?text=MarsHRM Alert: Please check your status.`, '_blank')}>
                                <Phone className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Real-Time Oversight" description="Tactical monitor with WhatsApp nudge integration.">
        <Popover>
            <PopoverTrigger asChild><Button variant="outline" className="rounded-full h-11 bg-white/50"><CalendarIcon className="size-4 mr-2" /> {format(date, 'PP')}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
        </Popover>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <MonitorCard title="Present" users={summary.present} icon={UserCheck} color="bg-green-100 text-green-700" />
            <MonitorCard title="Late" users={summary.late} icon={UserX} color="bg-yellow-100 text-yellow-700" />
            <MonitorCard title="Out of Range" users={summary.outOfRange} icon={AlertTriangle} color="bg-orange-100 text-orange-700" />
            <MonitorCard title="Absent" users={summary.absent} icon={UserRoundX} color="bg-red-100 text-red-700" />
            <MonitorCard title="L-OUT (Active)" users={summary.lunchOut} icon={Utensils} color="bg-blue-100 text-blue-700" />
            <MonitorCard title="No Lunch Logged" users={summary.noLunch} icon={LogIn} color="bg-slate-100 text-slate-700" />
        </div>
        
        <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <PieChartIcon className="size-4 text-primary" />
                    Fleet Distribution
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                {summary.isLoading ? (
                    <div className="h-full flex items-center justify-center animate-pulse text-muted-foreground text-xs uppercase font-bold">Scanning...</div>
                ) : chartData.length > 0 ? (
                    <ChartContainer config={monitorChartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs uppercase font-bold">No Data Available</div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
