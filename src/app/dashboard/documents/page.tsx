'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useStorage } from '@/firebase';
import { collection, query, orderBy, doc, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FolderPlus, Plus, Trash2, ExternalLink, Link as LinkIcon, Edit, UserCircle, Search, FileUp, Loader2, FileText, ShieldCheck, ChevronRight, Folder, Download, Users, Share2, ArrowLeft, Files, AlertCircle, ReceiptIndianRupee } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

type FolderData = {
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    color: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose';
    sharedWithTeams: string[];
    sharedWithUids: string[];
    createdAt: any;
};

type VaultAsset = {
    id: string;
    folderId: string | null;
    ownerId: string;
    ownerName: string;
    title: string;
    link: string;
    uploadedAt: any;
    sourceType: 'link' | 'file';
    fileName?: string;
    isInvoice?: boolean;
    clientId?: string;
    clientName?: string;
    authorizedUids?: string[]; // Specifically for Project Heads/Admins
};

const FOLDER_COLORS = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-700',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-700',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-700',
};

export default function DocumentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    // Navigation State
    const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);

    // Dialog States
    const [isFolderDialogOpen, setIsFolderDialogOpen] = React.useState(false);
    const [isAssetDialogOpen, setIsAssetDialogOpen] = React.useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);

    // Form States
    const [folderName, setFolderName] = React.useState("");
    const [folderColor, setFolderColor] = React.useState<FolderData['color']>('blue');
    const [assetTitle, setAssetTitle] = React.useState("");
    const [assetLink, setAssetLink] = React.useState("");
    const [activeTab, setActiveTab] = React.useState<string>("link");
    const [isUploading, setIsUploading] = React.useState(false);
    
    // Invoice State
    const [isInvoice, setIsInvoice] = React.useState(false);
    const [selectedClientId, setSelectedClientId] = React.useState("");

    // Sharing States
    const [sharingFolder, setSharingFolder] = React.useState<FolderData | null>(null);
    const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    // Fetch Global Data for Selection
    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: clients } = useCollection<any>(clientsQuery);

    // Fetch Folders
    const foldersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'folders'), orderBy('createdAt', 'desc'));
    }, [firestore, user]);
    const { data: rawFolders, isLoading: foldersLoading } = useCollection<FolderData>(foldersQuery);

    // Fetch Assets
    const assetsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'vault_assets'), orderBy('uploadedAt', 'desc'));
    }, [firestore, user]);
    const { data: rawAssets, isLoading: assetsLoading } = useCollection<VaultAsset>(assetsQuery);

    // Local Filtering for permissions and current path
    const filteredFolders = React.useMemo(() => {
        if (!rawFolders || !user || !userData) return [];
        return rawFolders.filter(f => {
            // ADMINS see everything. OTHERS see only what is shared with them or their team.
            const isSharedWithMe = f.sharedWithUids?.includes(user.uid);
            const isSharedWithMyTeam = userData.teamId && f.sharedWithTeams?.includes(userData.teamId);
            return isPrivileged || isSharedWithMe || isSharedWithMyTeam;
        });
    }, [rawFolders, user, userData, isPrivileged]);

    const displayFolders = React.useMemo(() => {
        if (currentFolderId) return [];
        return filteredFolders;
    }, [filteredFolders, currentFolderId]);

    const displayAssets = React.useMemo(() => {
        if (!rawAssets || !user) return [];
        const folderFiltered = rawAssets.filter(a => a.folderId === currentFolderId);
        
        return folderFiltered.filter(a => {
            if (isPrivileged) return true;
            if (a.ownerId === user.uid) return true;
            if (a.isInvoice && a.authorizedUids?.includes(user.uid)) return true;
            
            // If in a folder, permission is inherited from folder (handled by displayFolders navigation)
            // but we double check for safety in the final list
            return true; 
        });
    }, [rawAssets, currentFolderId, isPrivileged, user]);

    const currentFolder = React.useMemo(() => {
        return rawFolders?.find(f => f.id === currentFolderId);
    }, [rawFolders, currentFolderId]);

    const handleCreateFolder = async () => {
        if (!folderName.trim() || !user || !userData || !isPrivileged) return;
        const payload = {
            name: folderName,
            color: folderColor,
            ownerId: user.uid,
            ownerName: `${userData.firstName} ${userData.lastName}`,
            sharedWithTeams: [],
            sharedWithUids: [],
            createdAt: serverTimestamp(),
        };
        await addDocumentNonBlocking(collection(firestore, 'folders'), payload);
        toast({ title: 'Tactical Folder Provisioned' });
        setIsFolderDialogOpen(false);
        setFolderName("");
    };

    const handleSaveAsset = async () => {
        if (!assetTitle || (!assetLink && activeTab === 'link') || !user || !userData || !isPrivileged) {
            toast({ variant: 'destructive', title: 'Action Restricted', description: 'Administrative authorization required.' });
            return;
        }

        const client = clients?.find(c => c.id === selectedClientId);
        const authorizedUids = [];
        if (isInvoice && client) {
            if (client.productHeadId) authorizedUids.push(client.productHeadId);
            if (client.handlingEmployeeId) authorizedUids.push(client.handlingEmployeeId);
        }

        const payload: Partial<VaultAsset> = {
            folderId: currentFolderId,
            ownerId: user.uid,
            ownerName: `${userData.firstName} ${userData.lastName}`,
            title: assetTitle,
            link: assetLink,
            uploadedAt: serverTimestamp(),
            sourceType: activeTab as 'link' | 'file',
            isInvoice,
            clientId: isInvoice ? selectedClientId : null,
            clientName: isInvoice ? client?.companyName : null,
            authorizedUids: isInvoice ? authorizedUids : []
        };

        await addDocumentNonBlocking(collection(firestore, 'vault_assets'), payload);
        toast({ title: isInvoice ? 'Client Invoice Logged' : 'Mission Asset Synchronized' });
        setIsAssetDialogOpen(false);
        resetAssetForm();
    };

    const handleFileUpload = async (file: File) => {
        if (!user || !storage || !isPrivileged) return;
        setIsUploading(true);
        try {
            const fileRef = ref(storage, `vault/${user.uid}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setAssetLink(url);
            if (!assetTitle) setAssetTitle(file.name);
            toast({ title: "Binary Transmitted", description: "File encrypted and stored." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Transmission Failed", description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateSharing = async () => {
        if (!sharingFolder || !isPrivileged) return;
        const folderRef = doc(firestore, 'folders', sharingFolder.id);
        await updateDocumentNonBlocking(folderRef, {
            sharedWithTeams: selectedTeamIds,
            sharedWithUids: selectedUserIds
        });
        toast({ title: "Fleet Access Updated" });
        setIsShareDialogOpen(false);
    };

    const resetAssetForm = () => {
        setAssetTitle("");
        setAssetLink("");
        setActiveTab("link");
        setIsInvoice(false);
        setSelectedClientId("");
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <PageHeader title="Digital Document Vault" description="Manage secure project folders and audited client invoices.">
                <div className="flex gap-2">
                    {isPrivileged ? (
                        <>
                            {!currentFolderId && (
                                <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-full h-11 bg-white/50 border-none ring-1 ring-border/50 shadow-sm">
                                            <FolderPlus className="size-4 mr-2" /> New Folder
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-3xl sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black uppercase tracking-tighter">Create Tactical Folder</DialogTitle>
                                            <DialogDescription>Establish a new intelligence container.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-6 py-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Project Designation</Label>
                                                <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="e.g., Project Alpha Development" className="rounded-xl h-11" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Visual Identity</Label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {(Object.keys(FOLDER_COLORS) as Array<keyof typeof FOLDER_COLORS>).map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setFolderColor(c)}
                                                            className={cn(
                                                                "h-10 rounded-xl transition-all border-2",
                                                                folderColor === c ? "border-primary scale-105" : "border-transparent",
                                                                FOLDER_COLORS[c].split(' ')[0]
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCreateFolder} className="w-full rounded-full h-12 font-black uppercase shadow-xl shadow-primary/20">Initialize Container</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="rounded-full h-11 shadow-lg">
                                        <Plus className="size-4 mr-2" /> Submit Asset
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black uppercase tracking-tighter">Sync Mission Intelligence</DialogTitle>
                                        <DialogDescription>
                                            {currentFolderId ? `Uploading to Sector: ${currentFolder?.name}` : "Global Asset Upload"}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-6 py-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary">Asset Title</Label>
                                            <Input value={assetTitle} onChange={e => setAssetTitle(e.target.value)} placeholder="e.g., Tactical Briefing PDF" className="rounded-xl h-11" />
                                        </div>
                                        
                                        <div className="p-4 bg-muted/20 rounded-2xl flex items-center justify-between border border-dashed">
                                            <div className="space-y-0.5">
                                                <Label className="text-xs font-black uppercase">Client Invoice?</Label>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Restrict to Admin & Project Head</p>
                                            </div>
                                            <Switch checked={isInvoice} onCheckedChange={setIsInvoice} />
                                        </div>

                                        {isInvoice && (
                                            <div className="space-y-2 animate-fade-in-up">
                                                <Label className="text-[10px] font-black uppercase text-primary">Target Client</Label>
                                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select Client Account" /></SelectTrigger>
                                                    <SelectContent>
                                                        {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted/30 p-1">
                                                <TabsTrigger value="link" className="text-[10px] font-black uppercase rounded-lg">Cloud Link</TabsTrigger>
                                                <TabsTrigger value="file" className="text-[10px] font-black uppercase rounded-lg">Binary Upload</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="link" className="pt-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Repository URL</Label>
                                                    <Input value={assetLink} onChange={e => setAssetLink(e.target.value)} placeholder="https://drive.google.com/..." className="rounded-xl h-11" />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="file" className="pt-4 space-y-4">
                                                <div className="relative group">
                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={isUploading} />
                                                    <Button variant="outline" className="w-full h-14 rounded-xl border-dashed border-primary/40 font-bold uppercase text-[10px] gap-2" disabled={isUploading}>
                                                        {isUploading ? <Loader2 className="size-4 animate-spin"/> : <FileUp className="size-4" />}
                                                        {assetLink && activeTab === 'file' ? "Asset Selected" : "Select Binary Mission Data"}
                                                    </Button>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleSaveAsset} disabled={isUploading || !assetLink || (isInvoice && !selectedClientId)} className="w-full rounded-full h-12 font-black uppercase">Finalize Synchronization</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-full border border-amber-100 shadow-sm animate-fade-in-up">
                            <AlertCircle className="size-4 text-amber-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Audit Only</span>
                        </div>
                    )}
                </div>
            </PageHeader>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 px-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("rounded-full text-[10px] font-black uppercase tracking-widest", !currentFolderId && "text-primary")}
                    onClick={() => setCurrentFolderId(null)}
                >
                    Tactical Vault
                </Button>
                {currentFolderId && (
                    <>
                        <ChevronRight className="size-3 opacity-30" />
                        <Badge variant="secondary" className="rounded-full px-3 py-1 font-black text-[10px] uppercase bg-primary/10 text-primary border-none">
                            {currentFolder?.name} Sector
                        </Badge>
                        <Separator className="flex-1 opacity-0" />
                        <Button variant="ghost" size="icon" onClick={() => setCurrentFolderId(null)} className="h-8 w-8 rounded-full hover:bg-primary/5">
                            <ArrowLeft className="size-4" />
                        </Button>
                    </>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {!currentFolderId && displayFolders.map(f => {
                    const assetCount = rawAssets?.filter(a => a.folderId === f.id).length || 0;
                    return (
                        <Card 
                            key={f.id} 
                            className="group border-none ring-1 ring-border/50 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden cursor-pointer bg-white"
                            onClick={() => setCurrentFolderId(f.id)}
                        >
                            <div className={cn("h-12 flex items-end justify-between px-6", FOLDER_COLORS[f.color] || FOLDER_COLORS.blue)}>
                                <div className="w-16 h-4 bg-white/40 rounded-t-xl" />
                                <Badge variant="secondary" className="mb-2 rounded-full px-2 py-0 h-5 font-black text-[8px] uppercase tracking-widest bg-white/50 border-none flex gap-1 items-center">
                                    <Files className="size-2" />
                                    {assetCount}
                                </Badge>
                            </div>
                            <CardHeader className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter truncate max-w-[180px]">{f.name}</CardTitle>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Modified: {format(f.createdAt?.toDate() || new Date(), 'dd MMM yyyy')}</p>
                                    </div>
                                    {isPrivileged && (
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                                                onClick={(e) => { e.stopPropagation(); setSharingFolder(f); setSelectedTeamIds(f.sharedWithTeams || []); setSelectedUserIds(f.sharedWithUids || []); setIsShareDialogOpen(true); }}
                                            >
                                                <Share2 className="size-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={(e) => { e.stopPropagation(); deleteDocumentNonBlocking(doc(firestore, 'folders', f.id)); }}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-0 flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black border-2 border-white ring-1 ring-border/50">{f.ownerName[0]}</div>
                                    {(f.sharedWithUids?.length || 0) > 0 && <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black border-2 border-white ring-1 ring-border/50">+{f.sharedWithUids.length}</div>}
                                </div>
                                <Folder className="size-5 opacity-20" />
                            </CardContent>
                        </Card>
                    );
                })}

                {displayAssets.map(a => (
                    <Card key={a.id} className="group border-none ring-1 ring-border/50 shadow-sm hover:shadow-md transition-all rounded-[2rem] bg-white overflow-hidden">
                        <CardHeader className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-2xl", a.isInvoice ? "bg-emerald-50 text-emerald-600" : a.sourceType === 'file' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                                    {a.isInvoice ? <ReceiptIndianRupee className="size-5" /> : a.sourceType === 'file' ? <FileText className="size-5" /> : <LinkIcon className="size-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-sm font-bold truncate">{a.title}</CardTitle>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                        {a.isInvoice ? `Invoice: ${a.clientName}` : a.sourceType === 'file' ? 'Secure File' : 'Cloud Link'}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-0 space-y-4">
                            <div className="p-3 bg-muted/20 rounded-2xl border border-dashed border-border/50 space-y-2">
                                <div className="flex justify-between items-center text-[8px] font-black uppercase text-muted-foreground">
                                    <span>Source: {a.ownerName}</span>
                                    <span>{format(a.uploadedAt?.toDate() || new Date(), 'dd/MM/yy')}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild className="flex-1 rounded-xl h-10 font-bold uppercase text-[9px] tracking-widest">
                                    <Link href={a.link} target="_blank" download={a.sourceType === 'file'}>
                                        {a.sourceType === 'file' ? <Download className="size-3 mr-2" /> : <ExternalLink className="size-3 mr-2" />}
                                        {a.sourceType === 'file' ? 'Download' : 'Access Link'}
                                    </Link>
                                </Button>
                                {isPrivileged && (
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:bg-red-50" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'vault_assets', a.id))}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {(foldersLoading || assetsLoading) && [...Array(4)].map((_, i) => (
                    <Card key={i} className="h-48 rounded-[2rem] bg-muted animate-pulse border-none shadow-none" />
                ))}

                {!foldersLoading && !assetsLoading && displayFolders.length === 0 && displayAssets.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-30">
                        <Folder className="size-16 mb-4" />
                        <p className="font-black uppercase text-xs tracking-[0.3em]">Operational Grid Clear</p>
                    </div>
                )}
            </div>

            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Fleet Distribution Protocol</DialogTitle>
                        <DialogDescription>Select tactical teams or specific officials.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] py-4">
                        <div className="space-y-8 px-1">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Users className="size-3" /> Team Authorization</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allTeams?.map(t => (
                                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/50">
                                            <Checkbox id={`team-${t.id}`} checked={selectedTeamIds.includes(t.id)} onCheckedChange={c => setSelectedTeamIds(prev => c ? [...prev, t.id] : prev.filter(id => id !== t.id))} />
                                            <Label htmlFor={`team-${t.id}`} className="font-bold text-xs uppercase cursor-pointer flex-1">{t.name}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Separator className="opacity-50" />
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle className="size-3" /> Personnel Access</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors border border-border/50">
                                            <Checkbox id={`user-${u.id}`} checked={selectedUserIds.includes(u.id)} onCheckedChange={c => setSelectedUserIds(prev => c ? [...prev, u.id] : prev.filter(id => id !== u.id))} />
                                            <div className="flex-1 cursor-pointer" onClick={() => setSelectedUserIds(prev => selectedUserIds.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}>
                                                <p className="font-bold text-xs uppercase">{u.firstName} {u.lastName}</p>
                                                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">{u.jobTitle}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button onClick={handleUpdateSharing} className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Authorize Distribution</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
