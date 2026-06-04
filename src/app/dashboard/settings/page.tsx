
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useDoc, setDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, ShieldCheck, Globe, Save, Info, Key, Map as MapIcon, CalendarClock, LocateFixed } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
    const { data: locationData, isLoading } = useDoc<any>(configRef);

    const reportConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
    const { data: reportData } = useDoc<any>(reportConfigRef);

    const personnelConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'personnel'), [firestore]);
    const { data: personnelData } = useDoc<any>(personnelConfigRef);

    const [form, setForm] = React.useState<any>({
        latitude: '', longitude: '', maxDistanceKm: '0.5', shiftStartTime: '09:00', shiftEndTime: '18:00',
        morningReportSlot: '09:50', eveningReportSlot: '18:50', companyName: 'FortuMars AI',
        googleMapsApiKey: 'AIzaSyC0ilt4E_SJSB-1l5Mlhkr-UFwlBmWkuiI',
        defaultLeaveEntitlement: '24'
    });

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
                defaultLeaveEntitlement: personnelData.defaultLeaveEntitlement || '24'
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
                }
            );
        } else {
            toast({ variant: "destructive", title: "Not Supported", description: "Geolocation is not supported by your browser." });
        }
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
            defaultLeaveEntitlement: parseInt(form.defaultLeaveEntitlement) || 24,
            updatedAt: serverTimestamp()
        };

        setDocumentNonBlocking(configRef, locPayload, { merge: true });
        setDocumentNonBlocking(reportConfigRef, reportPayload, { merge: true });
        setDocumentNonBlocking(personnelConfigRef, personnelPayload, { merge: true });
        
        toast({ title: "System Protocols Synchronized", description: "Global configuration and API keys updated." });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-20">
            <PageHeader title="Global Command Center" description="Configure core platform parameters, geofencing protocols, and external API integrations." />

            <div className="grid gap-8">
                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><MapPin className="size-5 text-primary" /> HQ Geofencing Matrix</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Precision coordinates for the primary operational base.</CardDescription>
                            </div>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="rounded-full font-black uppercase text-[9px] tracking-widest h-9 bg-white border-primary/20 text-primary hover:bg-primary/5"
                                onClick={handleGetCurrentLocation}
                            >
                                <LocateFixed className="size-3 mr-2" /> Capture HQ Signal
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="e.g., 28.6139" className="rounded-xl h-12 font-mono" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="e.g., 77.2090" className="rounded-xl h-12 font-mono" /></div>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Verification Radius (KM)</Label><Input type="number" step="0.1" value={form.maxDistanceKm} onChange={e => setForm({...form, maxDistanceKm: e.target.value})} className="rounded-xl h-12 w-full md:w-1/3" /></div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 text-primary font-black uppercase tracking-tighter"><MapIcon className="size-5" /> Intelligence Integrations</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Connect external services for high-fidelity geofencing visualization.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2 tracking-widest"><Key className="size-3" /> Google Maps API Key</Label>
                            <Input 
                                type="password" 
                                value={form.googleMapsApiKey} 
                                onChange={e => setForm({...form, googleMapsApiKey: e.target.value})} 
                                placeholder="Paste API Key here..." 
                                className="rounded-xl h-12 font-mono" 
                            />
                            <p className="text-[9px] text-muted-foreground font-medium italic mt-2">Required for the Live Operational Monitor and precise address lookups. Enable "Maps JavaScript API" and "Geocoding API".</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><CalendarClock className="size-5 text-primary" /> Personnel Protocols</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Establish global personnel standards and mission entitlements.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Default Annual Leave Entitlement (Days)</Label>
                            <Input 
                                type="number" 
                                value={form.defaultLeaveEntitlement} 
                                onChange={e => setForm({...form, defaultLeaveEntitlement: e.target.value})} 
                                className="rounded-xl h-12 w-full md:w-1/3 font-black" 
                            />
                            <p className="text-[9px] text-muted-foreground italic mt-2">This serves as the default mission capacity for all fleet members until manually overridden.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter"><Clock className="size-5 text-primary" /> Tactical Timings</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Configure shift windows and automated intelligence triggers.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Shift Log-In Start</Label><Input type="time" value={form.shiftStartTime} onChange={e => setForm({...form, shiftStartTime: e.target.value})} className="rounded-xl h-12" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Shift Log-Out Target</Label><Input type="time" value={form.shiftEndTime} onChange={e => setForm({...form, shiftEndTime: e.target.value})} className="rounded-xl h-12" /></div>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Morning Report Trigger</Label><Input type="time" value={form.morningReportSlot} onChange={e => setForm({...form, morningReportSlot: e.target.value})} className="rounded-xl h-12" /><p className="text-[9px] text-muted-foreground italic font-bold">Standard: 09:50 AM IST</p></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Evening Report Trigger</Label><Input type="time" value={form.eveningReportSlot} onChange={e => setForm({...form, eveningReportSlot: e.target.value})} className="rounded-xl h-12" /><p className="text-[9px] text-muted-foreground italic font-bold">Standard: 06:50 PM IST</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-6 flex justify-end">
                <Button onClick={handleSave} className="rounded-full h-14 px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"><Save className="mr-2 size-5" /> Save Platform Config</Button>
            </div>
        </div>
    );
}
