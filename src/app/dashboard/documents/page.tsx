
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { FileBox, Plus, Trash2, ExternalLink, Link as LinkIcon, Edit, UserCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

type DocumentLink = {
    id: string;
    title: string;
    link: string;
    employeeId: string;
    uploadedAt: any;
};

export default function DocumentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingDoc, setEditingUserDoc] = React.useState<DocumentLink | null>(null);
    const [title, setTitle] = React.useState("");
    const [link, setLink] = React.useState("");
    const [selectedUserId, setSelectedUserId] = React.useState<string>("me");

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

    const handleSaveDocument = () => {
        if (!title || !link || !user) {
            toast({ variant: 'destructive', title: 'Missing Information' });
            return;
        }

        const payload = {
            title,
            link,
            employeeId: targetUserId,
            uploadedAt: serverTimestamp(),
        };

        if (editingDoc) {
            updateDocumentNonBlocking(doc(firestore, `users/${targetUserId}/documents`, editingDoc.id), payload);
            toast({ title: 'Document Updated' });
        } else {
            addDocumentNonBlocking(collection(firestore, `users/${targetUserId}/documents`), payload);
            toast({ title: 'Document Link Submitted' });
        }

        setIsDialogOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setTitle("");
        setLink("");
        setEditingUserDoc(null);
    };

    const handleEdit = (docLink: DocumentLink) => {
        setEditingUserDoc(docLink);
        setTitle(docLink.title);
        setLink(docLink.link);
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Digital Document Vault" description="Manage and audit professional cloud asset links.">
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
                        <DialogContent className="rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                                    {editingDoc ? 'Update Digital Asset' : 'Sync New Document'}
                                </DialogTitle>
                                <DialogDescription>Provide a descriptive title and the cloud repository link.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Asset Title</Label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Performance Portfolio Q4" className="rounded-xl h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Cloud Link (Drive/Dropbox)</Label>
                                    <div className="flex gap-2">
                                        <LinkIcon className="size-5 mt-3 text-muted-foreground" />
                                        <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/..." className="rounded-xl h-11" />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSaveDocument} className="w-full rounded-full h-12 font-black uppercase shadow-xl shadow-primary/20">Authorize Sync</Button>
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
                        <CardDescription>Consolidated record of linked professional documentation.</CardDescription>
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
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Source</TableHead>
                                <TableHead className="text-right font-black uppercase tracking-tighter text-[10px] py-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse font-bold uppercase text-xs">Scanning Vault...</TableCell></TableRow>
                            ) : documents && documents.length > 0 ? (
                                documents.map(d => (
                                    <TableRow key={d.id} className="border-border/50 group">
                                        <TableCell className="py-4">
                                            <p className="font-bold text-sm group-hover:text-primary transition-colors">{d.title}</p>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <span className="font-medium text-xs text-muted-foreground">{d.uploadedAt ? format(d.uploadedAt.toDate(), 'MMM d, p') : '...'}</span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Badge variant="outline" className="rounded-full text-[9px] uppercase font-black tracking-widest bg-white">
                                                <ExternalLink className="size-2 mr-1" /> Cloud-Base
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="text-blue-600" asChild>
                                                    <Link href={d.link} target="_blank"><ExternalLink className="size-4" /></Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => handleEdit(d)}>
                                                    <Edit className="size-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, `users/${targetUserId}/documents`, d.id))}>
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
