"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { addDays, format, isSameDay, startOfMonth } from "date-fns";

const events = [
  { date: new Date(), status: "present" },
  { date: addDays(new Date(), -1), status: "present" },
  { date: addDays(new Date(), -2), status: "late" },
  { date: addDays(new Date(), -3), status: "present" },
  { date: addDays(new Date(), -4), status: "absent" },
  { date: addDays(new Date(), -7), status: "present" },
  { date: addDays(new Date(), -8), status: "present" },
  { date: addDays(new Date(), -9), status: "present" },
  { date: addDays(new Date(), -10), status: "late" },
  { date: addDays(new Date(), -11), status: "present" },
  { date: addDays(new Date(), -14), status: "absent" },
  { date: addDays(new Date(), -15), status: "present" },
  { date: addDays(new Date(), -16), status: "present" },
];

type Status = "present" | "late" | "absent" | "permission";

const statusStyles: Record<Status, string> = {
  present: "bg-green-100 text-green-800 border-green-200",
  late: "bg-yellow-100 text-yellow-800 border-yellow-200",
  absent: "bg-red-100 text-red-800 border-red-200",
  permission: "bg-blue-100 text-blue-800 border-blue-200",
};

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
                classNames={{
                    day: cn(
                        "relative h-12 w-12 rounded-lg transition-colors hover:bg-accent/50 focus-within:relative focus-within:z-20"
                    ),
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const event = events.find((e) => isSameDay(e.date, date));
                    return (
                      <div className="relative h-full w-full">
                        <span>{format(date, "d")}</span>
                        {event && (
                          <div
                            className={cn(
                              "absolute bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full",
                              event.status === 'present' && 'bg-green-500',
                              event.status === 'late' && 'bg-yellow-500',
                              event.status === 'absent' && 'bg-red-500',
                            )}
                          />
                        )}
                      </div>
                    );
                  },
                }}
              />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
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
            <Card>
                <CardHeader>
                    <CardTitle  className="text-lg font-headline">Legend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-green-500" />
                        <span className="text-sm">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-yellow-500" />
                        <span className="text-sm">Late</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-red-500" />
                        <span className="text-sm">Absent</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-blue-500" />
                        <span className="text-sm">Permission</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
