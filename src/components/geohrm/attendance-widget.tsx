"use client";

import * as React from "react";
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
import { Clock, Coffee, Briefcase, MapPin, Utensils, LogOut, MapPinned, LogIn, RotateCcw, Zap, Loader2, Timer, Sparkles, ShieldCheck, RefreshCcw, AlertTriangle, Home, Building2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, useDoc } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { format, startOfDay } from "date-fns";
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
        setLastCapturedLoc(userLoc);
        const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
        setIsVerifyingLocation(false);
        if (dist <= activeGeofence.radius) {
            const todayId = format(new Date(), 'yyyy-MM-dd');
            setDocumentNonBlocking(getTodaysAttendanceRef!, { id: todayId, employeeId: user!.uid, checkInTime: serverTimestamp(), status: 'present', totalBreakDuration: 0, locationCheckInLatitude: userLoc.latitude, locationCheckInLongitude: userLoc.longitude, isOutOfRange: false }, { merge: true });
            toast({ title: "Shift Active", description: `Sector: ${activeGeofence.name}` });
        } else {
            setOutOfRangeType('Check In');
            setIsOutOfRangeDialogOpen(true);
        }
    }, () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "Satellite Signal Lost", description: "Please enable location services." }); });
  };

  const handleClockOut = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(p => {
          const userLoc = { latitude: p.coords.latitude, longitude: p.coords.longitude };
          setLastCapturedLoc(userLoc);
          const dist = getDistanceInKm(userLoc, { latitude: activeGeofence.lat, longitude: activeGeofence.lng });
          setIsVerifyingLocation(false);
          
          if (dist <= activeGeofence.radius) {
              updateDocumentNonBlocking(getTodaysAttendanceRef!, { checkOutTime: serverTimestamp(), locationCheckOutLatitude: p.coords.latitude, locationCheckOutLongitude: p.coords.longitude });
              toast({ title: "Shift Finalized" });
              router.push('/dashboard/reports');
          } else {
              setOutOfRangeType('Clock Out');
              setIsOutOfRangeDialogOpen(true);
          }
      }, () => { setIsVerifyingLocation(false); toast({ variant: "destructive", title: "Satellite Signal Lost" }); });
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
      toast({ title: "Approval Request Dispatched", description: "Management has been notified of your remote signal." });
      setIsOutOfRangeDialogOpen(false);
      setOutOfRangeReason("");
  };

  if (isUserDocLoading) return <div className="h-40 flex items-center justify-center text-[8px] font-black uppercase">Synchronizing...</div>;

  return (
    <>
        <Card className="animate-fade-in-up border-none shadow-sm rounded-2xl bg-white overflow-hidden font-jakarta">
            <CardHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                    <Clock className="size-3" /> Attendance Hub
                </CardTitle>
                <Badge variant="outline" className={cn(
                    "rounded-full text-[7px] font-black uppercase px-2 h-5 border-none",
                    userData?.isWfhAllowed ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                )}>
                    {userData?.isWfhAllowed ? <Home className="size-2.5 mr-1" /> : <Building2 className="size-2.5 mr-1" />}
                    {userData?.isWfhAllowed ? "WFH Active" : "Office Active"}
                </Badge>
            </div>
            </CardHeader>

            <CardContent className="p-4 flex flex-col items-center gap-4 text-center">
                <div className="py-2">
                    <div className="text-4xl font-black font-mono tabular-nums tracking-tighter text-primary">
                        {formatTime(workTimer)}
                    </div>
                    <p className="text-[8px] font-black uppercase text-muted-foreground/40 mt-1 tracking-widest">Shift Progress</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-2 max-w-sm">
                    <div className="p-2 rounded-xl bg-muted/20 border border-dashed flex flex-col items-center">
                        <p className="text-[6px] font-black uppercase text-muted-foreground/60 mb-0.5">Inbound</p>
                        <p className="text-[10px] font-black">{todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'p') : '--:--'}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-muted/20 border border-dashed flex flex-col items-center">
                        <p className="text-[6px] font-black uppercase text-muted-foreground/60 mb-0.5">Outbound</p>
                        <p className="text-[10px] font-black">{todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'}</p>
                    </div>
                </div>
                
                <div className="w-full max-w-sm pt-2">
                    {isVerifyingLocation ? (
                        <Button disabled className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest bg-muted text-muted-foreground">
                            <Loader2 className="animate-spin size-4 mr-2" /> Verifying Sector...
                        </Button>
                    ) : status === 'out' && !hasClockedOutToday ? (
                        <Button onClick={handleClockIn} className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest shadow-md">
                            Start Shift
                        </Button>
                    ) : status === 'in' ? (
                        <Button onClick={handleClockOut} variant="destructive" className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest">
                            Finish Shift
                        </Button>
                    ) : (
                        <Badge className="w-full h-10 rounded-xl justify-center bg-green-100 text-green-700 border-none font-black uppercase text-[10px] tracking-widest">
                            Shift Concluded
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>

        <Dialog open={isOutOfRangeDialogOpen} onOpenChange={setIsOutOfRangeDialogOpen}>
            <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-none shadow-2xl">
                <DialogHeader className="text-left">
                    <div className="size-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                        <AlertTriangle className="size-6" />
                    </div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter">Remote Signal Detected</DialogTitle>
                    <DialogDescription className="text-xs font-medium leading-relaxed">
                        Your current coordinates are outside the authorized <span className="font-bold text-primary">{activeGeofence.name}</span> radius. 
                        Please submit a justification for management approval.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Justification / Reason</Label>
                    <Textarea 
                        value={outOfRangeReason} 
                        onChange={e => setOutOfRangeReason(e.target.value)} 
                        placeholder="e.g., Client meeting at their headquarters..." 
                        className="rounded-2xl min-h-[100px] bg-muted/20 border-muted"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmitOutOfRangeRequest} disabled={!outOfRangeReason.trim()} className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                        Dispatch Approval Request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}