"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { LogOut, LogIn, Loader2, Utensils, AlertTriangle, CheckCircle2, MapPin, LocateFixed, Signal, Coffee, Timer, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, useDoc, useCollection } from "@/firebase";
import { doc, serverTimestamp, collection, Timestamp, query, where, getDocs } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format, startOfDay, endOfDay } from "date-fns";
import { Textarea } from "../ui/textarea";
import { Badge } from "@/components/ui/badge";

type AttendanceStatus = "out" | "in" | "lunch" | "short_break";

interface Location {
  latitude: number;
  longitude: number;
}

const getDistanceInKm = (loc1: Location, loc2: Location) => {
  if (!loc1 || !loc2) return Infinity;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; 
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(loc1.latitude)) * Math.cos(toRad(loc2.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function AttendanceWidget() {
  const [status, setStatus] = useState<AttendanceStatus>("out");
  const [now, setNow] = useState(Date.now());
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [lastClockInTime, setLastClockInTime] = useState<Date | null>(null);
  const [currentBreakStartTime, setCurrentBreakStartTime] = useState<Date | null>(null);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const { toast } = useToast();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);

  const branchDocRef = useMemoFirebase(() => userData?.branchId ? doc(firestore, 'branches', userData.branchId) : null, [userData, firestore]);
  const { data: branchData } = useDoc<any>(branchDocRef);

  const globalLocationDocRef = useMemoFirebase(() => doc(firestore, "settings", "location"), [firestore]);
  const { data: globalLocationData } = useDoc<any>(globalLocationDocRef);

  const wfhRequestsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
        collection(firestore, 'leave_requests'),
        where('employeeId', '==', user.uid),
        where('category', '==', 'WFH'),
        where('status', '==', 'Approved')
    );
  }, [user, firestore]);
  const { data: wfhRequests } = useCollection<any>(wfhRequestsQuery);

  const activeWfhToday = React.useMemo(() => {
    if (!wfhRequests) return null;
    const currentDay = new Date();
    return wfhRequests.find(r => {
        const start = r.startDate?.toDate?.() || new Date(r.startDate);
        const end = r.endDate?.toDate?.() || new Date(r.endDate);
        const s = startOfDay(start);
        const e = endOfDay(end);
        return currentDay >= s && currentDay <= e;
    });
  }, [wfhRequests]);
  
  const activeGeofence = React.useMemo(() => {
    if (activeWfhToday && typeof activeWfhToday.latitude === 'number') {
        return { name: "WFH", lat: Number(activeWfhToday.latitude), lng: Number(activeWfhToday.longitude), radius: 0.5, type: 'wfh' };
    }
    if (userData?.isWfhAllowed && typeof userData.homeLatitude === 'number') {
        return { name: "Home", lat: Number(userData.homeLatitude), lng: Number(userData.homeLongitude), radius: Number(userData.homeRadius || 0.5), type: 'wfh' };
    }
    if (userData?.branchId && branchData) {
        return { name: branchData.name, lat: Number(branchData.latitude), lng: Number(branchData.longitude), radius: Number(branchData.radius || 0.5), type: 'office' };
    }
    return { name: "Office", lat: Number(globalLocationData?.latitude || 13.0827), lng: Number(globalLocationData?.longitude || 80.2707), radius: Number(globalLocationData?.maxDistanceKm || 0.5), type: 'office' };
  }, [branchData, globalLocationData, userData, activeWfhToday]);

  const [isOutOfRangeDialogOpen, setIsOutOfRangeDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeType, setOutOfRangeType] = useState<'Check In' | 'Clock Out'>('Check In');
  const [lastCapturedLoc, setLastCapturedLoc] = useState<Location | null>(null);

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      return doc(firestore, `users/${user.uid}/attendances`, format(new Date(), 'yyyy-MM-dd'));
  }, [user, firestore]);
  
  const {data: todaysAttendance} = useDoc<any>(getTodaysAttendanceRef);

  useEffect(() => {
    if (todaysAttendance) {
        const checkIn = todaysAttendance.checkInTime?.toDate?.() || null;
        const checkOut = todaysAttendance.checkOutTime?.toDate?.() || null;
        const lunchOut = todaysAttendance.lunchOutTime?.toDate?.() || null;
        const lunchIn = todaysAttendance.lunchInTime?.toDate?.() || null;
        const breakOut = todaysAttendance.breakOutTime?.toDate?.() || null;
        const breakIn = todaysAttendance.breakInTime?.toDate?.() || null;

        setTotalBreakTime(Number(todaysAttendance.totalBreakDuration || 0));
        setLastClockInTime(checkIn);

        if (checkOut && checkIn) { 
            setStatus("out"); 
            setHasClockedOutToday(true); 
        } else if (checkIn) { 
            setHasClockedOutToday(false); 
            if (lunchOut && !lunchIn) { 
                setStatus("lunch"); 
                setCurrentBreakStartTime(lunchOut); 
            } else if (breakOut && !breakIn) {
                setStatus("short_break");
                setCurrentBreakStartTime(breakOut);
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
    }
  }, [todaysAttendance]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(Math.max(0, seconds) / 3600);
    const m = Math.floor((Math.max(0, seconds) % 3600) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const workTimer = useMemo(() => {
    if (!lastClockInTime) return 0;
    const elapsed = (now - lastClockInTime.getTime()) / 1000;
    if (status === "in") return Math.max(0, elapsed - totalBreakTime);
    if (status === "lunch" || status === "short_break") return Math.max(0, (currentBreakStartTime!.getTime() - lastClockInTime.getTime()) / 1000 - totalBreakTime);
    if (status === "out" && hasClockedOutToday) {
        const checkOut = todaysAttendance?.checkOutTime?.toDate?.() || new Date();
        return Math.max(0, (checkOut.getTime() - lastClockInTime.getTime()) / 1000 - totalBreakTime);
    }
    return 0;
  }, [now, status, lastClockInTime, totalBreakTime, currentBreakStartTime, hasClockedOutToday, todaysAttendance]);

  const handleClockIn = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition((p) => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setLastCapturedLoc(userLoc);
        const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
        setIsVerifyingLocation(false);
        if (dist <= (activeGeofence.radius + 0.05)) {
            const todayId = format(new Date(), 'yyyy-MM-dd');
            setDocumentNonBlocking(getTodaysAttendanceRef!, { 
                id: todayId, employeeId: user!.uid, checkInTime: serverTimestamp(), 
                status: 'present', totalBreakDuration: 0, 
                locationCheckInLatitude: userLoc.latitude, locationCheckInLongitude: userLoc.longitude, 
                isOutOfRange: false, isAtHome: activeGeofence.type === 'wfh'
            }, { merge: true });
            toast({ title: "Clocked In" });
        } else { setOutOfRangeType('Check In'); setIsOutOfRangeDialogOpen(true); }
    }, () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "Location Error" }); }, { enableHighAccuracy: true });
  };

  const handleClockOut = async () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(p => {
          const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
          setLastCapturedLoc(userLoc);
          const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
          setIsVerifyingLocation(false);
          if (dist <= (activeGeofence.radius + 0.05)) {
              updateDocumentNonBlocking(getTodaysAttendanceRef!, { 
                  checkOutTime: serverTimestamp(), 
                  locationCheckOutLatitude: p.coords.latitude, locationCheckOutLongitude: p.coords.longitude 
              });
              toast({ title: "Clocked Out" });
          } else { setOutOfRangeType('Clock Out'); setIsOutOfRangeDialogOpen(true); }
      }, () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "Location Error" }); }, { enableHighAccuracy: true });
  };

  const handleLunchOut = () => {
    updateDocumentNonBlocking(getTodaysAttendanceRef!, { lunchOutTime: serverTimestamp(), lunchInTime: null });
    toast({ title: "Lunch Started" });
  };

  const handleLunchIn = () => {
    const breakStart = todaysAttendance?.lunchOutTime?.toDate();
    const duration = breakStart ? Math.floor((new Date().getTime() - breakStart.getTime()) / 1000) : 0;
    updateDocumentNonBlocking(getTodaysAttendanceRef!, { 
        lunchInTime: serverTimestamp(), 
        totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration 
    });
    toast({ title: "Lunch Ended" });
  };

  const handleShortBreakOut = () => {
    updateDocumentNonBlocking(getTodaysAttendanceRef!, { breakOutTime: serverTimestamp(), breakInTime: null });
    toast({ title: "Break Started" });
  };

  const handleShortBreakIn = () => {
    const breakStart = todaysAttendance?.breakOutTime?.toDate();
    const duration = breakStart ? Math.floor((new Date().getTime() - breakStart.getTime()) / 1000) : 0;
    updateDocumentNonBlocking(getTodaysAttendanceRef!, { 
        breakInTime: serverTimestamp(), 
        totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration 
    });
    toast({ title: "Break Ended" });
  };

  const handleSubmitOutOfRangeRequest = () => {
      if (!outOfRangeReason.trim() || !user || !userData || !lastCapturedLoc || isSubmittingApproval) return;
      setIsSubmittingApproval(true);
      const payload = {
          employeeId: user.uid, employeeName: `${userData.firstName} ${userData.lastName}`,
          requestedCheckInTime: format(new Date(), 'PP p'), dateId: format(new Date(), 'yyyy-MM-dd'),
          intendedStatus: 'present', requestedLatitude: lastCapturedLoc.latitude, requestedLongitude: lastCapturedLoc.longitude,
          reason: outOfRangeReason, status: 'Pending', type: outOfRangeType, requestTimestamp: serverTimestamp()
      };
      addDocumentNonBlocking(collection(firestore, 'attendanceApprovalRequests'), payload).then(() => {
          toast({ title: "Request Sent" });
          setIsOutOfRangeDialogOpen(false);
          setOutOfRangeReason("");
      }).finally(() => setIsSubmittingApproval(false));
  };

  const isBreak = status === 'lunch' || status === 'short_break';
  const progress = Math.min(100, (workTimer / (9 * 3600)) * 100);
  const strokeDasharray = 2 * Math.PI * 45;
  const strokeDashoffset = strokeDasharray - (progress / 100) * strokeDasharray;

  if (isUserDocLoading || userData?.role === 'CEO/Admin' || userData?.role === 'CEO/MD') return null;

  return (
    <div className="flex flex-col items-center gap-4 py-4 animate-fade-in-up font-jakarta w-full">
        <div className="relative size-48 sm:size-56 flex items-center justify-center">
            <svg className="size-full -rotate-90">
                <circle cx="50%" cy="50%" r="45%" className="fill-none stroke-muted/20" strokeWidth="6" />
                <circle cx="50%" cy="50%" r="45%" className={cn("fill-none transition-all duration-500", isBreak ? "stroke-orange-500" : "stroke-primary")} strokeWidth="8" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="square" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-40 mb-1", isBreak ? "text-orange-600" : "text-primary")}>
                    {isBreak ? "On Break" : "Mission Timer"}
                </p>
                <h1 className={cn("text-3xl sm:text-4xl font-black font-mono tabular-nums leading-none tracking-tighter", isBreak ? "text-orange-600" : "text-slate-900")}>
                    {formatTime(workTimer)}
                </h1>
                <Badge variant="outline" className="mt-3 rounded-none border-none bg-muted/20 text-[7px] font-black uppercase tracking-widest">{activeGeofence.name}</Badge>
            </div>
        </div>

        <div className="w-full grid grid-cols-5 gap-1.5 px-2 max-w-2xl">
            <StatusStep label="In" time={todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'p') : '--:--'} isActive={!!todaysAttendance?.checkInTime} />
            <StatusStep label="Lunch" time={todaysAttendance?.lunchOutTime ? format(todaysAttendance.lunchOutTime.toDate(), 'p') : '--:--'} isActive={!!todaysAttendance?.lunchOutTime} />
            <StatusStep label="Break" time={todaysAttendance?.breakOutTime ? format(todaysAttendance.breakOutTime.toDate(), 'p') : '--:--'} isActive={!!todaysAttendance?.breakOutTime} />
            <StatusStep label="Total Break" time={formatTime(totalBreakTime)} isActive={totalBreakTime > 0} isMeta />
            <StatusStep label="Out" time={todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'} isActive={!!todaysAttendance?.checkOutTime} />
        </div>

        <div className="flex flex-wrap gap-2 justify-center pt-2">
            {isVerifyingLocation ? (
                <Button disabled className="h-9 rounded-none bg-muted text-muted-foreground text-[8px] font-black uppercase px-6"><Loader2 className="size-3 animate-spin mr-2"/> Verifying...</Button>
            ) : status === 'out' && !hasClockedOutToday ? (
                <Button onClick={handleClockIn} className="h-10 rounded-none px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"><LogIn className="size-4 mr-2"/> Clock In</Button>
            ) : status === 'in' ? (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleLunchOut} className="h-9 rounded-none px-4 text-[9px] font-black uppercase border-2">Lunch</Button>
                    <Button variant="outline" onClick={handleShortBreakOut} className="h-9 rounded-none px-4 text-[9px] font-black uppercase border-2">Break</Button>
                    <Button onClick={handleClockOut} className="h-9 rounded-none px-6 bg-rose-600 text-white text-[9px] font-black uppercase">Clock Out</Button>
                </div>
            ) : status === 'lunch' ? (
                <Button onClick={handleLunchIn} className="h-10 rounded-none px-8 bg-primary text-white font-black uppercase text-[10px]">End Lunch</Button>
            ) : status === 'short_break' ? (
                <Button onClick={handleShortBreakIn} className="h-10 rounded-none px-8 bg-primary text-white font-black uppercase text-[10px]">End Break</Button>
            ) : (
                <Badge className="bg-emerald-50 text-emerald-700 rounded-none border-none font-black text-[9px] uppercase px-4 h-8 flex items-center">Duty Finished</Badge>
            )}
        </div>

        <Dialog open={isOutOfRangeDialogOpen} onOpenChange={setIsOutOfRangeDialogOpen}>
            <DialogContent className="rounded-none sm:max-w-md p-6">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Out of Range</DialogTitle>
                    <DialogDescription className="text-[11px] font-bold uppercase opacity-60">Outside authorized {activeGeofence.name} sector</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Provide Justification</Label>
                    <Textarea value={outOfRangeReason} onChange={e => setOutOfRangeReason(e.target.value)} placeholder="Reason for remote check-in..." className="rounded-none min-h-[100px] text-xs font-bold bg-muted/20" />
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmitOutOfRangeRequest} disabled={!outOfRangeReason.trim() || isSubmittingApproval} className="w-full rounded-none h-12 font-black uppercase shadow-xl">{isSubmittingApproval ? <Loader2 className="animate-spin mr-2 size-4"/> : null} Submit for Approval</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

function StatusStep({ label, time, isActive, isMeta }: { label: string, time: string, isActive: boolean, isMeta?: boolean }) {
    return (
        <div className={cn("p-2 rounded-none border flex flex-col items-center text-center transition-all", isActive ? (isMeta ? "bg-amber-50 border-amber-200" : "bg-primary/5 border-primary/20 shadow-sm") : "bg-muted/10 opacity-30 grayscale border-transparent")}>
            <p className={cn("text-[6px] font-black uppercase tracking-tighter mb-0.5", isActive ? "text-primary/60" : "text-muted-foreground")}>{label}</p>
            <p className={cn("text-[9px] font-black tabular-nums leading-none", isActive ? "text-slate-900" : "text-muted-foreground")}>{time}</p>
        </div>
    );
}
