
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
      setStatus("out");
      setHasClockedOutToday(false);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setLastClockInTime(null);
    }
  }

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
        if (!user) return;
        setIsVerifyingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
              const dist = officeLocation ? getDistanceInKm(userLocation, officeLocation) : 0;
              
              setIsVerifyingLocation(false);
              if (officeLocation && dist > maxDistanceKm) {
                  setOutOfRangeAction(() => () => proceedWithBreakEnd(userLocation, dist, outOfRangeReason));
                  setIsOutOfRangeReasonDialogOpen(true);
              } else {
                  proceedWithBreakEnd(userLocation, dist);
              }
            },
            () => {
                setIsVerifyingLocation(false);
                toast({ variant: "destructive", title: "Location Error", description: "Could not get location. Please enable location services."});
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
      if (!user) return;
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
              toast({ title: "Lunch Break Started (L-OUT)", description: "Your L-OUT location has been recorded." });
          },
          () => {
              setStatus("lunch");
              setIsVerifyingLocation(false);
              toast({ variant: "destructive", title: "Location Warning", description: "L-OUT started but location couldn't be captured." });
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
          toast({ title: "Short Break Started", description: "Your work session is paused." });
      }
  }


  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (status === "in") {
      interval = setInterval(() => {
        if (lastClockInTime && !isSameDay(new Date(), lastClockInTime)) {
            handleAutoClockOut();
        } else {
            setTimer((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, lastClockInTime]);


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
          };
          setDocumentNonBlocking(getTodaysAttendanceRef, attendancePayload, { merge: true });
      }

      setStatus("in");
      setLastClockInTime(now);
      setTimer(0);
      setBreakTimer(0);
      setTotalBreakTime(0);
      setHasClockedOutToday(false);
      toast({ 
        title: attendanceStatus === 'late' ? "Late Clock-In Recorded" : "Clocked In", 
        description: `Location recorded for ${reason || 'clock-in'}. Status: ${attendanceStatus.toUpperCase()}` 
      });
  }

  const handleClockIn = () => {
    if (!user) {
        toast({ variant: "destructive", title: "Cannot Clock In", description: "User not logged in." });
        return;
    }

    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            const homeLat = (userData as any)?.homeLatitude;
            const homeLon = (userData as any)?.homeLongitude;
            const homeRange = (userData as any)?.homeLocationRangeKm === 0 ? 0 : ((userData as any)?.homeLocationRangeKm || 5);
            
            setIsVerifyingLocation(false);
            if (officeLocation) {
                const officeDist = getDistanceInKm(userLocation, officeLocation);
                if (officeDist <= maxDistanceKm) {
                    proceedWithClockIn(userLocation, officeDist, "Office");
                    return;
                }
            }

            if (isWfhAllowed || isAdmin) {
                if (homeLat && homeLon) {
                    const homeLocation = { latitude: homeLat, longitude: homeLon };
                    const homeDist = getDistanceInKm(userLocation, homeLocation);

                    if (homeDist <= homeRange) {
                        proceedWithClockIn(userLocation, homeDist, "Work From Home");
                        return;
                    }
                }
            }

            const officeDist = officeLocation ? getDistanceInKm(userLocation, officeLocation) : Infinity;

            let infoMsg = '';
            if ((isWfhAllowed || isAdmin) && homeLat && homeLon) {
                 const homeLocation = { latitude: homeLat, longitude: homeLon };
                 const homeDist = getDistanceInKm(userLocation, homeLocation);
                 infoMsg = `You are outside your designated locations. You are ${officeDist.toFixed(2)} km from the office (max ${maxDistanceKm} km) and ${homeDist.toFixed(2)} km from home (max ${homeRange} km).`
            } else if (officeLocation) {
                infoMsg = `You are ${officeDist.toFixed(2)} km from the office. The allowed clock-in radius is ${maxDistanceKm} km.`
            } else {
                infoMsg = 'You are not within any designated clock-in area.'
            }
            setOutOfRangeInfo(infoMsg);
            
            setDistance(officeDist);
            setOutOfRangeAction(() => () => proceedWithClockIn(userLocation, officeDist, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => {
            setIsVerifyingLocation(false);
            toast({ variant: "destructive", title: "Location Error", description: "Could not get your location. Please enable location services." });
        },
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
      // Redirect to report page after clock out
      router.push('/dashboard/reports');
  }

  const handleClockOut = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Cannot Clock Out" });
      return;
    }

    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLocation: Location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            const homeLat = (userData as any)?.homeLatitude;
            const homeLon = (userData as any)?.homeLongitude;
            const homeRange = (userData as any)?.homeLocationRangeKm === 0 ? 0 : ((userData as any)?.homeLocationRangeKm || 5);
            
            setIsVerifyingLocation(false);
            if (officeLocation) {
                const officeDist = getDistanceInKm(userLocation, officeLocation);
                if (officeDist <= maxDistanceKm) {
                    proceedWithClockOut(userLocation, "Office");
                    return;
                }
            }
            
            if (isWfhAllowed || isAdmin) {
                if (homeLat && homeLon) {
                    const homeLocation = { latitude: homeLat, longitude: homeLon };
                    const homeDist = getDistanceInKm(userLocation, homeLocation);
                    if (homeDist <= homeRange) {
                        proceedWithClockOut(userLocation, "Work From Home");
                        return;
                    }
                }
            }

            const officeDist = officeLocation ? getDistanceInKm(userLocation, officeLocation) : Infinity;

            let infoMsg = '';
            if ((isWfhAllowed || isAdmin) && homeLat && homeLon) {
                 const homeLocation = { latitude: homeLat, longitude: homeLon };
                 const homeDist = getDistanceInKm(userLocation, homeLocation);
                 infoMsg = `You are outside your designated locations. You are ${officeDist.toFixed(2)} km from the office (max ${maxDistanceKm} km) and ${homeDist.toFixed(2)} km from home (max ${homeRange} km).`
            } else if (officeLocation) {
                infoMsg = `You are ${officeDist.toFixed(2)} km from the office. The allowed clock-out radius is ${maxDistanceKm} km.`
            } else {
                infoMsg = 'You are not within any designated clock-out area.'
            }
            setOutOfRangeInfo(infoMsg);
            
            setOutOfRangeAction(() => () => proceedWithClockOut(userLocation, outOfRangeReason));
            setIsOutOfRangeReasonDialogOpen(true);
        },
        () => {
            setIsVerifyingLocation(false);
            toast({ variant: "destructive", title: "Location Error", description: "Could not get location to clock out."});
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
        toast({ title: "Settings Updated", description: "The office settings have been saved." });
        setIsSettingsDialogOpen(false);
      }
  }

  const handleCaptureOfficeLocation = () => {
      setIsVerifyingLocation(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              setNewLatitude(position.coords.latitude.toString());
              setNewLongitude(position.coords.longitude.toString());
              setIsVerifyingLocation(false);
              toast({ title: "Location Captured", description: "Coordinates updated to your current position." });
          },
          (error) => {
              setIsVerifyingLocation(false);
              toast({ variant: "destructive", title: "Capture Failed", description: error.message });
          },
          { enableHighAccuracy: true }
      );
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

  const isLate = () => {
    if (!lastClockInTime || !officeLocation?.shiftStartTime) return false;
    const shiftStart = parse(officeLocation.shiftStartTime, 'HH:mm', lastClockInTime);
    return isAfter(lastClockInTime, shiftStart);
  };

  const milestones = useMemo(() => {
    if (!officeLocation) return null;
    const now = new Date();
    
    const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const d = new Date(now);
        d.setHours(hours, minutes, 0, 0);
        return d;
    };

    const lOut = officeLocation.lunchBreakStartTime ? parseTime(officeLocation.lunchBreakStartTime) : null;
    let lIn = null;
    if (lOut && officeLocation.lunchBreakDurationMinutes) {
        lIn = addMinutes(lOut, officeLocation.lunchBreakDurationMinutes);
    }
    const logout = officeLocation.shiftEndTime ? parseTime(officeLocation.shiftEndTime) : null;

    return { lOut, lIn, logout };
  }, [officeLocation]);

  const upcomingMilestone = useMemo(() => {
    if (!milestones) return null;
    const now = new Date();
    if (milestones.lOut && now < milestones.lOut && differenceInMinutes(milestones.lOut, now) < 30) return { type: 'L-OUT', time: milestones.lOut };
    if (milestones.lIn && now < milestones.lIn && differenceInMinutes(milestones.lIn, now) < 15) return { type: 'L-IN', time: milestones.lIn };
    if (milestones.logout && now < milestones.logout && differenceInMinutes(milestones.logout, now) < 30) return { type: 'Log-out', time: milestones.logout };
    return null;
  }, [milestones]);

  const formatCapturedLocation = (lat?: number, lng?: number) => {
      if (lat === undefined || lng === undefined) return null;
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  return (
    <>
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
            </div>
            <h2 className="mt-6 text-xl font-black uppercase tracking-tighter text-primary">Verifying Precision Point</h2>
            <p className="text-sm text-muted-foreground font-medium">Communicating with GPS satellites...</p>
            <div className="mt-8 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-progress-loading" />
            </div>
        </div>
      )}

      <Card className="flex flex-col animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm relative overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between">
              <CardTitle className="font-headline flex items-center gap-2 text-primary">
              <Clock className="size-5" />
              High-Accuracy Attendance
              </CardTitle>
              {isAdmin && (
                  <Dialog open={isSettingsDialogOpen} onOpenChange={(open) => {
                      setIsSettingsDialogOpen(open);
                      if (!open) window.location.reload();
                  }}>
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
                                <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                                      <Label className="text-xs font-black uppercase text-primary">Precision Setup</Label>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="grid gap-2">
                                              <Label htmlFor="latitude">Office Latitude</Label>
                                              <Input id="latitude" value={newLatitude} onChange={(e) => setNewLatitude(e.target.value)} placeholder="e.g., 37.7749" />
                                          </div>
                                          <div className="grid gap-2">
                                              <Label htmlFor="longitude">Office Longitude</Label>
                                              <Input id="longitude" value={newLongitude} onChange={(e) => setNewLongitude(e.target.value)} placeholder="e.g., -122.4194" />
                                          </div>
                                      </div>
                                      <Button variant="secondary" className="w-full h-10 font-bold uppercase text-[10px]" onClick={handleCaptureOfficeLocation}>
                                          Pin Current Office Coordinates
                                      </Button>
                                </div>
                                <div className="grid gap-2">
                                      <Label htmlFor="range">Clock-in Range (km)</Label>
                                      <Input id="range" type="number" value={newMaxDistance} onChange={(e) => setNewMaxDistance(e.target.value)} placeholder="e.g., 2" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="grid gap-2">
                                        <Label htmlFor="shift-start">Shift Start Time (Late Trigger)</Label>
                                        <Input id="shift-start" type="time" value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)} />
                                  </div>
                                  <div className="grid gap-2">
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
            Precise location verification. Designated:
            <span className="font-semibold text-foreground">
              {isWfhAllowed ? " Work From Home" : " Work From Office"}
            </span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col items-center justify-center gap-6 text-center pb-8">
          {isLocationLoading && !isWfhAllowed && !isAdmin ? (
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <Building2 className="h-10 w-10 animate-pulse" />
                  <p>Loading Location...</p>
              </div>
          ) : (officeLocation || isWfhAllowed || isAdmin) ? (
            <>
              {upcomingMilestone && (status === 'in' || status === 'lunch' || status === 'short_break') && (
                  <div className="absolute top-0 left-0 right-0 p-2 bg-primary/10 border-b border-primary/20 animate-pulse flex items-center justify-center gap-2">
                      <AlertCircle className="size-4 text-primary" />
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                          Upcoming Milestone: {upcomingMilestone.type} at {format(upcomingMilestone.time, 'p')}
                      </span>
                  </div>
              )}

              <div
                className={cn(
                  "flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs",
                  status === "in" && (isLate() ? "text-orange-600" : "text-green-600"),
                  status === "lunch" && "text-yellow-600",
                  status === "short_break" && "text-blue-600",
                  status === "out" && !hasClockedOutToday && "text-red-600",
                  status === "out" && hasClockedOutToday && "text-muted-foreground"
                )}
              >
                {status === "in" && (isLate() ? <Clock className="size-4" /> : <Briefcase className="size-4" />)}
                {status === "lunch" && <Utensils className="size-4" />}
                {status === "short_break" && <Coffee className="size-4" />}
                {status === "out" && <CheckCircle2 className="size-4" />}

                {
                  hasClockedOutToday
                    ? "Daily Session Complete"
                    : status === 'lunch'
                      ? "L-OUT Active"
                      : status === 'short_break'
                      ? "Short Break Active"
                      : isLate() ? "Late Attendance" : `Clocked ${status.charAt(0).toUpperCase() + status.slice(1)}`
                }
              </div>
              
              <div className="space-y-1">
                  <div className="text-7xl font-black font-mono tabular-nums tracking-tighter drop-shadow-sm text-primary">
                  {formatTime(timer)}
                  </div>
                  {lastClockInTime && status !== "out" && (
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-bold px-3 py-1">
                      Logged In At: {format(lastClockInTime, 'p')}
                  </Badge>
                  )}
              </div>
              
              <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className={cn(
                      "p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-2",
                      status !== 'out' ? "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 shadow-inner" : "bg-white/50 border-border/50"
                  )}>
                      <LogIn className={cn("size-5", status !== 'out' ? "text-primary" : "text-muted-foreground/50")} />
                      <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Log In</p>
                          <p className="text-sm font-bold">{lastClockInTime ? format(lastClockInTime, 'p') : '--:--'}</p>
                          {todaysAttendance?.locationCheckInLatitude && (
                              <p className="text-[10px] text-primary/60 font-mono mt-1">
                                  {formatCapturedLocation(todaysAttendance.locationCheckInLatitude, todaysAttendance.locationCheckInLongitude)}
                              </p>
                          )}
                      </div>
                  </div>

                  <div className={cn(
                      "p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-2",
                      status === 'lunch' || todaysAttendance?.locationLunchOutLatitude ? "bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-200" : "bg-white/50 border-border/50"
                  )}>
                      <Utensils className={cn("size-5", status === 'lunch' ? "text-yellow-600" : "text-muted-foreground/50")} />
                      <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">L-Out</p>
                          <p className="text-sm font-bold">{todaysAttendance?.lunchOutTime ? format(todaysAttendance.lunchOutTime.toDate(), 'p') : '--:--'}</p>
                          {todaysAttendance?.locationLunchOutLatitude && (
                              <p className="text-[10px] text-yellow-600/60 font-mono mt-1">
                                  {formatCapturedLocation(todaysAttendance.locationLunchOutLatitude, todaysAttendance.locationLunchOutLongitude)}
                              </p>
                          )}
                      </div>
                  </div>

                  <div className={cn(
                      "p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-2",
                      todaysAttendance?.locationLunchInLatitude ? "bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-200" : "bg-white/50 border-border/50"
                  )}>
                      <Clock className={cn("size-5", todaysAttendance?.locationLunchInLatitude ? "text-blue-600" : "text-muted-foreground/50")} />
                      <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">L-In</p>
                          <p className="text-sm font-bold">{todaysAttendance?.lunchInTime ? format(todaysAttendance.lunchInTime.toDate(), 'p') : '--:--'}</p>
                          {todaysAttendance?.locationLunchInLatitude && (
                              <p className="text-[10px] text-blue-600/60 font-mono mt-1">
                                  {formatCapturedLocation(todaysAttendance.locationLunchInLatitude, todaysAttendance.locationLunchInLongitude)}
                              </p>
                          )}
                      </div>
                  </div>

                  <div className={cn(
                      "p-4 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-2",
                      hasClockedOutToday ? "bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-200" : "bg-white/50 border-border/50"
                  )}>
                      <LogOut className={cn("size-5", hasClockedOutToday ? "text-purple-600" : "text-muted-foreground/50")} />
                      <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Log-out</p>
                          <p className="text-sm font-bold">{todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'p') : '--:--'}</p>
                          {todaysAttendance?.locationCheckOutLatitude && (
                              <p className="text-[10px] text-purple-600/60 font-mono mt-1">
                                  {formatCapturedLocation(todaysAttendance.locationCheckOutLatitude, todaysAttendance.locationCheckOutLongitude)}
                              </p>
                          )}
                      </div>
                  </div>
              </div>

              <div className="flex items-center gap-6">
                {(status === "lunch" || status === "short_break") && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Current Break</span>
                    <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                      {formatTime(breakTimer)}
                    </div>
                  </div>
                )}
                {totalBreakTime > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Total Break Today</span>
                    <div className="text-2xl font-bold font-mono tabular-nums tracking-tighter">
                      {formatTime(totalBreakTime)}
                    </div>
                  </div>
                )}
              </div>

              {currentUserLocation && (
                <div className="flex items-center text-xs text-muted-foreground gap-1 bg-muted/30 px-3 py-1 rounded-full">
                  <MapPin className="size-3" />
                  <span className="font-medium">{`Point Lat: ${currentUserLocation.latitude.toFixed(4)}, Lon: ${currentUserLocation.longitude.toFixed(4)}`}</span>
                  {distance !== null && distance > 0 && (
                    <span className="text-primary font-bold">({distance.toFixed(2)} km from base)</span>
                  )}
                </div>
              )}
            </>
          ) : (
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <Building2 className="h-10 w-10" />
                  <p className="max-w-xs font-medium">Location not set. Please contact Admin.</p>
              </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center items-center py-6 px-6 bg-muted/5 border-t">
          {status === 'out' && !hasClockedOutToday && (
              <Button
                  onClick={handleClockIn}
                  className="w-full max-w-[280px] rounded-full h-14 text-lg font-black uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all duration-300 active:scale-95 bg-primary text-white"
                  disabled={!isWfhAllowed && !officeLocation && !isAdmin}
              >
                  <Clock className="mr-2 h-5 w-5" /> Start Shift
              </Button>
          )}
          {status !== 'out' && (
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-[600px] justify-center">
                  {status === "in" && (
                      <>
                          <Button
                              onClick={handleLunch}
                              variant="outline"
                              className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 px-8 bg-white border-primary/20 text-primary hover:bg-primary/5"
                          >
                              <Utensils className="mr-2 h-4 w-4" /> L-OUT
                          </Button>
                          <Button
                              onClick={handleShortBreak}
                              variant="outline"
                              className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 px-8 bg-white border-primary/20 text-primary hover:bg-primary/5"
                          >
                              <Coffee className="mr-2 h-4 w-4" /> Short Break
                          </Button>
                      </>
                  )}

                  {status === "lunch" && (
                      <Button
                          onClick={handleLunch}
                          className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 px-8 bg-primary text-white"
                      >
                          <LogIn className="mr-2 h-4 w-4" /> L-IN
                      </Button>
                  )}

                  {status === "short_break" && (
                      <Button
                          onClick={handleShortBreak}
                          className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 px-8 bg-primary text-white"
                      >
                          <Clock className="mr-2 h-4 w-4" /> End Short Break
                      </Button>
                  )}

                  <AlertDialog onOpenChange={(open) => { if (!open) window.location.reload(); }}>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest shadow-md transition-all active:scale-95 px-8">
                              Finish Day
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Ready to Clock Out?</AlertDialogTitle>
                              <AlertDialogDescription className="font-medium text-muted-foreground">This will finalize your attendance records for today.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Continue Working</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClockOut} className="rounded-full font-bold uppercase text-[10px]">Confirm Clock Out</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          )}
        </CardFooter>

        <Dialog open={isOutOfRangeReasonDialogOpen} onOpenChange={(open) => {
            setIsOutOfRangeReasonDialogOpen(open);
            if (!open) window.location.reload();
        }}>
          <DialogContent className="rounded-3xl">
              <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Location Out of Range</DialogTitle>
                  <DialogDescription className="font-medium text-muted-foreground">{outOfRangeInfo}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <Label htmlFor="reason" className="font-bold text-xs uppercase tracking-widest text-primary">Provide Mandatory Reason for Action</Label>
                  <Textarea id="reason" value={outOfRangeReason} onChange={(e) => setOutOfRangeReason(e.target.value)} placeholder="e.g., Client visit, working from temporary location, GPS deviation..." className="rounded-2xl min-h-[100px]" />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="rounded-full font-bold uppercase text-[10px]" onClick={() => { setIsOutOfRangeReasonDialogOpen(false); setOutOfRangeReason(""); }}>Cancel</Button>
                  <Button onClick={handleOutOfRangeSubmit} className="rounded-full font-bold uppercase text-[10px] bg-primary text-white">Confirm and Proceed</Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </>
  );
}
