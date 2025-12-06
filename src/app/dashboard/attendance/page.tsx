
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfMonth } from "date-fns";
import { CheckCircle, XCircle, AlertTriangle, Briefcase } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";

type Status = "present" | "late" | "absent" | "on_leave";
type AttendanceRecord = { 
  id: string;
  status: Status; 
  checkInTime?: any; 
  checkOutTime?: any;
};

const statusDetails = {
    present: { Icon: CheckCircle, className: "text-green-600", label: "Present" },
    late: { Icon: AlertTriangle, className: "text-yellow-600", label: "Late" },
    absent: { Icon: XCircle, className: "text-red-600", label: "Absent" },
    on_leave: { Icon: Briefcase, className: "text-blue-600", label: "On Leave" },
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

  const { data: attendanceData, isLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const events = React.useMemo(() => {
    return (attendanceData || []).map(record => ({
        date: record.checkInTime.toDate(),
        status: record.status,
        clockIn: record.checkInTime ? format(record.checkInTime.toDate(), 'p') : '-',
        clockOut: record.checkOutTime ? format(record.checkOutTime.toDate(), 'p') : '-',
    }));
  }, [attendanceData]);

  const statusCounts = React.useMemo(() => {
    return (attendanceData || []).reduce(
      (acc, event) => {
        acc[event.status]++;
        return acc;
      },
      { present: 0, late: 0, absent: 0, on_leave: 0 }
    );
  }, [attendanceData]);

  const selectedDayEvent = React.useMemo(() => {
      if (!date) return null;
      return events.find(e => isSameDay(e.date, date)) || null;
  }, [date, events]);

  const modifiers = React.useMemo(() => {
    const modifiers: Record<string, Date[]> = {
        present: [],
        late: [],
        absent: [],
        on_leave: []
    };
    events.forEach(event => {
        if (modifiers[event.status]) {
            modifiers[event.status].push(event.date);
        }
    });
    return modifiers;
  }, [events]);

  const modifiersClassNames = {
    present: 'bg-green-500/20 text-green-700',
    late: 'bg-yellow-500/20 text-yellow-700',
    absent: 'bg-red-500/20 text-red-700',
    on_leave: 'bg-blue-500/20 text-blue-700',
  };

  return (
    <>
      <PageHeader
        title="Attendance Calendar"
        description="View your monthly attendance at a glance."
      />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-0">
               {isLoading ? (
                 <div className="flex justify-center items-center h-[350px]">Loading calendar...</div>
               ) : (
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    className="p-3"
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                />
               )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-headline">
                        {date ? format(date, "MMMM do, yyyy") : 'Selected Day'}
                    </CardTitle>
                    <CardDescription>Details for the selected day</CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedDayEvent ? (() => {
                        const details = statusDetails[selectedDayEvent.status as keyof typeof statusDetails];
                        const {Icon, className, label} = details;
                        return (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Icon className={cn("h-6 w-6", className)} />
                                    <span className={cn("font-semibold text-lg", className)}>{label}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Clock In</p>
                                        <p className="font-semibold">{selectedDayEvent.clockIn}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Clock Out</p>
                                        <p className="font-semibold">{selectedDayEvent.clockOut}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })() : (
                        <div className="flex items-center justify-center h-24 text-muted-foreground">
                            <p>No record for this day</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-headline">Monthly Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg">
                            <span className="text-3xl font-bold text-green-700">{statusCounts.present}</span>
                            <span className="text-sm text-green-600">Present</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg">
                            <span className="text-3xl font-bold text-yellow-700">{statusCounts.late}</span>
                            <span className="text-sm text-yellow-600">Late</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
                            <span className="text-3xl font-bold text-red-700">{statusCounts.absent}</span>
                            <span className="text-sm text-red-600">Absent</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
                            <span className="text-3xl font-bold text-blue-700">{statusCounts.on_leave}</span>
                            <span className="text-sm text-blue-600">On Leave</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}

    