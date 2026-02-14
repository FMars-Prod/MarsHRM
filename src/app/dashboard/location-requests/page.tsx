
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ThumbsUp, ThumbsDown } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc, useUser } from "@/firebase";
import { collection, query, where, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

type LocationChangeRequest = {
    employeeId: string;
    employeeName: string;
    requestDate: any;
    newLatitude: number;
    newLongitude: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
};

export default function LocationRequestsPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    const [filter, setFilter] = React.useState<'pending' | 'processed'>('pending');
    const [rejectionReason, setRejectionReason] = React.useState("");
    const [requestToReject, setRequestToReject] = React.useState<WithId<LocationChangeRequest> | null>(null);

    const requestsQuery = useMemoFirebase(() => {
        if (filter === 'pending') {
            return query(collection(firestore, "location_change_requests"), where("status", "==", "pending"));
        }
        return query(collection(firestore, "location_change_requests"), where("status", "!=", "pending"));
    }, [firestore, filter]);

    const { data: requests, isLoading } = useCollection<LocationChangeRequest>(requestsQuery);

    const handleApprove = async (request: WithId<LocationChangeRequest>) => {
        if (!currentUser) return;
        const batch = writeBatch(firestore);
        
        const requestRef = doc(firestore, 'location_change_requests', request.id);
        batch.update(requestRef, {
            status: 'approved',
            processedDate: serverTimestamp(),
            approvedBy: currentUser.uid,
        });

        const userRef = doc(firestore, 'users', request.employeeId);
        batch.update(userRef, {
            homeLatitude: request.newLatitude,
            homeLongitude: request.newLongitude,
        });

        await batch.commit();
        toast({ title: 'Request Approved', description: `${request.employeeName}'s location has been updated.` });
    };

    const handleReject = async () => {
        if (!requestToReject || !currentUser) return;

        const requestRef = doc(firestore, 'location_change_requests', requestToReject.id);
        updateDocumentNonBlocking(requestRef, {
            status: 'rejected',
            processedDate: serverTimestamp(),
            approvedBy: currentUser.uid,
            rejectionReason: rejectionReason,
        });

        toast({ variant: 'destructive', title: 'Request Rejected' });
        setRequestToReject(null);
        setRejectionReason("");
    };

    return (
        <>
            <PageHeader title="Location Change Requests" description="Review and approve employee requests to change their home location.">
                <div className="flex gap-2">
                    <Button variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>Pending</Button>
                    <Button variant={filter === 'processed' ? 'default' : 'outline'} onClick={() => setFilter('processed')}>Processed</Button>
                </div>
            </PageHeader>
            <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>New Location</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading requests...</TableCell></TableRow>
                        ) : requests && requests.length > 0 ? (
                            requests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                                    <TableCell>{format(req.requestDate.toDate(), 'PP')}</TableCell>
                                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                                    <TableCell>
                                        <Button asChild variant="outline" size="icon">
                                            <Link href={`https://www.google.com/maps/search/?api=1&query=${req.newLatitude},${req.newLongitude}`} target="_blank">
                                                <MapPin className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {filter === 'pending' ? (
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" onClick={() => handleApprove(req)}><ThumbsUp className="mr-2 h-4 w-4"/>Approve</Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="destructive" onClick={() => setRequestToReject(req)}><ThumbsDown className="mr-2 h-4 w-4"/>Reject</Button>
                                                    </AlertDialogTrigger>
                                                     <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Reason for Rejection</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Please provide a reason for rejecting this request.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <Textarea
                                                            value={rejectionReason}
                                                            onChange={(e) => setRejectionReason(e.target.value)}
                                                            placeholder="e.g., Insufficient reason provided."
                                                        />
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleReject}>Confirm Rejection</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ) : (
                                            <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>{req.status}</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No {filter} requests found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}

    