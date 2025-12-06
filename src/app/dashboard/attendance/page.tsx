
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { addDays, format, isSameDay, startOfMonth } from "date-fns";
import { Clock, Coffee, Briefcase, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const events = [
  { date: new Date(), status: "present", clockIn: "09:01 AM", clockOut: "05:03 PM" },
  { date: addDays(new Date(), -1), status: "present", clockIn: "08:55 AM", clockOut: "05:00 PM" },
  { date: addDays(new Date(), -2), status: "late", clockIn: "09:15 AM", clockOut: "04:50 PM" },
  { date: addDays(new Date(), -3), status: "present", clockIn: "09:00 AM", clockOut: "05:00 PM" },
  { date: addDays(new Date(), -4), status: "absent", clockIn: "-", clockOut: "-" },
  { date: addDays(new Date(), -7), status: "present", clockIn: "08:59 AM", clockOut: "05:01 PM" },
  { date: addDays(new Date(), -8), status: "present", clockIn: "09:02 AM", clockOut: "05:00 PM" },
  { date: addDays(new Date(), -9), status: "present", clockIn: "09:03 AM", clockOut: "05:05 PM" },
  { date: addDays(new Date(), -10), status: "late", clockIn: "09:30 AM", clockOut: "05:30 PM" },
  { date: addDays(new Date(), -11), status: "present", clockIn: "08:50 AM", clockOut: "04:55 PM" },
  { date: addDays(new Date(), -14), status: "absent", clockIn: "-", clockOut: "-" },
  { date: addDays(new Date(), -15), status: "present", clockIn: "09:00 AM", clockOut: "05:00 PM" },
  { date: addDays(new Date(), -16), status: "present", clockIn: "09:00 AM", clockOut: "05:00 PM" },
];

type Status = "present" | "late" | "absent" | "permission";
type Event = { date: Date; status: Status; clockIn?: string; clockOut?: string };

const statusDetails = {
    present: { Icon: CheckCircle, className: "text-green-600", label: "Present" },
    late: { Icon: AlertTriangle, className: "text-yellow-600", label: "Late" },
    absent: { Icon: XCircle, className: "text-red-600", label: "Absent" },
    permission: { Icon: Briefcase, className: "text-blue-600", label: "On Permission" },
}

export default function AttendancePage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(new Date()));

  const statusCounts = React.useMemo(() => {
    return events.reduce(
      (acc, event) => {
        if (event.status) {
          acc[event.status as Status]++;
        }
        return acc;
      },
      { present: 0, late: 0, absent: 0, permission: 0 }
    );
  }, []);

  const selectedDayEvent = React.useMemo(() => {
      if (!date) return null;
      return events.find(e => isSameDay(e.date, date)) || { date: date, status: 'permission', clockIn: '-', clockOut: '-' };
  }, [date]);

  const modifiers = React.useMemo(() => {
    const modifiers: Record<string, Date[]> = {
        present: [],
        late: [],
        absent: [],
        permission: []
    };
    events.forEach(event => {
        if (modifiers[event.status]) {
            modifiers[event.status].push(event.date);
        }
    });
    return modifiers;
  }, []);

  const modifiersClassNames = {
    present: 'bg-green-500/20 text-green-700',
    late: 'bg-yellow-500/20 text-yellow-700',
    absent: 'bg-red-500/20 text-red-700',
    permission: 'bg-blue-500/20 text-blue-700',
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
                            <p>Select a day to see details</p>
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
                            <span className="text-3xl font-bold text-blue-700">{statusCounts.permission}</span>
                            <span className="text-sm text-blue-600">Permission</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
