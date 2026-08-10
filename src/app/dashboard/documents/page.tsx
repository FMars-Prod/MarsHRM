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
    authorizedUids?: string[];
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
    
    const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
    const [isFolderDialogOpen, setIsFolderDialogOpen] = React.useState(false);
    const [isAssetDialogOpen, setIsAssetDialogOpen] = React.useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);

    const [folderName, setFolderName] = React.useState("");
    const [folderColor, setFolderColor] = React.useState<FolderData['color']>('blue');
    const [assetTitle, setAssetTitle] = React.useState("");
    const [assetLink, setAssetLink] = React.useState("");
    const [activeTab, setActiveTab] = React.useState<string>("link");
    const [isUploading, setIsUploading] = React.useState(false);
    
    const [isInvoice, setIsInvoice] = React.useState(false);
    const [selectedClientId, setSelectedClientId] = React.useState("");

    const [sharingFolder, setSharingFolder] = React.useState<FolderData | null>(null);
    const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
    const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<any>(userDocRef);
    const userRole = userData?.role;
    const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: allTeams } = useCollection<any>(teamsQuery);
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: allUsers } = useCollection<any>(usersQuery);
    const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')), [firestore]);
    const { data: clients } = useCollection<any>(clientsQuery);

    const foldersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'folders'), orderBy('createdAt', 'desc'));
    }, [firestore, user]);
    const { data: rawFolders, isLoading: foldersLoading } = useCollection<FolderData>(foldersQuery);

    const assetsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'vault_assets'), orderBy('uploadedAt', 'desc'));
    }, [firestore, user]);
    const { data: rawAssets, isLoading: assetsLoading } = useCollection<VaultAsset>(assetsQuery);

    const filteredFolders = React.useMemo(() => {
        if (!rawFolders || !user || !userData) return [];
        return rawFolders.filter(f => {
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
        toast({ title: 'Folder Created' });
        setIsFolderDialogOpen(false);
        setFolderName("");
    };

    const handleSaveAsset = async () => {
        if (!assetTitle || (!assetLink && activeTab === 'link') || !user || !userData || !isPrivileged) {
            toast({ variant: 'destructive', title: 'Error', description: 'Fill all required fields.' });
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
        toast({ title: isInvoice ? 'Invoice Saved' : 'Document Saved' });
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
            toast({ title: "File Uploaded" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Upload Failed", description: error.message });
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
        toast({ title: "Sharing Updated" });
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
            <PageHeader title="Documents" description="Store and manage company documents and invoices.">
                <div className="flex gap-2">
                    {isPrivileged ? (
                        <>
                            {!currentFolderId && (
                                <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-none h-11 bg-white shadow-sm ring-1 ring-border/50">
                                            <FolderPlus className="size-4 mr-2" /> New Folder
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-none sm:max-w-md p-8">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black uppercase tracking-tighter">Create Folder</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-6 py-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Folder Name</Label>
                                                <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="e.g., Marketing Files" className="rounded-none h-11" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-primary">Color</Label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {(Object.keys(FOLDER_COLORS) as Array<keyof typeof FOLDER_COLORS>).map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setFolderColor(c)}
                                                            className={cn(
                                                                "h-10 rounded-none transition-all border-2",
                                                                folderColor === c ? "border-primary scale-105" : "border-transparent",
                                                                FOLDER_COLORS[c].split(' ')[0]
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCreateFolder} className="w-full rounded-none h-12 font-black uppercase shadow-xl shadow-primary/20">Create Folder</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="rounded-none h-11 shadow-lg font-black uppercase text-[10px] tracking-widest px-6">
                                        <Plus className="size-4 mr-2" /> Add Document
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-none sm:max-w-md p-0 overflow-hidden">
                                    <DialogHeader className="p-8 border-b bg-white">
                                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Add Document</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-6 p-8 bg-muted/5">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-primary">Document Title</Label>
                                            <Input value={assetTitle} onChange={e => setAssetTitle(e.target.value)} placeholder="e.g., Project PDF" className="rounded-none h-11" />
                                        </div>
                                        
                                        <div className="p-4 bg-white ring-1 ring-border rounded-none flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-xs font-black uppercase">Is this an Invoice?</Label>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Restrict to Admin only</p>
                                            </div>
                                            <Switch checked={isInvoice} onCheckedChange={setIsInvoice} />
                                        </div>

                                        {isInvoice && (
                                            <div className="space-y-2 animate-fade-in-up">
                                                <Label className="text-[10px] font-black uppercase text-primary">Select Client</Label>
                                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                                    <SelectTrigger className="rounded-none h-11"><SelectValue placeholder="Which client?" /></SelectTrigger>
                                                    <SelectContent className="rounded-none">
                                                        {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 h-11 rounded-none bg-muted/30 p-1">
                                                <TabsTrigger value="link" className="text-[10px] font-black uppercase rounded-none">Link</TabsTrigger>
                                                <TabsTrigger value="file" className="text-[10px] font-black uppercase rounded-none">Upload File</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="link" className="pt-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">URL</Label>
                                                    <Input value={assetLink} onChange={e => setAssetLink(e.target.value)} placeholder="https://..." className="rounded-none h-11" />
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="file" className="pt-4 space-y-4">
                                                <div className="relative group">
                                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={isUploading} />
                                                    <Button variant="outline" className="w-full h-14 rounded-none border-dashed border-primary/40 font-bold uppercase text-[10px] gap-2" disabled={isUploading}>
                                                        {isUploading ? <Loader2 className="size-4 animate-spin"/> : <FileUp className="size-4" />}
                                                        {assetLink && activeTab === 'file' ? "File Selected" : "Select File"}
                                                    </Button>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                    <DialogFooter className="p-8 border-t bg-white">
                                        <Button onClick={handleSaveAsset} disabled={isUploading || !assetLink || (isInvoice && !selectedClientId)} className="w-full rounded-none h-12 font-black uppercase shadow-xl shadow-primary/20">Save Document</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-full border border-amber-100 shadow-sm animate-fade-in-up">
                            <AlertCircle className="size-4 text-amber-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">View Only</span>
                        </div>
                    )}
                </div>
            </PageHeader>

            <div className="flex items-center gap-2 px-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn("rounded-none text-[10px] font-black uppercase tracking-widest", !currentFolderId && "text-primary")}
                    onClick={() => setCurrentFolderId(null)}
                >
                    Documents
                </Button>
                {currentFolderId && (
                    <>
                        <ChevronRight className="size-3 opacity-30" />
                        <Badge variant="secondary" className="rounded-none px-3 py-1 font-black text-[10px] uppercase bg-primary/10 text-primary border-none">
                            {currentFolder?.name}
                        </Badge>
                        <Separator className="flex-1 opacity-0" />
                        <Button variant="ghost" size="icon" onClick={() => setCurrentFolderId(null)} className="h-8 w-8 rounded-none hover:bg-primary/5">
                            <ArrowLeft className="size-4" />
                        </Button>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {!currentFolderId && displayFolders.map(f => {
                    const assetCount = rawAssets?.filter(a => a.folderId === f.id).length || 0;
                    return (
                        <Card 
                            key={f.id} 
                            className="group border-none ring-1 ring-border/50 shadow-sm hover:shadow-xl transition-all duration-300 rounded-none overflow-hidden cursor-pointer bg-white"
                            onClick={() => setCurrentFolderId(f.id)}
                        >
                            <div className={cn("h-12 flex items-end justify-between px-6", FOLDER_COLORS[f.color] || FOLDER_COLORS.blue)}>
                                <div className="w-16 h-4 bg-white/40 rounded-t-lg" />
                                <Badge variant="secondary" className="mb-2 rounded-none px-2 py-0 h-5 font-black text-[8px] uppercase tracking-widest bg-white/50 border-none flex gap-1 items-center">
                                    <Files className="size-2" />
                                    {assetCount}
                                </Badge>
                            </div>
                            <CardHeader className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-black uppercase tracking-tighter truncate max-w-[180px]">{f.name}</CardTitle>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Date: {format(f.createdAt?.toDate() || new Date(), 'dd MMM yyyy')}</p>
                                    </div>
                                    {isPrivileged && (
                                        <div className="flex items-center gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-none opacity-0 group-hover:opacity-100 transition-opacity" 
                                                onClick={(e) => { e.stopPropagation(); setSharingFolder(f); setSelectedTeamIds(f.sharedWithTeams || []); setSelectedUserIds(f.sharedWithUids || []); setIsShareDialogOpen(true); }}
                                            >
                                                <Share2 className="size-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={(e) => { e.stopPropagation(); deleteDocumentNonBlocking(doc(firestore, 'folders', f.id)); }}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-0 flex items-center justify-between">
                                <div className="flex -space-x-1">
                                    <div className="size-6 rounded-none bg-primary/20 flex items-center justify-center text-[10px] font-black border-2 border-white ring-1 ring-border/50">{f.ownerName[0]}</div>
                                    {(f.sharedWithUids?.length || 0) > 0 && <div className="size-6 rounded-none bg-muted flex items-center justify-center text-[10px] font-black border-2 border-white ring-1 ring-border/50">+{f.sharedWithUids.length}</div>}
                                </div>
                                <Folder className="size-5 opacity-20" />
                            </CardContent>
                        </Card>
                    );
                })}

                {displayAssets.map(a => (
                    <Card key={a.id} className="group border-none ring-1 ring-border/50 shadow-sm hover:shadow-md transition-all rounded-none bg-white overflow-hidden">
                        <CardHeader className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-none", a.isInvoice ? "bg-emerald-50 text-emerald-600" : a.sourceType === 'file' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600")}>
                                    {a.isInvoice ? <ReceiptIndianRupee className="size-5" /> : a.sourceType === 'file' ? <FileText className="size-5" /> : <LinkIcon className="size-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-sm font-bold truncate">{a.title}</CardTitle>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                        {a.isInvoice ? `Invoice: ${a.clientName}` : a.sourceType === 'file' ? 'File' : 'Link'}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 pt-0 space-y-4">
                            <div className="p-3 bg-muted/20 rounded-none border border-dashed border-border/50 space-y-2">
                                <div className="flex justify-between items-center text-[8px] font-black uppercase text-muted-foreground">
                                    <span>By: {a.ownerName}</span>
                                    <span>{format(a.uploadedAt?.toDate() || new Date(), 'dd MMM')}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button asChild className="flex-1 rounded-none h-10 font-bold uppercase text-[9px] tracking-widest shadow-sm">
                                    <Link href={a.link} target="_blank" download={a.sourceType === 'file'}>
                                        {a.sourceType === 'file' ? <Download className="size-3 mr-2" /> : <ExternalLink className="size-3 mr-2" />}
                                        {a.sourceType === 'file' ? 'Download' : 'Open'}
                                    </Link>
                                </Button>
                                {isPrivileged && (
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none text-destructive hover:bg-red-50" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'vault_assets', a.id))}>
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {(foldersLoading || assetsLoading) && [...Array(4)].map((_, i) => (
                    <Card key={i} className="h-48 rounded-none bg-muted animate-pulse border-none shadow-none" />
                ))}

                {!foldersLoading && !assetsLoading && displayFolders.length === 0 && displayAssets.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-30">
                        <Folder className="size-16 mb-4" />
                        <p className="font-black uppercase text-xs tracking-[0.3em]">No documents found</p>
                    </div>
                )}
            </div>

            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogContent className="rounded-none sm:max-w-md p-8 border-none shadow-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Share Folder</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] py-4">
                        <div className="space-y-8 px-1">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Users className="size-3" /> Teams</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allTeams?.map(t => (
                                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-none bg-muted/20 hover:bg-muted/40 transition-colors border border-border/50">
                                            <Checkbox id={`team-${t.id}`} checked={selectedTeamIds.includes(t.id)} onCheckedChange={c => setSelectedTeamIds(prev => c ? [...prev, t.id] : prev.filter(id => id !== t.id))} />
                                            <Label htmlFor={`team-${t.id}`} className="font-bold text-xs uppercase cursor-pointer flex-1">{t.name}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Separator className="opacity-50" />
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><UserCircle className="size-3" /> People</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allUsers?.filter(u => u.id !== user?.uid).map(u => (
                                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-none bg-muted/20 hover:bg-muted/40 transition-colors border border-border/50">
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
                        <Button onClick={handleUpdateSharing} className="w-full rounded-none h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Save Sharing</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
