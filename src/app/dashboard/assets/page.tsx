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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null);
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
        
        if (editingAsset) {
            updateDocumentNonBlocking(doc(firestore, 'assets', editingAsset.id), assetForm);
            toast({ title: "Asset Updated" });
        } else {
            const payload = { ...assetForm, createdAt: serverTimestamp() };
            addDocumentNonBlocking(collection(firestore, 'assets'), payload);
            toast({ title: "Asset Saved" });
        }
        setIsAddOpen(false);
        setEditingAsset(null);
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
            toast({ title: "Photo Uploaded" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Upload Failed" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRequestAsset = (asset: Asset) => {
        if (!userData) return;
        const payload = {
            assetId: asset.id,
            assetName: asset.name,
            requesterId: user?.uid,
            requesterName: `${userData.firstName} ${userData.lastName}`,
            status: 'Pending',
            requestDate: serverTimestamp(),
            reason: `Requested ${asset.name}.`
        };
        addDocumentNonBlocking(collection(firestore, 'asset_requests'), payload);
        toast({ title: "Request Sent" });
    };

    const handleApproveRequest = (req: AssetRequest) => {
        updateDocumentNonBlocking(doc(firestore, 'asset_requests', req.id), { status: 'Approved' });
        updateDocumentNonBlocking(doc(firestore, 'assets', req.assetId), { status: 'Assigned', assignedToId: req.requesterId });
        toast({ title: "Asset Assigned" });
    };

    return (
        <TooltipProvider delayDuration={0}>
        <div className="space-y-6 animate-fade-in-up font-jakarta">
            <PageHeader title="Asset Management" description="Manage company assets like laptops and mobile devices.">
                {isPrivileged && (
                    <Dialog open={isAddOpen} onOpenChange={(o) => { if(!o) setEditingAsset(null); setIsAddOpen(o); }}>
                        <DialogTrigger asChild><Button className="rounded-none h-11 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-6"><Plus className="size-4 mr-2"/> Add Asset</Button></DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">{editingAsset ? 'Edit Asset' : 'New Asset'}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-6 text-left">
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Asset Name</Label><Input value={assetForm.name} onChange={e => setAssetForm({...assetForm, name: e.target.value})} placeholder="e.g., MacBook Pro" className="rounded-none h-12 font-bold" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Category</Label>
                                        <Select value={assetForm.category} onValueChange={v => setAssetForm({...assetForm, category: v})}>
                                            <SelectTrigger className="rounded-none h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent className="rounded-none"><SelectItem value="Laptop">Laptop</SelectItem><SelectItem value="Mobile">Mobile</SelectItem><SelectItem value="Peripheral">Peripheral</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Status</Label>
                                        <Select value={assetForm.status} onValueChange={v => setAssetForm({...assetForm, status: v as any})}>
                                            <SelectTrigger className="rounded-none h-12 font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-none"><SelectItem value="Available">Available</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem><SelectItem value="Assigned">Assigned</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Specifications</Label><Textarea value={assetForm.specs} onChange={e => setAssetForm({...assetForm, specs: e.target.value})} placeholder="e.g., 16GB RAM, 512GB SSD" className="rounded-none min-h-[80px]" /></div>
                                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Photo</Label>
                                    <div className="flex gap-2">
                                        <Input value={assetForm.imageUrl} onChange={e => setAssetForm({...assetForm, imageUrl: e.target.value})} placeholder="Paste URL or upload..." className="flex-1 rounded-none h-12" />
                                        <div className="relative">
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                                            <Button variant="outline" size="icon" className="rounded-none h-12 w-12" disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin size-4"/> : <FileUp className="size-4" />}</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSaveAsset} className="w-full rounded-none h-14 font-black uppercase tracking-widest shadow-2xl">Save Asset</Button>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-fit grid-cols-2 h-11 bg-white/50 ring-1 ring-border/50 rounded-none p-1">
                    <TabsTrigger value="inventory" className="rounded-none font-black uppercase text-[10px] tracking-widest px-8">All Assets</TabsTrigger>
                    <TabsTrigger value="requests" className="rounded-none font-black uppercase text-[10px] tracking-widest px-8">Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="mt-6">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {assetsLoading ? [...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-none" />) : assets?.map(asset => {
                            const hasPendingRequest = requests?.some(req => req.assetId === asset.id && req.requesterId === user?.uid && req.status === 'Pending');

                            return (
                                <Card key={asset.id} className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden group bg-white rounded-none transition-all hover:shadow-xl">
                                    <div className="aspect-square bg-muted relative overflow-hidden">
                                        {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center opacity-10"><Package className="size-16" /></div>}
                                        <Badge className={cn("absolute top-3 right-3 rounded-none font-black text-[8px] uppercase tracking-widest border-none shadow-md", asset.status === 'Available' ? 'bg-green-600 text-white' : asset.status === 'Assigned' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white')}>{asset.status}</Badge>
                                        
                                        {isPrivileged && (
                                            <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-none shadow-lg" onClick={() => { setEditingAsset(asset); setAssetForm(asset); setIsAddOpen(true); }}>
                                                    <Edit className="size-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-none shadow-lg">
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-none border-none shadow-3xl">
                                                        <AlertDialogHeader className="text-left">
                                                            <AlertDialogTitle className="font-black uppercase tracking-tighter text-primary">Delete Asset?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">Remove "{asset.name}" from the registry permanently.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-8 gap-3">
                                                            <AlertDialogCancel className="rounded-none font-black uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(firestore, 'assets', asset.id))} className="bg-red-600 rounded-none h-11 px-6 font-black uppercase text-[10px]">Confirm Purge</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        )}
                                    </div>
                                    <CardHeader className="p-4 text-left">
                                        <CardTitle className="text-sm font-black uppercase tracking-tight truncate">{asset.name}</CardTitle>
                                        <CardDescription className="text-[9px] uppercase font-bold tracking-widest text-primary/60">{asset.category}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0 space-y-4">
                                        <p className="text-[11px] text-muted-foreground line-clamp-2 italic text-left leading-relaxed">"{asset.specs || 'No details.'}"</p>
                                        {asset.status === 'Available' ? (
                                            hasPendingRequest ? (
                                                <Button disabled className="w-full h-10 rounded-none font-black uppercase text-[9px] tracking-widest bg-muted text-muted-foreground opacity-50">
                                                    <Timer className="size-3 mr-2" /> Pending Approval
                                                </Button>
                                            ) : (
                                                <Button onClick={() => handleRequestAsset(asset)} className="w-full h-10 rounded-none font-black uppercase text-[9px] tracking-widest shadow-lg shadow-primary/20">Request Asset</Button>
                                            )
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-none border-2 border-dashed border-border/50">
                                                <UserCircle className="size-4 opacity-40" />
                                                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Assigned Personnel</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="requests" className="mt-6">
                    <Card className="border-none ring-1 ring-border/50 overflow-hidden bg-white shadow-xl rounded-none">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 px-8">Employee</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Asset</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Request Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6 px-8">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requestsLoading ? <TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20">Scanning...</TableCell></TableRow> : requests?.length === 0 ? <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] opacity-30">No requests found.</TableCell></TableRow> : requests?.map(req => (
                                    <TableRow key={req.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                        <TableCell className="font-black text-xs uppercase px-8 py-6">{req.requesterName}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-sm uppercase">{req.assetName}</span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 rounded-none hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100" 
                                                    onClick={() => {
                                                        const asset = assets?.find(a => a.id === req.assetId);
                                                        if (asset) setViewingAsset(asset);
                                                        else toast({ variant: 'destructive', title: 'Asset not found' });
                                                    }}
                                                >
                                                    <Eye className="size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-black text-muted-foreground uppercase opacity-60">{format(req.requestDate?.toDate() || new Date(), 'PP p')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("rounded-none font-black text-[9px] uppercase tracking-widest border-none px-3 h-6 shadow-sm", req.status === 'Approved' ? 'bg-green-50 text-green-700' : req.status === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right px-8">
                                            {(isPrivileged && req.status === 'Pending') ? (
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" onClick={() => handleApproveRequest(req)} className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-none font-black uppercase text-[8px] tracking-widest px-4 shadow-lg shadow-emerald-600/20">Approve</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => updateDocumentNonBlocking(doc(firestore, 'asset_requests', req.id), { status: 'Rejected' })} className="h-8 rounded-none font-black uppercase text-[8px] tracking-widest px-4 shadow-lg shadow-red-600/20">Reject</Button>
                                                </div>
                                            ) : <span className="text-[9px] font-black uppercase opacity-10">—</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!viewingAsset} onOpenChange={o => !o && setViewingAsset(null)}>
                <DialogContent className="rounded-none sm:max-w-lg p-0 overflow-hidden border-none shadow-3xl">
                    <ScrollArea className="h-full max-h-[90vh]">
                        <div className="aspect-video relative bg-muted">
                            {viewingAsset?.imageUrl ? (
                                <img src={viewingAsset.imageUrl} className="object-cover w-full h-full" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center opacity-10">
                                    <Package className="size-20" />
                                    <p className="text-[10px] font-black uppercase mt-3 tracking-widest">No Image</p>
                                </div>
                            )}
                            <Badge className={cn("absolute top-6 right-6 rounded-none font-black text-[10px] uppercase tracking-widest shadow-2xl border-none h-7 px-4", viewingAsset?.status === 'Available' ? 'bg-emerald-600 text-white' : viewingAsset?.status === 'Assigned' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white')}>
                                {viewingAsset?.status}
                            </Badge>
                        </div>
                        <div className="p-10 space-y-8 bg-white text-left">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">{viewingAsset?.name}</DialogTitle>
                                <DialogDescription className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">{viewingAsset?.category}</DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-6">
                                <div className="p-8 bg-muted/20 rounded-none border-2 border-dashed border-border/50 text-left">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest mb-4 block">Asset Specifications</Label>
                                    <p className="text-sm font-medium italic leading-relaxed text-slate-700">"{viewingAsset?.specs || 'No details registered.'}"</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 bg-primary/5 rounded-none border border-primary/10">
                                        <Label className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Registry ID</Label>
                                        <p className="text-sm font-black font-mono mt-1 uppercase">#ASSET-{viewingAsset?.id.slice(0, 8)}</p>
                                    </div>
                                    <div className="p-5 bg-muted/30 rounded-none border border-border/50">
                                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Mission Class</Label>
                                        <p className="text-sm font-black mt-1 uppercase">{viewingAsset?.category}</p>
                                    </div>
                                </div>
                            </div>

                            <Button onClick={() => setViewingAsset(null)} className="w-full rounded-none h-14 font-black uppercase tracking-widest shadow-2xl transition-all hover:scale-[1.02]">Close Terminal</Button>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    );
}
