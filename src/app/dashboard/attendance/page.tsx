"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth, eachDayOfInterval, isSunday, isToday, isAfter, startOfDay } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Briefcase, Clock, CalendarDays, Info, Coffee, ChevronRight, Target, Activity } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, Timestamp } from "firebase/firestore";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Status = "present" | "late" | "absent" | "on_leave";

type AttendanceRecord = { 
  id: string;
  status: Status; 
  checkInTime?: Timestamp; 
  checkOutTime?: Timestamp;
};

type LeaveRequest = {
    id: string;
    startDate: Timestamp;
    endDate: Timestamp;
    status: string;
}

const statusDetails = {
    present: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Present" },
    late: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Late" },
    absent: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Absent" },
    on_leave: { icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", label: "On Leave" },
};

export default function AttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(new Date()));

  const attendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    return query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', monthStart),
        where('checkInTime', '<=', monthEnd)
    );
  }, [user, firestore, currentMonth]);

  const { data: attendanceData, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);
  
  const leaveQuery = useMemoFirebase(() => {
      if(!user) return null;
      return query(
          collection(firestore, 'leave_requests'),
          where('employeeId', '==', user.uid),
          where('status', '==', 'Approved')
      );
  }, [user, firestore]);
  
  const { data: leaveData, isLoading: isLeaveLoading } = useCollection<LeaveRequest>(leaveQuery);

  const events = React.useMemo(() => {
    const dailyRecords = new Map<string, {date: Date, status: Status, clockIn: string, clockOut: string}>();

    // Process attendance records
    (attendanceData || []).forEach(record => {
      if (!record.checkInTime) return;
      const day = format(record.checkInTime.toDate(), 'yyyy-MM-dd');
      dailyRecords.set(day, {
        date: record.checkInTime.toDate(),
        status: record.status,
        clockIn: record.checkInTime ? format(record.checkInTime.toDate(), 'p') : '-',
        clockOut: record.checkOutTime ? format(record.checkOutTime.toDate(), 'p') : '-',
      });
    });

    // Process approved leave days
    (leaveData || []).forEach(leave => {
        const interval = { start: leave.startDate.toDate(), end: leave.endDate.toDate() };
        eachDayOfInterval(interval).forEach(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            if (!dailyRecords.has(dayStr)) {
                dailyRecords.set(dayStr, {
                    date: day,
                    status: 'on_leave',
                    clockIn: '-',
                    clockOut: '-'
                });
            }
        })
    });
    
    return Array.from(dailyRecords.values());
  }, [attendanceData, leaveData]);

  const statusCounts = React.useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc[event.status]++;
        return acc;
      },
      { present: 0, late: 0, absent: 0, on_leave: 0 }
    );
  }, [events]);

  const selectedDayEvent = React.useMemo(() => {
      if (!date) return null;
      return events.find(e => isSameDay(e.date, date)) || null;
  }, [date, events]);

  const modifiers = React.useMemo(() => {
    const mods: Record<string, Date[]> = {
        present: [],
        late: [],
        absent: [],
        on_leave: [],
    };
    events.forEach(event => {
        if (mods[event.status]) {
            mods[event.status].push(event.date);
        }
    });
    return mods;
  }, [events]);

  const modifiersClassNames = {
    present: 'bg-green-500/20 text-green-700 font-bold ring-1 ring-green-500/30',
    late: 'bg-yellow-500/20 text-yellow-700 font-bold ring-1 ring-yellow-500/30',
    absent: 'bg-red-500/20 text-red-700 font-bold ring-1 ring-red-500/30',
    on_leave: 'bg-blue-500/20 text-blue-700 font-bold ring-1 ring-blue-500/30',
  };
  
  const isLoading = isAttendanceLoading || isLeaveLoading;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Attendance History"
        description="A simple overview of your monthly attendance and approved leaves."
      />
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Calendar Hub */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-muted/5 border-b py-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                    <CalendarDays className="size-4" /> Attendance Calendar — {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               {isLoading ? (
                 <div className="flex justify-center items-center h-[400px]">
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                        <div className="relative h-12 w-40 animate-pulse">
                            <Image
                              src="https://fortumars.com/fortumarslogo.png"
                              alt="FortuMars Logo"
                              fill
                              style={{ objectFit: 'contain' }}
                              priority
                            />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Syncing...</p>
                    </div>
                 </div>
               ) : (
                <div className="flex flex-col md:flex-row">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        className="p-6 flex-1"
                        modifiers={modifiers}
                        modifiersClassNames={modifiersClassNames}
                        disabled={{ dayOfWeek: [0] }}
                        showOutsideDays={false}
                    />
                    <div className="w-full md:w-64 bg-muted/5 border-l p-6 space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Status Legend</h4>
                        <div className="space-y-4">
                            {Object.entries(statusDetails).map(([key, detail]) => (
                                <div key={key} className="flex items-center gap-3">
                                    <div className={cn("size-8 rounded-lg flex items-center justify-center", detail.bg, detail.color)}>
                                        <detail.icon className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase">{detail.label}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tight">Status: {key}</span>
                                    </div>
                                </div>
                            ))}
                            <Separator className="opacity-50" />
                            <div className="flex items-center gap-3 opacity-40 grayscale">
                                <div className="size-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
                                    <Clock className="size-4" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase">Sunday</span>
                                    <span className="text-[9px] font-bold uppercase tracking-tight">Weekly Off</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
               )}
            </CardContent>
          </Card>

          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white p-6">
              <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-primary/5 text-primary">
                      <Info className="size-5" />
                  </div>
                  <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-widest">Attendance Notes</h4>
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80">
                          Attendance is verified using GPS location. Late marks are automatically added for check-ins after the shift start time. Sundays and holidays are not included in attendance calculations.
                      </p>
                  </div>
              </div>
          </Card>
        </div>

        {/* Right Column: Details & Summary */}
        <div className="lg:col-span-4 space-y-6">
             <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 border-b py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Target className="size-4" /> Day Details
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {selectedDayEvent ? (() => {
                        const detail = statusDetails[selectedDayEvent.status as keyof typeof statusDetails];
                        return (
                            <div className="space-y-8">
                                <div className="flex flex-col items-center text-center gap-3">
                                    <div className={cn("p-4 rounded-3xl shadow-lg transition-transform hover:scale-105", detail.bg, detail.color)}>
                                        <detail.icon className="size-8" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{date ? format(date, "MMMM do, yyyy") : 'Selected Date'}</p>
                                        <h3 className={cn("text-2xl font-black uppercase tracking-tighter", detail.color)}>{detail.label}</h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-muted/20 rounded-2xl text-center space-y-1">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Clock In</p>
                                        <p className="font-mono text-sm font-black text-primary">{selectedDayEvent.clockIn}</p>
                                    </div>
                                    <div className="p-4 bg-muted/20 rounded-2xl text-center space-y-1">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Clock Out</p>
                                        <p className="font-mono text-sm font-black text-primary">{selectedDayEvent.clockOut}</p>
                                    </div>
                                </div>

                                {selectedDayEvent.status === 'on_leave' && (
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                                        <Briefcase className="size-4 text-blue-600" />
                                        <p className="text-[10px] font-bold text-blue-700 uppercase">Approved Leave</p>
                                    </div>
                                )}
                            </div>
                        )
                    })() : (
                        <div className="flex flex-col items-center justify-center h-48 opacity-30 grayscale gap-4">
                            <Clock className="size-10" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No data for this date</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-muted/10 border-b py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Activity className="size-4" /> Monthly Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                        <SummaryStat label="Present" val={statusCounts.present} color="text-green-600" bg="bg-green-50" />
                        <SummaryStat label="Late" val={statusCounts.late} color="text-yellow-600" bg="bg-yellow-50" />
                        <SummaryStat label="Absent" val={statusCounts.absent} color="text-red-600" bg="bg-red-50" />
                        <SummaryStat label="On Leave" val={statusCounts.on_leave} color="text-blue-600" bg="bg-blue-50" />
                    </div>
                    <div className="mt-6 p-4 bg-primary/5 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-primary/10 transition-colors">
                        <div className="space-y-0.5">
                            <p className="text-[8px] font-black uppercase tracking-widest text-primary/60">Present Rate</p>
                            <p className="text-lg font-black tracking-tighter text-primary">84%</p>
                        </div>
                        <ChevronRight className="size-4 text-primary opacity-40 group-hover:translate-x-1 transition-transform" />
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, val, color, bg }: { label: string, val: number, color: string, bg: string }) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-4 rounded-2xl shadow-sm ring-1 ring-inset ring-border/10", bg)}>
            <span className={cn("text-2xl font-black tracking-tighter", color)}>{val}</span>
            <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-60", color)}>{label}</span>
        </div>
    );
}