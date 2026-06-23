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
            toast({ variant: 'destructive', title: 'Missing Information' });
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
        toast({ title: 'Compliance Report Filed', description: 'The CEO has been notified of this high-priority alert.' });
        setIsDialogOpen(false);
        setReason("");
        setSelectedUserId("");
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Compliance Matrix" description="Internal oversight and professional standards auditing.">
                {isHR && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full h-11 shadow-lg bg-red-600 hover:bg-red-700">
                                <Plus className="mr-2 h-4 w-4" /> File Protocol Alert
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter">Protocol Violation Filing</DialogTitle>
                                <DialogDescription>Formally document an internal compliance issue.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Subject Employee</Label>
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                                        <SelectContent>
                                            {users?.filter(u => u.id !== user?.uid).map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Priority Tier</Label>
                                    <Select value={severity} onValueChange={setSeverity}>
                                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Low">Low (Procedural)</SelectItem>
                                            <SelectItem value="Medium">Medium (Standard)</SelectItem>
                                            <SelectItem value="High">High (Urgent)</SelectItem>
                                            <SelectItem value="Critical">Critical (Immediate)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary">Detailed Justification</Label>
                                    <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the violation in detail..." className="rounded-2xl min-h-[120px]" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleFileReport} className="w-full rounded-full h-12 font-black uppercase bg-red-600 shadow-xl shadow-red-600/20">Transmit to CEO</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                        <FileWarning className="size-5 text-red-600" />
                        Executive Compliance Log
                    </CardTitle>
                    <CardDescription>Consolidated record of internal procedural alerts.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Date</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Subject</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Priority</TableHead>
                                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Auditor</TableHead>
                                <TableHead className="text-right font-black uppercase tracking-tighter text-[10px] py-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse font-bold uppercase text-xs">Scanning registry...</TableCell></TableRow>
                            ) : reports && reports.length > 0 ? (
                                reports.map(r => (
                                    <TableRow key={r.id} className="border-border/50">
                                        <TableCell className="py-4">
                                            <span className="font-bold text-xs">{r.timestamp ? format(r.timestamp.toDate(), 'MMM d, p') : '...'}</span>
                                        </TableCell>
                                        <TableCell className="font-bold py-4">{r.employeeName}</TableCell>
                                        <TableCell className="py-4">
                                            <Badge className={cn(
                                                "rounded-full text-[9px] uppercase font-black tracking-widest border-none",
                                                r.severity === 'Critical' ? "bg-red-600 text-white" :
                                                r.severity === 'High' ? "bg-orange-500 text-white" :
                                                r.severity === 'Medium' ? "bg-yellow-500 text-black" : "bg-blue-500 text-white"
                                            )}>
                                                {r.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 text-xs font-medium text-muted-foreground">{r.filedByName}</TableCell>
                                        <TableCell className="text-right py-4">
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'compliance_reports', r.id))}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No compliance alerts found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
