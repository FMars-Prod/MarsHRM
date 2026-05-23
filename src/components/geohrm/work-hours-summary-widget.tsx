'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { startOfMonth, endOfMonth, differenceInSeconds, startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { Activity, TrendingUp, Zap, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AttendanceRecord = {
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
};

const chartConfig = {
  hours: {
    label: "Work Volume",
    color: "hsl(var(--primary))",
  },
} satisfies React.ComponentProps<typeof ChartContainer>['config'];

export function WorkHoursSummaryWidget() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [viewMode, setViewMode] = React.useState<'weekly' | 'monthly'>('weekly');

    const { start, end } = React.useMemo(() => {
        const now = new Date();
        if (viewMode === 'weekly') {
            return {
                start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
                end: endOfWeek(now, { weekStartsOn: 1 }), // Sunday
            };
        } else {
            return {
                start: startOfMonth(now),
                end: endOfMonth(now),
            };
        }
    }, [viewMode]);

    const attendanceQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, `users/${user.uid}/attendances`),
            where('checkInTime', '>=', start),
            where('checkInTime', '<=', end)
        );
    }, [user, firestore, start, end]);

    const { data: attendanceData, isLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    const chartData = React.useMemo(() => {
        if (!attendanceData) return [];

        if (viewMode === 'weekly') {
            const dailyHours = new Map<string, number>();
            const daysInWeek = eachDayOfInterval({ start, end });
            daysInWeek.forEach(day => {
                dailyHours.set(format(day, 'EEE'), 0);
            });

            attendanceData.forEach(rec => {
                if (rec.checkInTime && rec.checkOutTime) {
                    const dayKey = format(rec.checkInTime.toDate(), 'EEE');
                    const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                    const currentHours = dailyHours.get(dayKey) || 0;
                    dailyHours.set(dayKey, currentHours + workSeconds / 3600);
                }
            });

            return Array.from(dailyHours.entries()).map(([name, hours]) => ({
                name,
                hours: parseFloat(hours.toFixed(1)),
            }));
        } else {
            const weeklyHours: { [week: string]: number } = {
                "W1": 0, "W2": 0, "W3": 0, "W4": 0, "W5": 0,
            };

            attendanceData.forEach(rec => {
                if (rec.checkInTime && rec.checkOutTime) {
                    const date = rec.checkInTime.toDate();
                    const dayOfMonth = date.getDate();
                    const weekNumber = Math.ceil(dayOfMonth / 7);
                    
                    if (weekNumber >= 1 && weekNumber <= 5) {
                        const weekKey = `W${weekNumber}`;
                        const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                        weeklyHours[weekKey] += workSeconds / 3600;
                    }
                }
            });

            return Object.keys(weeklyHours).map(name => ({
                name,
                hours: parseFloat(weeklyHours[name].toFixed(1)),
            }));
        }
    }, [attendanceData, viewMode, start, end]);

    const totalHours = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.hours, 0).toFixed(1);
    }, [chartData]);

    const peakHours = React.useMemo(() => {
        return Math.max(...chartData.map(d => d.hours), 0).toFixed(1);
    }, [chartData]);

    return (
        <Card className="animate-fade-in-up border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-full flex flex-col font-open-sans">
            <CardHeader className="p-8 pb-4">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-xl font-black uppercase tracking-tighter text-primary">
                                Mission Intensity
                            </CardTitle>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-black uppercase rounded-full px-2">
                                <Zap className="size-2 mr-1 fill-primary" /> Tactical Pulse
                            </Badge>
                        </div>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            {viewMode === 'weekly' ? 'Current operational week audit' : 'Monthly fleet engagement summary'}
                        </CardDescription>
                    </div>
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'weekly' | 'monthly')}>
                        <TabsList className="h-9 bg-muted/30 p-1 rounded-xl">
                            <TabsTrigger value="weekly" className="h-7 px-3 text-[9px] font-black uppercase rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Week</TabsTrigger>
                            <TabsTrigger value="monthly" className="h-7 px-3 text-[9px] font-black uppercase rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Month</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest mb-1">Total Effort</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tighter text-primary">{totalHours}</span>
                            <span className="text-[10px] font-bold text-primary/40 uppercase">hrs</span>
                        </div>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-2xl border border-border/50">
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Peak Intensity</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tighter text-foreground/80">{peakHours}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">hrs</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-8 pt-2 flex-1">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 opacity-30">
                        <Clock className="size-8 animate-spin mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Syncing Records...</p>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <AreaChart
                            data={chartData}
                            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                className="text-[10px] font-black uppercase tracking-widest fill-muted-foreground/40"
                            />
                            <YAxis
                                tickFormatter={(value) => `${value}h`}
                                axisLine={false}
                                tickLine={false}
                                className="text-[9px] font-bold fill-muted-foreground/30"
                            />
                            <ChartTooltip
                                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                                content={<ChartTooltipContent 
                                    formatter={(value) => `${value} Tactical Hours`}
                                    indicator="line"
                                />}
                            />
                            <Area
                                type="monotone"
                                dataKey="hours"
                                stroke="hsl(var(--primary))"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorHours)"
                                activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                            />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
            
            <div className="px-8 pb-8 pt-0 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                    <TrendingUp className="size-3" /> Mission Velocity Audit
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" />
            </div>
        </Card>
    );
}
