"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Coffee, Briefcase, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceStatus = "out" | "in" | "break";

export function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus>("out");
  const [timer, setTimer] = useState(0);
  const [breakTimer, setBreakTimer] = useState(0);
  const [lastClockInTime, setLastClockInTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (status === "in" || status === "break") {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [status]);
  
  useEffect(() => {
    let breakInterval: NodeJS.Timeout | undefined;
    if (status === 'break') {
      breakInterval = setInterval(() => {
        setBreakTimer(prev => prev + 1);
      }, 1000);
    } else {
      setBreakTimer(0); // Reset break timer when not on break
    }
    return () => clearInterval(breakInterval);
  }, [status]);

  useEffect(() => {
    // This effect runs only on the client to avoid hydration mismatch for Date
    if (status === 'in' && lastClockInTime === null) {
      setLastClockInTime(new Date());
    }
    if (status === 'out') {
        setLastClockInTime(null);
    }
  }, [status, lastClockInTime]);

  const handleClockIn = () => {
    setStatus("in");
    setLastClockInTime(new Date());
    setTimer(0);
  };

  const handleClockOut = () => {
    setStatus("out");
  };

  const handleBreak = () => {
    setStatus(status === "in" ? "break" : "in");
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Clock className="size-5" />
          Geolocation Attendance
        </CardTitle>
        <CardDescription>
          Your real-time attendance and break tracker.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center gap-4 text-center">
        <div
          className={cn(
            "flex items-center justify-center gap-2 font-semibold",
            status === "in" && "text-green-600",
            status === "break" && "text-yellow-600",
            status === "out" && "text-red-600"
          )}
        >
          {status === "in" && <Briefcase className="size-5" />}
          {status === "break" && <Coffee className="size-5" />}
          {status === "out" && <CheckCircle2 className="size-5" />}
          You are currently Clocked {status === "break" ? "on a Break" : status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
        <div className="flex items-center gap-4">
            <div className="text-6xl font-bold font-mono tabular-nums tracking-tighter">
            {formatTime(timer)}
            </div>
            {status === 'break' && (
                <div className="flex flex-col items-center">
                    <span className="text-sm text-muted-foreground">Break</span>
                    <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                        {formatTime(breakTimer)}
                    </div>
                </div>
            )}
        </div>
        {lastClockInTime && status !== 'out' && (
             <p className="text-sm text-muted-foreground">
                Clocked in at {lastClockInTime.toLocaleTimeString()}
             </p>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4">
        {status === "out" ? (
          <Button onClick={handleClockIn} className="w-full col-span-2">
            <Clock className="mr-2" /> Clock In
          </Button>
        ) : (
          <>
            <Button
              onClick={handleBreak}
              variant={status === "break" ? "default" : "outline"}
              className="w-full"
            >
              <Coffee className="mr-2" />
              {status === "break" ? "End Break" : "Start Break"}
            </Button>
            <Button onClick={handleClockOut} variant="destructive" className="w-full">
              Clock Out
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
