
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
import { MapPin, Clock, ShieldCheck, Globe, Save, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
    const { data: locationData, isLoading } = useDoc<any>(configRef);

    const reportConfigRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
    const { data: reportData } = useDoc<any>(reportConfigRef);

    const [form, setForm] = React.useState<any>({
        latitude: '', longitude: '', maxDistanceKm: '0.5', shiftStartTime: '09:00', shiftEndTime: '18:00',
        morningReportSlot: '09:50', eveningReportSlot: '18:50', companyName: 'FortuMars AI'
    });

    React.useEffect(() => {
        if (locationData) {
            setForm((prev: any) => ({
                ...prev,
                latitude: locationData.latitude || '',
                longitude: locationData.longitude || '',
                maxDistanceKm: locationData.maxDistanceKm || '0.5',
                shiftStartTime: locationData.shiftStartTime || '09:00'
            }));
        }
        if (reportData?.timings) {
            setForm((prev: any) => ({
                ...prev,
                morningReportSlot: reportData.timings.morningReportSlot || '09:50',
                eveningReportSlot: reportData.timings.eveningReportSlot || '18:50',
                shiftEnd: reportData.timings.shiftEnd || '18:00'
            }));
        }
    }, [locationData, reportData]);

    const handleSave = () => {
        const locPayload = {
            latitude: parseFloat(form.latitude),
            longitude: parseFloat(form.longitude),
            maxDistanceKm: parseFloat(form.maxDistanceKm),
            shiftStartTime: form.shiftStartTime,
            updatedAt: serverTimestamp()
        };

        const reportPayload = {
            timings: {
                morningReportSlot: form.morningReportSlot,
                eveningReportSlot: form.eveningReportSlot,
                shiftEnd: form.shiftEnd
            }
        };

        setDocumentNonBlocking(configRef, locPayload, { merge: true });
        setDocumentNonBlocking(reportConfigRef, reportPayload, { merge: true });
        
        toast({ title: "System Protocols Synchronized", description: "Global configuration updated across all modules." });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
            <PageHeader title="Global Command Center" description="Configure core platform parameters and geofencing protocols." />

            <div className="grid gap-8">
                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-headline flex items-center gap-2"><MapPin className="size-5 text-primary" /> HQ Geofencing Matrix</CardTitle>
                        <CardDescription>Precision coordinates for the primary operational base.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="e.g., 28.6139" className="rounded-xl h-12" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="e.g., 77.2090" className="rounded-xl h-12" /></div>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Verification Radius (KM)</Label><Input type="number" step="0.1" value={form.maxDistanceKm} onChange={e => setForm({...form, maxDistanceKm: e.target.value})} className="rounded-xl h-12 w-full md:w-1/3" /></div>
                    </CardContent>
                </Card>

                <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-headline flex items-center gap-2"><Clock className="size-5 text-primary" /> Tactical Timings</CardTitle>
                        <CardDescription>Configure shift windows and automated intelligence triggers.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Shift Log-In Start</Label><Input type="time" value={form.shiftStartTime} onChange={e => setForm({...form, shiftStartTime: e.target.value})} className="rounded-xl h-12" /></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Shift Log-Out Target</Label><Input type="time" value={form.shiftEnd} onChange={e => setForm({...form, shiftEnd: e.target.value})} className="rounded-xl h-12" /></div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Morning Report Trigger</Label><Input type="time" value={form.morningReportSlot} onChange={e => setForm({...form, morningReportSlot: e.target.value})} className="rounded-xl h-12" /><p className="text-[9px] text-muted-foreground italic">Standard: 09:50 AM IST</p></div>
                            <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Evening Report Trigger</Label><Input type="time" value={form.eveningReportSlot} onChange={e => setForm({...form, eveningReportSlot: e.target.value})} className="rounded-xl h-12" /><p className="text-[9px] text-muted-foreground italic">Standard: 06:50 PM IST</p></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-6 flex justify-end">
                <Button onClick={handleSave} className="rounded-full h-14 px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20"><Save className="mr-2 size-5" /> Save Platform Config</Button>
            </div>
        </div>
    );
}
