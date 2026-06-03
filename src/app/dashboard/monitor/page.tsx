
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, AlertTriangle, Utensils, LogIn, Phone, PieChart as PieChartIcon, MapPin, Activity, Clock, LogOut, Map as MapIcon, List, Search, Key, Sparkles } from 'lucide-react';
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
    locationCheckInLatitude?: number;
    locationCheckInLongitude?: number;
};

export default function MonitorPage() {
  const firestore = useFirestore();
  const [date, setDate] = React.useState<Date>(new Date());
  const [monitorData, setMonitorData] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users } = useCollection<UserData>(usersQuery);

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
  const { data: locationConfig } = useDoc<any>(configRef);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
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
            let color = 'bg-red-100 text-red-700 border-red-200';
            let icon = <UserRoundX className="size-3 mr-1" />;

            if (att) {
                if (att.isOutOfRange) {
                    status = 'out-of-range';
                    label = 'OUT OF RANGE';
                    color = 'bg-orange-100 text-orange-700 border-orange-200';
                    icon = <AlertTriangle className="size-3 mr-1" />;
                } else if (att.isAtHome) {
                    status = 'home';
                    label = 'HOME';
                    color = 'bg-blue-100 text-blue-700 border-blue-200';
                    icon = <Activity className="size-3 mr-1" />;
                } else if (att.status === 'late') {
                    status = 'late';
                    label = 'LATE';
                    color = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                    icon = <UserX className="size-3 mr-1" />;
                } else {
                    status = 'present';
                    label = 'PRESENT';
                    color = 'bg-green-100 text-green-700 border-green-200';
                    icon = <UserCheck className="size-3 mr-1" />;
                }
            } else if (u.role === 'CEO/Admin' || u.role === 'HR Manager') {
                status = 'privileged';
                label = 'OFF-GRID';
                color = 'bg-slate-100 text-slate-500 border-slate-200';
                icon = <Activity className="size-3 mr-1 opacity-50" />;
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
    };
    fetchMonitorData();
  }, [users, date, firestore]);

  const filteredData = React.useMemo(() => {
    return monitorData.filter(d => 
        `${d.user.firstName} ${d.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [monitorData, searchQuery]);

  const handleNudge = (u: UserData) => {
      if (!u.phoneNumber) return;
      const msg = `MarsHRM Alert: Professional nudge for shift verification. Please check your current status.`;
      window.open(`https://wa.me/${u.phoneNumber.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const getFormattedTime = (ts: any) => {
      if (!ts) return <span className="text-muted-foreground/30 font-black">—</span>;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return <span className="font-mono text-[11px] font-black text-primary">{format(d, 'p')}</span>;
  };

  const isUrl = (str?: string) => str && str.startsWith('http');

  return (
    <div className="space-y-8 animate-fade-in-up font-jakarta">
      <PageHeader title="Real-Time Oversight" description="Tactical grid monitor with verified satellite timestamps and integrated fleet nudges.">
        <div className="flex gap-3">
            <div className="relative w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
                <Input 
                    placeholder="Search personnel directory..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="h-12 pl-11 rounded-full bg-white border-none ring-1 ring-border/50 shadow-sm focus-visible:ring-primary/40" 
                />
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-full h-12 bg-white border-none ring-1 ring-border/50 shadow-sm px-6 font-black uppercase text-[10px] tracking-widest">
                        <CalendarIcon className="size-4 mr-2.5 text-primary opacity-60" /> {format(date, 'PP')}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[2rem] overflow-hidden border-none shadow-2xl"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
            </Popover>
        </div>
      </PageHeader>

      <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-white/50 ring-2 ring-white rounded-[2rem] p-1.5 mb-10 shadow-sm">
              <TabsTrigger value="list" className="rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest gap-2.5 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg"><List className="size-4"/> Operational Grid Overview</TabsTrigger>
              <TabsTrigger value="map" className="rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest gap-2.5 transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg"><MapIcon className="size-4"/> Satellite Map Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0">
              <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-md">
                  <CardHeader className="p-10 pb-6 border-b bg-muted/5">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                          <div className="space-y-1">
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-primary">
                                <Activity className="size-7" /> Live Tactical Registry
                            </CardTitle>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Verified fleet signals for {format(date, 'PPP')}</p>
                          </div>
                          <div className="flex flex-wrap justify-center gap-6">
                              <div className="flex items-center gap-2.5"><div className="size-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /><span className="text-[11px] font-black uppercase tracking-tighter">Onsite: {monitorData.filter(d => d.statusInfo.status === 'present' || d.statusInfo.status === 'home').length}</span></div>
                              <div className="flex items-center gap-2.5"><div className="size-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" /><span className="text-[11px] font-black uppercase tracking-tighter">Late: {monitorData.filter(d => d.statusInfo.status === 'late').length}</span></div>
                              <div className="flex items-center gap-2.5"><div className="size-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /><span className="text-[11px] font-black uppercase tracking-tighter">Absent: {monitorData.filter(d => d.statusInfo.status === 'absent').length}</span></div>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 px-10">Personnel Official</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Current Status</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Inbound Signal</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 text-center">Tactical Break</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Outbound Signal</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 text-right px-10">Direct Comms</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.4em]">Scanning Deep-Grid Records...</TableCell></TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((row, i) => (
                                        <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-all duration-300">
                                            <TableCell className="py-6 px-10">
                                                <Link href={`/dashboard/users/${row.user.id}`} className="flex items-center gap-4 group/link">
                                                    <Avatar className="size-11 ring-2 ring-white shadow-md group-hover/link:ring-primary/20 transition-all">
                                                        {row.user.avatar ? (
                                                            isUrl(row.user.avatar) ? (
                                                                <AvatarImage src={row.user.avatar} className="object-cover" />
                                                            ) : (
                                                                <span className="text-2xl">{row.user.avatar}</span>
                                                            )
                                                        ) : <AvatarFallback className="font-bold">{row.user.firstName?.[0]}</AvatarFallback>}
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm group-hover/link:text-primary transition-colors">{row.user.firstName} {row.user.lastName}</span>
                                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">{row.user.jobTitle}</span>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("rounded-full uppercase text-[9px] font-black tracking-[0.15em] gap-1.5 border-none px-4 py-1.5 shadow-sm", row.statusInfo.color)}>
                                                    {row.statusInfo.icon}
                                                    {row.statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkInTime)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-3 bg-muted/20 rounded-full py-1.5 px-4 w-fit mx-auto border border-dashed border-border/50">
                                                    {getFormattedTime(row.att?.lunchOutTime)}
                                                    <span className="text-muted-foreground/30 font-black opacity-30">|</span>
                                                    {getFormattedTime(row.att?.lunchInTime)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkOutTime)}</TableCell>
                                            <TableCell className="text-right px-10">
                                                <div className="flex justify-end gap-3">
                                                    {row.user.phoneNumber && (
                                                        <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 text-emerald-600 hover:text-white hover:bg-emerald-600 shadow-sm border border-emerald-100 transition-all" onClick={() => handleNudge(row.user)}>
                                                            <Phone className="size-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">Operational Sector Clear: No matching personnel found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-0">
                <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white h-[700px] relative font-jakarta ring-1 ring-border/50">
                    {locationConfig?.googleMapsApiKey ? (
                        <>
                            <MonitorMap employees={monitorData.filter(d => d.att?.locationCheckInLatitude)} apiKey={locationConfig.googleMapsApiKey} />
                            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none">
                                <div className="p-6 rounded-[2rem] bg-white/90 backdrop-blur-md shadow-2xl border-2 border-white pointer-events-auto space-y-4 max-w-sm">
                                    <div className="flex items-center gap-2.5 text-primary font-black uppercase text-[11px] tracking-[0.2em]">
                                        <Sparkles className="size-4 animate-pulse" /> Live Satellite Data
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">Markers represent exact GPS coordinates captured during shift activation. Click a signal for personnel details.</p>
                                </div>
                                <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-[0.3em] h-10 px-8 rounded-full shadow-2xl pointer-events-auto flex gap-2">
                                    <Activity className="size-3.5" /> Synchronized
                                </Badge>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 bg-muted/20">
                            <div className="p-8 rounded-[3rem] bg-white shadow-xl ring-4 ring-primary/5 mb-8">
                                <MapPin className="size-20 text-primary/30" />
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter">Satellite Intelligence Disabled</h3>
                            <p className="text-sm text-muted-foreground max-w-md mt-4 font-medium leading-relaxed uppercase tracking-tight opacity-70">Google Maps credentials missing. Configure your operational API Key in the <b>Global Command Center</b> to enable real-time fleet visualization.</p>
                            <Button asChild className="mt-10 rounded-full h-14 px-12 font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/20 transition-all hover:scale-105" variant="default">
                                <Link href="/dashboard/settings">Access Command Center</Link>
                            </Button>
                        </div>
                    )}
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
        } else {
            setIsLoaded(true);
        }
    }, [apiKey, isLoaded]);

    React.useEffect(() => {
        if (isLoaded && mapRef.current && window.google) {
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 13.0827, lng: 80.2707 },
                zoom: 13,
                styles: [
                    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
                    { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 13 }] },
                    { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#0b0b0b" }, { "lightness": 16 }] },
                    { "featureType": "road.arterial", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "road.local", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
                    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
                ],
                disableDefaultUI: true,
                zoomControl: true,
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
                            fillColor: '#a855f7', // primary color
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                            scale: 10,
                        }
                    });

                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `
                            <div style="padding: 12px; font-family: 'Plus Jakarta Sans', sans-serif;">
                                <p style="margin: 0; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: -0.02em; color: #1a1a1a;">${emp.user.firstName} ${emp.user.lastName}</p>
                                <p style="margin: 2px 0; font-size: 9px; opacity: 0.5; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">${emp.user.jobTitle}</p>
                                <div style="margin-top: 10px; height: 1px; background: rgba(0,0,0,0.05);"></div>
                                <p style="margin: 8px 0 0; font-size: 11px; font-weight: 800; color: #a855f7; display: flex; align-items: center; gap: 4px;">
                                    SYNCED: ${format(emp.att.checkInTime.toDate(), 'p')}
                                </p>
                            </div>
                        `
                    });

                    marker.addListener('click', () => infoWindow.open(map, marker));
                    bounds.extend(pos);
                }
            });

            if (employees.length > 0) map.fitBounds(bounds);
        }
    }, [isLoaded, employees]);

    return <div ref={mapRef} className="w-full h-full" />;
}

declare global { interface Window { initMonitorMap: () => void; google: any; } }
