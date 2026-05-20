
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useStorage } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { FileBox, Plus, Trash2, ExternalLink, Link as LinkIcon, Edit, UserCircle, Search, FileUp, Loader2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

type DocumentLink = {
    id: string;
    title: string;
    link: string;
    employeeId: string;
    uploadedAt: any;
    sourceType: 'link' | 'file';
    fileName?: string;
};

export default function DocumentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingDoc, setEditingUserDoc] = React.useState<DocumentLink | null>(null);
    const [title, setTitle] = React.useState("");
    const [link, setLink] = React.useState("");
    const [selectedUserId, setSelectedUserId] = React.useState<string>("me");
    const [isUploading, setIsUploading] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<string>("link");

    const currentUserDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc<any>(currentUserDocRef);
    const isPrivileged = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const targetUserId = selectedUserId === 'me' ? user?.uid : selectedUserId;

    const docsQuery = useMemoFirebase(() => {
        if (!targetUserId) return null;
        return query(collection(firestore, `users/${targetUserId}/documents`), orderBy('uploadedAt', 'desc'));
    }, [firestore, targetUserId]);

    const { data: documents, isLoading } = useCollection<DocumentLink>(docsQuery);

    const handleSaveDocument = async () => {
        if (!title || (!link && activeTab === 'link') || !user) {
            toast({ variant: 'destructive', title: 'Missing Information' });
            return;
        }

        const payload = {
            title,
            link: activeTab === 'link' ? link : link, // link state stores URL for both
            employeeId: targetUserId,
            uploadedAt: serverTimestamp(),
            sourceType: activeTab as 'link' | 'file',
        };

        if (editingDoc) {
            updateDocumentNonBlocking(doc(firestore, `users/${targetUserId}/documents`, editingDoc.id), payload);
            toast({ title: 'Document Updated' });
        } else {
            addDocumentNonBlocking(collection(firestore, `users/${targetUserId}/documents`), payload);
            toast({ title: 'Document Asset Synchronized' });
        }

        setIsDialogOpen(false);
        resetForm();
    };

    const handleFileUpload = async (file: File) => {
        if (!user || !storage) return;
        setIsUploading(true);
        try {
            const fileRef = ref(storage, `documents/${user.uid}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setLink(url);
            if (!title) setTitle(file.name);
            toast({ title: "Asset Transmitted", description: "File uploaded to secure vault." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Transmission Failed", description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setLink("");
        setEditingUserDoc(null);
        setActiveTab("link");
    };

    const handleEdit = (docLink: DocumentLink) => {
        setEditingUserDoc(docLink);
        setTitle(docLink.title);
        setLink(docLink.link);
        setActiveTab(docLink.sourceType || "link");
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Digital Document Vault" description="Manage and audit professional cloud asset links and secure file uploads.">
                <div className="flex gap-2">
                    {isPrivileged && (
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="w-[220px] rounded-full h-11 bg-white/50">
                                <Search className="size-4 mr-2 opacity-50" />
                                <SelectValue placeholder="Filter Fleet" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="me">My Documents</SelectItem>
                                {users?.filter(u => u.id !== user?.uid).map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if(!o) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full h-11 shadow-lg">
                                <Plus className="mr-2 h-4 w-4" /> Submit Asset
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                                    {editingDoc ? 'Update Digital Asset' : 'Sync New Document'}
                                </DialogTitle>
                                <DialogDescription>Provision professional intelligence to the secure fleet vault.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Asset Title</Label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Q4 Performance Portfolio" className="rounded-xl h-11" />
                                </div>

                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-muted/30 p-1">
                                        <TabsTrigger value="link" className="text-[10px] font-black uppercase rounded-lg">Cloud Link</TabsTrigger>
                                        <TabsTrigger value="file" className="text-[10px] font-black uppercase rounded-lg">File Upload</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="link" className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Repository URL</Label>
                                            <div className="flex gap-2">
                                                <LinkIcon className="size-5 mt-3 text-muted-foreground shrink-0" />
                                                <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..." className="rounded-xl h-11" />
                                            </div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="file" className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Secure Upload</Label>
                                            <div className="relative group">
                                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} disabled={isUploading} />
                                                <Button variant="outline" className="w-full h-14 rounded-xl border-dashed border-primary/40 font-bold uppercase text-[10px] gap-2" disabled={isUploading}>
                                                    {isUploading ? <Loader2 className="size-4 animate-spin"/> : <FileUp className="size-4" />}
                                                    {link ? "Asset Selected (Click to change)" : "Select Professional Asset"}
                                                </Button>
                                            </div>
                                            {link && activeTab === 'file' && <p className="text-[9px] text-green-600 font-bold uppercase text-center mt-2">File verified and ready for sync.</p>}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSaveDocument} disabled={isUploading || !link} className="w-full rounded-full h-12 font-black uppercase shadow-xl shadow-primary/20">Authorize Sync</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </PageHeader>

            <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-headline flex items-center gap-2">
                            <FileBox className="size-5 text-primary" />
                            Tactical Asset Registry
                        </CardTitle>
                        <CardDescription>Consolidated record of linked and uploaded professional documentation.</CardDescription>
                    </div>
                    {selectedUserId !== 'me' && (
                        <Button variant="outline" size="sm" className="rounded-full font-bold uppercase text-[10px]" asChild>
                            <Link href={`/dashboard/users/${selectedUserId}`}>
                                <UserCircle className="size-3.5 mr-1.5" /> View Fleet Profile
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Asset Title</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Linked At</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Intelligence Source</TableHead>
                                <TableHead className="text-right font-black uppercase tracking-tighter text-[10px] py-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse font-bold uppercase text-xs text-muted-foreground">Scanning Vault Registry...</TableCell></TableRow>
                            ) : documents && documents.length > 0 ? (
                                documents.map(d => (
                                    <TableRow key={d.id} className="border-border/50 group">
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/5 text-primary">
                                                    {d.sourceType === 'file' ? <FileText className="size-4" /> : <LinkIcon className="size-4" />}
                                                </div>
                                                <p className="font-bold text-sm group-hover:text-primary transition-colors">{d.title}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="font-medium text-xs text-muted-foreground">{d.uploadedAt ? format(d.uploadedAt.toDate(), 'MMM d, p') : '...'}</span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Badge variant="outline" className={cn(
                                                "rounded-full text-[9px] uppercase font-black tracking-widest bg-white gap-1",
                                                d.sourceType === 'file' ? "text-purple-600 border-purple-200" : "text-blue-600 border-blue-200"
                                            )}>
                                                {d.sourceType === 'file' ? <ShieldCheck className="size-2" /> : <ExternalLink className="size-2" />}
                                                {d.sourceType === 'file' ? "Secure-File" : "Cloud-Base"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="text-blue-600 rounded-full h-8 w-8" asChild>
                                                    <Link href={d.link} target="_blank"><ExternalLink className="size-4" /></Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full h-8 w-8" onClick={() => handleEdit(d)}>
                                                    <Edit className="size-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive rounded-full h-8 w-8" onClick={() => deleteDocumentNonBlocking(doc(firestore, `users/${targetUserId}/documents`, d.id))}>
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No digital assets synchronized in this sector.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
