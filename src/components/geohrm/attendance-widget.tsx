
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
import { Clock, Coffee, Briefcase, MapPin, Utensils, LogOut, MapPinned, LogIn, RotateCcw, Zap } from "lucide-react";
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
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, serverTimestamp, Timestamp, collection } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format, parse, isAfter } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Badge } from "@/components/ui/badge";

type AttendanceStatus = "out" | "in" | "lunch" | "short_break";

interface Location {
  latitude: number;
  longitude: number;
  maxDistanceKm?: number;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

const getDistanceInKm = (loc1: Location, loc2: Location) => {
  if (!loc1 || !loc2 || isNaN(loc1.latitude) || isNaN(loc1.longitude) || isNaN(loc2.latitude) || isNaN(loc2.longitude)) return Infinity;
  const R = 6371; 
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
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';
  const isAdminOrCEO = userRole === 'CEO/Admin' || userRole === 'HR Manager';

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

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);
  
  const {data: todaysAttendance} = useDoc(getTodaysAttendanceRef);

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
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          const dist = officeLocation ? getDistanceInKm(userLocation, officeLocation) : 0;
          setIsVerifyingLocation(false);
          
          if (status === "lunch") {
              if (officeLocation && dist > maxDistanceKm && !isAdminOrCEO) {
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
      let attendanceStatus: 'present' | 'late' = 'present';
      if (officeLocation?.shiftStartTime) {
          const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', new Date());
          if (isAfter(nowClock, shiftStart)) attendanceStatus = 'late';
      }

      const isAtHome = userData?.isWfhAllowed && userData.homeLatitude && userData.homeLongitude && 
                       getDistanceInKm(userLocation, { latitude: userData.homeLatitude, longitude: userData.homeLongitude }) <= (userData.homeRadius || 0.5);
      
      if (getTodaysAttendanceRef) {
          const attendancePayload: any = {
              id: format(nowClock, 'yyyy-MM-dd'),
              employeeId: user!.uid,
              checkInTime: serverTimestamp(),
              status: attendanceStatus,
              totalBreakDuration: 0,
              locationCheckInLatitude: userLocation.latitude || 0,
              locationCheckInLongitude: userLocation.longitude || 0,
              checkInNotes: reason || "",
              isOutOfRange: !!reason,
              isAtHome: isAtHome || false,
          };
          setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
      }

      if (reason) {
          addDocumentNonBlocking(collection(firestore, "attendanceApprovalRequests"), {
              employeeId: user!.uid,
              employeeName: `${(userData as any).firstName} ${(userData as any).lastName}`,
              requestedCheckInTime: format(nowClock, 'PP p'),
              requestedLatitude: userLocation.latitude,
              requestedLongitude: userLocation.longitude,
              reason: reason,
              status: 'Pending',
              requestTimestamp: serverTimestamp()
          });
      }

      setStatus("in");
      toast({ title: "Shift Started" });
  }

  const handleClockIn = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLoc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            setIsVerifyingLocation(false);
            if (isAdminOrCEO) { proceedWithClockIn(userLoc, 0); return; }

            const officeDist = officeLocation ? getDistanceInKm(userLoc, officeLocation) : Infinity;
            const isAtHome = userData?.isWfhAllowed && userData.homeLatitude && userData.homeLongitude && 
                             getDistanceInKm(userLoc, { latitude: userData.homeLatitude, longitude: userData.homeLongitude }) <= (userData.homeRadius || 0.5);

            if (officeDist <= maxDistanceKm || isAtHome) { 
                proceedWithClockIn(userLoc, officeDist); 
                return; 
            }

            setOutOfRangeAction(() => () => proceedWithClockIn(userLoc, officeDist, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "GPS Error" }); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClockOutRedirect = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(p => {
          if (getTodaysAttendanceRef) {
              updateDocumentNonBlocking(getTodaysAttendanceRef, {
                  checkOutTime: serverTimestamp(),
                  locationCheckOutLatitude: p.coords.latitude,
                  locationCheckOutLongitude: p.coords.longitude,
              });
          }
          setIsVerifyingLocation(false);
          setStatus("out");
          setHasClockedOutToday(true);
          toast({ title: "Shift Concluded" });
          router.push('/dashboard/reports');
      }, () => { 
          setIsVerifyingLocation(false); 
          toast({ variant: 'destructive', title: 'GPS Required' }); 
      });
  };

  const isLate = () => {
    if (!lastClockInTime || !officeLocation?.shiftStartTime) return false;
    const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', lastClockInTime);
    return isAfter(lastClockInTime, shiftStart);
  };

  const TrackingCard = ({ label, time, icon: Icon, subValue, active }: any) => (
    <div className={cn(
        "flex-1 p-5 rounded-[2rem] border transition-all duration-500", 
        active ? "bg-white shadow-md ring-1 ring-border border-border/50" : "bg-muted/10 border-transparent opacity-40 grayscale"
    )}>
        <div className="flex flex-col items-center text-center gap-3">
            <div className={cn("p-2.5 rounded-2xl shadow-sm", active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className={cn("text-sm font-black tracking-tight", active ? "text-foreground" : "text-muted-foreground")}>{time}</p>
                {subValue && active && <p className="text-[8px] font-mono font-bold text-primary/60 mt-1.5 tracking-tighter bg-primary/5 px-2 py-0.5 rounded-full">{subValue}</p>}
            </div>
        </div>
    </div>
  );

  const getMilestoneTime = (timestamp: any) => (timestamp instanceof Timestamp) ? format(timestamp.toDate(), 'p') : '--:--';

  return (
    <>
      <Card className="flex flex-col animate-fade-in-up border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden relative font-open-sans">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-[80px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full -ml-32 -mb-32 blur-[80px]" />
        
        <CardHeader className="p-10 pb-4 relative">
          <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2.5 text-primary">
                    <Clock className="size-6" /> Fleet Shift Tracker
                  </CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Verified location-based intelligence registry</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full bg-primary/5 text-primary border-primary/20 font-black text-[10px] uppercase px-5 h-10 shadow-sm">
                <MapPin className="size-3.5 mr-2" /> GPS Active
              </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-10 pt-4 flex flex-col items-center justify-center gap-12 text-center relative">
            <div className="space-y-4">
                <div className={cn(
                    "inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] shadow-sm", 
                    status === "in" ? (isLate() ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700") : "bg-muted text-muted-foreground"
                )}>
                    <div className={cn("size-2 rounded-full", status === 'in' ? (isLate() ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]') : 'bg-slate-400')} />
                    {status === 'in' ? (isLate() ? 'Late Log-in Detected' : 'Operational Status: On Shift') : 'Ready for Deployment'}
                </div>
                
                <div className="py-4">
                    <div className="text-8xl md:text-9xl font-black font-mono tabular-nums tracking-tighter text-primary drop-shadow-xl select-none">
                        {formatTime(workTimer)}
                    </div>
                </div>

                {(status === "lunch" || status === "short_break") && (
                  <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center p-6 rounded-3xl bg-orange-50/50 border border-orange-100 ring-4 ring-orange-50">
                            <span className="text-[11px] font-black uppercase text-orange-600 tracking-[0.3em] flex items-center gap-2 mb-2">
                                <Coffee className="size-4 animate-bounce"/> Active Break
                            </span>
                            <div className="text-4xl font-black font-mono tabular-nums text-orange-600 drop-shadow-sm">{formatTime(breakTimer)}</div>
                        </div>
                    </div>
                    <Badge variant="secondary" className="bg-white/50 text-orange-700 border-orange-100/50 rounded-2xl px-6 py-2 font-black text-[11px] uppercase tracking-widest shadow-sm">
                        Accumulated Break: <span className="ml-2 font-mono">{formatTime(totalBreakTime + breakTimer)}</span>
                    </Badge>
                  </div>
                )}
            </div>

            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl">
                <TrackingCard label="Clock In" time={getMilestoneTime(todaysAttendance?.checkInTime)} icon={LogIn} subValue={todaysAttendance?.locationCheckInLatitude ? `${todaysAttendance.locationCheckInLatitude.toFixed(3)}, ${todaysAttendance.locationCheckInLongitude.toFixed(3)}` : undefined} active={!!todaysAttendance?.checkInTime} />
                <TrackingCard label="Lunch Start" time={getMilestoneTime(todaysAttendance?.lunchOutTime)} icon={Utensils} active={!!todaysAttendance?.lunchOutTime} />
                <TrackingCard label="Lunch End" time={getMilestoneTime(todaysAttendance?.lunchInTime)} icon={LogIn} active={!!todaysAttendance?.lunchInTime} />
                <TrackingCard label="Clock Out" time={getMilestoneTime(todaysAttendance?.checkOutTime)} icon={LogOut} active={!!todaysAttendance?.checkOutTime} />
            </div>
        </CardContent>

        <CardFooter className="p-10 pt-0 flex justify-center items-center relative">
          <div className="w-full max-w-3xl pt-8 border-t border-dashed border-border/50">
            {status === 'out' && !hasClockedOutToday && (
                <Button onClick={handleClockIn} className="w-full h-16 rounded-[2rem] text-xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/25 bg-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Initiate Deployment
                </Button>
            )}
            
            {status !== 'out' && (
                <div className="flex flex-col sm:flex-row gap-5 w-full justify-center">
                    {status === "in" && (
                        <>
                            {!todaysAttendance?.lunchInTime && (
                                <Button onClick={handleLunch} variant="outline" className="rounded-2xl h-14 flex-1 font-black uppercase text-[11px] tracking-widest bg-white border-2 hover:bg-orange-50 hover:border-orange-200 transition-colors">
                                    Lunch Out
                                </Button>
                            )}
                            <Button onClick={handleShortBreak} variant="outline" className="rounded-2xl h-14 flex-1 font-black uppercase text-[11px] tracking-widest bg-white border-2 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                                Short Break
                            </Button>
                        </>
                    )}
                    
                    {status === "lunch" && (
                        <Button onClick={handleLunch} className="rounded-2xl h-14 flex-1 font-black uppercase text-[11px] tracking-widest bg-primary text-white shadow-lg shadow-primary/20">
                            Resume Mission (Lunch End)
                        </Button>
                    )}
                    
                    {status === "short_break" && (
                        <Button onClick={handleShortBreak} className="rounded-2xl h-14 flex-1 font-black uppercase text-[11px] tracking-widest bg-primary text-white shadow-lg shadow-primary/20">
                            Resume Mission
                        </Button>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="rounded-2xl h-14 flex-1 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-red-500/20">
                                Conclude Shift
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] p-8 border-none shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">Deactivate Fleet ID?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                    Strategic protocols require a daily work report submission upon deactivation. Your shift duration will be stamped on the mission log.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-8 gap-3">
                                <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px] h-11 border-2">Return to Post</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClockOutRedirect} className="rounded-full font-bold uppercase text-[10px] h-11 bg-red-600 shadow-lg shadow-red-600/20">Finalize & Sign-Out</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
          </div>
        </CardFooter>

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={setIsOutOfRangeReasonDialogOpen}>
          <DialogContent className="rounded-[2.5rem] p-10 border-none shadow-2xl sm:max-w-md">
              <div className="flex flex-col items-center text-center gap-6 py-4">
                  <div className="p-6 rounded-[2rem] bg-orange-100 text-orange-600 shadow-inner">
                      <MapPinned className="size-10" />
                  </div>
                  <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Remote Access Alert</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Verification Radius Breach Detected</p>
                  </div>
              </div>
              <div className="grid gap-4 py-2">
                  <Label htmlFor="reason" className="font-black text-[10px] uppercase text-primary tracking-widest">Strategic Justification</Label>
                  <Textarea id="reason" value={outOfRangeReason} onChange={(e) => setOutOfRangeReason(e.target.value)} placeholder="Provide context for remote operational base..." className="rounded-2xl min-h-[140px] bg-muted/20 border-none ring-1 ring-border/50 focus:ring-primary/40 transition-all p-4 text-sm" />
              </div>
              <div className="flex flex-col gap-3 mt-6">
                  <Button onClick={() => { if(!outOfRangeReason) { toast({variant: 'destructive', title: 'Justification Required'}); return; } if(outOfRangeAction) outOfRangeAction(); setIsOutOfRangeReasonDialogOpen(false); }} className="h-14 rounded-2xl font-black uppercase tracking-widest bg-primary text-white shadow-xl shadow-primary/20">
                      Certify & Authenticate
                  </Button>
                  <Button onClick={() => setIsOutOfRangeReasonDialogOpen(false)} variant="ghost" className="h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-muted-foreground">
                      Abort Request
                  </Button>
              </div>
          </DialogContent>
        </Dialog>
      </Card>
      
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
                <div className="h-20 w-20 border-4 border-primary/20 border-t-primary animate-spin rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <MapPin className="size-6 text-primary animate-pulse" />
                </div>
            </div>
            <div className="mt-8 text-center space-y-2">
                <p className="text-white font-black uppercase tracking-[0.4em] text-sm">Synchronizing Satellite Grid</p>
                <p className="text-white/40 font-bold uppercase tracking-widest text-[9px]">Awaiting precise GPS calibration...</p>
            </div>
        </div>
      )}
    </>
  );
}
