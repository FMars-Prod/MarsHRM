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
  const { toast } = useToast();
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc(userDocRef);

  const branchDocRef = useMemoFirebase(() => userData?.branchId ? doc(firestore, 'branches', userData.branchId) : null, [userData, firestore]);
  const { data: branchData, isLoading: isBranchLoading } = useDoc<any>(branchDocRef);

  const globalLocationDocRef = useMemoFirebase(() => doc(firestore, "settings", "location"), [firestore]);
  const { data: globalLocationData } = useDoc<any>(globalLocationDocRef);
  
  const activeGeofence = React.useMemo(() => {
    if (userData?.branchId && branchData) {
        return { name: branchData.name, lat: Number(branchData.latitude), lng: Number(branchData.longitude), radius: Number(branchData.radius || 0.5) };
    }
    if (userData?.isWfhAllowed && typeof userData.homeLatitude === 'number') {
        return { name: "Home", lat: Number(userData.homeLatitude), lng: Number(userData.homeLongitude), radius: Number(userData.homeRadius || 0.5) };
    }
    return { name: "HQ", lat: Number(globalLocationData?.latitude || 13.0827), lng: Number(globalLocationData?.longitude || 80.2707), radius: Number(globalLocationData?.maxDistanceKm || 0.5) };
  }, [branchData, globalLocationData, userData]);

  const [isOutOfRangeReasonDialogOpen, setIsOutOfRangeReasonDialogOpen] = useState(false);
  const [outOfRangeReason, setOutOfRangeReason] = useState("");
  const [outOfRangeAction, setOutOfRangeAction] = useState<(() => void) | null>(null);

  const getTodaysAttendanceRef = useMemoFirebase(() => {
      if (!user) return null;
      return doc(firestore, `users/${user.uid}/attendances`, format(new Date(), 'yyyy-MM-dd'));
  }, [user, firestore]);
  
  const {data: todaysAttendance} = useDoc(getTodaysAttendanceRef);

  useEffect(() => {
    if (todaysAttendance) {
        const checkIn = todaysAttendance.checkInTime?.toDate?.() || null;
        const checkOut = todaysAttendance.checkOutTime?.toDate?.() || null;
        const lunchOut = todaysAttendance.lunchOutTime?.toDate?.() || null;
        const lunchIn = todaysAttendance.lunchInTime?.toDate?.() || null;
        setTotalBreakTime(Number(todaysAttendance.totalBreakDuration || 0));
        setLastClockInTime(checkIn);
        if (checkOut && checkIn) { setStatus("out"); setHasClockedOutToday(true); }
        else if (checkIn) { setHasClockedOutToday(false); if (lunchOut && !lunchIn) { setStatus("lunch"); setCurrentBreakStartTime(lunchOut); } else { setStatus("in"); setCurrentBreakStartTime(null); } }
    } else { setStatus("out"); setHasClockedOutToday(false); setTotalBreakTime(0); setLastClockInTime(null); }
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
        const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
        setIsVerifyingLocation(false);
        if (dist <= activeGeofence.radius) {
            const todayId = format(new Date(), 'yyyy-MM-dd');
            setDocumentNonBlocking(getTodaysAttendanceRef!, { id: todayId, employeeId: user!.uid, checkInTime: serverTimestamp(), status: 'present', totalBreakDuration: 0, locationCheckInLatitude: userLoc.latitude, locationCheckInLongitude: userLoc.longitude }, { merge: true });
            toast({ title: "Started" });
        } else {
            toast({ variant: "destructive", title: "Out of range" });
        }
    }, () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "GPS Error" }); });
  };

  const handleClockOut = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(p => {
          setIsVerifyingLocation(false);
          updateDocumentNonBlocking(getTodaysAttendanceRef!, { checkOutTime: serverTimestamp(), locationCheckOutLatitude: p.coords.latitude, locationCheckOutLongitude: p.coords.longitude });
          toast({ title: "Finished" });
          router.push('/dashboard/reports');
      }, () => { setIsVerifyingLocation(false); });
  };

  if (isUserDocLoading) return <div className="h-40 flex items-center justify-center text-[8px] font-black uppercase">Loading...</div>;

  return (
    <Card className="animate-fade-in-up border-none shadow-sm rounded-2xl bg-white overflow-hidden font-jakarta">
        <CardHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                <Clock className="size-3" /> Attendance
              </CardTitle>
              <Badge variant="outline" className="rounded-full text-[7px] font-black uppercase px-2 h-5 bg-primary/5 border-primary/20">
                {activeGeofence.name}
              </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 flex flex-col items-center gap-4 text-center">
            <div className="py-2">
                <div className="text-4xl font-black font-mono tabular-nums tracking-tighter text-primary">
                    {formatTime(workTimer)}
                </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-2 max-w-sm">
                <div className="p-2 rounded-xl bg-muted/20 border flex flex-col items-center">
                    <p className="text-[6px] font-black uppercase text-muted-foreground/60 mb-0.5">Check In</p>
                    <p className="text-[10px] font-black">{todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'p') : '--:--'}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted/20 border flex flex-col items-center">
                    <p className="text-[6px] font-black uppercase text-muted-foreground/60 mb-0.5">Check Out</p>
                    <p className="text-[10px] font-black">{todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'}</p>
                </div>
            </div>
            
            <div className="w-full max-w-sm pt-2">
                {status === 'out' && !hasClockedOutToday && (
                    <Button onClick={handleClockIn} className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest shadow-md">
                        Start Shift
                    </Button>
                )}
                {status === 'in' && (
                    <Button onClick={handleClockOut} variant="destructive" className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest">
                        Finish Shift
                    </Button>
                )}
            </div>
        </CardContent>
    </Card>
  );
}
