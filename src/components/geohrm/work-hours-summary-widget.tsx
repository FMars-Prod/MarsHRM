'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { startOfMonth, endOfMonth, differenceInSeconds, startOfWeek, endOfWeek } from 'date-fns';
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

    const summaryData = React.useMemo(() => {
        if (!attendanceData) {
            return { workHours: 0, breakHours: 0 };
        }
        let totalWorkSeconds = 0;
        let totalBreakSeconds = 0;

        attendanceData.forEach(rec => {
            if (rec.checkInTime && rec.checkOutTime) {
                const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
                const breakDuration = rec.totalBreakDuration || 0;
                totalWorkSeconds += workSeconds - breakDuration;
                totalBreakSeconds += breakDuration;
            }
        });

        return {
            workHours: parseFloat((totalWorkSeconds / 3600).toFixed(1)),
            breakHours: parseFloat((totalBreakSeconds / 3600).toFixed(1)),
        };
    }, [attendanceData]);

    const chartData = [
        { name: 'Work', hours: summaryData.workHours, fill: 'hsl(var(--chart-1))' },
        { name: 'Break', hours: summaryData.breakHours, fill: 'hsl(var(--chart-2))' }
    ];
    
    const periodText = viewMode === 'weekly' ? 'this week' : 'this month';

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Activity className="size-5" />
                        Hours Summary
                    </CardTitle>
                    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'weekly' | 'monthly')}>
                        <TabsList className="h-8">
                            <TabsTrigger value="weekly" className="h-6 px-2 text-xs">Weekly</TabsTrigger>
                            <TabsTrigger value="monthly" className="h-6 px-2 text-xs">Monthly</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <CardDescription>
                    Your total work and break hours for {periodText}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[200px] flex items-center justify-center">
                        <p className="text-muted-foreground">Loading chart data...</p>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ left: -10 }}
                            accessibilityLayer
                        >
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                className="text-sm"
                            />
                            <XAxis dataKey="hours" type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent
                                    formatter={(value) => `${value} hrs`}
                                    hideLabel
                                />}
                            />
                            <Bar
                                dataKey="hours"
                                radius={4}
                                barSize={32}
                            />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
