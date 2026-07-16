'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, setDocumentNonBlocking, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection, query, orderBy } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, CheckCircle2, Globe, Save, Info, Key, Map as MapIcon, CalendarClock, LocateFixed, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
    const { data: locationData } = useDoc<any>(configRef);

    const reportConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
    const { data: reportData } = useDoc<any>(reportConfigRef);

    const personnelConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'personnel'), [firestore]);
    const { data: personnelData } = useDoc<any>(personnelConfigRef);

    const shiftsQuery = useMemoFirebase(() => query(collection(firestore, 'settings', 'config', 'shifts'), orderBy('name', 'asc')), [firestore]);
    const { data: shifts } = useCollection<any>(shiftsQuery);

    const [form, setForm] = React.useState<any>({
        latitude: '', longitude: '', maxDistanceKm: '0.5', shiftStartTime: '09:00', shiftEndTime: '18:00',
        morningReportSlot: '09:50', eveningReportSlot: '18:50', companyName: 'FortuMars AI',
        googleMapsApiKey: 'AIzaSyC0ilt4E_SJSB-1l5Mlhkr-UFwlBmWkuiI',
        defaultLeaveEntitlement: '12'
    });

    const [newShift, setNewShift] = React.useState({ name: '', start: '09:00', end: '18:00', deadline: '18:30' });

    React.useEffect(() => {
        if (locationData) {
            setForm((prev: any) => ({
                ...prev,
                latitude: locationData.latitude || '',
                longitude: locationData.longitude || '',
                maxDistanceKm: locationData.maxDistanceKm || '0.5',
                shiftStartTime: locationData.shiftStartTime || '09:00',
                googleMapsApiKey: locationData.googleMapsApiKey || 'AIzaSyC0ilt4E_SJSB-1l5Mlhkr-UFwlBmWkuiI'
            }));
        }
        if (reportData?.timings) {
            setForm((prev: any) => ({
                ...prev,
                morningReportSlot: reportData.timings.morningReportSlot || '09:50',
                eveningReportSlot: reportData.timings.eveningReportSlot || '18:50',
                shiftEndTime: reportData.timings.shiftEnd || '18:00'
            }));
        }
        if (personnelData) {
            setForm((prev: any) => ({
                ...prev,
                defaultLeaveEntitlement: personnelData.defaultLeaveEntitlement || '12'
            }));
        }
    }, [locationData, reportData, personnelData]);

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setForm({
                        ...form,
                        latitude: position.coords.latitude.toString(),
                        longitude: position.coords.longitude.toString()
                    });
                    toast({ title: "HQ Signal Captured", description: "Global coordinates updated." });
                },
                (error) => {
                    toast({ variant: "destructive", title: "GPS Error", description: error.message });
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
        }
    };

    const handleAddShift = () => {
        if (!newShift.name) return;
        const shiftRef = doc(collection(firestore, 'settings', 'config', 'shifts'));
        setDocumentNonBlocking(shiftRef, { ...newShift, id: shiftRef.id, createdAt: serverTimestamp() }, { merge: true });
        setNewShift({ name: '', start: '09:00', end: '18:00', deadline: '18:30' });
        toast({ title: "Shift Profile Added" });
    };

    const handleSave = () => {
        const locPayload = {
            latitude: parseFloat(form.latitude),
            longitude: parseFloat(form.longitude),
            maxDistanceKm: parseFloat(form.maxDistanceKm),
            shiftStartTime: form.shiftStartTime,
            googleMapsApiKey: form.googleMapsApiKey,
            updatedAt: serverTimestamp()
        };

        const reportPayload = {
            timings: {
                morningReportSlot: form.morningReportSlot,
                eveningReportSlot: form.eveningReportSlot,
                shiftEnd: form.shiftEndTime
            }
        };

        const personnelPayload = {
            defaultLeaveEntitlement: parseInt(form.defaultLeaveEntitlement) || 12,
            updatedAt: serverTimestamp()
        };

        setDocumentNonBlocking(configRef, locPayload, { merge: true });
        setDocumentNonBlocking(reportConfigRef, reportPayload, { merge: true });
        setDocumentNonBlocking(personnelConfigRef, personnelPayload, { merge: true });
        
        toast({ title: "System Protocols Synchronized", description: "Global configuration and API keys updated." });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta">
            <PageHeader title="Global Command Center" description="Configure core platform parameters, geofencing protocols, and shift timing schemas." />

            <div className="grid gap-8">
                {/* Shift Registry */}
                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><Clock className="size-5 text-primary" /> Shift Profile Registry</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Define operational shift windows and reporting deadlines.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/20 p-4 border border-dashed rounded-none">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase">Shift Name</Label>
                                <Input value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} placeholder="e.g. Night Shift" className="h-10 rounded-none bg-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase">Start Time</Label>
                                <Input type="time" value={newShift.start} onChange={e => setNewShift({...newShift, start: e.target.value})} className="h-10 rounded-none bg-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase">End Time</Label>
                                <Input type="time" value={newShift.end} onChange={e => setNewShift({...newShift, end: e.target.value})} className="h-10 rounded-none bg-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase">Report Deadline</Label>
                                <Input type="time" value={newShift.deadline} onChange={e => setNewShift({...newShift, deadline: e.target.value})} className="h-10 rounded-none bg-white" />
                            </div>
                            <Button onClick={handleAddShift} className="col-span-full h-11 rounded-none font-black uppercase text-[10px] tracking-widest mt-2"><Plus className="size-4 mr-2" /> Register Shift Profile</Button>
                        </div>

                        <div className="border rounded-none overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="text-[9px] font-black uppercase py-4">Shift Identity</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase py-4">Time Window</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase py-4">Report Deadline</TableHead>
                                        <TableHead className="text-right text-[9px] font-black uppercase py-4 pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shifts?.map(s => (
                                        <TableRow key={s.id} className="border-border/50">
                                            <TableCell className="font-bold text-xs uppercase">{s.name}</TableCell>
                                            <TableCell className="text-xs font-mono">{s.start} — {s.end}</TableCell>
                                            <TableCell className="text-xs font-black text-rose-600">{s.deadline}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'settings/config/shifts', s.id))} className="text-rose-600 hover:bg-rose-50 rounded-none h-8 w-8">
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!shifts || shifts.length === 0) && (
                                        <TableRow><TableCell colSpan={4} className="h-20 text-center text-[10px] uppercase font-bold opacity-30 italic">No shift profiles registered</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1 text-left">
                                <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><MapPin className="size-5 text-primary" /> HQ Geofencing Matrix</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Precision coordinates for the primary operational base.</CardDescription>
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="rounded-none font-black uppercase text-[9px] tracking-widest h-9 bg-white border-primary/20 text-primary hover:bg-primary/5"
                                onClick={handleGetCurrentLocation}
                            >
                                <LocateFixed className="size-3 mr-2" /> Capture HQ Signal
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="e.g., 28.6139" className="rounded-none h-12 font-mono" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="e.g., 77.2090" className="rounded-none h-12 font-mono" /></div>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Verification Radius (KM)</Label><Input type="number" step="0.1" value={form.maxDistanceKm} onChange={e => setForm({...form, maxDistanceKm: e.target.value})} className="rounded-none h-12 w-full md:w-1/3" /></div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 text-primary font-black uppercase tracking-tighter"><MapIcon className="size-5" /> Intelligence Integrations</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Connect external services for high-fidelity geofencing visualization.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-left">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2 tracking-widest"><Key className="size-3" /> Google Maps API Key</Label>
                            <Input 
                                type="password" 
                                value={form.googleMapsApiKey} 
                                onChange={e => setForm({...form, googleMapsApiKey: e.target.value})} 
                                placeholder="Paste API Key here..." 
                                className="rounded-none h-12 font-mono" 
                            />
                            <p className="text-[9px] text-muted-foreground font-medium italic mt-2">Required for the Live Operational Monitor and precise address lookups. Enable "Maps JavaScript API" and "Geocoding API".</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><CalendarClock className="size-5 text-primary" /> Personnel Protocols</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Establish global personnel standards and mission entitlements.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-left">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Default Annual Leave Entitlement (Days)</Label>
                            <Input 
                                type="number" 
                                value={form.defaultLeaveEntitlement} 
                                onChange={e => setForm({...form, defaultLeaveEntitlement: e.target.value})} 
                                className="rounded-none h-12 w-full md:w-1/3 font-black" 
                            />
                            <p className="text-[9px] text-muted-foreground italic mt-2">This serves as the default mission capacity for all fleet members until manually overridden.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><Clock className="size-5 text-primary" /> Tactical Timings</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Configure shift windows and automated intelligence triggers.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Shift Log-In Start</Label><Input type="time" value={form.shiftStartTime} onChange={e => setForm({...form, shiftStartTime: e.target.value})} className="rounded-none h-12" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Shift Log-Out Target</Label><Input type="time" value={form.shiftEndTime} onChange={e => setForm({...form, shiftEndTime: e.target.value})} className="rounded-none h-12" /></div>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Morning Report Trigger</Label><Input type="time" value={form.morningReportSlot} onChange={e => setForm({...form, morningReportSlot: e.target.value})} className="rounded-none h-12" /><p className="text-[9px] text-muted-foreground italic font-bold">Standard: 09:50 AM IST</p></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Evening Report Trigger</Label><Input type="time" value={form.eveningReportSlot} onChange={e => setForm({...form, eveningReportSlot: e.target.value})} className="rounded-none h-12" /><p className="text-[9px] text-muted-foreground italic font-bold">Standard: 06:50 PM IST</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-6 flex justify-end">
                <Button onClick={handleSave} className="rounded-none h-14 px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"><Save className="mr-2 size-5" /> Save Platform Config</Button>
            </div>
        </div>
    );
}

