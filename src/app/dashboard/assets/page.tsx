
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useStorage } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Laptop, Plus, Trash2, Edit, Search, FileUp, Loader2, Package, CheckCircle2, XCircle, Info, UserCircle, Eye, Timer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

type Asset = {
    id: string;
    name: string;
    category: string;
    specs: string;
    imageUrl?: string;
    status: 'Available' | 'Assigned' | 'Maintenance';
    assignedToId?: string;
};

type AssetRequest = {
    id: string;
    assetId: string;
    assetName: string;
    requesterId: string;
    requesterName: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    requestDate: any;
};

export default function AssetsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [viewingAsset, setViewingAsset] = React.useState<Asset | null>(null);
    const [assetForm, setAssetForm] = React.useState<Partial<Asset>>({
        name: '', category: '', specs: '', status: 'Available', imageUrl: ''
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const isPrivileged = userData?.role === 'HR Manager' || userData?.role === 'CEO/Admin';

    const assetsQuery = useMemoFirebase(() => query(collection(firestore, 'assets'), orderBy('name', 'asc')), [firestore]);
    const { data: assets, isLoading: assetsLoading } = useCollection<Asset>(assetsQuery);

    const requestsQuery = useMemoFirebase(() => {
        const base = collection(firestore, 'asset_requests');
        if (isPrivileged) return query(base, orderBy('requestDate', 'desc'));
        return query(base, where('requesterId', '==', user?.uid), orderBy('requestDate', 'desc'));
    }, [firestore, isPrivileged, user]);
    const { data: requests, isLoading: requestsLoading } = useCollection<AssetRequest>(requestsQuery);

    const handleSaveAsset = async () => {
        if (!assetForm.name || !assetForm.category) return;
        
        const payload = { ...assetForm, createdAt: serverTimestamp() };
        addDocumentNonBlocking(collection(firestore, 'assets'), payload);
        toast({ title: "Asset Registry Synchronized" });
        setIsAddOpen(false);
        setAssetForm({ name: '', category: '', specs: '', status: 'Available', imageUrl: '' });
    };

    const handleImageUpload = async (file: File) => {
        if (!user || !storage) return;
        setIsUploading(true);
        try {
            const fileRef = ref(storage, `assets/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setAssetForm(prev => ({ ...prev, imageUrl: url }));
            toast({ title: "Visual Asset Verified" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Transmission Failed" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRequestAsset = (asset: Asset) => {
        const payload = {
            assetId: asset.id,
            assetName: asset.name,
            requesterId: user?.uid,
            requesterName: `${userData.firstName} ${userData.lastName}`,
            status: 'Pending',
            requestDate: serverTimestamp(),
            reason: `Standard requisition for ${asset.category} unit.`
        };
        addDocumentNonBlocking(collection(firestore, 'asset_requests'), payload);
        toast({ title: "Tactical Requisition Dispatched" });
    };

    const handleApproveRequest = (req: AssetRequest) => {
        const batch = doc(firestore, 'asset_requests', req.id);
        updateDocumentNonBlocking(batch, { status: 'Approved' });
        updateDocumentNonBlocking(doc(firestore, 'assets', req.assetId), { status: 'Assigned', assignedToId: req.requesterId });
        toast({ title: "Asset Allocated" });
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Fleet Logistics" description="Command center for physical asset management and personnel requisitions.">
                {isPrivileged && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild><Button className="rounded-full h-11 shadow-lg"><Plus className="size-4 mr-2"/> Provision Asset</Button></DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-md">
                            <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">New Asset Provisioning</DialogTitle></DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Unit Designation</Label><Input value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} placeholder="e.g., MacBook Pro M3" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Category</Label>
                                        <Select value={assetForm.category} onValueChange={v => setAssetForm({...assetForm, category: v})}>
                                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent><SelectItem value="Laptop">Laptop</SelectItem><SelectItem value="Mobile">Mobile</SelectItem><SelectItem value="Peripheral">Peripheral</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Initial Status</Label>
                                        <Select value={assetForm.status} onValueChange={v => setAssetForm({...assetForm, status: v as any})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="Available">Available</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Specifications</Label><Textarea value={assetForm.specs} onChange={e => setAssetForm({...assetForm, specs: e.target.value})} placeholder="e.g., 32GB RAM, 1TB SSD" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Unit Visualization</Label>
                                    <div className="flex gap-2">
                                        <Input value={assetForm.imageUrl} onChange={e => setAssetForm({...assetForm, imageUrl: e.target.value})} placeholder="Image URL..." className="flex-1" />
                                        <div className="relative">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                                            <Button variant="outline" size="icon" disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin size-4"/> : <FileUp className="size-4" />}</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSaveAsset} className="w-full rounded-full h-12 font-black uppercase">Finalize Provisioning</Button>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 bg-white/50 ring-1 ring-border/50 rounded-2xl p-1">
                    <TabsTrigger value="inventory" className="rounded-xl font-black uppercase text-[10px] tracking-widest">Global Inventory</TabsTrigger>
                    <TabsTrigger value="requests" className="rounded-xl font-black uppercase text-[10px] tracking-widest">Tactical Requisitions</TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {assetsLoading ? [...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-3xl" />) : assets?.map(asset => {
                            const hasPendingRequest = requests?.some(req => req.assetId === asset.id && req.requesterId === user?.uid && req.status === 'Pending');

                            return (
                                <Card key={asset.id} className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden group">
                                    <div className="aspect-square bg-muted relative overflow-hidden">
                                        {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><Package className="size-12" /></div>}
                                        <Badge className={cn("absolute top-3 right-3 rounded-full font-black text-[8px] uppercase tracking-widest", asset.status === 'Available' ? 'bg-green-600' : asset.status === 'Assigned' ? 'bg-blue-600' : 'bg-orange-600')}>{asset.status}</Badge>
                                    </div>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-sm font-bold truncate">{asset.name}</CardTitle>
                                        <CardDescription className="text-[10px] uppercase font-black tracking-widest">{asset.category}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0 space-y-3">
                                        <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{asset.specs || 'No technical data provisioned.'}"</p>
                                        {asset.status === 'Available' ? (
                                            hasPendingRequest ? (
                                                <Button disabled className="w-full h-9 rounded-xl font-black uppercase text-[9px] tracking-widest bg-muted text-muted-foreground opacity-50">
                                                    <Timer className="size-3 mr-2" /> Request Pending
                                                </Button>
                                            ) : (
                                                <Button onClick={() => handleRequestAsset(asset)} className="w-full h-9 rounded-xl font-black uppercase text-[9px] tracking-widest">Submit Requisition</Button>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl">
                                                <UserCircle className="size-4 opacity-40" />
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Assigned to Fleet Member</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="requests" className="mt-6">
                    <Card className="border-none ring-1 ring-border/50 overflow-hidden bg-white/50 backdrop-blur-sm">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Fleet Official</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Target Unit</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Command</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requestsLoading ? <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse">Syncing satellite log...</TableCell></TableRow> : requests?.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-bold py-4">{req.requesterName}</TableCell>
                                        <TableCell className="text-xs font-medium">
                                            <div className="flex items-center gap-2">
                                                {req.assetName}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 rounded-full hover:bg-primary/10 text-primary" 
                                                    onClick={() => {
                                                        const asset = assets?.find(a => a.id === req.assetId);
                                                        if (asset) setViewingAsset(asset);
                                                        else toast({ variant: 'destructive', title: 'Asset record not found' });
                                                    }}
                                                >
                                                    <Eye className="size-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-mono text-muted-foreground">{format(req.requestDate?.toDate() || new Date(), 'PP p')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("rounded-full font-black text-[8px] uppercase tracking-widest", req.status === 'Approved' ? 'text-green-600 border-green-200' : req.status === 'Pending' ? 'text-orange-600 border-orange-200' : 'text-red-600 border-red-200')}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(isPrivileged && req.status === 'Pending') ? (
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" onClick={() => handleApproveRequest(req)} className="bg-green-600 h-8 rounded-full font-black uppercase text-[8px] tracking-widest px-3">Authorize</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => updateDocumentNonBlocking(doc(firestore, 'asset_requests', req.id), { status: 'Rejected' })} className="h-8 rounded-full font-black uppercase text-[8px] tracking-widest px-3">Deny</Button>
                                                </div>
                                            ) : <span className="text-[9px] font-black uppercase opacity-20">Cycle Finished</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!viewingAsset} onOpenChange={o => !o && setViewingAsset(null)}>
                <DialogContent className="rounded-3xl sm:max-w-lg p-0 overflow-hidden border-none shadow-2xl max-h-[90vh]">
                    <ScrollArea className="h-full max-h-[90vh]">
                        <div className="aspect-video relative bg-muted">
                            {viewingAsset?.imageUrl ? (
                                <img src={viewingAsset.imageUrl} className="object-cover w-full h-full" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
                                    <Package className="size-16" />
                                    <p className="text-[10px] font-black uppercase mt-2">No Visual Asset</p>
                                </div>
                            )}
                            <Badge className={cn("absolute top-4 right-4 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg", viewingAsset?.status === 'Available' ? 'bg-green-600' : viewingAsset?.status === 'Assigned' ? 'bg-blue-600' : 'bg-orange-600')}>
                                {viewingAsset?.status}
                            </Badge>
                        </div>
                        <div className="p-8 space-y-6 bg-white">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">{viewingAsset?.name}</DialogTitle>
                                <DialogDescription className="text-xs font-black uppercase tracking-[0.2em] text-primary">{viewingAsset?.category} Intelligence</DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                                <div className="p-5 bg-muted/30 rounded-2xl border border-dashed border-border/50">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2 block">Technical Specifications</Label>
                                    <p className="text-sm font-medium italic leading-relaxed text-foreground/80">"{viewingAsset?.specs || 'No technical specifications provisioned.'}"</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                        <Label className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Asset Reference</Label>
                                        <p className="text-xs font-bold font-mono mt-1">#REF-{viewingAsset?.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                    <div className="p-4 bg-muted/30 rounded-2xl border">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Unit Classification</Label>
                                        <p className="text-xs font-bold mt-1 uppercase">{viewingAsset?.category}</p>
                                    </div>
                                </div>
                            </div>

                            <Button onClick={() => setViewingAsset(null)} className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Acknowledge Record</Button>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
