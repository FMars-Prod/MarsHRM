
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
import { Clock, Coffee, Briefcase, CheckCircle2, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type AttendanceStatus = "out" | "in" | "break";

interface Location {
    latitude: number;
    longitude: number;
}

const OFFICE_LOCATION: Location = { latitude: 37.7749, longitude: -122.4194 }; // Example: San Francisco
const MAX_DISTANCE_KM = 2;

// Haversine formula to calculate distance between two lat/lon points in km
const getDistanceInKm = (loc1: Location, loc2: Location) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (loc2.latitude - loc1.latitude) * (Math.PI / 180);
    const dLon = (loc2.longitude - loc1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.latitude * (Math.PI / 180)) *
        Math.cos(loc2.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus>("out");
  const [timer, setTimer] = useState(0);
  const [breakTimer, setBreakTimer] = useState(0);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [lastClockInTime, setLastClockInTime] = useState<Date | null>(null);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (status === "in") {
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
      clearInterval(breakInterval);
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
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation: Location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                
                const dist = getDistanceInKm(userLocation, OFFICE_LOCATION);
                setDistance(dist);

                if (dist > MAX_DISTANCE_KM) {
                    toast({
                        variant: "destructive",
                        title: "Clock-In Failed",
                        description: `You are ${dist.toFixed(2)} km away from the office. You must be within ${MAX_DISTANCE_KM} km to clock in.`,
                    });
                    return;
                }

                setLocation(userLocation);
                setStatus("in");
                setLastClockInTime(new Date());
                setTimer(0);
                setBreakTimer(0);
                setTotalBreakTime(0);
                setHasClockedOutToday(false);
                toast({
                    title: "Clocked In",
                    description: `Your location has been recorded, ${dist.toFixed(2)} km from the office.`,
                });
            },
            (error) => {
                console.error("Geolocation error:", error);
                toast({
                    variant: "destructive",
                    title: "Location Error",
                    description: "Could not get location. Please enable location services.",
                });
            }
        );
    } else {
        toast({
            variant: "destructive",
            title: "Geolocation Not Supported",
            description: "Your browser does not support geolocation.",
        });
    }
  };

  const handleClockOut = () => {
    setStatus("out");
    setHasClockedOutToday(true);
    setLocation(null);
    setDistance(null);
  };

  const handleBreak = () => {
    if (status === 'break') { // Ending a break
      setTotalBreakTime(prev => prev + breakTimer);
      setBreakTimer(0);
      setStatus('in');
    } else { // Starting a break
      setStatus('break');
    }
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
            status === "out" && !hasClockedOutToday && "text-red-600",
            status === "out" && hasClockedOutToday && "text-muted-foreground",
          )}
        >
          {status === "in" && <Briefcase className="size-5" />}
          {status === "break" && <Coffee className="size-5" />}
          {status === "out" && <CheckCircle2 className="size-5" />}

          {hasClockedOutToday 
            ? "You have clocked out for the day"
            : `You are currently Clocked ${status === "break" ? "on a Break" : status.charAt(0).toUpperCase() + status.slice(1)}`
          }
        </div>
        <div className="flex flex-col items-center gap-4">
            <div className="text-6xl font-bold font-mono tabular-nums tracking-tighter">
              {formatTime(timer)}
            </div>
            <div className="flex items-center gap-6">
                {status === 'break' && (
                    <div className="flex flex-col items-center">
                        <span className="text-sm text-muted-foreground">Current Break</span>
                        <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                            {formatTime(breakTimer)}
                        </div>
                    </div>
                )}
                {totalBreakTime > 0 && (
                    <div className="flex flex-col items-center">
                        <span className="text-sm text-muted-foreground">Total Break</span>
                        <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                            {formatTime(totalBreakTime)}
                        </div>
                    </div>
                )}
            </div>
        </div>
        {lastClockInTime && status !== 'out' && (
             <p className="text-sm text-muted-foreground">
                Clocked in at {lastClockInTime.toLocaleTimeString()}
             </p>
        )}
        {location && (
            <div className="flex items-center text-xs text-muted-foreground gap-1">
                <MapPin className="size-3"/>
                <span>{`Lat: ${location.latitude.toFixed(4)}, Lon: ${location.longitude.toFixed(4)}`}</span>
                {distance !== null && <span>({distance.toFixed(2)} km from office)</span>}
            </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4">
        {status === "out" ? (
          <Button onClick={handleClockIn} className="w-full col-span-2" disabled={hasClockedOutToday}>
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
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                        Clock Out
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to clock out?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will end your current work session. You can clock in again later if needed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClockOut}>Confirm Clock Out</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
