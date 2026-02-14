
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
import { Clock, Coffee, Briefcase, CheckCircle2, MapPin, Settings, Building2, RotateCcw, Home } from "lucide-react";
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
import { doc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parse, isSameDay, endOfDay } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";


type AttendanceStatus = "out" | "in" | "break";

interface Location {
  latitude: number;
  longitude: number;
  maxDistanceKm?: number;
  shiftStartTime?: string;
  shiftEndTime?: string;
  lunchBreakStartTime?: string;
  lunchBreakDurationMinutes?: number;
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
  const isWfhAllowed = (userData as any)?.isWfhAllowed;

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
  const [newLunchStart, setNewLunchStart] = useState("");
  const [newLunchDuration, setNewLunchDuration] = useState("");
  const [autoLunchTriggered, setAutoLunchTriggered] = useState(false);
  
  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);
  
  const [isSetHomeLocationDialogOpen, setIsSetHomeLocationDialogOpen] = useState(false);
  const [capturedLocation, setCapturedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (officeLocation) {
        setNewLatitude(officeLocation.latitude?.toString() || "");
        setNewLongitude(officeLocation.longitude?.toString() || "");
        setNewMaxDistance((officeLocation.maxDistanceKm || 2).toString());
        setNewShiftStart(officeLocation.shiftStartTime || "09:00");
        setNewShiftEnd(officeLocation.shiftEndTime || "17:00");
        setNewLunchStart(officeLocation.lunchBreakStartTime || "13:00");
        setNewLunchDuration((officeLocation.lunchBreakDurationMinutes || 60).toString());
    }
  }, [officeLocation])

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);
  
  const getYesterdayAttendanceRef = useMemoFirebase(() => {
      if (!user || !lastClockInTime) return null;
      const yesterdayId = format(lastClockInTime, 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, yesterdayId);
  }, [user, firestore, lastClockInTime]);

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
        setAutoLunchTriggered((todaysAttendance as any).autoLunchBreakStarted || false);
    } else {
        setStatus("out");
        setHasClockedOutToday(false);
        setTimer(0);
        setBreakTimer(0);
        setTotalBreakTime(0);
        setLastClockInTime(null);
        setAutoLunchTriggered(false);
    }
  }, [todaysAttendance]);

  const handleAutoClockOut = () => {
    if (getYesterdayAttendanceRef && lastClockInTime) {
      const midnight = endOfDay(lastClockInTime);
      updateDocumentNonBlocking(getYesterdayAttendanceRef, {
        checkOutTime: Timestamp.fromDate(midnight),
        totalBreakDuration: totalBreakTime,
        checkOutNotes: "Automatically clocked out at midnight."
      });
      toast({
        title: "Automatically Clocked Out",
        description: "You were clocked out as the day has changed.",
      });
      // Reset state for the new day
      setStatus("out");
      setHasClockedOutToday(false);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setLastClockInTime(null);
    }
  }

  const proceedWithLunchClockIn = (userLocation: Location, dist: number, reason?: string) => {
      const updatedBreakTime = totalBreakTime + breakTimer;
      if (getTodaysAttendanceRef) {
          const payload: any = {
              totalBreakDuration: updatedBreakTime,
          };
          if (reason) {
              const newNote = `Post-Lunch Clock-In (${format(new Date(), 'p')}): ${reason}`;
              const existingNotes = (todaysAttendance as any)?.checkInNotes || "";
              payload.checkInNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;
          }
          updateDocumentNonBlocking(getTodaysAttendanceRef, payload);
      }
      
      setTotalBreakTime(updatedBreakTime);
      setBreakTimer(0);
      setStatus("in");
      setCurrentUserLocation(userLocation);
      setDistance(dist);
      toast({ title: "Clocked In from Lunch", description: `Location recorded, ${dist.toFixed(2)} km from office.` });
  }

  const handleBreak = () => {
    if (status === "break") {
        if (autoLunchTriggered) {
            if (!officeLocation || !user) {
                toast({ variant: "destructive", title: "Cannot Clock In", description: "Office location not set." });
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                  const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                  const dist = getDistanceInKm(userLocation, officeLocation);
                  
                  if (dist > maxDistanceKm) {
                      setOutOfRangeAction(() => () => proceedWithLunchClockIn(userLocation, dist, outOfRangeReason));
                      setIsOutOfRangeReasonDialogOpen(true);
                  } else {
                      proceedWithLunchClockIn(userLocation, dist);
                  }
                },
                () => toast({ variant: "destructive", title: "Location Error", description: "Could not get location. Please enable location services."}),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            const updatedBreakTime = totalBreakTime + breakTimer;
            setTotalBreakTime(updatedBreakTime);
            if (getTodaysAttendanceRef) {
                updateDocumentNonBlocking(getTodaysAttendanceRef, {
                    totalBreakDuration: updatedBreakTime
                });
            }
            setBreakTimer(0);
            setStatus("in");
        }
    } else {
      setStatus("break");
    }
  };


  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (status === "in") {
      interval = setInterval(() => {
        if (lastClockInTime && !isSameDay(new Date(), lastClockInTime)) {
            handleAutoClockOut();
        } else {
            setTimer((prev) => prev + 1);

            const now = new Date();
            if (officeLocation?.lunchBreakStartTime && !autoLunchTriggered) {
                const [hours, minutes] = officeLocation.lunchBreakStartTime.split(':');
                const lunchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);

                if (now >= lunchTime) {
                    if (getTodaysAttendanceRef) {
                        updateDocumentNonBlocking(getTodaysAttendanceRef, { autoLunchBreakStarted: true });
                    }
                    setAutoLunchTriggered(true);
                    handleBreak(); 
                    toast({
                        title: "Lunch Time!",
                        description: "You have been automatically signed out for lunch. Please sign back in when you return.",
                    });
                }
            }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, lastClockInTime, officeLocation, autoLunchTriggered, getTodaysAttendanceRef]);


  useEffect(() => {
    let breakInterval: NodeJS.Timeout | undefined;
    if (status === "break") {
      breakInterval = setInterval(() => setBreakTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(breakInterval);
  }, [status]);
  
  const proceedWithClockIn = (userLocation: Location, dist: number, reason?: string, isOutOfRange: boolean = false) => {
      setCurrentUserLocation(userLocation);
      const now = new Date();
      const clockInTime = serverTimestamp();
      
      let attendanceStatus = 'present';
      if (reason === 'Office' && officeLocation?.shiftStartTime) {
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
              checkInNotes: reason,
              isOutOfRange: isOutOfRange,
          };
          setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
      }

      setStatus("in");
      setLastClockInTime(now);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setHasClockedOutToday(false);
      toast({ title: "Clocked In", description: `Location recorded for ${reason || 'clock-in'}.` });
  }

  const handleClockIn = () => {
    if (!user) {
        toast({ variant: "destructive", title: "Cannot Clock In", description: "User not logged in." });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            
            // 1. Check against Office Location
            if (officeLocation) {
                const officeDist = getDistanceInKm(userLocation, officeLocation);
                if (officeDist <= maxDistanceKm) {
                    proceedWithClockIn(userLocation, officeDist, "Office", false);
                    return;
                }
            }

            // 2. Not at the office, check WFH possibility
            if (isWfhAllowed) {
                const homeLat = (userData as any)?.homeLatitude;
                const homeLon = (userData as any)?.homeLongitude;
                const homeRange = (userData as any)?.homeLocationRangeKm === 0 ? 0 : ((userData as any)?.homeLocationRangeKm || 5);

                if (homeLat && homeLon) {
                    const homeLocation = { latitude: homeLat, longitude: homeLon };
                    const homeDist = getDistanceInKm(userLocation, homeLocation);

                    if (homeDist <= homeRange) {
                        proceedWithClockIn(userLocation, homeDist, "Work From Home", false);
                        return;
                    }
                } else {
                    setCapturedLocation(userLocation);
                    setIsSetHomeLocationDialogOpen(true);
                    return;
                }
            }
            
            // 3. Out of all valid ranges
            const distForPrompt = officeLocation ? getDistanceInKm(userLocation, officeLocation) : Infinity;
            setDistance(distForPrompt);
            setOutOfRangeAction(() => () => proceedWithClockIn(userLocation, distForPrompt, outOfRangeReason, true));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => toast({ variant: "destructive", title: "Location Error", description: "Could not get your location. Please enable location services." }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
    if (!user) {
      toast({ variant: "destructive", title: "Cannot Clock Out" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            
            // 1. Check Office
            if (officeLocation) {
                const officeDist = getDistanceInKm(userLocation, officeLocation);
                if (officeDist <= maxDistanceKm) {
                    proceedWithClockOut(userLocation, "Office");
                    return;
                }
            }
            
            // 2. Check Home
            if (isWfhAllowed) {
                const homeLat = (userData as any)?.homeLatitude;
                const homeLon = (userData as any)?.homeLongitude;
                const homeRange = (userData as any)?.homeLocationRangeKm === 0 ? 0 : ((userData as any)?.homeLocationRangeKm || 5);

                if (homeLat && homeLon) {
                    const homeLocation = { latitude: homeLat, longitude: homeLon };
                    const homeDist = getDistanceInKm(userLocation, homeLocation);
                    if (homeDist <= homeRange) {
                        proceedWithClockOut(userLocation, "Work From Home");
                        return;
                    }
                }
            }

            // 3. Out of Range
            const distForPrompt = officeLocation ? getDistanceInKm(userLocation, officeLocation) : Infinity;
            setOutOfRangeAction(() => () => proceedWithClockOut(userLocation, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => toast({ variant: "destructive", title: "Location Error", description: "Could not get location to clock out."}),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const handleConfirmSetHomeLocation = () => {
    if (!userDocRef || !capturedLocation) return;

    updateDocumentNonBlocking(userDocRef, {
        homeLatitude: capturedLocation.latitude,
        homeLongitude: capturedLocation.longitude,
    });

    proceedWithClockIn(capturedLocation, 0, "Work From Home (Initial Location Set)", false);
    
    toast({
        title: "Home Location Saved",
        description: "Your current location has been set as your home address for WFH.",
    });

    setCapturedLocation(null);
    setIsSetHomeLocationDialogOpen(false);
  };


  const handleSaveSettings = async () => {
      const lat = parseFloat(newLatitude);
      const lon = parseFloat(newLongitude);
      const range = parseFloat(newMaxDistance);
      const lunchDuration = parseInt(newLunchDuration);

      if (isNaN(lat) || isNaN(lon) || isNaN(range) || !newShiftStart || !newShiftEnd || !newLunchStart || isNaN(lunchDuration)) {
          toast({ variant: "destructive", title: "Invalid Input", description: "Please enter valid numbers and times." });
          return;
      }
      
      if (officeLocationDocRef) {
        setDocumentNonBlocking(officeLocationDocRef, { 
            latitude: lat, 
            longitude: lon, 
            maxDistanceKm: range,
            shiftStartTime: newShiftStart,
            shiftEndTime: newShiftEnd,
            lunchBreakStartTime: newLunchStart,
            lunchBreakDurationMinutes: lunchDuration
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

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const handleResetDay = () => {
    if (getTodaysAttendanceRef) {
        deleteDocumentNonBlocking(getTodaysAttendanceRef);
        toast({
            title: "Day Reset",
            description: "Your attendance for today has been reset. You can now clock in again."
        });
    }
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
                    <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle>Company Settings</DialogTitle>
                            <DialogDescription>
                                Set global settings for attendance and location.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto -mx-6 px-6">
                            <div className="grid gap-4 py-4 pr-2">
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
                                 <div className="grid grid-cols-2 gap-4">
                                      <Label htmlFor="shift-end">Shift End Time</Label>
                                      <Input id="shift-end" type="time" value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)} />
                                 </div>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="grid gap-2">
                                      <Label htmlFor="lunch-start">Lunch Start Time</Label>
                                      <Input id="lunch-start" type="time" value={newLunchStart} onChange={(e) => setNewLunchStart(e.target.value)} />
                                 </div>
                                 <div className="grid gap-2">
                                      <Label htmlFor="lunch-duration">Lunch Duration (mins)</Label>
                                      <Input id="lunch-duration" type="number" value={newLunchDuration} onChange={(e) => setNewLunchDuration(e.target.value)} />
                                 </div>
                               </div>
                            </div>
                        </div>
                        <DialogFooter className="mt-auto pt-4 border-t">
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
          Your real-time attendance tracker. Your designated location is
          <span className="font-semibold text-foreground">
            {isWfhAllowed ? " Work From Home" : " Work From Office"}
          </span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center gap-4 text-center">
        {isLocationLoading && !isWfhAllowed ? (
             <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Building2 className="h-10 w-10 animate-pulse" />
                <p>Loading Location Data...</p>
            </div>
        ) : (officeLocation || isWfhAllowed) ? (
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

              {
                hasClockedOutToday
                  ? "You have clocked out for the day"
                  : status === 'break'
                    ? (autoLunchTriggered ? "You are Clocked Out for Lunch" : "You are currently on a Break")
                    : `You are currently Clocked ${status.charAt(0).toUpperCase() + status.slice(1)}`
              }
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
                  <span>({distance.toFixed(2)} km from designated location)</span>
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
        {status === 'out' && !hasClockedOutToday && (
            <Button
                onClick={handleClockIn}
                className="w-full col-span-2"
                disabled={!isWfhAllowed && !officeLocation}
            >
                <Clock className="mr-2" /> Clock In
            </Button>
        )}
        {status === 'out' && hasClockedOutToday && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full col-span-2">
                        <RotateCcw className="mr-2" /> Reset Day
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete today's attendance record and allow you to clock in again. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetDay}>Confirm Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        {status !== 'out' && (
            <>
                <Button
                    onClick={handleBreak}
                    variant={status === "break" ? "default" : "outline"}
                    className="w-full"
                >
                    {status === 'break' && autoLunchTriggered
                        ? <Clock className="mr-2" />
                        : <Coffee className="mr-2" />
                    }
                    {status === 'break' 
                        ? autoLunchTriggered ? 'Clock In' : 'End Break'
                        : 'Start Break'
                    }
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
      
      <AlertDialog open={isSetHomeLocationDialogOpen} onOpenChange={setIsSetHomeLocationDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Set Home Location?</AlertDialogTitle>
                <AlertDialogDescription>
                    You have not set a home location yet. Would you like to use your current location as your Work From Home address? This can be changed later in your profile.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCapturedLocation(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmSetHomeLocation}>Confirm & Clock In</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
