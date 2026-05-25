
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Building2, Plus, MapPin, Trash2, Edit, ExternalLink, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InteractiveMap } from '@/components/geohrm/interactive-map';
import Link from 'next/link';

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
    const [location, setLocation] = React.useState({ lat: 13.0827, lng: 80.2707, address: "" }); // Chennai Default
    const [radius, setRadius] = React.useState(0.5);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches'), orderBy('name', 'asc')), [firestore]);
    const { data: branches, isLoading } = useCollection<Branch>(branchesQuery);

    const handleSave = () => {
        if (!branchName || !location.lat || !location.lng) {
            toast({ variant: 'destructive', title: 'Missing parameters' });
            return;
        }

        const payload = {
            name: branchName,
            address: location.address,
            latitude: location.lat,
            longitude: location.lng,
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
        setLocation({ lat: 13.0827, lng: 80.2707, address: "" });
        setRadius(0.5);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <PageHeader title="Operational Branches" description="Define physical office boundaries and geofencing verification points.">
                <Dialog open={isDialogOpen} onOpenChange={o => { if(!o) resetForm(); setIsDialogOpen(o); }}>
                    <DialogTrigger asChild>
                        <Button className="rounded-full h-11 shadow-lg">
                            <Plus className="mr-2 size-4" /> Add Branch
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-3xl sm:max-w-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-8 pb-4">
                            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Branch Registration</DialogTitle>
                            <DialogDescription>Define tactical boundaries for shift verification.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Branch Name</Label>
                                    <Input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="e.g., Chennai HQ" className="rounded-xl h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Verification Radius (KM)</Label>
                                    <Input type="number" step="0.1" value={radius} onChange={e => setRadius(parseFloat(e.target.value))} className="rounded-xl h-11" />
                                </div>
                                <div className="p-4 bg-muted/20 rounded-2xl border border-dashed border-border/50">
                                    <Label className="text-[9px] font-black uppercase text-muted-foreground mb-2 block">Precise Coordinates</Label>
                                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px] font-bold">
                                        <div className="p-2 bg-white rounded-lg">LAT: {location.lat.toFixed(4)}</div>
                                        <div className="p-2 bg-white rounded-lg">LNG: {location.lng.toFixed(4)}</div>
                                    </div>
                                </div>
                                <Button onClick={handleSave} className="w-full h-12 rounded-full font-black uppercase tracking-widest mt-4">Confirm Registry</Button>
                            </div>
                            <div className="h-[400px] lg:h-auto bg-muted">
                                <InteractiveMap 
                                    initialCenter={{ lat: location.lat, lng: location.lng }} 
                                    onLocationSelect={setLocation} 
                                />
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    [...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-[2rem] bg-muted animate-pulse" />)
                ) : branches?.map(branch => (
                    <Card key={branch.id} className="border-none ring-1 ring-border/50 shadow-sm hover:shadow-xl transition-all duration-500 rounded-[2rem] bg-white overflow-hidden group">
                        <CardHeader className="p-6 pb-2">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="rounded-full font-black uppercase text-[8px] bg-muted/20 border-none px-3 h-6">
                                    {branch.radius} KM Radius
                                </Badge>
                            </div>
                            <CardTitle className="text-lg font-black uppercase tracking-tighter mt-4">{branch.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-4">
                            <div className="flex items-start gap-3">
                                <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <p className="text-[11px] font-medium leading-relaxed line-clamp-2">{branch.address || "No precise address registered."}</p>
                            </div>
                            <div className="pt-4 border-t border-dashed border-border/50 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-primary/10 text-primary" onClick={() => {
                                        setEditingBranch(branch);
                                        setBranchName(branch.name);
                                        setLocation({ lat: branch.latitude, lng: branch.longitude, address: branch.address });
                                        setRadius(branch.radius);
                                        setIsDialogOpen(true);
                                    }}>
                                        <Edit className="size-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-red-50 text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'branches', branch.id))}>
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-full h-8 font-bold text-[9px] uppercase bg-white/50" asChild>
                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`} target="_blank">
                                        <ExternalLink className="size-2.5 mr-1.5" /> Satellite View
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {branches?.length === 0 && !isLoading && (
                <div className="py-32 text-center opacity-30 grayscale flex flex-col items-center">
                    <MapPin className="size-16 mb-4 text-primary" />
                    <p className="font-black uppercase text-xs tracking-[0.3em]">No Branches Defined</p>
                </div>
            )}
        </div>
    );
}
