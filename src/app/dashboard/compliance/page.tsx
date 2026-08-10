'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ShieldAlert, Plus, Trash2, UserSearch, AlertCircle, FileWarning } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ComplianceReport = {
    id: string;
    employeeId: string;
    employeeName: string;
    filedById: string;
    filedByName: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    reason: string;
    timestamp: any;
};

export default function CompliancePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState<string>("");
    const [severity, setSeverity] = React.useState<string>("Medium");
    const [reason, setReason] = React.useState("");

    const currentUserDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc<any>(currentUserDocRef);
    const userRole = currentUserData?.role;
    const isHR = userRole === 'HR Manager' || userRole === 'CEO/Admin';

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    const reportsQuery = useMemoFirebase(() => query(collection(firestore, 'compliance_reports'), orderBy('timestamp', 'desc')), [firestore]);
    const { data: reports, isLoading } = useCollection<ComplianceReport>(reportsQuery);

    const handleFileReport = () => {
        if (!selectedUserId || !reason || !user || !currentUserData) {
            toast({ variant: 'destructive', title: 'Missing Info' });
            return;
        }

        const targetUser = users?.find(u => u.id === selectedUserId);
        const payload = {
            employeeId: selectedUserId,
            employeeName: `${targetUser.firstName} ${targetUser.lastName}`,
            filedById: user.uid,
            filedByName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            severity,
            reason,
            timestamp: serverTimestamp(),
        };

        addDocumentNonBlocking(collection(firestore, 'compliance_reports'), payload);
        toast({ title: 'Complaint Filed', description: 'The record has been added to the system.' });
        setIsDialogOpen(false);
        setReason("");
        setSelectedUserId("");
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Complaints" description="Manage and track internal complaints and staff issues." />

            {isHR && (
                <div className="flex justify-end">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-none h-11 shadow-lg bg-red-600 hover:bg-red-700 font-black uppercase text-[10px] tracking-widest px-6">
                                <Plus className="mr-2 h-4 w-4" /> File Complaint
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-lg p-8 border-none shadow-3xl">
                            <DialogHeader className="text-left">
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">New Complaint</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Record a staff issue or complaint</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6 text-left">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Employee</Label>
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="rounded-none h-11 bg-muted/20 border-none ring-1 ring-border/50"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {users?.filter(u => u.id !== user?.uid).map(u => (
                                                <SelectItem key={u.id} value={u.id} className="uppercase font-bold text-xs">{u.firstName} {u.lastName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Priority</Label>
                                    <Select value={severity} onValueChange={setSeverity}>
                                        <SelectTrigger className="rounded-none h-11 bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Description</Label>
                                    <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide details..." className="rounded-none min-h-[120px] bg-muted/20 border-none ring-1 ring-border/50" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleFileReport} className="w-full rounded-none h-12 font-black uppercase tracking-widest shadow-xl bg-red-600 hover:bg-red-700 text-white">Save Complaint</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm rounded-none">
                <CardHeader className="bg-muted/10 border-b p-6">
                    <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter text-primary">
                        <FileWarning className="size-5" />
                        Complaints Log
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Date</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">Employee</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">Priority</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">By</TableHead>
                                <TableHead className="text-right font-black uppercase tracking-widest text-[9px] py-4 px-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse font-black uppercase text-xs opacity-20">Scanning...</TableCell></TableRow>
                            ) : reports && reports.length > 0 ? (
                                reports.map(r => (
                                    <TableRow key={r.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                        <TableCell className="py-4 px-6 text-xs font-bold">{r.timestamp ? format(r.timestamp.toDate(), 'MMM d, p') : '...'}</TableCell>
                                        <TableCell className="font-black text-xs uppercase text-slate-800">{r.employeeName}</TableCell>
                                        <TableCell className="py-4">
                                            <Badge className={cn(
                                                "rounded-none text-[8px] uppercase font-black tracking-widest border-none h-6 px-3 shadow-sm",
                                                r.severity === 'Critical' ? "bg-red-600 text-white" :
                                                r.severity === 'High' ? "bg-orange-500 text-white" :
                                                r.severity === 'Medium' ? "bg-yellow-500 text-black" : "bg-blue-500 text-white"
                                            )}>
                                                {r.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 text-[10px] font-bold text-muted-foreground uppercase opacity-60">{r.filedByName}</TableCell>
                                        <TableCell className="text-right py-4 px-6">
                                            {isHR && (
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-red-50 rounded-none h-8 w-8" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'compliance_reports', r.id))}>
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-black text-[10px] uppercase opacity-30">No complaints found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
