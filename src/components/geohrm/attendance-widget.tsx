
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { LogOut, LogIn, Loader2, Utensils, AlertTriangle, ShieldCheck, MapPin, LocateFixed, Signal } from "lucide-react";
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
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, useDoc } from "@/firebase";
import { doc, serverTimestamp, collection, Timestamp } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
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
  
  const activeGeofence = React.useMemo(() => {
    if (userData?.isWfhAllowed && typeof userData.homeLatitude === 'number') {
        return { name: "Home Base", lat: Number(userData.homeLatitude), lng: Number(userData.homeLongitude), radius: Number(userData.homeRadius || 0.5) };
    }
    if (userData?.branchId && branchData) {
        return { name: branchData.name, lat: Number(branchData.latitude), lng: Number(branchData.longitude), radius: Number(branchData.radius || 0.5) };
    }
    return { name: "HQ Sector", lat: Number(globalLocationData?.latitude || 13.0827), lng: Number(globalLocationData?.longitude || 80.2707), radius: Number(globalLocationData?.maxDistanceKm || 0.5) };
  }, [branchData, globalLocationData, userData]);

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
    setCurrentSignal("Checking...");
    
    navigator.geolocation.getCurrentPosition((p) => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setLastCapturedLoc(userLoc);
        setCurrentSignal(`${userLoc.latitude.toFixed(4)}, ${userLoc.longitude.toFixed(4)}`);
        
        const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
        
        const buffer = 0.015; 
        
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
                isOutOfRange: false 
            }, { merge: true });
            toast({ title: "Shift Active", description: `Location: ${activeGeofence.name}` });
        } else {
            setOutOfRangeType('Check In');
            setIsOutOfRangeDialogOpen(true);
        }
    }, () => { 
        setIsVerifyingLocation(false); 
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location signal lost", description: "Please enable high-accuracy location services." }); 
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleClockOut = () => {
      setIsVerifyingLocation(true);
      setCurrentSignal("Checking...");
      
      navigator.geolocation.getCurrentPosition(p => {
          const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
          setLastCapturedLoc(userLoc);
          setCurrentSignal(`${userLoc.latitude.toFixed(4)}, ${userLoc.longitude.toFixed(4)}`);
          
          const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
          
          const buffer = 0.015;

          setIsVerifyingLocation(false);
          if (dist <= (activeGeofence.radius + buffer)) {
              updateDocumentNonBlocking(getTodaysAttendanceRef!, { 
                  checkOutTime: serverTimestamp(), 
                  locationCheckOutLatitude: p.coords.latitude, 
                  locationCheckOutLongitude: p.coords.longitude 
              });
              toast({ title: "Shift Finalized" });
              router.push('/dashboard/reports');
          } else {
              setOutOfRangeType('Clock Out');
              setIsOutOfRangeDialogOpen(true);
          }
      }, () => { 
          setIsVerifyingLocation(false); 
          setCurrentSignal("");
          toast({ variant: "destructive", title: "Location signal lost" }); 
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleLunchOut = () => {
    setIsVerifyingLocation(true);
    setCurrentSignal("Checking...");
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          lunchOutTime: serverTimestamp(),
          lunchInTime: null,
          locationLunchOutLatitude: userLoc.latitude,
          locationLunchOutLongitude: userLoc.longitude
        });
        toast({ title: "Lunch Break Active" });
    }, () => {
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location signal failed" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleLunchIn = () => {
    setIsVerifyingLocation(true);
    setCurrentSignal("Checking...");
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        
        const breakStart = todaysAttendance?.lunchOutTime?.toDate();
        const breakEnd = new Date();
        const duration = breakStart ? Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000) : 0;
        
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          lunchInTime: serverTimestamp(),
          locationLunchInLatitude: userLoc.latitude,
          locationLunchInLongitude: userLoc.longitude,
          totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration
        });
        toast({ title: "Back from Lunch" });
    }, () => {
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location signal failed" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleShortBreakOut = () => {
    setIsVerifyingLocation(true);
    setCurrentSignal("Checking...");
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
            breakOutTime: serverTimestamp(),
            breakInTime: null,
            locationBreakOutLatitude: userLoc.latitude,
            locationBreakOutLongitude: userLoc.longitude
        });
        toast({ title: "Short Break Started" });
    }, () => {
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location signal failed" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleShortBreakIn = () => {
    setIsVerifyingLocation(true);
    setCurrentSignal("Checking...");
    navigator.geolocation.getCurrentPosition(p => {
        const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        
        const breakStart = todaysAttendance?.breakOutTime?.toDate();
        const breakEnd = new Date();
        const duration = breakStart ? Math.floor((breakEnd.getTime() - breakStart.getTime()) / 1000) : 0;
        
        updateDocumentNonBlocking(getTodaysAttendanceRef!, {
          breakInTime: serverTimestamp(),
          locationBreakInLatitude: userLoc.latitude,
          locationBreakInLongitude: userLoc.longitude,
          totalBreakDuration: (todaysAttendance?.totalBreakDuration || 0) + duration
        });
        toast({ title: "Short Break Finished" });
    }, () => {
        setIsVerifyingLocation(false);
        setCurrentSignal("");
        toast({ variant: "destructive", title: "Location signal failed" });
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const handleSubmitOutOfRangeRequest = () => {
      if (!outOfRangeReason.trim() || !user || !userData || !lastCapturedLoc) return;

      const todayId = format(new Date(), 'yyyy-MM-dd');
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

      addDocumentNonBlocking(collection(firestore, 'attendanceApprovalRequests'), payload);
      toast({ title: "Request Sent", description: "Management has been notified." });
      setIsOutOfRangeDialogOpen(false);
      setOutOfRangeReason("");
  };

  if (isUserDocLoading) return <div className="h-64 flex items-center justify-center text-[10px] font-black uppercase opacity-20 tracking-[0.2em]">Loading...</div>;

  return (
    <>
        <div className="w-full flex flex-col items-center gap-6 py-6 sm:py-10 animate-fade-in-up font-jakarta max-w-5xl mx-auto">
            {status !== 'out' && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 shadow-sm animate-pulse">
                    <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Active Duty</span>
                </div>
            )}

            <div className="flex flex-col items-center gap-2 px-4 text-center">
                <h1 className="text-[64px] sm:text-[100px] lg:text-[140px] font-black leading-none tracking-tighter text-primary drop-shadow-sm font-mono">
                    {formatTime(workTimer)}
                </h1>
                <div className="flex flex-col items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-6 h-8 bg-white/50 border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest">
                    Location: {activeGeofence.name}
                    </Badge>
                    {isVerifyingLocation && currentSignal && (
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase text-primary animate-pulse">
                            <Signal className="size-3" /> Location: {currentSignal}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-8 px-2">
                <StatusStep 
                    icon={LogIn} 
                    label="Clock In" 
                    time={todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.checkInTime}
                    coords={{ lat: todaysAttendance?.locationCheckInLatitude, lng: todaysAttendance?.locationCheckInLongitude }}
                />
                <StatusStep 
                    icon={Utensils} 
                    label="Lunch Start" 
                    time={todaysAttendance?.lunchOutTime ? format(todaysAttendance.lunchOutTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.lunchOutTime}
                    coords={{ lat: todaysAttendance?.locationLunchOutLatitude, lng: todaysAttendance?.locationLunchOutLongitude }}
                />
                <StatusStep 
                    icon={LogIn} 
                    label="Lunch End" 
                    time={todaysAttendance?.lunchInTime ? format(todaysAttendance.lunchInTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.lunchInTime}
                    coords={{ lat: todaysAttendance?.locationLunchInLatitude, lng: todaysAttendance?.locationLunchInLongitude }}
                />
                <StatusStep 
                    icon={LogOut} 
                    label="Clock Out" 
                    time={todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'} 
                    isActive={!!todaysAttendance?.checkOutTime}
                    coords={{ lat: todaysAttendance?.locationCheckOutLatitude, lng: todaysAttendance?.locationCheckOutLongitude }}
                />
            </div>

            <div className="w-full max-w-4xl pt-8 sm:pt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-4 px-4">
                {isVerifyingLocation ? (
                    <Button disabled className="h-14 sm:h-16 rounded-none px-8 sm:px-12 bg-muted text-muted-foreground font-black uppercase text-xs tracking-widest flex items-center gap-3">
                        <Loader2 className="size-5 animate-spin" /> Checking Location...
                    </Button>
                ) : status === 'out' && !hasClockedOutToday ? (
                    <Button onClick={handleClockIn} className="h-14 sm:h-16 rounded-none px-8 sm:px-12 text-sm sm:text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <LogIn className="size-5 mr-3" /> Start Shift
                    </Button>
                ) : status === 'in' ? (
                    <>
                        <Button onClick={handleLunchOut} variant="outline" className="h-14 sm:h-16 rounded-none px-6 sm:px-10 bg-white border-2 font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-all">
                            Lunch Start
                        </Button>
                        <Button onClick={handleShortBreakOut} variant="outline" className="h-14 sm:h-16 rounded-none px-6 sm:px-10 bg-white border-2 font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-all">
                            Short Break
                        </Button>
                        <Button onClick={handleClockOut} className="h-14 sm:h-16 rounded-none px-8 sm:px-12 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-500/20 transition-all hover:scale-[1.02]">
                            Stop Shift
                        </Button>
                    </>
                ) : status === 'lunch' ? (
                    <Button onClick={handleLunchIn} className="h-14 sm:h-16 rounded-none px-10 sm:px-16 bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                        End Lunch (Resume)
                    </Button>
                ) : status === 'short_break' ? (
                    <Button onClick={handleShortBreakIn} className="h-14 sm:h-16 rounded-none px-10 sm:px-16 bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                        End Break (Resume)
                    </Button>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <div className="p-4 bg-emerald-50 rounded-full border-2 border-dashed border-emerald-200">
                            <ShieldCheck className="size-10 text-emerald-500" />
                        </div>
                        <p className="font-black uppercase tracking-[0.3em] text-emerald-700 text-sm">Shift Concluded</p>
                    </div>
                )}
            </div>
        </div>

        <Dialog open={isOutOfRangeDialogOpen} onOpenChange={setIsOutOfRangeDialogOpen}>
            <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-2xl">
                <DialogHeader className="text-left">
                    <div className="size-12 rounded-none bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                        <AlertTriangle className="size-6" />
                    </div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter">Out of Range</DialogTitle>
                    <DialogDescription className="text-xs font-medium leading-relaxed">
                        You are outside the authorized <span className="font-bold text-primary">{activeGeofence.name}</span> area. 
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-muted/30 p-4 rounded-none border border-dashed border-border space-y-2">
                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Location Details</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-0.5">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Your Lat</p>
                                <p className="text-xs font-mono font-bold">{lastCapturedLoc?.latitude.toFixed(6)}</p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Your Lng</p>
                                <p className="text-xs font-mono font-bold">{lastCapturedLoc?.longitude.toFixed(6)}</p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-border/50">
                            <p className="text-[8px] font-bold text-primary uppercase">Work Location: {activeGeofence.name}</p>
                            <p className="text-[10px] font-mono font-black text-primary/70">{activeGeofence.lat.toFixed(6)}, {activeGeofence.lng.toFixed(6)}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Justification</Label>
                        <p className="text-[9px] text-muted-foreground uppercase font-bold italic mb-2">Required for management authorization.</p>
                        <Textarea 
                            value={outOfRangeReason} 
                            onChange={e => setOutOfRangeReason(e.target.value)} 
                            placeholder="e.g., Working from client site or home location pending approval..." 
                            className="rounded-none min-h-[100px] bg-muted/20 border-muted text-sm"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSubmitOutOfRangeRequest} disabled={!outOfRangeReason.trim()} className="w-full rounded-none h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                        Ask for Approval
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

function StatusStep({ icon: Icon, label, time, isActive, coords }: { icon: any, label: string, time: string, isActive: boolean, coords?: {lat?: number, lng?: number} }) {
    return (
        <Card className={cn(
            "border-none shadow-sm rounded-none transition-all duration-500 overflow-hidden",
            isActive ? "bg-white ring-1 ring-border shadow-lg" : "bg-transparent opacity-20 grayscale"
        )}>
            <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-2 sm:gap-3">
                <div className={cn(
                    "p-2.5 sm:p-3 rounded-none transition-colors",
                    isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                    <Icon className="size-4 sm:size-5" />
                </div>
                <div>
                    <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm sm:text-xl font-black tabular-nums">{time}</p>
                    {isActive && coords?.lat && coords?.lng && (
                        <p className="text-[7px] font-mono font-bold text-primary mt-1">
                            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
