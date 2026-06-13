
'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ThumbsUp, ThumbsDown, Clock, CheckCircle2, XCircle, ExternalLink, Trash2 } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, query, where, doc, serverTimestamp, orderBy } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type AttendanceApprovalRequest = {
    employeeId: string;
    employeeName: string;
    requestedCheckInTime: string;
    dateId: string;
    intendedStatus: string;
    requestedLatitude: number;
    requestedLongitude: number;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    type?: 'Check In' | 'Clock Out';
    requestTimestamp: any;
    approvalNotes?: string;
};

export default function AttendanceRequestsPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    const [filter, setFilter] = React.useState<'Pending' | 'Processed'>('Pending');
    const [rejectionReason, setRejectionReason] = React.useState("");
    const [requestToReject, setRequestToReject] = React.useState<WithId<AttendanceApprovalRequest> | null>(null);
    
    // Selection state
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    const requestsQuery = useMemoFirebase(() => {
        const base = collection(firestore, "attendanceApprovalRequests");
        if (filter === 'Pending') {
            return query(base, where("status", "==", "Pending"), orderBy("requestTimestamp", "desc"));
        }
        return query(base, where("status", "!=", "Pending"), orderBy("requestTimestamp", "desc"));
    }, [firestore, filter]);

    const { data: requests, isLoading } = useCollection<AttendanceApprovalRequest>(requestsQuery);

    const handleAction = (request: WithId<AttendanceApprovalRequest>, status: 'Approved' | 'Rejected') => {
        if (!currentUser) return;
        
        const requestRef = doc(firestore, 'attendanceApprovalRequests', request.id);
        const payload: any = {
            status,
            approvalTimestamp: serverTimestamp(),
            approverEmployeeId: currentUser.uid,
        };

        if (status === 'Rejected') {
            payload.approvalNotes = rejectionReason;
        }

        updateDocumentNonBlocking(requestRef, payload);

        // If approved, update or create the actual attendance record for that day
        if (status === 'Approved') {
            const attDateId = request.dateId || format(new Date(), 'yyyy-MM-dd');
            const attendanceRef = doc(firestore, `users/${request.employeeId}/attendances`, attDateId);
            
            const attendanceUpdate: any = {
                isOutOfRange: false
            };

            if (request.type === 'Clock Out') {
                attendanceUpdate.checkOutTime = serverTimestamp();
                attendanceUpdate.locationCheckOutLatitude = request.requestedLatitude;
                attendanceUpdate.locationCheckOutLongitude = request.requestedLongitude;
            } else {
                // Check In
                attendanceUpdate.id = attDateId;
                attendanceUpdate.employeeId = request.employeeId;
                attendanceUpdate.checkInTime = serverTimestamp();
                attendanceUpdate.status = request.intendedStatus || 'present';
                attendanceUpdate.locationCheckInLatitude = request.requestedLatitude;
                attendanceUpdate.locationCheckInLongitude = request.requestedLongitude;
                attendanceUpdate.totalBreakDuration = 0;
            }

            setDocumentNonBlocking(attendanceRef, attendanceUpdate, { merge: true });
        }

        toast({ 
            title: `Request ${status}`, 
            description: `${request.employeeName}'s out-of-range request has been ${status.toLowerCase()}.` 
        });
        
        if (status === 'Rejected') {
            setRequestToReject(null);
            setRejectionReason("");
        }
    };

    const handleBulkDelete = () => {
        selectedIds.forEach(id => {
            deleteDocumentNonBlocking(doc(firestore, 'attendanceApprovalRequests', id));
        });
        toast({ title: "Records Purged", description: `${selectedIds.length} requests have been removed.` });
        setSelectedIds([]);
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked && requests) {
            setSelectedIds(requests.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectRow = (id: string, checked: boolean) => {
        setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <PageHeader title="Range Approval Desk" description="Verify and approve remote clock-in/out requests with high-precision GPS monitoring.">
                <div className="flex gap-2 items-center">
                    {selectedIds.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="rounded-none px-4 h-9 font-bold uppercase text-[10px] gap-2 shadow-lg shadow-red-600/20">
                                    <Trash2 className="size-3.5" /> Purge ({selectedIds.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Purge Mission Logs?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                        This will permanently remove {selectedIds.length} selected requests from the tactical registry. This action cannot be reversed.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete} className="rounded-none font-bold uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700">Confirm Purge</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <div className="flex bg-muted/50 p-1 rounded-none border">
                        <Button 
                            variant={filter === 'Pending' ? 'default' : 'ghost'} 
                            size="sm"
                            className="rounded-none px-6 font-bold uppercase text-[10px]"
                            onClick={() => { setFilter('Pending'); setSelectedIds([]); }}
                        >
                            Pending ({requests?.filter(r => r.status === 'Pending').length || 0})
                        </Button>
                        <Button 
                            variant={filter === 'Processed' ? 'default' : 'ghost'} 
                            size="sm"
                            className="rounded-none px-6 font-bold uppercase text-[10px]"
                            onClick={() => { setFilter('Processed'); setSelectedIds([]); }}
                        >
                            History
                        </Button>
                    </div>
                </div>
            </PageHeader>

            <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="w-[50px] py-4 px-6">
                                        <Checkbox 
                                            checked={requests && requests.length > 0 && selectedIds.length === requests.length}
                                            onCheckedChange={toggleSelectAll}
                                            className="rounded-none"
                                        />
                                    </TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Employee</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Type</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Requested At</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Justification</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Location</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4 text-right px-6">Final Decision</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse font-medium uppercase text-xs">Scanning dispatch log...</TableCell></TableRow>
                                ) : requests && requests.length > 0 ? (
                                    requests.map(req => (
                                        <TableRow key={req.id} className={cn("border-border/50 transition-colors group hover:bg-primary/5", selectedIds.includes(req.id) && "bg-primary/5")}>
                                            <TableCell className="py-4 px-6 align-middle">
                                                <Checkbox 
                                                    checked={selectedIds.includes(req.id)}
                                                    onCheckedChange={(checked) => toggleSelectRow(req.id, !!checked)}
                                                    className="rounded-none"
                                                />
                                            </TableCell>
                                            <TableCell className="font-bold py-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black uppercase tracking-tight">{req.employeeName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase">ID: {req.employeeId.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <Badge variant="outline" className="rounded-none text-[9px] font-black uppercase tracking-widest bg-muted/20 border-none px-2.5 h-5">
                                                    {req.type || 'Check In'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-mono font-bold text-primary">{req.requestedCheckInTime.split(' at ')[1] || req.requestedCheckInTime}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{req.requestTimestamp ? format(req.requestTimestamp.toDate(), 'PP') : '...'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] py-4 align-middle">
                                                <p className="text-xs italic leading-relaxed text-muted-foreground line-clamp-2">"{req.reason}"</p>
                                            </TableCell>
                                            <TableCell className="py-4 align-middle">
                                                <Button asChild variant="outline" size="sm" className="h-9 rounded-none font-bold text-[10px] uppercase tracking-wider bg-white shadow-sm border-primary/20 text-primary hover:bg-primary/5">
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${req.requestedLatitude},${req.requestedLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 mr-2 text-primary" />
                                                        Verify On Map
                                                        <ExternalLink className="ml-2 h-2.5 w-2.5 opacity-50" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right py-4 px-6 align-middle">
                                                {filter === 'Pending' ? (
                                                    <div className="flex gap-2 justify-end">
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-green-600 hover:bg-green-700 h-9 rounded-none font-black uppercase text-[10px] tracking-widest px-4 shadow-lg shadow-green-600/20" 
                                                            onClick={() => handleAction(req, 'Approved')}
                                                        >
                                                            <ThumbsUp className="mr-2 h-3.5 w-3.5"/> Approve
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="destructive" 
                                                                    className="h-9 rounded-none font-black uppercase text-[10px] tracking-widest px-4 shadow-lg shadow-red-600/20" 
                                                                    onClick={() => setRequestToReject(req)}
                                                                >
                                                                    <ThumbsDown className="mr-2 h-3.5 w-3.5"/> Reject
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-none border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Deny Remote Access</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                                                        Please provide a professional reason for denying {req.employeeName}'s out-of-range request.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <div className="py-6">
                                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Rejection Note</Label>
                                                                    <Textarea
                                                                        value={rejectionReason}
                                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                                        placeholder="e.g., Required in-office for scheduled team workshop."
                                                                        className="rounded-none min-h-[120px] border-muted bg-muted/20"
                                                                    />
                                                                </div>
                                                                <AlertDialogFooter className="gap-2">
                                                                    <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6" onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction className="rounded-none font-bold uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700" onClick={() => handleAction(req, 'Rejected')}>Confirm Rejection</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        {req.status === 'Approved' ? (
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-4 py-1.5 rounded-none font-bold text-[10px] uppercase tracking-widest gap-1.5 shadow-sm"><CheckCircle2 className="size-3.5"/>Approved</Badge>
                                                        ) : (
                                                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-4 py-1.5 rounded-none font-bold text-[10px] uppercase tracking-widest gap-1.5 shadow-sm"><XCircle className="size-3.5"/>Rejected</Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic font-medium uppercase text-[10px] tracking-widest opacity-30">No {filter.toLowerCase()} requests in this sector.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
