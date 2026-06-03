"use client";

import * as React from "react";
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
import { Clock, Coffee, Briefcase, MapPin, Utensils, LogOut, MapPinned, LogIn, RotateCcw, Zap, Loader2, Timer, Sparkles, ShieldCheck, RefreshCcw } from "lucide-react";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, useDoc, useCollection } from "@/firebase";
import { doc, serverTimestamp, Timestamp, collection, query, where } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format, parse, isAfter, startOfToday } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Badge } from "@/components/ui/badge";

type AttendanceStatus = "out" | "in" | "lunch" | "short_break";

interface Location {
  latitude: number;
  longitude: number;
}

const getDistanceInKm = (loc1: Location, loc2: Location) => {
  if (!loc1 || !loc2) return Infinity;
  if (typeof loc1.latitude !== 'number' || typeof loc1.longitude !== 'number') return Infinity;
  if (typeof loc2.latitude !== 'number' || typeof loc2.longitude !== 'number') return Infinity;

  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.latitude)) *
      Math.cos(toRad(loc2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus>("out");
  const [now, setNow] = useState(Date.now());
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [lastClockInTime, setLastClockInTime] = useState<Date | null>(null);
  const [currentBreakStartTime, setCurrentBreakStartTime] = useState<Date | null>(null);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);

  const branchDocRef = useMemoFirebase(
    () => userData?.branchId ? doc(firestore, 'branches', userData.branchId) : null,
    [userData, firestore]
  );
  const { data: branchData, isLoading: isBranchLoading } = useDoc<any>(branchDocRef);

  const globalLocationDocRef = useMemoFirebase(
    () => doc(firestore, "settings", "location"),
    [firestore]
  );
  const { data: globalLocationData } = useDoc<any>(globalLocationDocRef);
  
  const activeGeofence = React.useMemo(() => {
    if (userData?.branchId) {
        if (isBranchLoading) return null;
        if (branchData) {
            return {
                name: branchData.name || "Assigned Branch",
                lat: Number(branchData.latitude),
                lng: Number(branchData.longitude),
                radius: Number(branchData.radius || 0.5),
                type: 'branch'
            };
        }
    }

    if (userData?.isWfhAllowed && typeof userData.homeLatitude === 'number' && typeof userData.homeLongitude === 'number') {
        return {
            name: "Residential Base (WFH)",
            lat: Number(userData.homeLatitude),
            lng: Number(userData.homeLongitude),
            radius: Number(userData.homeRadius || 0.5),
            type: 'wfh'
        };
    }

    return {
        name: "Global HQ Sector",
        lat: Number(globalLocationData?.latitude || 13.0827),
        lng: Number(globalLocationData?.longitude || 80.2707),
        radius: Number(globalLocationData?.maxDistanceKm || 0.5),
        type: 'hq'
    };
  }, [branchData, isBranchLoading, globalLocationData, userData]);

  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);
  const [currentDist, setCurrentDist] = useState<number | null>(null);

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);
  
  const {data: todaysAttendance} = useDoc(getTodaysAttendanceRef);

  const requestsQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = startOfToday();
    return query(
        collection(firestore, "attendanceApprovalRequests"),
        where("employeeId", "==", user.uid),
        where("requestTimestamp", ">=", Timestamp.fromDate(today))
    );
  }, [user, firestore]);
  
  const { data: myRequests } = useCollection(requestsQuery);
  const pendingRequest = myRequests?.find(r => r.status === 'Pending');
  const approvedRequest = myRequests?.find(r => r.status === 'Approved');

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(Math.max(0, totalSeconds) / 3600);
    const mins = Math.floor((Math.max(0, totalSeconds) % 3600) / 60);
    const secs = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (todaysAttendance) {
        const checkIn = todaysAttendance.checkInTime instanceof Timestamp ? todaysAttendance.checkInTime.toDate() : null;
        const checkOut = todaysAttendance.checkOutTime instanceof Timestamp ? todaysAttendance.checkOutTime.toDate() : null;
        const lunchOut = todaysAttendance.lunchOutTime instanceof Timestamp ? todaysAttendance.lunchOutTime.toDate() : null;
        const lunchIn = todaysAttendance.lunchInTime instanceof Timestamp ? todaysAttendance.lunchInTime.toDate() : null;
        const savedBreakSec = Number(todaysAttendance.totalBreakDuration || 0);

        setTotalBreakTime(savedBreakSec);
        setLastClockInTime(checkIn);

        if (checkOut && checkIn) {
            setStatus("out");
            setHasClockedOutToday(true);
        } else if (checkIn) {
            setHasClockedOutToday(false);
            if (lunchOut && !lunchIn) {
                setStatus("lunch");
                setCurrentBreakStartTime(lunchOut);
            } else {
                setStatus("in");
                setCurrentBreakStartTime(null);
            }
        }
    } else {
        setStatus("out");
        setHasClockedOutToday(false);
        setTotalBreakTime(0);
        setLastClockInTime(null);
        setCurrentBreakStartTime(null);
    }
  }, [todaysAttendance]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const breakTimer = useMemo(() => {
    if ((status === "lunch" || status === "short_break") && currentBreakStartTime) {
        return Math.max(0, (now - currentBreakStartTime.getTime()) / 1000);
    }
    return 0;
  }, [now, status, currentBreakStartTime]);

  const workTimer = useMemo(() => {
    if (!lastClockInTime) return 0;
    const currentAbsoluteTotalElapsed = (now - lastClockInTime.getTime()) / 1000;
    
    if (status === "in") {
        return Math.max(0, currentAbsoluteTotalElapsed - totalBreakTime);
    } else if (status === "lunch" || status === "short_break") {
        const elapsedUntilBreak = (currentBreakStartTime!.getTime() - lastClockInTime.getTime()) / 1000;
        return Math.max(0, elapsedUntilBreak - totalBreakTime);
    } else if (status === "out" && hasClockedOutToday) {
        const checkOut = todaysAttendance?.checkOutTime instanceof Timestamp ? todaysAttendance.checkOutTime.toDate() : new Date();
        const totalElapsed = (checkOut.getTime() - lastClockInTime.getTime()) / 1000;
        return Math.max(0, totalElapsed - totalBreakTime);
    }
    return 0;
  }, [now, status, lastClockInTime, totalBreakTime, currentBreakStartTime, hasClockedOutToday, todaysAttendance]);

  const proceedWithBreakEnd = useCallback((userLocation: Location, dist: number, reason?: string) => {
      const finalBreakDuration = (Date.now() - currentBreakStartTime!.getTime()) / 1000;
      const updatedTotalBreakTime = totalBreakTime + finalBreakDuration;
      
      if (getTodaysAttendanceRef) {
          const payload: any = {
              totalBreakDuration: updatedTotalBreakTime,
          };
          if (status === 'lunch') {
              payload.locationLunchInLatitude = userLocation.latitude || 0;
              payload.locationLunchInLongitude = userLocation.longitude || 0;
              payload.lunchInTime = serverTimestamp();
          }
          if (reason) {
              payload.isOutOfRange = true;
          }
          updateDocumentNonBlocking(getTodaysAttendanceRef, payload);
      }
      setTotalBreakTime(updatedTotalBreakTime);
      setCurrentBreakStartTime(null);
      setStatus("in");
      toast({ title: "Work Resumed" });
  }, [currentBreakStartTime, totalBreakTime, status, getTodaysAttendanceRef, toast]);

  const handleLunch = () => {
    if (!activeGeofence) return;
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          const dist = getDistanceInKm(userLocation, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
          setIsVerifyingLocation(false);
          
          if (status === "lunch") {
              if (dist > activeGeofence.radius && !approvedRequest) {
                  setCurrentDist(dist);
                  setOutOfRangeAction(() => () => proceedWithBreakEnd(userLocation, dist, outOfRangeReason));
                  setIsOutOfRangeReasonDialogOpen(true);
              } else {
                  proceedWithBreakEnd(userLocation, dist);
              }
          } else {
              const nowBreak = new Date();
              if (getTodaysAttendanceRef) {
                  updateDocumentNonBlocking(getTodaysAttendanceRef, {
                      locationLunchOutLatitude: userLocation.latitude,
                      locationLunchOutLongitude: userLocation.longitude,
                      lunchOutTime: serverTimestamp(),
                  });
              }
              setCurrentBreakStartTime(nowBreak);
              setStatus("lunch");
              toast({ title: "Lunch Break Started" });
          }
        },
        () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "GPS Required" }); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleShortBreak = () => {
      if (status === "short_break") {
          proceedWithBreakEnd({ latitude: 0, longitude: 0 }, 0);
      } else {
          setCurrentBreakStartTime(new Date());
          setStatus("short_break");
          toast({ title: "Break Started" });
      }
  }
  
  const proceedWithClockIn = (userLocation: Location, dist: number, reason?: string) => {
      const nowClock = new Date();
      let attendanceStatus: 'present' | 'late' | 'out_of_range' = 'present';
      if (globalLocationData?.shiftStartTime) {
          const shiftStart = parse(globalLocationData.shiftStartTime, 'HH:mm', new Date());
          if (isAfter(nowClock, shiftStart)) attendanceStatus = 'late';
      }

      const todayId = format(nowClock, 'yyyy-MM-dd');

      if (reason) {
          addDocumentNonBlocking(collection(firestore, "attendanceApprovalRequests"), {
              employeeId: user!.uid,
              employeeName: `${userData?.firstName} ${userData?.lastName}`,
              requestedCheckInTime: format(nowClock, 'PP p'),
              dateId: todayId,
              intendedStatus: attendanceStatus,
              requestedLatitude: userLocation.latitude,
              requestedLongitude: userLocation.longitude,
              reason: reason,
              status: 'Pending',
              type: 'Check In',
              distance: dist.toFixed(2),
              targetBranch: activeGeofence?.name,
              requestTimestamp: serverTimestamp()
          });
          toast({ title: "Range Permission Dispatched", description: "Pending administrative review." });
          setIsOutOfRangeReasonDialogOpen(false);
          setOutOfRangeReason("");
      } else {
          if (getTodaysAttendanceRef) {
              const attendancePayload: any = {
                  id: todayId,
                  employeeId: user!.uid,
                  checkInTime: serverTimestamp(),
                  status: attendanceStatus,
                  totalBreakDuration: 0,
                  locationCheckInLatitude: userLocation.latitude || 0,
                  locationCheckInLongitude: userLocation.longitude || 0,
                  isOutOfRange: dist > (activeGeofence?.radius || 0.5),
                  isAtHome: activeGeofence?.type === 'wfh'
              };
              setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
          }
          setStatus("in");
          toast({ title: "Shift Synchronized" });
      }
  }

  const handleClockIn = () => {
    if (!activeGeofence) {
        toast({ variant: 'destructive', title: 'Target Sector Resolving', description: 'Please wait while we calibrate your assigned operational coordinates.' });
        return;
    }
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLoc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setIsVerifyingLocation(false);

            const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
            
            // Allow clock-in if within range OR if a request for today was already approved
            if (dist <= activeGeofence.radius || approvedRequest) { 
                proceedWithClockIn(userLoc, dist); 
                return; 
            }

            setCurrentDist(dist);
            setOutOfRangeAction(() => () => proceedWithClockIn(userLoc, dist, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "GPS Error" }); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const proceedWithClockOut = (userLocation: Location, dist: number, reason?: string) => {
      if (reason) {
          addDocumentNonBlocking(collection(firestore, "attendanceApprovalRequests"), {
              employeeId: user!.uid,
              employeeName: `${userData?.firstName} ${userData?.lastName}`,
              requestedCheckInTime: format(new Date(), 'PP p'),
              dateId: format(new Date(), 'yyyy-MM-dd'),
              requestedLatitude: userLocation.latitude,
              requestedLongitude: userLocation.longitude,
              reason: reason,
              status: 'Pending',
              type: 'Clock Out',
              distance: dist.toFixed(2),
              targetBranch: activeGeofence?.name,
              requestTimestamp: serverTimestamp()
          });
          toast({ title: "Checkout Request Dispatched", description: "Pending administrative review." });
          setIsOutOfRangeReasonDialogOpen(false);
          setOutOfRangeReason("");
      } else {
          if (getTodaysAttendanceRef) {
              updateDocumentNonBlocking(getTodaysAttendanceRef, {
                  checkOutTime: serverTimestamp(),
                  locationCheckOutLatitude: userLocation.latitude,
                  locationCheckOutLongitude: userLocation.longitude,
              });
          }
          setStatus("out");
          setHasClockedOutToday(true);
          toast({ title: "Shift Concluded" });
          router.push('/dashboard/reports');
      }
  };

  const handleClockOutRedirect = () => {
      if (!activeGeofence) return;
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(p => {
          const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
          setIsVerifyingLocation(false);

          const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });

          if (dist <= activeGeofence.radius || approvedRequest) {
              proceedWithClockOut(userLoc, dist);
          } else {
              setCurrentDist(dist);
              setOutOfRangeAction(() => () => proceedWithClockOut(userLoc, dist, outOfRangeReason));
              setIsOutOfRangeReasonDialogOpen(true);
          }
      }, () => { 
          setIsVerifyingLocation(false); 
          toast({ variant: 'destructive', title: 'GPS Required' }); 
      });
  };

  const handleRecalibrate = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(() => {
          setIsVerifyingLocation(false);
          toast({ title: "Satellite Grid Recalibrated", description: "GPS coordinates synchronized with high-fidelity." });
      }, () => {
          setIsVerifyingLocation(false);
          toast({ variant: 'destructive', title: "Calibration Failed" });
      }, { enableHighAccuracy: true, timeout: 5000 });
  };

  const isLate = () => {
    if (!lastClockInTime || !globalLocationData?.shiftStartTime) return false;
    const shiftStart = parse(globalLocationData.shiftStartTime, 'HH:mm', lastClockInTime);
    return isAfter(lastClockInTime, shiftStart);
  };

  const TrackingCard = ({ label, time, icon: Icon, subValue, active }: any) => (
    <div className={cn(
        "flex-1 p-3 rounded-2xl border transition-all duration-500", 
        active ? "bg-white shadow-sm ring-1 ring-border border-border/50" : "bg-muted/5 border-transparent opacity-40 grayscale"
    )}>
        <div className="flex flex-col items-center text-center gap-2">
            <div className={cn("p-1.5 rounded-lg shadow-sm", active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                <Icon className="size-3" />
            </div>
            <div className="min-w-0 w-full">
                <p className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5 leading-none">{label}</p>
                <p className={cn("text-[10px] font-black tracking-tight truncate", active ? "text-foreground" : "text-muted-foreground")}>{time}</p>
            </div>
        </div>
    </div>
  );

  const getMilestoneTime = (timestamp: any) => (timestamp instanceof Timestamp) ? format(timestamp.toDate(), 'p') : '--:--';

  if (isUserDocLoading) return <div className="h-64 flex items-center justify-center animate-pulse uppercase font-black text-[10px] tracking-[0.4em]">Calibrating...</div>;

  return (
    <>
      <Card className="flex flex-col animate-fade-in-up border-none shadow-lg rounded-[1.5rem] bg-white overflow-hidden relative font-jakarta">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-20 -mt-20 blur-[60px]" />
        
        <CardHeader className="p-6 pb-2 relative">
          <div className="flex items-center justify-between">
              <div className="space-y-1">
                  <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                    <Clock className="size-4" /> Shift Tracker
                  </CardTitle>
                  <CardDescription className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60">Verified location registry</CardDescription>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={handleRecalibrate} className="rounded-full h-8 px-3 font-black text-[8px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50 border border-dashed">
                    <RefreshCcw className="size-2.5 mr-1" /> Re-sync
                </Button>
                <Badge variant="outline" className="rounded-full bg-primary/5 text-primary border-primary/20 font-black text-[8px] uppercase px-3 h-8 shadow-sm">
                    <MapPin className="size-2.5 mr-1.5" /> Satellite Active
                </Badge>
              </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-2 flex flex-col items-center justify-center gap-8 text-center relative">
            <div className="space-y-2">
                <div className={cn(
                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-sm", 
                    status === "in" ? (isLate() ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700") : "bg-muted text-muted-foreground"
                )}>
                    <div className={cn("size-1.5 rounded-full", status === 'in' ? (isLate() ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-pulse') : 'bg-slate-400')} />
                    {status === 'in' ? (isLate() ? 'Late Entry' : 'On Shift') : 'Ready'}
                </div>
                
                <div className="py-2">
                    <div className="text-6xl md:text-7xl font-black font-mono tabular-nums tracking-tighter text-primary drop-shadow-md select-none">
                        {formatTime(workTimer)}
                    </div>
                </div>

                {activeGeofence && (
                    <div className="flex flex-col items-center gap-2">
                        <Badge variant="secondary" className="rounded-full px-4 py-1 font-black text-[8px] uppercase tracking-widest bg-muted/40 text-primary border border-primary/10">
                            Sector: {activeGeofence.name}
                        </Badge>
                    </div>
                )}

                {(status === "lunch" || status === "short_break") && (
                  <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                        <div className="flex flex-col items-center p-4 rounded-2xl bg-orange-50/50 border border-orange-100 shadow-inner">
                            <span className="text-[9px] font-black uppercase text-orange-600 tracking-[0.2em] flex items-center gap-1.5 mb-1">
                                <Coffee className="size-3 animate-bounce"/> Break
                            </span>
                            <div className="text-3xl font-black font-mono tabular-nums text-orange-600">{formatTime(breakTimer)}</div>
                        </div>
                    <Badge variant="secondary" className="bg-white/50 text-orange-700 border-orange-100/50 rounded-xl px-4 py-1 font-black text-[9px] uppercase tracking-widest shadow-sm">
                        Total: {formatTime(totalBreakTime + breakTimer)}
                    </Badge>
                  </div>
                )}

                {pendingRequest && status === 'out' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-dashed border-amber-200 animate-pulse">
                        <div className="flex items-center justify-center gap-2 text-amber-700 mb-1">
                            <Timer className="size-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Awaiting Approval</span>
                        </div>
                        <p className="text-[8px] text-amber-600 font-bold uppercase tracking-widest leading-tight">Remote access justification submitted. Deployment pending.</p>
                    </div>
                )}
            </div>

            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-2xl">
                <TrackingCard label="Clock In" time={getMilestoneTime(todaysAttendance?.checkInTime)} icon={LogIn} active={!!todaysAttendance?.checkInTime} />
                <TrackingCard label="Break Start" time={getMilestoneTime(todaysAttendance?.lunchOutTime)} icon={Utensils} active={!!todaysAttendance?.lunchOutTime} />
                <TrackingCard label="Break End" time={getMilestoneTime(todaysAttendance?.lunchInTime)} icon={LogIn} active={!!todaysAttendance?.lunchInTime} />
                <TrackingCard label="Clock Out" time={getMilestoneTime(todaysAttendance?.checkOutTime)} icon={LogOut} active={!!todaysAttendance?.checkOutTime} />
            </div>
        </CardContent>

        <CardFooter className="p-6 pt-0 flex justify-center items-center relative">
          <div className="w-full max-w-xl pt-4 border-t border-dashed border-border/50">
            {status === 'out' && !hasClockedOutToday && !pendingRequest && (
                <Button onClick={handleClockIn} className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 bg-primary text-white transition-all">
                    Activate Shift
                </Button>
            )}

            {status === 'out' && pendingRequest && (
                <Button disabled className="w-full h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] bg-muted text-muted-foreground opacity-50 border border-dashed">
                    Awaiting Authority...
                </Button>
            )}
            
            {status !== 'out' && (
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                    {status === "in" && (
                        <>
                            {!todaysAttendance?.lunchInTime && (
                                <Button onClick={handleLunch} variant="outline" className="rounded-xl h-12 flex-1 font-black uppercase text-[9px] tracking-[0.15em] bg-white border-2 hover:bg-orange-50 transition-all">
                                    Break Out
                                </Button>
                            )}
                            <Button onClick={handleShortBreak} variant="outline" className="rounded-xl h-12 flex-1 font-black uppercase text-[9px] tracking-[0.15em] bg-white border-2 hover:bg-blue-50 transition-all">
                                Short Stop
                            </Button>
                        </>
                    )}
                    
                    {(status === "lunch" || status === "short_break") && (
                        <Button onClick={handleLunch} className="rounded-xl h-12 flex-1 font-black uppercase text-[9px] tracking-[0.15em] bg-primary text-white shadow-md transition-all">
                            Resume
                        </Button>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="rounded-xl h-12 flex-1 font-black uppercase text-[9px] tracking-[0.15em] shadow-md transition-all">
                                Deactivate
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[1.5rem] p-6 border-none shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-red-600">Deactivate Shift?</AlertDialogTitle>
                                <AlertDialogDescription className="text-[10px] font-bold uppercase tracking-tight leading-relaxed opacity-60">
                                    Strategic protocols require a daily log submission. Your tenure will be stamped on the mission log.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6 gap-2">
                                <AlertDialogCancel className="rounded-full font-black uppercase text-[8px] h-10 border-2 px-6">Return</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClockOutRedirect} className="rounded-full font-black uppercase text-[8px] h-10 bg-red-600 shadow-md px-6">Deactivate</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
          </div>
        </CardFooter>

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={setIsOutOfRangeReasonDialogOpen}>
          <DialogContent className="rounded-[1.5rem] p-8 border-none shadow-2xl sm:max-w-md">
              <div className="flex flex-col items-center text-center gap-4 py-2">
                  <div className="p-4 rounded-xl bg-orange-100 text-orange-600 shadow-inner">
                      <MapPinned className="size-8" />
                  </div>
                  <div className="space-y-1">
                      <h3 className="text-xl font-black uppercase tracking-tighter text-primary">Range Breach</h3>
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Radius Violation Detected</p>
                  </div>
              </div>
              <div className="grid gap-4 py-4">
                  <Label htmlFor="reason" className="font-black text-[8px] uppercase text-primary tracking-[0.2em]">Justification</Label>
                  <Textarea id="reason" value={outOfRangeReason} onChange={(e) => setOutOfRangeReason(e.target.value)} placeholder="Provide contextual briefing..." className="rounded-xl min-h-[100px] bg-muted/10 border-none ring-1 ring-border/50 focus:ring-primary/40 p-4 text-xs font-medium" />
              </div>
              <div className="flex flex-col gap-2 mt-4">
                  <Button onClick={() => { if(!outOfRangeReason) { toast({variant: 'destructive', title: 'Justification Required'}); return; } if(outOfRangeAction) outOfRangeAction(); }} className="h-12 rounded-xl font-black uppercase tracking-widest bg-primary text-white text-[9px] transition-all">
                      Certify & Dispatch
                  </Button>
                  <Button onClick={() => setIsOutOfRangeReasonDialogOpen(false)} variant="ghost" className="h-10 rounded-full font-black uppercase text-[8px] text-muted-foreground/60">
                      Abort
                  </Button>
              </div>
          </DialogContent>
        </Dialog>
      </Card>
      
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
                <div className="h-16 w-16 border-2 border-primary/20 border-t-primary animate-spin rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin className="size-4 text-primary animate-pulse" />
                </div>
            </div>
            <div className="mt-6 text-center space-y-2">
                <div className="flex items-center gap-2 justify-center text-white font-black uppercase tracking-[0.3em] text-sm">
                    <Sparkles className="size-4 text-primary" /> Calibrating Grid
                </div>
                <p className="text-white/40 font-bold uppercase tracking-[0.15em] text-[8px]">Satellite handshake in progress...</p>
            </div>
        </div>
      )}
    </>
  );
}
