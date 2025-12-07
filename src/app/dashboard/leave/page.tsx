
"use client";

import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfToday } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";


type LeaveStatus = 'Pending' | 'Pending HR Approval' | 'Approved' | 'Rejected' | 'Rejected by Team Lead' | 'Rejected by HR';

type LeaveRequest = {
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string;
  startDate: any;
  endDate: any;
  leaveType: string;
  reason: string;
  status: LeaveStatus;
  approvedByTeamLeadId?: string | null;
  approvedByHRId?: string | null;
  rejectionReason?: string;
  createdAt: any;
};

type LeaveRequestWithId = WithId<LeaveRequest>;


const LeaveStatusTracker = ({ request }: { request: LeaveRequestWithId }) => {
    const isSubmitted = true;
    const isFinalRejected = request.status === 'Rejected' || request.status.startsWith('Rejected by');
    const isApprovedByLead = ['Pending HR Approval', 'Approved'].includes(request.status);
    const isRejectedByLead = request.status === 'Rejected by Team Lead';
    const isApprovedByHR = request.status === 'Approved';
    const isRejectedByHR = request.status === 'Rejected by HR';

    return (
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white", isFinalRejected ? "bg-red-500" : "bg-green-500")}>
                {isFinalRejected ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </div>
              <div className={cn("h-12 w-0.5", (isApprovedByLead || isRejectedByLead || isFinalRejected) ? 'bg-primary/20' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className={cn("font-semibold", isFinalRejected && "text-red-500")}>{isFinalRejected ? "Rejected" : "Submitted"}</h4>
              <p className="text-sm text-muted-foreground">Request submitted on {format(request.createdAt.toDate(), "PP")}.</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white",
                isApprovedByLead && !isFinalRejected && 'bg-green-500',
                (isRejectedByLead || (isFinalRejected && !isApprovedByLead)) && 'bg-red-500',
                !isApprovedByLead && !isRejectedByLead && !isFinalRejected && 'bg-yellow-500'
              )}>
                {(isApprovedByLead && !isFinalRejected) && <Check className="h-4 w-4" />}
                {(isRejectedByLead || (isFinalRejected && !isApprovedByLead)) && <X className="h-4 w-4" />}
                {!isApprovedByLead && !isRejectedByLead && !isFinalRejected && <Clock className="h-4 w-4" />}
              </div>
              <div className={cn("h-12 w-0.5", (isApprovedByHR || isRejectedByHR || isFinalRejected) ? 'bg-primary/20' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className={cn("font-semibold", (isRejectedByLead || isFinalRejected) && "text-red-500")}>Team Lead Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByLead && 'Approved by Team Lead.'}
                {isRejectedByLead && `Rejected by Team Lead. ${request.rejectionReason || ''}`}
                {isFinalRejected && !isApprovedByLead && !isRejectedByLead && 'Rejected by higher authority.'}
                {!isApprovedByLead && !isRejectedByLead && !isFinalRejected && 'Pending approval.'}
              </p>
            </div>
          </div>
           <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white",
                isApprovedByHR && 'bg-green-500',
                isRejectedByHR && 'bg-red-500',
                isFinalRejected && !isRejectedByHR && 'bg-red-500',
                isApprovedByLead && !isApprovedByHR && !isRejectedByHR && 'bg-yellow-500',
                !isApprovedByLead && 'bg-gray-300',
              )}>
                {isApprovedByHR && <Check className="h-4 w-4" />}
                {(isRejectedByHR || (isFinalRejected && !isRejectedByHR)) && <X className="h-4 w-4" />}
                {!(isApprovedByHR || isRejectedByHR || isFinalRejected) && <Clock className="h-4 w-4" />}
              </div>
            </div>
            <div>
              <h4 className={cn("font-semibold", isRejectedByHR && "text-red-500", !isApprovedByLead && "text-muted-foreground")}>HR Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByHR && 'Approved by HR.'}
                {isRejectedByHR && `Rejected by HR. ${request.rejectionReason || ''}`}
                {isApprovedByLead && !isApprovedByHR && !isRejectedByHR && 'Pending HR approval.'}
                {!isApprovedByLead && !isRejectedByLead && 'Waiting for Team Lead approval.'}
                 {isRejectedByLead && 'Not applicable.'}
              </p>
            </div>
          </div>
        </div>
    )
}

const statusVariantMap: { [key in LeaveStatus]: string } = {
    'Approved': 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
    'Pending': 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
    'Pending HR Approval': 'bg-blue-500/20 text-blue-700 border-transparent hover:bg-blue-500/30',
    'Rejected by Team Lead': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30',
    'Rejected by HR': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30',
    'Rejected': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30'
};


export default function LeavePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';

  const [leaveType, setLeaveType] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [date, setDate] = React.useState<DateRange | undefined>({ from: undefined, to: undefined });
  const [isRequesting, setIsRequesting] = React.useState(false);

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!user) return null;
    
    let q = query(collection(firestore, "leave_requests"));

    switch(userRole) {
        case 'Member':
            q = query(q, where("employeeId", "==", user.uid));
            break;
        case 'Team Lead':
            q = query(q, where("status", "==", "Pending"));
            // In a real app, you'd add: where("teamLeadId", "==", user.uid)
            break;
        case 'HR Manager':
            q = query(q, where("status", "in", ["Pending HR Approval", "Approved", "Rejected by HR"]));
            break;
        case 'CEO/Admin':
            // CEO sees all requests
            break;
    }
    return q;
  }, [firestore, user, userRole]);

  const { data: leaveRequests, isLoading } = useCollection<LeaveRequest>(leaveRequestsQuery);
  
  const handleRequestStatus = (requestId: string, newStatus: LeaveStatus, approverId: string, approvalField: string) => {
    const requestDocRef = doc(firestore, 'leave_requests', requestId);
    updateDocumentNonBlocking(requestDocRef, { 
      status: newStatus,
      [approvalField]: approverId,
    });
    toast({ title: `Request ${newStatus}` });
  }

  const handleCreateRequest = () => {
    if (!user || !userData || !leaveType || !date?.from || !date?.to || !reason) {
        toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all fields."});
        return;
    }
    setIsRequesting(true);

    const newRequest: LeaveRequest = {
        employeeId: user.uid,
        employeeName: `${(userData as any).firstName} ${(userData as any).lastName}`,
        employeeJobTitle: (userData as any).jobTitle,
        startDate: date.from,
        endDate: date.to,
        leaveType,
        reason,
        status: 'Pending',
        createdAt: serverTimestamp(),
    }
    
    addDocumentNonBlocking(collection(firestore, 'leave_requests'), newRequest)
      .then(() => {
          toast({ title: "Request Submitted", description: "Your leave request has been submitted for approval."});
          setLeaveType("");
          setReason("");
          setDate({from: undefined, to: undefined});
          setIsRequesting(false);
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Submission Failed", description: e.message });
        setIsRequesting(false);
      });
  }

  const allLeaveRequests = leaveRequests || [];

  const formatDate = (timestamp: any) => timestamp ? format(timestamp.toDate(), 'PP') : '';


  return (
    <>
      <PageHeader
        title="Leave Management"
        description="Request time off and track your leave balance."
      >
        {userRole === 'Member' && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2" />
                New Leave Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit a Leave Request</DialogTitle>
                <DialogDescription>
                  Fill out the details below to request time off.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="leaveType" className="text-right">
                    Leave Type
                  </Label>
                  <Select onValueChange={setLeaveType}>
                      <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Vacation">Vacation</SelectItem>
                          <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                          <SelectItem value="Personal">Personal</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dates" className="text-right">Dates</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="dates"
                            variant={"outline"}
                            className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            disabled={(d) => d < startOfToday()}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="reason" className="text-right pt-2">
                    Reason
                  </Label>
                  <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide a reason for your leave..." className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={isRequesting}>Cancel</Button>
                <Button onClick={handleCreateRequest} disabled={isRequesting}>
                  {isRequesting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {(userRole === 'Team Lead' || userRole === 'HR Manager' || userRole === 'CEO/Admin') && <TableHead>Employee</TableHead>}
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading requests...</TableCell></TableRow>
            ) : allLeaveRequests.length === 0 ? (
                 <TableRow><TableCell colSpan={5} className="h-24 text-center">No leave requests found.</TableCell></TableRow>
            ) : (
              allLeaveRequests.map((request) => (
                <TableRow key={request.id}>
                  {(userRole === 'Team Lead' || userRole === 'HR Manager' || userRole === 'CEO/Admin') && <TableCell className="font-medium">{request.employeeName}</TableCell>}
                  <TableCell className="font-medium">{`${formatDate(request.startDate)} - ${formatDate(request.endDate)}`}</TableCell>
                  <TableCell>{request.leaveType}</TableCell>
                  <TableCell>
                    <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                      {request.status.replace(/ by Team Lead| by HR/g, '')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                          {userRole === 'CEO/Admin' && !['Approved', 'Rejected'].includes(request.status) && (
                               <>
                                  <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </Button>
                                  <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected', user!.uid, 'approvedByHRId')}>
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </Button>
                              </>
                          )}
                          {userRole === 'Team Lead' && request.status === 'Pending' && (
                              <>
                                  <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </Button>
                                  <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected by Team Lead', user!.uid, 'approvedByTeamLeadId')}>
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </Button>
                              </>
                          )}
                           {(userRole === 'HR Manager') && request.status === 'Pending HR Approval' && (
                              <>
                                  <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </Button>
                                  <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected by HR', user!.uid, 'approvedByHRId')}>
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </Button>
                              </>
                          )}
                          <Sheet>
                              <SheetTrigger asChild>
                                  <Button variant="outline" size="sm">
                                      <Eye className="mr-2 h-4 w-4"/>
                                      View Details
                                  </Button>
                              </SheetTrigger>
                              <SheetContent>
                                  <SheetHeader>
                                      <SheetTitle>Leave Request Details</SheetTitle>
                                      <SheetDescription>
                                          Track the approval status of the request.
                                      </SheetDescription>
                                  </SheetHeader>
                                  <Separator className="my-4" />
                                  <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
                                  <div className="space-y-4">
                                     <div className="space-y-1">
                                          <p className="text-sm font-medium text-muted-foreground">Employee</p>
                                          <p className="font-semibold">{request.employeeName}</p>
                                     </div>
                                     <div className="space-y-1">
                                          <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                                          <p className="font-semibold">{request.leaveType}</p>
                                     </div>
                                     <div className="space-y-1">
                                          <p className="text-sm font-medium text-muted-foreground">Dates</p>
                                          <p className="font-semibold">{`${formatDate(request.startDate)} to ${formatDate(request.endDate)}`}</p>
                                     </div>
                                     <div className="space-y-1">
                                          <p className="text-sm font-medium text-muted-foreground">Reason</p>
                                          <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
                                     </div>
                                     <div className="space-y-1">
                                          <p className="text-sm font-medium text-muted-foreground">Status</p>
                                          <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                                              {request.status}
                                          </Badge>
                                     </div>
                                      <Separator className="my-4" />
                                      <h4 className="font-semibold">Approval History</h4>
                                      <LeaveStatusTracker request={request} />
                                  </div>
                                  </ScrollArea>
                              </SheetContent>
                          </Sheet>
                      </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

    