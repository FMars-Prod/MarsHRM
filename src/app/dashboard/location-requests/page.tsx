
'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, query, where, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { format, isValid } from 'date-fns';
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
        const base = collection(firestore, "location_change_requests");
        if (filter === 'pending') return query(base, where("status", "==", "pending"));
        return query(base, where("status", "!=", "pending"));
    }, [firestore, filter]);

    const { data: requests, isLoading } = useCollection<LocationChangeRequest>(requestsQuery);

    const handleApprove = async (request: WithId<LocationChangeRequest>) => {
        const batch = writeBatch(firestore);
        const reqRef = doc(firestore, 'location_change_requests', request.id);
        const userRef = doc(firestore, 'users', request.employeeId);

        batch.update(reqRef, { status: 'approved', processedDate: serverTimestamp() });
        batch.update(userRef, { homeLatitude: request.newLatitude, homeLongitude: request.newLongitude });

        await batch.commit();
        toast({ title: 'WFH Location Approved' });
    };

    const handleReject = async () => {
        if (!requestToReject) return;
        const reqRef = doc(firestore, 'location_change_requests', requestToReject.id);
        updateDocumentNonBlocking(reqRef, { 
            status: 'rejected', 
            rejectionReason: rejectionReason,
            processedDate: serverTimestamp() 
        });
        toast({ title: 'WFH Location Rejected' });
        setRequestToReject(null);
        setRejectionReason("");
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <PageHeader title="WFH Precision Requests" description="Verify and approve employee residential points.">
                <div className="flex bg-muted/50 p-1 rounded-full border">
                    <Button variant={filter === 'pending' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('pending')} className="rounded-full">Pending</Button>
                    <Button variant={filter === 'processed' ? 'default' : 'ghost'} size="sm" onClick={() => setFilter('processed')} className="rounded-full">History</Button>
                </div>
            </PageHeader>

            <div className="border rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Employee</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Requested At</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Justification</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Map Point</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse">Syncing satellite data...</TableCell></TableRow>
                        ) : requests?.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className="font-bold">{req.employeeName}</TableCell>
                                <TableCell className="text-xs">{req.requestDate && isValid(req.requestDate.toDate()) ? format(req.requestDate.toDate(), 'PP p') : '...'}</TableCell>
                                <TableCell className="max-w-xs truncate italic text-xs">"{req.reason}"</TableCell>
                                <TableCell>
                                    <Button asChild variant="outline" size="sm" className="h-8 rounded-full text-[10px] font-bold">
                                        <Link href={`https://www.google.com/maps/search/?api=1&query=${req.newLatitude},${req.newLongitude}`} target="_blank">
                                            <MapPin className="size-3 mr-1" /> View Point
                                        </Link>
                                    </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                    {filter === 'pending' ? (
                                        <div className="flex gap-2 justify-end">
                                            <Button size="sm" onClick={() => handleApprove(req)} className="bg-green-600 hover:bg-green-700 h-8 rounded-full"><ThumbsUp className="size-3 mr-1"/> Approve</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive" onClick={() => setRequestToReject(req)} className="h-8 rounded-full"><ThumbsDown className="size-3 mr-1"/> Reject</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl">
                                                    <AlertDialogHeader><AlertDialogTitle>Deny WFH Point</AlertDialogTitle></AlertDialogHeader>
                                                    <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide rejection reason..." />
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleReject} className="bg-red-600">Reject Point</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    ) : (
                                        <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className="rounded-full">
                                            {req.status === 'approved' ? <CheckCircle2 className="size-3 mr-1"/> : <XCircle className="size-3 mr-1"/>}
                                            {req.status.toUpperCase()}
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
