'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, differenceInSeconds } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type AttendanceRecord = {
    checkInTime?: Timestamp;
    checkOutTime?: Timestamp;
    totalBreakDuration?: number;
};

export function MissionHeatmapWidget() {
    const { user } = useUser();
    const firestore = useFirestore();

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const attendanceQuery = useMemoFirebase(() => user ? query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', Timestamp.fromDate(monthStart)),
        where('checkInTime', '<=', Timestamp.fromDate(monthEnd))
    ) : null, [user, firestore]);

    const { data: attendanceData, isLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    const days = React.useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

    const getIntensity = (hours: number) => {
        if (hours === 0) return 'bg-muted/30';
        if (hours < 4) return 'bg-primary/20';
        if (hours < 7) return 'bg-primary/40';
        if (hours < 9) return 'bg-primary/70';
        return 'bg-primary';
    };

    const avgHours = React.useMemo(() => {
        if (!attendanceData || attendanceData.length === 0) return "0.0";
        let total = 0;
        attendanceData.forEach(r => {
            if (r.checkInTime && r.checkOutTime) {
                total += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
            }
        });
        return ((total / 3600) / attendanceData.length).toFixed(1);
    }, [attendanceData]);

    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-full">
            <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                            <Activity className="size-4 text-primary" /> Mission Heatmap
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Attendance consistency grid</CardDescription>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-primary leading-none">{avgHours}</p>
                        <p className="text-[8px] font-black uppercase text-muted-foreground">Avg Hrs/Shift</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-4">
                <div className="grid grid-cols-7 gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="text-[9px] font-black text-muted-foreground/30 text-center mb-1">{d}</div>
                    ))}
                    
                    <TooltipProvider delayDuration={0}>
                        {days.map((day, i) => {
                            const record = attendanceData?.find(r => r.checkInTime && isSameDay(r.checkInTime.toDate(), day));
                            let hours = 0;
                            if (record?.checkInTime && record?.checkOutTime) {
                                hours = (differenceInSeconds(record.checkOutTime.toDate(), record.checkInTime.toDate()) - (record.totalBreakDuration || 0)) / 3600;
                            }

                            return (
                                <Tooltip key={i}>
                                    <TooltipTrigger asChild>
                                        <div className={cn(
                                            "aspect-square rounded-md transition-all duration-300 hover:scale-110 shadow-sm",
                                            getIntensity(hours)
                                        )} />
                                    </TooltipTrigger>
                                    <TooltipContent className="rounded-xl border-none shadow-2xl bg-sidebar text-white p-3">
                                        <div className="text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{format(day, 'MMM dd, yyyy')}</p>
                                            <p className="text-sm font-bold">{hours.toFixed(1)} Tactical Hours</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>

                <div className="mt-8 pt-6 border-t border-dashed border-border/50 flex items-center justify-between">
                    <div className="flex gap-1.5 items-center">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase mr-1">Less</span>
                        {[0, 2, 5, 8, 10].map(h => <div key={h} className={cn("size-2.5 rounded-sm shadow-sm", getIntensity(h))} />)}
                        <span className="text-[8px] font-bold text-muted-foreground uppercase ml-1">More</span>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase rounded-full bg-muted/20 border-none px-3">Monthly Audit</Badge>
                </div>
            </CardContent>
        </Card>
    );
}
