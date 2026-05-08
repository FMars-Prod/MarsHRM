
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Coffee, Briefcase, CheckCircle2, MapPin, Settings, Building2, LogOut, Utensils, AlertCircle, LogIn, LocateFixed } from "lucide-react";
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
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, serverTimestamp, Timestamp, collection, query, where, orderBy, limit } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parse, isSameDay, endOfDay, isAfter, addMinutes, differenceInMinutes } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

type AttendanceStatus = "out" | "in" | "lunch" | "short_break";

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
  if (!loc1 || !loc2 || isNaN(loc1.latitude) || isNaN(loc1.longitude) || isNaN(loc2.latitude) || isNaN(loc2.longitude)) return Infinity;
  const R = 6371; // Radius in km
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
  const [distance, setDistance] = useState<number>(0);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdminOrCEO = userRole === 'CEO/Admin' || userRole === 'HR Manager';
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
  
  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);
  const [outOfRangeInfo, setOutOfRangeInfo] = useState('');

  useEffect(() => {
    if (officeLocation) {
        setNewLatitude(officeLocation.latitude?.toString() || "");
        setNewLongitude(officeLocation.longitude?.toString() || "");
        setNewMaxDistance((officeLocation.maxDistanceKm || 2).toString());
        setNewShiftStart(officeLocation.shiftStartTime || "09:30");
        setNewShiftEnd(officeLocation.shiftEndTime || "18:30");
        setNewLunchStart(officeLocation.lunchBreakStartTime || "13:30");
        setNewLunchDuration((officeLocation.lunchBreakDurationMinutes || 60).toString());
    }
  }, [officeLocation]);

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
            if (todaysAttendance.locationLunchOutLatitude && !todaysAttendance.locationLunchInLatitude) {
                setStatus("lunch");
            } else {
                setStatus("in");
            }
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

  const proceedWithBreakEnd = (userLocation: Location, dist: number, reason?: string) => {
      const updatedBreakTime = totalBreakTime + breakTimer;
      if (getTodaysAttendanceRef) {
          const payload: any = {
              totalBreakDuration: updatedBreakTime,
          };
          
          if (status === 'lunch') {
              payload.locationLunchInLatitude = userLocation.latitude;
              payload.locationLunchInLongitude = userLocation.longitude;
              payload.lunchInTime = serverTimestamp();
          }

          if (reason) {
              const breakType = status === 'lunch' ? 'Lunch' : 'Short Break';
              const newNote = `${breakType} Return (${format(new Date(), 'p')}): ${reason}`;
              const existingNotes = (todaysAttendance as any)?.checkInNotes || "";
              payload.checkInNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;
              payload.isOutOfRange = true;
          }
          updateDocumentNonBlocking(getTodaysAttendanceRef, payload);
      }
      
      setTotalBreakTime(updatedBreakTime);
      setBreakTimer(0);
      setStatus("in");
      setCurrentUserLocation(userLocation);
      setDistance(dist);
      toast({ title: "Clocked In from Break", description: `Location recorded, ${dist.toFixed(2)} km from point.` });
  }

  const handleLunch = () => {
    if (status === "lunch") {
        setIsVerifyingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
              const dist = officeLocation ? getDistanceInKm(userLocation, officeLocation) : 0;
              
              setIsVerifyingLocation(false);
              if (officeLocation && dist > maxDistanceKm && !isAdminOrCEO) {
                  setOutOfRangeAction(() => () => proceedWithBreakEnd(userLocation, dist, outOfRangeReason));
                  setIsOutOfRangeReasonDialogOpen(true);
              } else {
                  proceedWithBreakEnd(userLocation, dist);
              }
            },
            () => {
                setIsVerifyingLocation(false);
                toast({ variant: "destructive", title: "Location Error", description: "Enable GPS to end lunch."});
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
              if (getTodaysAttendanceRef) {
                  updateDocumentNonBlocking(getTodaysAttendanceRef, {
                      locationLunchOutLatitude: userLocation.latitude,
                      locationLunchOutLongitude: userLocation.longitude,
                      lunchOutTime: serverTimestamp(),
                  });
              }
              setStatus("lunch");
              setIsVerifyingLocation(false);
              toast({ title: "Lunch Started (L-OUT)", description: "Location recorded." });
          },
          () => {
              setStatus("lunch");
              setIsVerifyingLocation(false);
              toast({ variant: "destructive", title: "Location Error", description: "GPS required for lunch." });
          },
          { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleShortBreak = () => {
      if (status === "short_break") {
          const userLocation = currentUserLocation || { latitude: 0, longitude: 0 };
          proceedWithBreakEnd(userLocation, 0);
      } else {
          setStatus("short_break");
          toast({ title: "Short Break Started" });
      }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (status === "in") {
      interval = setInterval(() => {
          setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    let breakInterval: NodeJS.Timeout | undefined;
    if (status === "lunch" || status === "short_break") {
      breakInterval = setInterval(() => setBreakTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(breakInterval);
  }, [status]);
  
  const proceedWithClockIn = (userLocation: Location, dist: number, reason?: string) => {
      setCurrentUserLocation(userLocation);
      const now = new Date();
      const clockInTime = serverTimestamp();
      
      let attendanceStatus: 'present' | 'late' = 'present';
      if (officeLocation?.shiftStartTime) {
          const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', new Date());
          if (isAfter(now, shiftStart)) {
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
              isOutOfRange: !!reason,
          };
          setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
      }

      setStatus("in");
      setLastClockInTime(now);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setHasClockedOutToday(false);
      toast({ title: "Clocked In", description: `Status: ${attendanceStatus.toUpperCase()}` });
  }

  const handleClockIn = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setIsVerifyingLocation(false);
            
            if (isAdminOrCEO) {
                proceedWithClockIn(userLocation, 0);
                return;
            }

            const homeLat = (userData as any)?.homeLatitude;
            const homeLon = (userData as any)?.homeLongitude;
            const homeRange = (userData as any)?.homeLocationRangeKm || 5;
            
            if (officeLocation) {
                const officeDist = getDistanceInKm(userLocation, officeLocation);
                if (officeDist <= maxDistanceKm) {
                    proceedWithClockIn(userLocation, officeDist);
                    return;
                }
            }

            if (isWfhAllowed && homeLat && homeLon) {
                const homeLocation = { latitude: homeLat, longitude: homeLon };
                const homeDist = getDistanceInKm(userLocation, homeLocation);
                if (homeDist <= homeRange) {
                    proceedWithClockIn(userLocation, homeDist, "WFH Area");
                    return;
                }
            }

            setOutOfRangeInfo("You are outside designated areas.");
            setOutOfRangeAction(() => () => proceedWithClockIn(userLocation, 0, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => {
            setIsVerifyingLocation(false);
            toast({ variant: "destructive", title: "Location Error", description: "GPS required." });
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClockOutRedirect = () => {
      if (isAdminOrCEO) {
          handleDirectClockOut();
      } else {
          router.push('/dashboard/reports');
      }
  };

  const handleDirectClockOut = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              const todayId = format(new Date(), 'yyyy-MM-dd');
              const attRef = doc(firestore, `users/${user!.uid}/attendances`, todayId);
              updateDocumentNonBlocking(attRef, {
                  checkOutTime: serverTimestamp(),
                  locationCheckOutLatitude: latitude,
                  locationCheckOutLongitude: longitude,
              });
              setIsVerifyingLocation(false);
              setStatus("out");
              setHasClockedOutToday(true);
              toast({ title: "Clocked Out" });
          },
          () => {
              setIsVerifyingLocation(false);
              toast({ variant: 'destructive', title: 'Location Error' });
          }
      );
  }

  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || isNaN(totalSeconds)) return "00:00:00";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const isLate = () => {
    if (!lastClockInTime || !officeLocation?.shiftStartTime) return false;
    const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', lastClockInTime);
    return isAfter(lastClockInTime, shiftStart);
  };

  const hasReturnedFromLunch = todaysAttendance?.locationLunchInLatitude;

  return (
    <>
      <Card className="flex flex-col animate-fade-in-up bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm relative overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between">
              <CardTitle className="font-headline flex items-center gap-2 text-primary">
                <Clock className="size-5" />
                Precision Attendance
              </CardTitle>
          </div>
          <CardDescription>
            High-accuracy geofenced tracking active.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center gap-6 text-center pb-8">
            <div className={cn(
              "flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs",
              status === "in" && (isLate() ? "text-orange-600" : "text-green-600"),
              status === "lunch" && "text-yellow-600",
              status === "short_break" && "text-blue-600",
              status === "out" && "text-muted-foreground"
            )}>
              {status === "in" && (isLate() ? <Clock className="size-4" /> : <Briefcase className="size-4" />)}
              {status === "lunch" && <Utensils className="size-4" />}
              {status === "out" && <CheckCircle2 className="size-4" />}
              {hasClockedOutToday ? "Daily Session Complete" : status === 'lunch' ? "L-OUT Active" : isLate() ? "Late Log-In" : status.toUpperCase()}
            </div>
            
            <div className="text-7xl font-black font-mono tabular-nums tracking-tighter text-primary">
              {formatTime(timer)}
            </div>

            <div className="flex items-center gap-6">
                {(status === "lunch" || status === "short_break") && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Current Break</span>
                    <div className="text-2xl font-bold font-mono tabular-nums">{formatTime(breakTimer)}</div>
                  </div>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex justify-center items-center py-6 px-6 bg-muted/5 border-t">
          {status === 'out' && !hasClockedOutToday && (
              <Button onClick={handleClockIn} className="w-full max-w-[280px] rounded-full h-14 text-lg font-black uppercase tracking-widest shadow-xl bg-primary text-white">
                  Start Shift
              </Button>
          )}
          {status !== 'out' && (
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-[600px] justify-center">
                  {status === "in" && (
                      <>
                          {!hasReturnedFromLunch && (
                            <Button onClick={handleLunch} variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-white text-primary">
                                L-OUT
                            </Button>
                          )}
                          <Button onClick={handleShortBreak} variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-white text-primary">
                              Short Break
                          </Button>
                      </>
                  )}
                  {status === "lunch" && (
                      <Button onClick={handleLunch} className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-primary text-white">
                          L-IN
                      </Button>
                  )}
                  {status === "short_break" && (
                      <Button onClick={handleShortBreak} className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-primary text-white">
                          Resume Work
                      </Button>
                  )}
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md">
                              Finish Day
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Ready to Clock Out?</AlertDialogTitle>
                              <AlertDialogDescription>Capture final location and finish shift.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClockOutRedirect} className="rounded-full font-bold uppercase text-[10px]">
                                  Confirm
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          )}
        </CardFooter>

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={setIsOutOfRangeReasonDialogOpen}>
          <DialogContent className="rounded-3xl">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Out of Range</DialogTitle>
                  <DialogDescription>{outOfRangeInfo}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <Label htmlFor="reason" className="font-bold text-xs uppercase tracking-widest text-primary">Mandatory Justification</Label>
                  <Textarea id="reason" value={outOfRangeReason} onChange={(e) => setOutOfRangeReason(e.target.value)} placeholder="Why are you out of range?" className="rounded-2xl min-h-[100px]" />
              </div>
              <DialogFooter>
                  <Button onClick={() => setIsOutOfRangeReasonDialogOpen(false)} variant="outline" className="rounded-full font-bold uppercase text-[10px]">Cancel</Button>
                  <Button onClick={handleOutOfRangeSubmit} className="rounded-full font-bold uppercase text-[10px] bg-primary text-white">Confirm & Proceed</Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );

  function handleOutOfRangeSubmit() {
    if (!outOfRangeReason) {
        toast({ variant: "destructive", title: "Reason Required" });
        return;
    }
    if (outOfRangeAction) outOfRangeAction();
    setIsOutOfRangeReasonDialogOpen(false);
    setOutOfRangeReason("");
  }
}
