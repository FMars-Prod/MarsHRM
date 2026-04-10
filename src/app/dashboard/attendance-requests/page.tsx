
'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ThumbsUp, ThumbsDown, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, query, where, doc, serverTimestamp, orderBy } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

type AttendanceApprovalRequest = {
    employeeId: string;
    employeeName: string;
    requestedCheckInTime: string;
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
        <div className="animate-fade-in-up">
            <PageHeader title="Attendance Approval Requests" description="Review and approve employee requests to clock in from out-of-range locations.">
                <div className="flex gap-2">
                    <Button variant={filter === 'Pending' ? 'default' : 'outline'} onClick={() => setFilter('Pending')}>Pending</Button>
                    <Button variant={filter === 'Processed' ? 'default' : 'outline'} onClick={() => setFilter('Processed')}>Processed</Button>
                </div>
            </PageHeader>
            <div className="border rounded-lg overflow-x-auto bg-gradient-to-br from-primary/5 to-transparent">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Requested Time</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Requested Spot</TableHead>
                            <TableHead className="text-right">Decision</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading requests...</TableCell></TableRow>
                        ) : requests && requests.length > 0 ? (
                            requests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold">{req.requestedCheckInTime}</span>
                                            <span className="text-[10px] text-muted-foreground">{req.requestTimestamp ? format(req.requestTimestamp.toDate(), 'PP') : '...'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-xs text-xs italic leading-relaxed">"{req.reason}"</TableCell>
                                    <TableCell>
                                        <Button asChild variant="outline" size="sm" className="h-8 rounded-full">
                                            <Link href={`https://www.google.com/maps/search/?api=1&query=${req.requestedLatitude},${req.requestedLongitude}`} target="_blank">
                                                <MapPin className="h-3 w-3 mr-1" /> Map
                                            </Link>
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {filter === 'Pending' ? (
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 rounded-full" onClick={() => handleAction(req, 'Approved')}><ThumbsUp className="mr-1 h-3 w-3"/>Approve</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="destructive" className="h-8 rounded-full" onClick={() => setRequestToReject(req)}><ThumbsDown className="mr-1 h-3 w-3"/>Reject</Button>
                                                    </AlertDialogTrigger>
                                                     <AlertDialogContent className="rounded-3xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Reject Request</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-sm font-medium">
                                                                Provide a reason for denying {req.employeeName}'s clock-in request.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <Textarea
                                                            value={rejectionReason}
                                                            onChange={(e) => setRejectionReason(e.target.value)}
                                                            placeholder="e.g., Please clock in from the office today."
                                                            className="rounded-2xl"
                                                        />
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]" onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction className="rounded-full font-bold uppercase text-[10px] bg-red-600" onClick={() => handleAction(req, 'Rejected')}>Confirm Rejection</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                {req.status === 'Approved' ? (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 py-1 gap-1"><CheckCircle2 className="size-3"/>Approved</Badge>
                                                ) : (
                                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-3 py-1 gap-1"><XCircle className="size-3"/>Rejected</Badge>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">No {filter.toLowerCase()} requests found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
