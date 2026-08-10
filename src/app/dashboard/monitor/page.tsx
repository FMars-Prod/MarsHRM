'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isValid } from 'date-fns';
import { UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, AlertTriangle, Activity, Clock, Map as MapIcon, List, Search, MapPin, Phone, ShieldAlert, Download, Plus, Edit, Timer, ShieldCheck, ChevronRight, Signal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phoneNumber?: string;
  avatar?: string;
  role?: string;
};

type AttendanceRecord = {
    employeeId: string;
    checkInTime?: any;
    checkOutTime?: any;
    lunchOutTime?: any;
    lunchInTime?: any;
    status: string;
    isOutOfRange?: boolean;
    isAtHome?: boolean;
    totalBreakDuration?: number;
};

export default function MonitorPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const [date, setDate] = React.useState<Date>(new Date());
  const [monitorData, setMonitorData] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Manual Entry States
  const [isManualLogOpen, setIsManualLogOpen] = React.useState(false);
  const [manualDate, setManualLogDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [targetUserId, setTargetUserId] = React.useState("");
  const [manualStatus, setManualStatus] = React.useState("present");
  const [manualIn, setManualIn] = React.useState("09:00");
  const [manualOut, setManualOut] = React.useState("18:00");
  const [manualBreakMin, setManualBreakMin] = React.useState("60");

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<UserData>(usersQuery);

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD';

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
  const { data: locationConfig } = useDoc<any>(configRef);

  const fetchMonitorData = React.useCallback(async () => {
    if (!users || !firestore) return;
    setIsLoading(true);
    try {
      const start = startOfDay(date);
      const end = endOfDay(date);
      const attSnap = await getDocs(query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', start), where('checkInTime', '<=', end)));
      const attMap = new Map();
      attSnap.docs.forEach(d => attMap.set(d.data().employeeId, d.data()));

      const results = users.map(u => {
          const att = attMap.get(u.id);
          let status = 'absent';
          let label = 'Absent';
          let color = 'bg-red-50 text-red-700 border-none shadow-sm';
          let icon = <UserRoundX className="size-3 mr-1" />;

          if (att) {
              if (att.isAtHome) {
                  status = 'home';
                  label = 'Home';
                  color = 'bg-blue-50 text-blue-700 border-none shadow-sm';
                  icon = <Activity className="size-3 mr-1" />;
              } else if (att.isOutOfRange) {
                  status = 'remote';
                  label = 'Remote';
                  color = 'bg-sky-50 text-sky-700 border-none shadow-sm';
                  icon = <MapPin className="size-3 mr-1" />;
              } else if (att.status === 'late') {
                  status = 'late';
                  label = 'Late';
                  color = 'bg-yellow-50 text-yellow-700 border-none shadow-sm';
                  icon = <UserX className="size-3 mr-1" />;
              } else {
                  status = 'present';
                  label = 'Present';
                  color = 'bg-green-50 text-green-700 border-none shadow-sm';
                  icon = <UserCheck className="size-3 mr-1" />;
              }
          }

          return {
              user: u,
              att,
              statusInfo: { status, label, color, icon }
          };
      });

      results.sort((a, b) => {
          if (a.att && !b.att) return -1;
          if (!a.att && b.att) return 1;
          return a.user.firstName.localeCompare(b.user.firstName);
      });

      setMonitorData(results);
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
    }
  }, [users, date, firestore]);

  React.useEffect(() => {
    fetchMonitorData();
  }, [fetchMonitorData]);

  const filteredData = React.useMemo(() => {
    return monitorData.filter(d => 
        `${d.user.firstName} ${d.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [monitorData, searchQuery]);

  const handleManualSave = async () => {
    if (!targetUserId || !manualDate) return;
    
    const attRef = doc(firestore, `users/${targetUserId}/attendances`, manualDate);
    const inDate = new Date(`${manualDate}T${manualIn}`);
    const outDate = new Date(`${manualDate}T${manualOut}`);
    
    const payload = {
        id: manualDate,
        employeeId: targetUserId,
        status: manualStatus,
        checkInTime: Timestamp.fromDate(inDate),
        checkOutTime: Timestamp.fromDate(outDate),
        totalBreakDuration: (parseInt(manualBreakMin) || 0) * 60,
        manualOverride: true,
        overriddenBy: currentUser?.uid,
        overriddenAt: serverTimestamp()
    };

    setDocumentNonBlocking(attRef, payload, { merge: true });
    toast({ title: "Ledger Updated", description: "Record stamped successfully." });
    setIsManualLogOpen(false);
    fetchMonitorData();
  };

  const getFormattedTime = (ts: any) => {
      if (!ts) return <span className="text-muted-foreground/30 font-black">—</span>;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return <span className="font-mono text-[11px] font-bold text-primary">{format(d, 'p')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in-up font-jakarta">
      <PageHeader title="Daily Status" description="Real-time operational status oversight and tactical fleet geolocation monitoring.">
        <div className="flex gap-3">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                <Input 
                    placeholder="Search people..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="h-10 pl-10 rounded-none bg-white border-none ring-1 ring-border/50 font-bold uppercase text-[10px]" 
                />
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-none h-10 bg-white border-none ring-1 ring-border/50 px-6 font-black uppercase text-[10px] tracking-widest shadow-sm">
                        <CalendarIcon className="size-4 mr-2 text-primary" /> {format(date, 'PP')}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-none overflow-hidden border-none shadow-2xl"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
            </Popover>

            {isAdmin && (
                <Dialog open={isManualLogOpen} onOpenChange={setIsManualLogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-none h-10 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-6">
                            <Plus className="size-4 mr-2" /> Manual Log
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-none sm:max-w-md p-0 border-none shadow-3xl overflow-hidden text-left">
                        <DialogHeader className="p-8 border-b bg-white text-left">
                            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Attendance Override</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Manual stamp for tactical mission ledger</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] p-8 bg-muted/5">
                            <div className="space-y-8 text-left">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Personnel</Label>
                                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                                        <SelectTrigger className="h-11 rounded-none font-bold bg-white border-none ring-1 ring-border/50"><SelectValue placeholder="Which official?" /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Target Date</Label>
                                        <Input type="date" value={manualDate} onChange={e => setManualLogDate(e.target.value)} className="h-11 rounded-none font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Mission Status</Label>
                                        <Select value={manualStatus} onValueChange={setManualStatus}>
                                            <SelectTrigger className="h-11 rounded-none font-bold bg-white border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-none">
                                                <SelectItem value="present">Present</SelectItem>
                                                <SelectItem value="late">Late</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">In Time</Label>
                                        <Input type="time" value={manualIn} onChange={e => setManualIn(e.target.value)} className="h-11 rounded-none font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Out Time</Label>
                                        <Input type="time" value={manualOut} onChange={e => setManualOut(e.target.value)} className="h-11 rounded-none font-mono" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cumulative Break (Minutes)</Label>
                                    <Input type="number" value={manualBreakMin} onChange={e => setManualBreakMin(e.target.value)} className="h-11 rounded-none font-bold" />
                                </div>
                            </div>
                        </ScrollArea>
                        <div className="p-8 border-t bg-white shrink-0">
                            <Button onClick={handleManualSave} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl">Acknowledge & Stamp</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
      </PageHeader>

      <Tabs defaultValue="list" className="w-full">
          <TabsList className="flex w-fit bg-muted/30 p-1 rounded-none ring-1 ring-border/50 mb-6">
              <TabsTrigger value="list" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2 px-8 h-9">
                <List className="size-3.5"/> List View
              </TabsTrigger>
              <TabsTrigger value="map" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2 px-8 h-9">
                <MapIcon className="size-3.5"/> Map View
              </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0">
              <Card className="border-none shadow-xl rounded-none overflow-hidden bg-white ring-1 ring-border/50">
                  <CardHeader className="bg-muted/5 border-b py-4 px-8 flex flex-row items-center justify-between text-left">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                            <Activity className="size-4" /> Operational Oversight
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="rounded-none border-none bg-primary/5 text-primary font-black uppercase text-[8px] tracking-widest px-3 h-6">Live Fleet Sync</Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-b">
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-8">Fleet Member</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Status</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">In</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] text-center">Break Logs</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Out</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] text-right px-8">Admin Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse font-black text-xs uppercase opacity-20 tracking-[0.3em]">Scanning Roster...</TableCell></TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((row, i) => (
                                        <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-6 px-8 text-left">
                                                <Link href={`/dashboard/users/${row.user.id}`} className="flex items-center gap-4 group/avatar">
                                                    <Avatar className="h-10 w-10 rounded-none ring-1 ring-border group-hover/avatar:ring-primary transition-all shadow-sm">
                                                        <AvatarImage src={row.user.avatar} className="object-cover" />
                                                        <AvatarFallback className="font-black text-xs">{row.user.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{row.user.firstName} {row.user.lastName}</span>
                                                        <span className="text-[10px] font-bold uppercase text-muted-foreground mt-1.5 opacity-60 tracking-widest">{row.user.jobTitle}</span>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("rounded-none uppercase text-[8px] font-black px-3 h-6 border-none", row.statusInfo.color)}>
                                                    {row.statusInfo.icon}
                                                    {row.statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkInTime)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold opacity-60">
                                                        {getFormattedTime(row.att?.lunchOutTime)}
                                                        <span className="opacity-20">—</span>
                                                        {getFormattedTime(row.att?.lunchInTime)}
                                                    </div>
                                                    {row.att?.totalBreakDuration > 0 && (
                                                        <Badge variant="outline" className="text-[7px] font-black uppercase rounded-none border-none bg-muted h-4 px-1.5">
                                                            Vol: {Math.floor(row.att.totalBreakDuration / 60)}m
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkOutTime)}</TableCell>
                                            <TableCell className="text-right px-8">
                                                <div className="flex justify-end gap-1.5">
                                                    {isAdmin && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-9 w-9 rounded-none text-primary hover:bg-primary/5 opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={() => {
                                                                setTargetUserId(row.user.id);
                                                                setManualLogDate(format(date, 'yyyy-MM-dd'));
                                                                if (row.att) {
                                                                    setManualIn(row.att.checkInTime ? format(row.att.checkInTime.toDate(), 'HH:mm') : "09:00");
                                                                    setManualOut(row.att.checkOutTime ? format(row.att.checkOutTime.toDate(), 'HH:mm') : "18:00");
                                                                    setManualStatus(row.att.status || "present");
                                                                    setManualBreakMin(String(Math.floor((row.att.totalBreakDuration || 0) / 60)));
                                                                }
                                                                setIsManualLogOpen(true);
                                                            }}
                                                        >
                                                            <Edit className="size-4" />
                                                        </Button>
                                                    )}
                                                    {row.user.phoneNumber && (
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none text-emerald-600 hover:bg-emerald-50">
                                                            <Phone className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-black text-[10px] uppercase opacity-20 tracking-widest">No signals detected for this sector.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
                  <div className="p-8 bg-primary/5 border-t border-dashed border-primary/20 space-y-4">
                      <div className="flex items-center gap-3 text-primary text-left">
                          <ShieldAlert className="size-4" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Oversight Protocol</h4>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed tracking-tight text-left">
                          All attendance data is timestamped and verified against tactical geofencing sectors. Administrative overrides are logged in the master audit ledger.
                      </p>
                  </div>
              </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-0">
                <Card className="border-none shadow-2xl rounded-none overflow-hidden bg-white h-[600px] relative ring-1 ring-border/50">
                    {locationConfig?.googleMapsApiKey ? (
                        <MonitorMap employees={monitorData.filter(d => d.att?.locationCheckInLatitude)} apiKey={locationConfig.googleMapsApiKey} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 bg-muted/10 opacity-30 grayscale">
                            <MapPin className="size-20 text-primary/40 mb-4" />
                            <h3 className="text-xl font-black uppercase tracking-tighter">Signal Offline</h3>
                            <p className="text-[10px] text-muted-foreground max-w-xs mt-2 font-black uppercase tracking-widest opacity-60">Maps key required in System Settings.</p>
                        </div>
                    )}
                    <div className="absolute top-6 left-6 flex flex-col gap-2">
                        <Badge className="bg-white/90 backdrop-blur-md text-primary font-black text-[8px] border-none shadow-lg h-7 px-4 rounded-none uppercase tracking-widest flex items-center gap-2">
                            <Signal className="size-3 animate-pulse" /> Live Tracking Active
                        </Badge>
                    </div>
                </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}

function MonitorMap({ employees, apiKey }: { employees: any[], apiKey: string }) {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
        if (!apiKey || isLoaded) return;
        const scriptId = 'google-maps-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMonitorMap`;
            script.async = true;
            script.defer = true;
            window.initMonitorMap = () => setIsLoaded(true);
            document.head.appendChild(script);
        } else { setIsLoaded(true); }
    }, [apiKey, isLoaded]);

    React.useEffect(() => {
        if (isLoaded && mapRef.current && window.google) {
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 13.0827, lng: 80.2707 },
                zoom: 13,
                disableDefaultUI: true,
                zoomControl: true,
                styles: [
                    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }] },
                    { "featureType": "administrative.country", "elementType": "geometry", "stylers": [{ "visibility": "on" }] },
                    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
                    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
                ]
            });
            const bounds = new window.google.maps.LatLngBounds();
            employees.forEach(emp => {
                const lat = Number(emp.att.locationCheckInLatitude);
                const lng = Number(emp.att.locationCheckInLongitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const pos = { lat, lng };
                    const marker = new window.google.maps.Marker({ 
                        position: pos, 
                        map, 
                        title: `${emp.user.firstName} ${emp.user.lastName}`,
                        icon: {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: "#6D28D9",
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "#FFFFFF",
                        }
                    });
                    
                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `<div style="padding: 8px; font-family: sans-serif; text-transform: uppercase; font-weight: 900; font-size: 10px;">${emp.user.firstName} ${emp.user.lastName}</div>`
                    });

                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });

                    bounds.extend(pos);
                }
            });
            if (employees.length > 0) map.fitBounds(bounds);
        }
    }, [isLoaded, employees]);
    return <div ref={mapRef} className="w-full h-full" />;
}

declare global { interface Window { initMonitorMap: () => void; google: any; } }
