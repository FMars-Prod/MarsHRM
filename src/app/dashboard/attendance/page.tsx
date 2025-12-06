
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
                modifiersClassNames={{
                    present: 'border-b-2 border-green-500 rounded-none',
                    late: 'border-b-2 border-yellow-500 rounded-none',
                    absent: 'border-b-2 border-red-500 rounded-none',
                    permission: 'border-b-2 border-blue-500 rounded-none'
                }}
                classNames={{
                    day: cn(
                        "h-10 w-10 rounded-full transition-colors hover:bg-accent/50 focus-within:relative focus-within:z-20"
                    ),
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary focus:bg-primary",
                    day_today: "bg-accent text-accent-foreground",
                    cell: "h-12 w-12 text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
                    head_cell: "text-muted-foreground rounded-md w-12 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2"
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
                        <div className="h-2 w-4 rounded-full border-b-2 border-green-500" />
                        <span className="text-sm">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-4 rounded-full border-b-2 border-yellow-500" />
                        <span className="text-sm">Late</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-4 rounded-full border-b-2 border-red-500" />
                        <span className="text-sm">Absent</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="h-2 w-4 rounded-full border-b-2 border-blue-500" />
                        <span className="text-sm">Permission</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
