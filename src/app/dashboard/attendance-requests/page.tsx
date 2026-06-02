
'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ThumbsUp, ThumbsDown, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, query, where, doc, serverTimestamp, orderBy } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

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

        // If approved, update the actual attendance record for that day
        if (status === 'Approved') {
            const attDateId = request.dateId || request.requestedCheckInTime.split(' at ')[0];
            const attendanceRef = doc(firestore, `users/${request.employeeId}/attendances`, attDateId);
            updateDocumentNonBlocking(attendanceRef, {
                status: request.intendedStatus || 'present',
                isOutOfRange: false
            });
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

    return (
        <div className="animate-fade-in-up space-y-6">
            <PageHeader title="Range Approval Desk" description="Verify and approve remote clock-in requests with high-precision GPS monitoring.">
                <div className="flex bg-muted/50 p-1 rounded-full border">
                    <Button 
                        variant={filter === 'Pending' ? 'default' : 'ghost'} 
                        size="sm"
                        className="rounded-full px-6 font-bold uppercase text-[10px]"
                        onClick={() => setFilter('Pending')}
                    >
                        Pending ({requests?.length || 0})
                    </Button>
                    <Button 
                        variant={filter === 'Processed' ? 'default' : 'ghost'} 
                        size="sm"
                        className="rounded-full px-6 font-bold uppercase text-[10px]"
                        onClick={() => setFilter('Processed')}
                    >
                        History
                    </Button>
                </div>
            </PageHeader>

            <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Employee</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Requested At</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Justification</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Precision Location</TableHead>
                                    <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4 text-right">Final Decision</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse font-medium">Fetching remote requests...</TableCell></TableRow>
                                ) : requests && requests.length > 0 ? (
                                    requests.map(req => (
                                        <TableRow key={req.id} className="border-border/50">
                                            <TableCell className="font-bold py-4">
                                                <div className="flex flex-col">
                                                    <span>{req.employeeName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase">ID: {req.employeeId.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-mono font-bold text-primary">{req.requestedCheckInTime.split(' at ')[1] || req.requestedCheckInTime}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{req.requestTimestamp ? format(req.requestTimestamp.toDate(), 'PP') : '...'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] py-4">
                                                <p className="text-xs italic leading-relaxed text-muted-foreground line-clamp-2">"{req.reason}"</p>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Button asChild variant="outline" size="sm" className="h-9 rounded-xl font-bold text-[10px] uppercase tracking-wider bg-white shadow-sm border-primary/20 text-primary hover:bg-primary/5">
                                                    <Link href={`https://www.google.com/maps/search/?api=1&query=${req.requestedLatitude},${req.requestedLongitude}`} target="_blank">
                                                        <MapPin className="h-3 w-3 mr-2 text-primary" />
                                                        Verify On Map
                                                        <ExternalLink className="ml-2 h-2.5 w-2.5 opacity-50" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                {filter === 'Pending' ? (
                                                    <div className="flex gap-2 justify-end">
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-green-600 hover:bg-green-700 h-9 rounded-xl font-black uppercase text-[10px] tracking-widest px-4 shadow-lg shadow-green-600/20" 
                                                            onClick={() => handleAction(req, 'Approved')}
                                                        >
                                                            <ThumbsUp className="mr-2 h-3.5 w-3.5"/> Approve
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="destructive" 
                                                                    className="h-9 rounded-xl font-black uppercase text-[10px] tracking-widest px-4 shadow-lg shadow-red-600/20" 
                                                                    onClick={() => setRequestToReject(req)}
                                                                >
                                                                    <ThumbsDown className="mr-2 h-3.5 w-3.5"/> Reject
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Deny Remote Access</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-sm font-medium">
                                                                        Please provide a specific reason for denying {req.employeeName}'s out-of-range request.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <div className="py-4">
                                                                    <Textarea
                                                                        value={rejectionReason}
                                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                                        placeholder="e.g., Required in-office for scheduled team workshop."
                                                                        className="rounded-2xl min-h-[100px] border-muted bg-muted/20"
                                                                    />
                                                                </div>
                                                                <AlertDialogFooter className="gap-2">
                                                                    <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]" onClick={() => setRejectionReason("")}>Go Back</AlertDialogCancel>
                                                                    <AlertDialogAction className="rounded-full font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700" onClick={() => handleAction(req, 'Rejected')}>Confirm Rejection</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        {req.status === 'Approved' ? (
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest gap-1.5"><CheckCircle2 className="size-3.5"/>Approved</Badge>
                                                        ) : (
                                                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest gap-1.5"><XCircle className="size-3.5"/>Rejected</Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic font-medium">No {filter.toLowerCase()} requests in the queue.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
