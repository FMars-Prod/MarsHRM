
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, AlertTriangle, Utensils, LogIn, Phone, PieChart as PieChartIcon, MapPin, Activity, Clock, LogOut, Map as MapIcon, List, Search } from 'lucide-react';
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
      if (!ts) return <span className="text-muted-foreground/30">—</span>;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return <span className="font-mono text-[10px] font-bold">{format(d, 'p')}</span>;
  };

  const isUrl = (str?: string) => str && str.startsWith('http');

  return (
    <div className="space-y-6">
      <PageHeader title="Real-Time Oversight" description="Tactical grid monitor with verified timestamps and nudge integration.">
        <div className="flex gap-2">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                    placeholder="Search personnel..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="h-11 pl-9 rounded-full bg-white/50 border-none ring-1 ring-border/50" 
                />
            </div>
            <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="rounded-full h-11 bg-white/50"><CalendarIcon className="size-4 mr-2" /> {format(date, 'PP')}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
            </Popover>
        </div>
      </PageHeader>

      <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-white/50 ring-1 ring-border/50 rounded-2xl p-1 mb-6">
              <TabsTrigger value="list" className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"><List className="size-3.5"/> Grid Overview</TabsTrigger>
              <TabsTrigger value="map" className="rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"><MapIcon className="size-3.5"/> Satellite Map</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0">
              <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                  <CardHeader className="bg-muted/10 border-b">
                      <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-headline flex items-center gap-2">
                              <Activity className="size-5 text-primary" />
                              Live Strategic Log
                          </CardTitle>
                          <div className="flex gap-4">
                              <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-green-500" /><span className="text-[10px] font-black uppercase tracking-tighter opacity-60">Present: {monitorData.filter(d => d.statusInfo.status === 'present' || d.statusInfo.status === 'home').length}</span></div>
                              <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-yellow-500" /><span className="text-[10px] font-black uppercase tracking-tighter opacity-60">Late: {monitorData.filter(d => d.statusInfo.status === 'late').length}</span></div>
                              <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-red-500" /><span className="text-[10px] font-black uppercase tracking-tighter opacity-60">Absent: {monitorData.filter(d => d.statusInfo.status === 'absent').length}</span></div>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Employee Official</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Status</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Check In</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4 text-center">L-Out / L-In</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Check Out</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center animate-pulse uppercase font-black text-xs text-muted-foreground">Scanning tactical logs...</TableCell></TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((row, i) => (
                                        <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-4">
                                                <Link href={`/dashboard/users/${row.user.id}`} className="flex items-center gap-3">
                                                    <Avatar className="size-8 ring-1 ring-border group-hover:ring-primary/20 transition-all">
                                                        {row.user.avatar ? (
                                                            isUrl(row.user.avatar) ? (
                                                                <AvatarImage src={row.user.avatar} className="object-cover" />
                                                            ) : (
                                                                <span className="text-xl">{row.user.avatar}</span>
                                                            )
                                                        ) : <AvatarFallback>{row.user.firstName?.[0]}</AvatarFallback>}
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm group-hover:text-primary transition-colors">{row.user.firstName} {row.user.lastName}</span>
                                                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">{row.user.jobTitle}</span>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("rounded-full uppercase text-[9px] font-black tracking-widest gap-1 border-none", row.statusInfo.color)}>
                                                    {row.statusInfo.icon}
                                                    {row.statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkInTime)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {getFormattedTime(row.att?.lunchOutTime)}
                                                    <span className="text-muted-foreground/30 font-black">|</span>
                                                    {getFormattedTime(row.att?.lunchInTime)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkOutTime)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {row.user.phoneNumber && (
                                                        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleNudge(row.user)}>
                                                            <Phone className="size-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No tactical data for this sector.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-0">
                <Card className="border-none ring-1 ring-border/50 shadow-2xl rounded-[3rem] overflow-hidden bg-white h-[600px] relative">
                    {locationConfig?.googleMapsApiKey ? (
                        <MonitorMap employees={monitorData.filter(d => d.att?.locationCheckInLatitude)} apiKey={locationConfig.googleMapsApiKey} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 bg-muted/20">
                            <MapPin className="size-16 text-primary/20 mb-4" />
                            <h3 className="text-xl font-black uppercase tracking-tighter">Satellite Intelligence Disabled</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mt-2">Please configure your Google Maps API Key in <b>System Settings</b> to enable real-time fleet visualization.</p>
                            <Button asChild className="mt-8 rounded-full h-11 px-8 font-black uppercase text-[10px]" variant="outline">
                                <Link href="/dashboard/settings">Open Command Center</Link>
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
                zoom: 12,
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
                            fillColor: '#8b5cf6',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                            scale: 8,
                        }
                    });

                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `
                            <div style="padding: 10px; font-family: 'Open Sans', sans-serif;">
                                <p style="margin: 0; font-weight: 800; font-size: 14px; text-transform: uppercase;">${emp.user.firstName} ${emp.user.lastName}</p>
                                <p style="margin: 2px 0; font-size: 10px; opacity: 0.6; font-weight: 700; text-transform: uppercase;">${emp.user.jobTitle}</p>
                                <p style="margin: 5px 0 0; font-size: 11px; font-weight: 600; color: #8b5cf6;">Synced: ${format(emp.att.checkInTime.toDate(), 'p')}</p>
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
