'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { UserCheck, UserX, UserRoundX, Calendar as CalendarIcon, AlertTriangle, Activity, Clock, Map as MapIcon, List, Search, MapPin, Phone } from 'lucide-react';
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
                if (att.isAtHome) {
                    status = 'home';
                    label = 'Home';
                    color = 'bg-blue-100 text-blue-700 border-blue-200';
                    icon = <Activity className="size-3 mr-1" />;
                } else if (att.isOutOfRange) {
                    status = 'remote';
                    label = 'Remote';
                    color = 'bg-sky-100 text-sky-700 border-sky-200';
                    icon = <MapPin className="size-3 mr-1" />;
                } else if (att.status === 'late') {
                    status = 'late';
                    label = 'Late';
                    color = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                    icon = <UserX className="size-3 mr-1" />;
                } else {
                    status = 'present';
                    label = 'Present';
                    color = 'bg-green-100 text-green-700 border-green-200';
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
    };
    fetchMonitorData();
  }, [users, date, firestore]);

  const filteredData = React.useMemo(() => {
    return monitorData.filter(d => 
        `${d.user.firstName} ${d.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.user.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [monitorData, searchQuery]);

  const getFormattedTime = (ts: any) => {
      if (!ts) return <span className="text-muted-foreground/30 font-black">—</span>;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return <span className="font-mono text-[11px] font-bold text-primary">{format(d, 'p')}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader title="Real-Time Monitor" description="Monitor employee attendance and locations for the selected date.">
        <div className="flex gap-3">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                <Input 
                    placeholder="Search employees..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="h-10 pl-10 rounded-full bg-white border-none ring-1 ring-border/50" 
                />
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-full h-10 bg-white border-none ring-1 ring-border/50 px-4 font-bold text-xs">
                        <CalendarIcon className="size-4 mr-2 text-primary" /> {format(date, 'PP')}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl"><Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus /></PopoverContent>
            </Popover>
        </div>
      </PageHeader>

      <Tabs defaultValue="list" className="w-full">
          <TabsList className="flex w-fit bg-muted/30 p-1 rounded-xl mb-6">
              <TabsTrigger value="list" className="rounded-lg font-black uppercase text-[10px] tracking-widest gap-2">
                <List className="size-3.5"/> Attendance List
              </TabsTrigger>
              <TabsTrigger value="map" className="rounded-lg font-black uppercase text-[10px] tracking-widest gap-2">
                <MapIcon className="size-3.5"/> Live Map
              </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0">
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="bg-muted/10 border-b py-4">
                      <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                          <Activity className="size-4" /> Attendance Registry
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Employee</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Status</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Check In</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] text-center">Lunch Break</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Check Out</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] text-right px-6">Contact</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center animate-pulse font-bold text-xs uppercase opacity-30">Loading records...</TableCell></TableRow>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((row, i) => (
                                        <TableRow key={i} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-4 px-6">
                                                <Link href={`/dashboard/users/${row.user.id}`} className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src={row.user.avatar} className="object-cover" />
                                                        <AvatarFallback>{row.user.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{row.user.firstName} {row.user.lastName}</span>
                                                        <span className="text-[9px] font-black uppercase text-muted-foreground">{row.user.jobTitle}</span>
                                                    </div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("rounded-full uppercase text-[8px] font-black px-2.5 h-5 border-none", row.statusInfo.color)}>
                                                    {row.statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkInTime)}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
                                                    {getFormattedTime(row.att?.lunchOutTime)}
                                                    <span className="opacity-20">—</span>
                                                    {getFormattedTime(row.att?.lunchInTime)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getFormattedTime(row.att?.checkOutTime)}</TableCell>
                                            <TableCell className="text-right px-6">
                                                {row.user.phoneNumber && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-600">
                                                        <Phone className="size-3.5" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic text-sm">No records found for this date.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-0">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white h-[600px] relative ring-1 ring-border/50">
                    {locationConfig?.googleMapsApiKey ? (
                        <MonitorMap employees={monitorData.filter(d => d.att?.locationCheckInLatitude)} apiKey={locationConfig.googleMapsApiKey} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 bg-muted/10">
                            <MapPin className="size-12 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-lg font-black uppercase">Maps Disabled</h3>
                            <p className="text-xs text-muted-foreground max-w-xs mt-2 font-bold uppercase tracking-tight opacity-60">Configure your Google Maps API Key in Settings to enable map visualization.</p>
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
        } else { setIsLoaded(true); }
    }, [apiKey, isLoaded]);

    React.useEffect(() => {
        if (isLoaded && mapRef.current && window.google) {
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: 13.0827, lng: 80.2707 },
                zoom: 13,
                disableDefaultUI: true,
                zoomControl: true,
            });
            const bounds = new window.google.maps.LatLngBounds();
            employees.forEach(emp => {
                const lat = Number(emp.att.locationCheckInLatitude);
                const lng = Number(emp.att.locationCheckInLongitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const pos = { lat, lng };
                    new window.google.maps.Marker({ position: pos, map, title: `${emp.user.firstName} ${emp.user.lastName}` });
                    bounds.extend(pos);
                }
            });
            if (employees.length > 0) map.fitBounds(bounds);
        }
    }, [isLoaded, employees]);
    return <div ref={mapRef} className="w-full h-full" />;
}

declare global { interface Window { initMonitorMap: () => void; google: any; } }
