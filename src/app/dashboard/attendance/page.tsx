
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
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm">Present</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-sm">Late</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm">Absent</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-sm">Permission</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
