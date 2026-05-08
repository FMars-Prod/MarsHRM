"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Clock, Coffee, Briefcase, CheckCircle2, MapPin, Utensils, LogOut, MapPinned, Info } from "lucide-react";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format, parse, isAfter } from "date-fns";
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
  const { data: officeLocationData } = useDoc<Location>(officeLocationDocRef);
  
  const officeLocation = officeLocationData;
  const maxDistanceKm = officeLocation?.maxDistanceKm || 2;

  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);
  const [outOfRangeInfo, setOutOfRangeInfo] = useState('');

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);
  
  const {data: todaysAttendance} = useDoc(getTodaysAttendanceRef);

  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || isNaN(totalSeconds)) return "00:00:00";
    const hrs = Math.floor(Math.max(0, totalSeconds) / 3600);
    const mins = Math.floor((Math.max(0, totalSeconds) % 3600) / 60);
    const secs = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (todaysAttendance) {
        const checkIn = todaysAttendance.checkInTime?.toDate();
        const checkOut = todaysAttendance.checkOutTime?.toDate();
        const lunchOut = todaysAttendance.lunchOutTime?.toDate();
        const lunchIn = todaysAttendance.lunchInTime?.toDate();
        const savedBreakSec = todaysAttendance.totalBreakDuration || 0;

        setTotalBreakTime(savedBreakSec);
        setLastClockInTime(checkIn || null);

        if (checkOut) {
            setStatus("out");
            setHasClockedOutToday(true);
            const totalElapsed = (checkOut.getTime() - checkIn.getTime()) / 1000;
            setTimer(totalElapsed - savedBreakSec);
            setBreakTimer(0);
        } else {
            setHasClockedOutToday(false);
            if (lunchOut && !lunchIn) {
                setStatus("lunch");
                const elapsedBeforeLunch = (lunchOut.getTime() - checkIn.getTime()) / 1000;
                setTimer(elapsedBeforeLunch - savedBreakSec);
                setBreakTimer((new Date().getTime() - lunchOut.getTime()) / 1000);
            } else {
                setStatus("in");
                const now = new Date().getTime();
                const totalElapsed = (now - checkIn.getTime()) / 1000;
                setTimer(totalElapsed - savedBreakSec);
                setBreakTimer(0);
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
      interval = setInterval(() => {
          setTimer((prev) => prev + 1);
      }, 1000);
    } else if (status === "lunch" || status === "short_break") {
      interval = setInterval(() => {
          setBreakTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

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

  const isLate = () => {
    if (!lastClockInTime || !officeLocation?.shiftStartTime) return false;
    const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', lastClockInTime);
    return isAfter(lastClockInTime, shiftStart);
  };

  const hasReturnedFromLunch = todaysAttendance?.locationLunchInLatitude;

  const TrackingCard = ({ label, time, icon: Icon, subValue, active }: { label: string, time: string, icon: any, subValue?: string, active: boolean }) => (
    <div className={cn(
        "flex-1 p-4 rounded-2xl border transition-all duration-500",
        active ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" : "bg-white border-border/50 opacity-60 grayscale"
    )}>
        <div className="flex flex-col items-center text-center gap-2">
            <div className={cn("p-1.5 rounded-lg", active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                <Icon className="size-3.5" />
            </div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className={cn("text-sm font-bold mt-0.5", active ? "text-primary" : "text-muted-foreground")}>{time}</p>
                {subValue && active && <p className="text-[8px] font-mono font-bold text-muted-foreground mt-1 tracking-tighter">{subValue}</p>}
            </div>
        </div>
    </div>
  );

  const getMilestoneTime = (timestamp: any) => timestamp ? format(timestamp.toDate(), 'p') : '--:--';

  return (
    <>
      <Card className="flex flex-col animate-fade-in-up bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
              <CardTitle className="font-headline flex items-center gap-2 text-primary">
                <Clock className="size-5" />
                Precision Attendance
              </CardTitle>
          </div>
          <CardDescription>High-accuracy geofenced tracking active.</CardDescription>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col items-center justify-center gap-8 text-center pb-8 pt-2">
            <div className="space-y-1">
                <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4",
                    status === "in" ? (isLate() ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700") : "bg-muted text-muted-foreground"
                )}>
                    {status === "in" && (isLate() ? <Clock className="size-3" /> : <Briefcase className="size-3" />)}
                    {status === 'in' ? (isLate() ? 'Late Operations' : 'Active Shift') : 'Ready to Start'}
                </div>
                
                {lastClockInTime && (
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                        <LogIn className="size-3" /> Logged In At: <span className="text-primary">{format(lastClockInTime, 'p')}</span>
                    </p>
                )}
                
                <div className="text-7xl font-black font-mono tabular-nums tracking-tighter text-primary drop-shadow-sm py-2">
                    {formatTime(timer)}
                </div>

                {(status === "lunch" || status === "short_break") && (
                  <div className="flex flex-col items-center animate-pulse">
                    <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest flex items-center gap-1.5"><Coffee className="size-3"/> Current Break</span>
                    <div className="text-2xl font-bold font-mono tabular-nums text-orange-600">{formatTime(breakTimer)}</div>
                  </div>
                )}
            </div>

            <div className="w-full max-w-3xl flex gap-3 px-2">
                <TrackingCard 
                    label="Log In" 
                    time={getMilestoneTime(todaysAttendance?.checkInTime)} 
                    icon={LogIn} 
                    subValue={todaysAttendance?.locationCheckInLatitude ? `${todaysAttendance.locationCheckInLatitude.toFixed(4)}, ${todaysAttendance.locationCheckInLongitude.toFixed(4)}` : undefined}
                    active={!!todaysAttendance?.checkInTime} 
                />
                <TrackingCard 
                    label="L-Out" 
                    time={getMilestoneTime(todaysAttendance?.lunchOutTime)} 
                    icon={Utensils} 
                    active={!!todaysAttendance?.lunchOutTime} 
                />
                <TrackingCard 
                    label="L-In" 
                    time={getMilestoneTime(todaysAttendance?.lunchInTime)} 
                    icon={LogIn} 
                    active={!!todaysAttendance?.lunchInTime} 
                />
                <TrackingCard 
                    label="Log-Out" 
                    time={getMilestoneTime(todaysAttendance?.checkOutTime)} 
                    icon={LogOut} 
                    active={!!todaysAttendance?.checkOutTime} 
                />
            </div>
        </CardContent>

        <CardFooter className="flex justify-center items-center py-6 px-6 bg-muted/5 border-t">
          {status === 'out' && !hasClockedOutToday && (
              <Button onClick={handleClockIn} className="w-full max-w-[280px] rounded-full h-14 text-lg font-black uppercase tracking-widest shadow-xl bg-primary text-white hover:scale-[1.02] transition-transform">
                  Start Shift
              </Button>
          )}
          {status !== 'out' && (
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-[600px] justify-center">
                  {status === "in" && (
                      <>
                          {!hasReturnedFromLunch && (
                            <Button onClick={handleLunch} variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-white text-primary hover:bg-primary/5">
                                L-OUT
                            </Button>
                          )}
                          <Button onClick={handleShortBreak} variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-white text-primary hover:bg-primary/5">
                              Short Break
                          </Button>
                      </>
                  )}
                  {status === "lunch" && (
                      <Button onClick={handleLunch} className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-primary text-white shadow-lg">
                          L-IN
                      </Button>
                  )}
                  {status === "short_break" && (
                      <Button onClick={handleShortBreak} className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest bg-primary text-white shadow-lg">
                          Resume Work
                      </Button>
                  )}
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md hover:scale-[1.02] transition-transform">
                              Finish Day
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Shift Conclusion Protocol</AlertDialogTitle>
                              <AlertDialogDescription>Capture final location and synchronize today's strategic log.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Resume Ops</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClockOutRedirect} className="rounded-full font-bold uppercase text-[10px]">
                                  Confirm & Finish
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          )}
        </CardFooter>

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={setIsOutOfRangeReasonDialogOpen}>
          <DialogContent className="rounded-3xl">
              <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="p-4 rounded-full bg-orange-100 text-orange-600">
                    <MapPinned className="size-8" />
                  </div>
                  <div className="space-y-1">
                      <h3 className="text-xl font-black uppercase tracking-tighter">Satellite Discrepancy</h3>
                      <p className="text-sm text-muted-foreground font-medium">Device is currently operating outside the pre-approved geofence parameters.</p>
                  </div>
              </div>
              <div className="grid gap-4 py-2">
                  <Label htmlFor="reason" className="font-bold text-[10px] uppercase tracking-widest text-primary">Mandatory Strategic Justification</Label>
                  <Textarea id="reason" value={outOfRangeReason} onChange={(e) => setOutOfRangeReason(e.target.value)} placeholder="Provide specific reason for remote access (e.g. Field assignment, Client site...)" className="rounded-2xl min-h-[100px] bg-muted/20 border-none ring-1 ring-border/50" />
              </div>
              <div className="flex gap-3 mt-4">
                  <Button onClick={() => setIsOutOfRangeReasonDialogOpen(false)} variant="outline" className="flex-1 rounded-full font-bold uppercase text-[10px]">Cancel</Button>
                  <Button onClick={handleOutOfRangeSubmit} className="flex-1 rounded-full font-bold uppercase text-[10px] bg-primary text-white">Certify & Proceed</Button>
              </div>
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
