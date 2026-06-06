
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Building2, Plus, MapPin, Trash2, Edit, ExternalLink, ShieldCheck, Map as MapIcon, Key, Loader2, LocateFixed } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { InteractiveMap } from '@/components/geohrm/interactive-map';
import { ScrollArea } from '@/components/ui/scroll-area';

type Branch = {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
};

export default function BranchesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingBranch, setEditingBranch] = React.useState<Branch | null>(null);
    const [branchName, setBranchName] = React.useState("");
    const [address, setAddress] = React.useState("");
    const [coords, setCoords] = React.useState({ lat: 13.0827, lng: 80.2707 }); 
    const [radius, setRadius] = React.useState(0.5);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches'), orderBy('name', 'asc')), [firestore]);
    const { data: branches, isLoading } = useCollection<Branch>(branchesQuery);

    const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'location'), [firestore]);
    const { data: locationConfig } = useDoc<any>(configRef);
    const apiKey = locationConfig?.googleMapsApiKey;

    const handleGetCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCoords({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    toast({ title: "Branch Signal Captured", description: "GPS coordinates synchronized." });
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
        if (!branchName || isNaN(coords.lat) || isNaN(coords.lng)) {
            toast({ variant: 'destructive', title: 'Missing parameters', description: 'Please ensure valid coordinates are set.' });
            return;
        }

        const payload = {
            name: branchName,
            address: address,
            latitude: coords.lat,
            longitude: coords.lng,
            radius: radius
        };

        if (editingBranch) {
            updateDocumentNonBlocking(doc(firestore, 'branches', editingBranch.id), payload);
            toast({ title: 'Branch Reconfigured' });
        } else {
            addDocumentNonBlocking(collection(firestore, 'branches'), payload);
            toast({ title: 'Branch Registered' });
        }

        setIsDialogOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setEditingBranch(null);
        setBranchName("");
        setAddress("");
        setCoords({ lat: 13.0827, lng: 80.2707 });
        setRadius(0.5);
    };

    const handleLocationSelect = (loc: { lat: number, lng: number, address: string }) => {
        setCoords({ lat: loc.lat, lng: loc.lng });
        setAddress(loc.address);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <PageHeader title="Operational Branches" description="Define physical office boundaries and high-precision geofencing sectors.">
                <Dialog open={isDialogOpen} onOpenChange={o => { if(!o) resetForm(); setIsDialogOpen(o); }}>
                    <DialogTrigger asChild>
                        <Button className="rounded-full h-11 shadow-lg shadow-primary/20">
                            <Plus className="mr-2 size-4" /> Add Branch
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] sm:max-w-3xl p-0 border-none shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                        <DialogHeader className="p-10 pb-6 bg-white border-b shrink-0">
                            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Branch Registry</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Define tactical boundaries with GPS precision</DialogDescription>
                        </DialogHeader>

                        <ScrollArea className="flex-1">
                            <div className="p-10 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Branch Designation</Label>
                                            <Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="e.g., Chennai HQ" className="rounded-xl h-12" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Physical Address (Verified)</Label>
                                            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Select point on map or enter..." className="rounded-xl h-12" />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Coordinates</Label>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 rounded-full text-[8px] font-black uppercase tracking-widest px-3 border border-primary/20 hover:bg-primary/5"
                                                    onClick={handleGetCurrentLocation}
                                                >
                                                    <LocateFixed className="size-3 mr-1.5" /> Capture Signal
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] uppercase font-bold opacity-40">Latitude</Label>
                                                    <Input 
                                                        type="number" 
                                                        step="any" 
                                                        value={coords.lat} 
                                                        onChange={e => setCoords({...coords, lat: parseFloat(e.target.value) || 0})} 
                                                        className="h-11 rounded-xl font-mono text-xs font-bold" 
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[9px] uppercase font-bold opacity-40">Longitude</Label>
                                                    <Input 
                                                        type="number" 
                                                        step="any" 
                                                        value={coords.lng} 
                                                        onChange={e => setCoords({...coords, lng: parseFloat(e.target.value) || 0})} 
                                                        className="h-11 rounded-xl font-mono text-xs font-bold" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Verification Radius (KM)</Label>
                                            <Input type="number" step="0.1" value={radius} onChange={e => setRadius(parseFloat(e.target.value))} className="rounded-xl h-12" />
                                            <p className="text-[9px] text-muted-foreground italic font-bold">Tactical Precision: {radius * 1000} meters</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 flex flex-col h-full min-h-[400px]">
                                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                            <MapIcon className="size-3" /> Satellite Point Selection
                                        </Label>
                                        {apiKey ? (
                                            <div className="flex-1 rounded-3xl border-2 border-dashed border-primary/20 overflow-hidden shadow-inner bg-muted/20 relative">
                                                <InteractiveMap 
                                                    initialCenter={coords} 
                                                    onLocationSelect={handleLocationSelect} 
                                                    className="w-full h-full"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-1 rounded-3xl border-2 border-dashed border-muted/30 bg-muted/10 flex flex-col items-center justify-center text-center p-8 opacity-40">
                                                <Key className="size-10 mb-3" />
                                                <p className="font-black uppercase text-[10px] tracking-widest">Maps API Key Required</p>
                                                <p className="text-[9px] mt-1 italic">Configure key in System Settings for tactical map selection.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        <div className="p-10 border-t bg-white shrink-0">
                            <Button onClick={handleSave} className="w-full h-14 rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">Finalize Registry Protocol</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {isLoading ? (
                    [...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-[2.5rem] bg-muted animate-pulse" />)
                ) : branches?.map(branch => (
                    <Card key={branch.id} className="border-none ring-1 ring-border/50 shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] bg-white overflow-hidden group">
                        <CardHeader className="p-10 pb-4">
                            <div className="flex items-center justify-between">
                                <div className="p-3.5 rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                                    <Building2 className="h-6 w-6" />
                                </div>
                                <Badge variant="outline" className="rounded-full font-black uppercase text-[9px] bg-muted/20 border-none px-4 h-7 tracking-widest">
                                    {branch.radius} KM Radius
                                </Badge>
                            </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tighter mt-6">{branch.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 pt-0 space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="size-4 text-primary/40 mt-0.5 shrink-0" />
                                <p className="text-[11px] font-bold leading-relaxed line-clamp-2 uppercase tracking-tight text-foreground/70">{branch.address || "No precise address registered."}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 font-mono text-[10px] font-black text-muted-foreground/60 bg-muted/20 p-3 rounded-2xl border-2 border-dashed border-border/50">
                                <div>LAT: {branch.latitude.toFixed(4)}</div>
                                <div>LNG: {branch.longitude.toFixed(4)}</div>
                            </div>
                            <div className="pt-6 border-t border-dashed border-border/50 flex items-center justify-between">
                                <div className="flex gap-3">
                                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-colors" onClick={() => {
                                        setEditingBranch(branch);
                                        setBranchName(branch.name);
                                        setAddress(branch.address);
                                        setCoords({ lat: branch.latitude, lng: branch.longitude });
                                        setRadius(branch.radius);
                                        setIsDialogOpen(true);
                                    }}>
                                        <Edit className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-red-50 text-destructive transition-colors" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'branches', branch.id))}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-full h-9 font-black text-[9px] uppercase tracking-widest bg-white shadow-sm ring-1 ring-border/50 border-none px-4" asChild>
                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`} target="_blank">
                                        <ExternalLink className="size-3 mr-2 opacity-60" /> Satellite View
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {branches?.length === 0 && !isLoading && (
                <div className="py-40 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-6">
                    <div className="p-8 rounded-[3rem] bg-muted/20 ring-4 ring-muted/10">
                        <MapPin className="size-20 text-primary/40" />
                    </div>
                    <p className="font-black uppercase text-xs tracking-[0.4em]">Operational Grid Depleted</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs leading-relaxed">No strategic branches registered in the regional directory.</p>
                </div>
            )}
        </div>
    );
}
