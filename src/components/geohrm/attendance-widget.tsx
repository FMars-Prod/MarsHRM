
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
import { Clock, Coffee, Briefcase, CheckCircle2, MapPin, Settings, Building2, RotateCcw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parse } from "date-fns";
import { Textarea } from "../ui/textarea";


type AttendanceStatus = "out" | "in" | "break";

interface Location {
  latitude: number;
  longitude: number;
  maxDistanceKm?: number;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

const getDistanceInKm = (loc1: Location, loc2: Location) => {
  if (!loc1 || !loc2) return Infinity;
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
  const [currentUserLocation, setCurrentUserLocation] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const { toast } = useToast();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdmin = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  const officeLocationDocRef = useMemoFirebase(
    () => doc(firestore, "settings", "location"),
    [firestore]
  );
  const { data: officeLocationData, isLoading: isLocationLoading } = useDoc<Location>(officeLocationDocRef);
  
  const officeLocation = officeLocationData;
  const maxDistanceKm = officeLocation?.maxDistanceKm || 2;

  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [newLatitude, setNewLatitude] = useState("");
  const [newLongitude, setNewLongitude] = useState("");
  const [newMaxDistance, setNewMaxDistance] = useState("");
  const [newShiftStart, setNewShiftStart] = useState("");
  const [newShiftEnd, setNewShiftEnd] = useState("");
  
  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);
  
  useEffect(() => {
    if (officeLocation) {
        setNewLatitude(officeLocation.latitude?.toString() || "");
        setNewLongitude(officeLocation.longitude?.toString() || "");
        setNewMaxDistance((officeLocation.maxDistanceKm || 2).toString());
        setNewShiftStart(officeLocation.shiftStartTime || "09:00");
        setNewShiftEnd(officeLocation.shiftEndTime || "17:00");
    }
  }, [officeLocation])

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);

  const {data: todaysAttendance} = useDoc(getTodaysAttendanceRef);

  useEffect(() => {
    if (todaysAttendance) {
        if (todaysAttendance.checkOutTime) {
            setStatus("out");
            setHasClockedOutToday(true);
            const workDuration = (todaysAttendance.checkOutTime.toMillis() - todaysAttendance.checkInTime.toMillis()) / 1000;
            setTimer(workDuration - (todaysAttendance.totalBreakDuration || 0));
            setTotalBreakTime(todaysAttendance.totalBreakDuration || 0);
        } else {
          if (todaysAttendance.checkInTime) {
            setStatus("in");
            setHasClockedOutToday(false);
            setLastClockInTime(todaysAttendance.checkInTime.toDate());
            const secondsSinceClockIn = (new Date().getTime() - todaysAttendance.checkInTime.toMillis()) / 1000;
            setTimer(secondsSinceClockIn);
            setTotalBreakTime(todaysAttendance.totalBreakDuration || 0);
          }
        }
    } else {
        setStatus("out");
        setHasClockedOutToday(false);
        setTimer(0);
        setBreakTimer(0);
        setTotalBreakTime(0);
        setLastClockInTime(null);
    }
  }, [todaysAttendance]);


  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (status === "in") {
      interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    let breakInterval: NodeJS.Timeout | undefined;
    if (status === "break") {
      breakInterval = setInterval(() => setBreakTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(breakInterval);
  }, [status]);
  
  const proceedWithClockIn = (userLocation: Location, dist: number, reason?: string) => {
      setCurrentUserLocation(userLocation);
      const now = new Date();
      const clockInTime = serverTimestamp();
      
      let attendanceStatus = 'present';
      if (officeLocation?.shiftStartTime) {
          const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', new Date());
          if (now > shiftStart) {
              attendanceStatus = 'late';
          }
      }
      
      if (getTodaysAttendanceRef) {
          const attendancePayload: any = {
              id: format(now, 'yyyy-MM-dd'),
              employeeId: user!.uid,
              checkInTime: clockInTime,
              status: attendanceStatus,
              totalBreakDuration: 0,
              locationCheckInLatitude: userLocation.latitude,
              locationCheckInLongitude: userLocation.longitude,
          };
          if (reason) {
            attendancePayload.checkInNotes = reason;
          }
          setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
      }

      setStatus("in");
      setLastClockInTime(now);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setHasClockedOutToday(false);
      toast({ title: "Clocked In", description: `Location recorded, ${dist.toFixed(2)} km from office.` });
  }

  const handleClockIn = () => {
    if (!officeLocation || !user) {
        toast({
            variant: "destructive",
            title: "Cannot Clock In",
            description: "Office location not set or user not logged in.",
        });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          const dist = getDistanceInKm(userLocation, officeLocation);
          setDistance(dist);

          if (dist > maxDistanceKm) {
              setOutOfRangeAction(() => () => proceedWithClockIn(userLocation, dist, outOfRangeReason));
              setIsOutOfRangeReasonDialogOpen(true);
          } else {
              proceedWithClockIn(userLocation, dist);
          }
        },
        () => toast({ variant: "destructive", title: "Location Error", description: "Could not get location. Please enable location services."})
    );
  };
  
  const proceedWithClockOut = (userLocation: Location, reason?: string) => {
      if (getTodaysAttendanceRef) {
          const payload: any = {
              checkOutTime: serverTimestamp(),
              totalBreakDuration: totalBreakTime,
              locationCheckOutLatitude: userLocation.latitude,
              locationCheckOutLongitude: userLocation.longitude,
          };
          if (reason) {
            payload.checkOutNotes = reason;
          }
          updateDocumentNonBlocking(getTodaysAttendanceRef, payload);
      }
      setStatus("out");
      setHasClockedOutToday(true);
      setCurrentUserLocation(null);
      setDistance(null);
  }

  const handleClockOut = () => {
    if (!officeLocation || !user) {
      toast({ variant: "destructive", title: "Cannot Clock Out" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            const dist = getDistanceInKm(userLocation, officeLocation);

            if (dist > maxDistanceKm) {
                setOutOfRangeAction(() => () => proceedWithClockOut(userLocation, outOfRangeReason));
                setIsOutOfRangeReasonDialogOpen(true);
            } else {
                proceedWithClockOut(userLocation);
            }
        },
        () => toast({ variant: "destructive", title: "Location Error", description: "Could not get location to clock out."})
    );
  };

  const handleBreak = () => {
    const updatedBreakTime = totalBreakTime + breakTimer;
    if (status === "break") {
      setTotalBreakTime(updatedBreakTime);
      if (getTodaysAttendanceRef) {
        updateDocumentNonBlocking(getTodaysAttendanceRef, {
            totalBreakDuration: updatedBreakTime
        });
      }
      setBreakTimer(0);
      setStatus("in");
    } else {
      if (getTodaysAttendanceRef) {
        updateDocumentNonBlocking(getTodaysAttendanceRef, {
            totalBreakDuration: updatedBreakTime
        });
      }
      setStatus("break");
    }
  };

  const handleSaveSettings = async () => {
      const lat = parseFloat(newLatitude);
      const lon = parseFloat(newLongitude);
      const range = parseFloat(newMaxDistance);

      if (isNaN(lat) || isNaN(lon) || isNaN(range) || !newShiftStart || !newShiftEnd) {
          toast({ variant: "destructive", title: "Invalid Input", description: "Please enter valid numbers and times." });
          return;
      }
      
      if (officeLocationDocRef) {
        setDocumentNonBlocking(officeLocationDocRef, { 
            latitude: lat, 
            longitude: lon, 
            maxDistanceKm: range,
            shiftStartTime: newShiftStart,
            shiftEndTime: newShiftEnd
        }, { merge: true });
        toast({ title: "Settings Update Initiated", description: "The office settings are being updated." });
        setIsSettingsDialogOpen(false);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not save the new settings." });
      }
  }
  
  const handleOutOfRangeSubmit = () => {
      if (!outOfRangeReason) {
          toast({ variant: "destructive", title: "Reason required", description: "Please provide a reason for being out of range."});
          return;
      }
      if (outOfRangeAction) {
          outOfRangeAction();
      }
      setIsOutOfRangeReasonDialogOpen(false);
      setOutOfRangeReason("");
      setOutOfRangeAction(null);
  }

  const handleReset = () => {
    if (getTodaysAttendanceRef) {
        deleteDocumentNonBlocking(getTodaysAttendanceRef);
        toast({ title: "Attendance Reset", description: "Today's clock-in has been cleared." });
    }
  }

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
            <CardTitle className="font-headline flex items-center gap-2">
            <Clock className="size-5" />
            Geolocation Attendance
            </CardTitle>
            {isAdmin && (
                <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Settings className="size-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Company Settings</DialogTitle>
                            <DialogDescription>
                                Set global settings for attendance and location.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                           <div className="grid gap-2">
                                <Label htmlFor="latitude">Office Latitude</Label>
                                <Input id="latitude" value={newLatitude} onChange={(e) => setNewLatitude(e.target.value)} placeholder="e.g., 37.7749" />
                           </div>
                           <div className="grid gap-2">
                                <Label htmlFor="longitude">Office Longitude</Label>
                                <Input id="longitude" value={newLongitude} onChange={(e) => setNewLongitude(e.target.value)} placeholder="e.g., -122.4194" />
                           </div>
                           <div className="grid gap-2">
                                <Label htmlFor="range">Clock-in Range (km)</Label>
                                <Input id="range" type="number" value={newMaxDistance} onChange={(e) => setNewMaxDistance(e.target.value)} placeholder="e.g., 2" />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             <div className="grid gap-2">
                                  <Label htmlFor="shift-start">Shift Start Time</Label>
                                  <Input id="shift-start" type="time" value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)} />
                             </div>
                             <div className="grid gap-2">
                                  <Label htmlFor="shift-end">Shift End Time</Label>
                                  <Input id="shift-end" type="time" value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)} />
                             </div>
                           </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={handleSaveSettings}>Save Settings</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
        <CardDescription>
          Your real-time attendance and break tracker.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center gap-4 text-center">
        {isLocationLoading ? (
             <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Building2 className="h-10 w-10 animate-pulse" />
                <p>Loading Location Data...</p>
            </div>
        ) : officeLocation ? (
          <>
            <div
              className={cn(
                "flex items-center justify-center gap-2 font-semibold",
                status === "in" && "text-green-600",
                status === "break" && "text-yellow-600",
                status === "out" && !hasClockedOutToday && "text-red-600",
                status === "out" &&
                  hasClockedOutToday &&
                  "text-muted-foreground"
              )}
            >
              {status === "in" && <Briefcase className="size-5" />}
              {status === "break" && <Coffee className="size-5" />}
              {status === "out" && <CheckCircle2 className="size-5" />}

              {hasClockedOutToday
                ? "You have clocked out for the day"
                : `You are currently Clocked ${
                    status === "break"
                      ? "on a Break"
                      : status.charAt(0).toUpperCase() + status.slice(1)
                  }`}
            </div>
            <div className="text-6xl font-bold font-mono tabular-nums tracking-tighter">
              {formatTime(timer)}
            </div>
            <div className="flex items-center gap-6">
              {status === "break" && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-muted-foreground">
                    Current Break
                  </span>
                  <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                    {formatTime(breakTimer)}
                  </div>
                </div>
              )}
              {totalBreakTime > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Break
                  </span>
                  <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                    {formatTime(totalBreakTime)}
                  </div>
                </div>
              )}
            </div>
            {lastClockInTime && status !== "out" && (
              <p className="text-sm text-muted-foreground">
                Clocked in at {lastClockInTime.toLocaleTimeString()}
              </p>
            )}
            {currentUserLocation && (
              <div className="flex items-center text-xs text-muted-foreground gap-1">
                <MapPin className="size-3" />
                <span>{`Lat: ${currentUserLocation.latitude.toFixed(
                  4
                )}, Lon: ${currentUserLocation.longitude.toFixed(4)}`}</span>
                {distance !== null && (
                  <span>({distance.toFixed(2)} km from office)</span>
                )}
              </div>
            )}
          </>
        ) : (
             <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Building2 className="h-10 w-10" />
                <p className="max-w-xs">Office location is not set. An administrator needs to configure it.</p>
            </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4">
        {status === "out" ? (
          <Button
            onClick={handleClockIn}
            className="w-full col-span-2"
            disabled={hasClockedOutToday || !officeLocation}
          >
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
                  <AlertDialogTitle>
                    Are you sure you want to clock out?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will end your current work session.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClockOut}>
                    Confirm Clock Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardFooter>
      {(status !== 'out' || hasClockedOutToday) && (
        <CardFooter className="border-t pt-4">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <RotateCcw className="mr-2" />
                    Reset Clock In
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you sure you want to reset?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete today's entire attendance record, including clock-in, clock-out, and break times. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>
                    Confirm Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      )}

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={setIsOutOfRangeReasonDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Out of Range</DialogTitle>
                    <DialogDescription>
                        You are outside the designated office radius. Please provide a reason to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea 
                        id="reason" 
                        value={outOfRangeReason}
                        onChange={(e) => setOutOfRangeReason(e.target.value)}
                        placeholder="e.g., Working from a client's office" 
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOutOfRangeReasonDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleOutOfRangeSubmit}>Submit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </Card>
  );
}
