'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { startOfMonth, endOfMonth, differenceInSeconds, startOfWeek, endOfWeek, eachDayOfInterval, format, getDaysInMonth } from 'date-fns';
import { Activity } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AttendanceRecord = {
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  totalBreakDuration?: number;
};

const chartConfig = {
  hours: {
    label: "Hours",
    color: "hsl(var(--chart-1))",
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
                "Week 1": 0,
                "Week 2": 0,
                "Week 3": 0,
                "Week 4": 0,
                "Week 5": 0,
            };

            attendanceData.forEach(rec => {
                if (rec.checkInTime && rec.checkOutTime) {
                    const date = rec.checkInTime.toDate();
                    const dayOfMonth = date.getDate();
                    const weekNumber = Math.ceil(dayOfMonth / 7);
                    
                    if (weekNumber >= 1 && weekNumber <= 5) {
                        const weekKey = `Week ${weekNumber}`;
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

    return (
        <Card className="animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '300ms' }}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Activity className="size-5" />
                        My Activity
                    </CardTitle>
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'weekly' | 'monthly')}>
                        <TabsList className="h-8 bg-white/50">
                            <TabsTrigger value="weekly" className="h-6 px-2 text-xs">Weekly</TabsTrigger>
                            <TabsTrigger value="monthly" className="h-6 px-2 text-xs">Monthly</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <CardDescription>
                    Your work and break hours summary.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground animate-pulse">Loading chart data...</p>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                            accessibilityLayer
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                className="text-[0.65rem] sm:text-xs"
                            />
                            <YAxis
                                tickFormatter={(value) => `${value}h`}
                                allowDecimals={false}
                                className="text-xs"
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent 
                                    formatter={(value) => `${value} hrs`}
                                    indicator="dot"
                                />}
                            />
                            <Bar
                                dataKey="hours"
                                fill="var(--color-hours)"
                                radius={4}
                            />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
