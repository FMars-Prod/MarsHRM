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
  const [currentSignal, setCurrentSignal] = useState<string>("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);

  const branchDocRef = useMemoFirebase(() => userData?.branchId ? doc(firestore, 'branches', userData.branchId) : null, [userData, firestore]);
  const { data: branchData } = useDoc<any>(branchDocRef);

  const globalLocationDocRef = useMemoFirebase(() => doc(firestore, "settings", "location"), [firestore]);
  const { data: globalLocationData } = useDoc<any>(globalLocationDocRef);

  // Fetch approved WFH requests for this user
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

  // Determine if there is an active approved WFH request for today
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
    // Priority 1: Approved Dynamic WFH Request for Today
    if (activeWfhToday && typeof activeWfhToday.latitude === 'number') {
        return { 
            name: "WFH", 
            lat: Number(activeWfhToday.latitude), 
            lng: Number(activeWfhToday.longitude), 
            radius: 0.5, 
            type: 'wfh'
        };
    }
    // Priority 2: Permanent Home Authorization
    if (userData?.isWfhAllowed && typeof userData.homeLatitude === 'number') {
        return { 
            name: "Home", 
            lat: Number(userData.homeLatitude), 
            lng: Number(userData.homeLongitude), 
            radius: Number(userData.homeRadius || 0.5),
            type: 'wfh'
        };
    }
    // Priority 3: Assigned Branch Office
    if (userData?.branchId && branchData) {
        return { 
            name: branchData.name, 
            lat: Number(branchData.latitude), 
            lng: Number(branchData.longitude), 
            radius: Number(branchData.radius || 0.5),
            type: 'office'
        };
    }
    // Priority 4: Default Office (Fallback)
    return { 
        name: "Office", 
        lat: Number(globalLocationData?.latitude || 13.0827), 
        lng: Number(globalLocationData?.longitude || 80.2707), 
        radius: Number(globalLocationData?.maxDistanceKm || 0.5),
        type: 'office'
    };
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

  // Monitor pending requests
  const pendingRequestsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'attendanceApprovalRequests'),
      where('employeeId', '==', user.uid),
      where('status', '==', 'Pending')
    );
  }, [user, firestore]);
  const { data: userPendingRequests } = useCollection<any>(pendingRequestsQuery);

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

  const currentBreakTimer = useMemo(() => {
      if (!currentBreakStartTime) return 0;
      return (now - currentBreakStartTime.getTime()) / 1000;
  }, [now, currentBreakStartTime]);

  const handleClockIn = () => {
    setIsVerifyingLocation(true);
    setCurrentSignal("Checking...");
    
    navigator.geolocation.getCurrentPosition((p) => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setLastCapturedLoc(userLoc);
        setCurrentSignal(`${userLoc.latitude.toFixed(4)}, ${userLoc.longitude.toFixed(4)}`);
        
        const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
        const buffer = 0.05; // 50 meters buffer for accuracy
        
        setIsVerifyingLocation(false);
        if (dist <= (activeGeofence.radius + buffer)) {
            const todayId = format(new Date(), 'yyyy-MM-dd');
            setDocumentNonBlocking(getTodaysAttendanceRef!, { 
                id: todayId, 
                employeeId: user!.uid, 
                checkInTime: serverTimestamp(), 
                status: 'present', 
                totalBreakDuration: 0, 
                locationCheckInLatitude: userLoc.latitude, 
                locationCheckInLongitude: userLoc.longitude, 
                isOutOfRange: false,
                isAtHome: activeGeofence.type === 'wfh'
            }, { merge: true });
            toast({ title: "Clocked In", description: `Location: ${activeGeofence.name}` });
        } else {
            setOutOfRangeType('Check In');
            setIsOutOfRangeDialogOpen(true);
        }
    }, () => { 
        setIsVerifyingLocation(false); 
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location Error", description: "Please enable location services." }); 
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleClockOut = async () => {
      // Protocol Check: Must submit report before clock out
      const isPrivileged = userData?.role === 'HR Manager' || userData?.role === 'CEO/Admin' || userData?.role === 'CEO/MD';
      if (!isPrivileged) {
          const todayS = startOfDay(new Date());
          const todayE = endOfDay(new Date());
          const q = query(
              collection(firestore, `users/${user!.uid}/reports`),
              where('date', '>=', todayS),
              where('date', '<=', todayE)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
              toast({ 
                  variant: 'destructive', 
                  title: "Report Required", 
                  description: "Protocol violation: Please submit your daily report before clocking out." 
              });
              router.push('/dashboard/reports');
              return;
          }
      }

      setIsVerifyingLocation(true);
      setCurrentSignal("Checking...");
      
      navigator.geolocation.getCurrentPosition(p => {
          const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
          setLastCapturedLoc(userLoc);
          setCurrentSignal(`${userLoc.latitude.toFixed(4)}, ${userLoc.longitude.toFixed(4)}`);
          
          const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
          const buffer = 0.05; // 50 meters buffer for accuracy

          setIsVerifyingLocation(false);
          if (dist <= (activeGeofence.radius + buffer)) {
              updateDocumentNonBlocking(getTodaysAttendanceRef!, { 
                  checkOutTime: serverTimestamp(), 
                  locationCheckOutLatitude: p.coords.latitude, 
                  locationCheckOutLongitude: p.coords.longitude 
              });
              toast({ title: "Clocked Out", description: "Mission finished." });
          } else {
              setOutOfRangeType('Clock Out');
              setIsOutOfRangeDialogOpen(true);
          }
      }, () => { 
          setIsVerifyingLocation(false); 
          setCurrentSignal("");
          toast({ variant: "destructive", title: "Location Error" }); 
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleLunchOut = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          lunchOutTime: serverTimestamp(),
          lunchInTime: null,
          locationLunchOutLatitude: userLoc.latitude,
          locationLunchOutLongitude: userLoc.longitude
        });
        toast({ title: "Lunch Break Started" });
    }, () => {
        setIsVerifyingLocation(false);
        toast({ variant: "destructive", title: "Location Error" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleLunchIn = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        const breakStart = todaysAttendance?.lunchOutTime?.toDate();
        const breakEnd = new Date();
        const duration = breakStart ? Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000) : 0;
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          lunchInTime: serverTimestamp(),
          locationLunchInLatitude: userLoc.latitude,
          locationLunchInLongitude: userLoc.longitude,
          totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration
        });
        toast({ title: "Lunch Break Ended" });
    }, () => {
        setIsVerifyingLocation(false);
        toast({ variant: "destructive", title: "Location Error" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleShortBreakOut = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
            breakOutTime: serverTimestamp(),
            breakInTime: null,
            locationBreakOutLatitude: userLoc.latitude,
            locationBreakOutLongitude: userLoc.longitude
        });
        toast({ title: "Break Started" });
    }, () => {
        setIsVerifyingLocation(false);
        toast({ variant: "destructive", title: "Location Error" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleShortBreakIn = () => {
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        const breakStart = todaysAttendance?.breakOutTime?.toDate();
        const breakEnd = new Date();
        const duration = breakStart ? Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000) : 0;
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          breakInTime: serverTimestamp(),
          locationBreakInLatitude: userLoc.latitude,
          locationBreakInLongitude: userLoc.longitude,
          totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration
        });
        toast({ title: "Break Ended" });
    }, () => {
        setIsVerifyingLocation(false);
        toast({ variant: "destructive", title: "Location Error" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleSubmitOutOfRangeRequest = () => {
      if (!outOfRangeReason.trim() || !user || !userData || !lastCapturedLoc || isSubmittingApproval) return;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      const alreadyPending = userPendingRequests?.some(r => r.dateId === todayId && r.type === outOfRangeType);
      if (alreadyPending) {
          toast({ variant: 'destructive', title: "Request Pending", description: `You already have a pending ${outOfRangeType} approval.` });
          setIsOutOfRangeDialogOpen(false);
          return;
      }
      setIsSubmittingApproval(true);
      const payload = {
          employeeId: user.uid,
          employeeName: `${userData.firstName} ${userData.lastName}`,
          requestedCheckInTime: format(new Date(), 'PP p'),
          dateId: todayId,
          intendedStatus: 'present',
          requestedLatitude: lastCapturedLoc.latitude,
          requestedLongitude: lastCapturedLoc.longitude,
          reason: outOfRangeReason,
          status: 'Pending',
          type: outOfRangeType,
          requestTimestamp: serverTimestamp()
      };
      addDocumentNonBlocking(collection(firestore, 'attendanceApprovalRequests'), payload)
        .then(() => {
            toast({ title: "Request Sent", description: "Awaiting approval." });
            setIsOutOfRangeDialogOpen(false);
            setOutOfRangeReason("");
        })
        .finally(() => setIsSubmittingApproval(false));
  };

  if (isUserDocLoading) return null;

  // CEO exclusion check
  const isCEO = userData?.role === 'CEO/Admin' || userData?.role === 'CEO/MD';
  if (isCEO) return null;

  return (
    <>
        <div className="w-full flex flex-col items-center gap-2 py-2 animate-fade-in-up font-jakarta max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2">
                {status !== 'out' && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-none border border-emerald-100 shadow-sm animate-pulse">
                        <div className="size-1 rounded-full bg-emerald-500" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700">Clocked In</span>
                    </div>
                )}
                {(status === 'lunch' || status === 'short_break') && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-none border border-amber-100 shadow-sm">
                        <Coffee className="size-2.5 text-amber-600" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-700">Break: {formatTime(currentBreakTimer)}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center gap-1 px-4 text-center">
                <h1 className="text-[40px] sm:text-[50px] lg:text-[60px] font-black leading-none tracking-tighter text-primary font-mono w-full">
                    {formatTime(workTimer)}
                </h1>
                <Badge variant="outline" className="rounded-none px-3 h-5 bg-white/50 border-primary/20 text-primary font-black uppercase text-[8px] tracking-widest">
                  Location: {activeGeofence.name}
                </Badge>
            </div>

            <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2 mt-1 px-2">
                <StatusStep 
                    icon={LogIn} 
                    label="Clock In" 
                    time={todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.checkInTime}
                />
                <StatusStep 
                    icon={Utensils} 
                    label="Lunch Start" 
                    time={todaysAttendance?.lunchOutTime ? format(todaysAttendance.lunchOutTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.lunchOutTime}
                />
                <StatusStep 
                    icon={LogIn} 
                    label="Lunch End" 
                    time={todaysAttendance?.lunchInTime ? format(todaysAttendance.lunchInTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.lunchInTime}
                />
                <StatusStep 
                    icon={LogOut} 
                    label="Clock Out" 
                    time={todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.checkOutTime}
                />
            </div>

            <div className="w-full max-w-xl pt-2 flex flex-wrap items-center justify-center gap-2 px-4">
                {isVerifyingLocation ? (
                    <Button disabled className="h-8 rounded-none px-4 bg-muted text-muted-foreground font-black uppercase text-[8px] tracking-widest flex items-center gap-2">
                        <Loader2 className="size-3 animate-spin" /> Verifying...
                    </Button>
                ) : status === 'out' && !hasClockedOutToday ? (
                    <Button onClick={handleClockIn} className="h-10 rounded-none px-6 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <LogIn className="size-3.5 mr-2" /> Clock In
                    </Button>
                ) : status === 'in' ? (
                    <>
                        <Button onClick={handleLunchOut} variant="outline" className="h-8 rounded-none px-3 bg-white border-2 font-black uppercase text-[8px] tracking-widest hover:bg-primary/5 transition-all">
                            Lunch Start
                        </Button>
                        <Button onClick={handleShortBreakOut} variant="outline" className="h-8 rounded-none px-3 bg-white border-2 font-black uppercase text-[8px] tracking-widest hover:bg-primary/5 transition-all">
                            Short Break
                        </Button>
                        <Button onClick={handleClockOut} className="h-8 rounded-none px-4 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[8px] tracking-widest shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02]">
                            Clock Out
                        </Button>
                    </>
                ) : status === 'lunch' ? (
                    <Button onClick={handleLunchIn} className="h-10 rounded-none px-8 bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                        End Lunch
                    </Button>
                ) : status === 'short_break' ? (
                    <Button onClick={handleShortBreakIn} className="h-10 rounded-none px-8 bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                        End Break
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 py-1 text-emerald-700 font-black uppercase tracking-[0.2em] text-[8px]">
                        <CheckCircle2 className="size-3" /> Duty Finished
                    </div>
                )}
            </div>
        </div>

        <Dialog open={isOutOfRangeDialogOpen} onOpenChange={setIsOutOfRangeDialogOpen}>
            <DialogContent className="rounded-none sm:max-w-md p-6 border-none shadow-2xl">
                <DialogHeader className="text-left">
                    <div className="size-10 rounded-none bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                        <AlertTriangle className="size-5" />
                    </div>
                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">Out of Range</DialogTitle>
                    <DialogDescription className="text-[11px] font-medium leading-relaxed text-left">
                        Outside authorized <span className="font-bold text-primary">{activeGeofence.name}</span> area.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-3 space-y-3 text-left">
                    <div className="space-y-1.5 text-left">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-primary">Reason</Label>
                        <Textarea 
                            value={outOfRangeReason} 
                            onChange={e => setOutOfRangeReason(e.target.value)} 
                            placeholder="Why are you checking in from here?" 
                            className="rounded-none min-h-[80px] bg-muted/20 border-muted text-xs"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmitOutOfRangeRequest} disabled={!outOfRangeReason.trim() || isSubmittingApproval} className="w-full rounded-none h-11 font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-xs">
                        {isSubmittingApproval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Ask for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

function StatusStep({ icon: Icon, label, time, isActive }: { icon: any, label: string, time: string, isActive: boolean }) {
    return (
        <Card className={cn(
            "border-none shadow-sm rounded-none transition-all duration-300 overflow-hidden",
            isActive ? "bg-white ring-1 ring-border shadow-md" : "bg-transparent opacity-20 grayscale"
        )}>
            <CardContent className="p-2 flex flex-col items-center text-center gap-1">
                <div className={cn(
                    "p-1 rounded-none transition-colors",
                    isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                    <Icon className="size-3" />
                </div>
                <div>
                    <p className="text-[6px] font-black uppercase tracking-widest text-muted-foreground mb-0">{label}</p>
                    <p className="text-[10px] font-black tabular-nums leading-none">{time}</p>
                </div>
            </CardContent>
        </Card>
    );
}
