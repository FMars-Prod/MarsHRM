'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, serverTimestamp } from 'firebase/firestore';
import { MapPin, LocateFixed, ShieldAlert, Loader2, Signal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Dashboard alert for WFH authorized users to set or update their residential check-in point.
 */
export function WfhSetupReminder() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);

    const [isOpen, setIsOpen] = React.useState(false);
    const [isCapturing, setIsCapturing] = React.useState(false);
    const [coords, setCoords] = React.useState({ lat: '', lng: '' });
    const [reason, setReason] = React.useState('');

    // Only show for users with WFH permission enabled by Admin
    if (!userData?.isWfhAllowed) return null;

    const hasLocation = userData?.homeLatitude && userData?.homeLongitude;

    const handleCapture = () => {
        setIsCapturing(true);
        navigator.geolocation.getCurrentPosition(
            (p) => {
                setCoords({ lat: p.coords.latitude.toString(), lng: p.coords.longitude.toString() });
                setIsCapturing(false);
                toast({ title: "GPS Signal Captured", description: "Coordinates synced to form." });
            },
            (err) => {
                setIsCapturing(false);
                toast({ variant: 'destructive', title: "GPS Error", description: err.message });
            },
            { enableHighAccuracy: true }
        );
    };

    const handleRequest = async () => {
        if (!coords.lat || !coords.lng || !user || !userData) return;
        
        const payload = {
            employeeId: user.uid,
            employeeName: `${userData.firstName} ${userData.lastName}`,
            requestDate: serverTimestamp(),
            newLatitude: Number(coords.lat),
            newLongitude: Number(coords.lng),
            reason: reason || (hasLocation ? "Updating residential check-in point." : "Setting initial WFH location."),
            status: 'pending'
        };
        
        await addDocumentNonBlocking(collection(firestore, 'location_change_requests'), payload);
        toast({ title: "Request Transmitted", description: "Your coordinates have been sent for Admin authorization." });
        setIsOpen(false);
        setReason('');
    };

    return (
        <>
            <Alert className={cn(
                "mb-4 animate-fade-in-up rounded-2xl border-none ring-1 shadow-xl backdrop-blur-xl", 
                !hasLocation ? "bg-amber-50/60 ring-amber-200" : "bg-white/60 ring-primary/20"
            )}>
                <MapPin className={cn("h-4 w-4", !hasLocation ? "text-amber-600" : "text-primary")} />
                <AlertTitle className={cn("font-black uppercase tracking-widest text-[10px] mb-1", !hasLocation ? "text-amber-700" : "text-primary")}>
                    {!hasLocation ? "WFH Setup Required" : "WFH Location Status"}
                </AlertTitle>
                <AlertDescription className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <p className="text-[11px] font-bold uppercase tracking-tight text-slate-700 leading-relaxed text-left">
                        {!hasLocation 
                            ? "Remote authorization is active but no location is registered. You must define a check-in point." 
                            : "Your remote check-in coordinates are active. Use this terminal if you need to relocate."}
                    </p>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant={!hasLocation ? "default" : "outline"} className="rounded-full h-8 px-6 font-black uppercase text-[9px] tracking-widest shadow-sm">
                                {!hasLocation ? "Set WFH Point" : "Relocate Point"}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-md p-0 border-none shadow-3xl overflow-hidden">
                            <DialogHeader className="p-8 border-b bg-white text-left">
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                                    <Signal className="size-5" /> Location Stamping
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Authorize your residential mission sector</DialogDescription>
                            </DialogHeader>
                            <div className="p-8 space-y-8 bg-muted/5 text-left">
                                <div className="p-6 bg-white ring-1 ring-border rounded-2xl shadow-sm space-y-6">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Tactical Coordinates</Label>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 rounded-full text-[9px] font-black uppercase tracking-widest px-4 border border-primary/20 hover:bg-primary/5" 
                                            onClick={handleCapture} 
                                            disabled={isCapturing}
                                        >
                                            {isCapturing ? <Loader2 className="size-3 animate-spin mr-2"/> : <LocateFixed className="size-3 mr-2" />} 
                                            Live Capture
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 text-left">
                                            <Label className="text-[9px] uppercase font-black opacity-40">Latitude</Label>
                                            <Input 
                                                value={coords.lat} 
                                                onChange={e => setCoords({...coords, lat: e.target.value})} 
                                                placeholder="0.000000"
                                                className="rounded-xl h-11 font-mono text-sm font-bold border-none ring-1 ring-border focus-visible:ring-primary" 
                                            />
                                        </div>
                                        <div className="space-y-1.5 text-left">
                                            <Label className="text-[9px] uppercase font-black opacity-40">Longitude</Label>
                                            <Input 
                                                value={coords.lng} 
                                                onChange={e => setCoords({...coords, lng: e.target.value})} 
                                                placeholder="0.000000"
                                                className="rounded-xl h-11 font-mono text-sm font-bold border-none ring-1 ring-border focus-visible:ring-primary" 
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Justification / Reason</Label>
                                    <Input 
                                        value={reason} 
                                        onChange={e => setReason(e.target.value)} 
                                        placeholder="e.g., Setting permanent remote office" 
                                        className="h-12 rounded-xl bg-white border-none ring-1 ring-border" 
                                    />
                                </div>
                            </div>
                            <DialogFooter className="p-8 border-t bg-white">
                                <Button 
                                    onClick={handleRequest} 
                                    disabled={!coords.lat || !coords.lng} 
                                    className="w-full h-14 rounded-full font-black uppercase tracking-widest shadow-2xl"
                                >
                                    Transmit to HQ
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </AlertDescription>
            </Alert>
        </>
    );
}
