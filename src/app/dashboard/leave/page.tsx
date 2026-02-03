
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye, Clock, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2 } from "lucide-react";
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
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfToday, getDaysInMonth, getYear, getMonth, getDate } from "date-fns";
import { DateRange } from "react-day-picker";
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

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
};

type LeaveRequestWithId = WithId<LeaveRequest>;

type Team = {
    id: string;
    name: string;
    teamLeadId: string;
    memberIds: string[];
}


const LeaveStatusTracker = ({ request, users }: { request: LeaveRequestWithId; users: WithId<UserData>[] | null; }) => {
  const teamLeadApprover = users?.find(u => u.id === request.approvedByTeamLeadId);
  const hrApprover = users?.find(u => u.id === request.approvedByHRId);
  
  const teamLeadName = teamLeadApprover ? `${teamLeadApprover.firstName} ${teamLeadApprover.lastName}` : 'Team Lead';
  const hrName = hrApprover ? `${hrApprover.firstName} ${hrApprover.lastName}` : 'HR';

  // Find who rejected it
  let rejecterName = '';
  if (request.status.startsWith('Rejected')) {
      const rejecterId = request.status === 'Rejected by Team Lead' ? request.approvedByTeamLeadId : request.approvedByHRId;
      const rejecter = users?.find(u => u.id === rejecterId);
      rejecterName = rejecter ? `${rejecter.firstName} ${rejecter.lastName}` : 'Administrator';
  }

  const isSubmitted = true;
  const isFinalRejected = request.status.startsWith('Rejected');
  const isApprovedByLead = ['Pending HR Approval', 'Approved', 'Rejected by HR'].includes(request.status);
  const isRejectedByLead = request.status === 'Rejected by Team Lead';
  const isApprovedByHR = request.status === 'Approved';
  const isRejectedByHR = request.status === 'Rejected by HR' || request.status === 'Rejected';

  const isPendingLead = request.status === 'Pending';
  const isPendingHR = request.status === 'Pending HR Approval';

  return (
    <div className="space-y-4">
      {/* Submitted Stage */}
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500 text-white">
            <Check className="h-4 w-4" />
          </div>
          <div className="h-16 w-0.5 bg-primary/20"></div>
        </div>
        <div>
          <h4 className="font-semibold">Submitted</h4>
          <p className="text-sm text-muted-foreground">Request submitted on {format(request.createdAt.toDate(), "PP")}.</p>
        </div>
      </div>
      
      {/* Team Lead Stage */}
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white",
            isApprovedByLead && 'bg-green-500',
            isRejectedByLead && 'bg-red-500',
            isPendingLead && 'bg-yellow-500'
          )}>
            {isApprovedByLead && <Check className="h-4 w-4" />}
            {isRejectedByLead && <X className="h-4 w-4" />}
            {isPendingLead && <Clock className="h-4 w-4" />}
          </div>
          <div className={cn("h-16 w-0.5", (isApprovedByLead || isRejectedByLead) ? 'bg-primary/20' : 'bg-gray-200')}></div>
        </div>
        <div className="flex-1">
          <h4 className={cn("font-semibold", isRejectedByLead && "text-red-500")}>Team Lead Approval</h4>
          <p className="text-sm text-muted-foreground">
            {isApprovedByLead && `Approved by ${teamLeadName}.`}
            {isRejectedByLead && `Rejected by ${rejecterName}.`}
            {isPendingLead && 'Pending approval.'}
          </p>
          {isRejectedByLead && request.rejectionReason && (
            <p className="text-xs text-destructive/80 mt-1 italic">"{request.rejectionReason}"</p>
          )}
        </div>
      </div>

      {/* HR Stage */}
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-full",
            !isApprovedByLead && !isRejectedByLead && "bg-gray-300 text-white",
            isPendingHR && "bg-yellow-500 text-white",
            isApprovedByHR && "bg-green-500 text-white",
            isRejectedByHR && "bg-red-500 text-white",
            isRejectedByLead && "bg-gray-300 text-white"
          )}>
            {isApprovedByHR && <Check className="h-4 w-4" />}
            {(isRejectedByHR || isRejectedByLead) && <X className="h-4 w-4" />}
            {(isPendingHR || isPendingLead) && <Clock className="h-4 w-4" />}
          </div>
        </div>
        <div className="flex-1">
          <h4 className={cn("font-semibold", 
              isRejectedByHR && "text-red-500",
              !isApprovedByLead && !isRejectedByLead && "text-muted-foreground"
          )}>HR Approval</h4>
          <p className="text-sm text-muted-foreground">
            {isApprovedByHR && `Approved by ${hrName}.`}
            {isRejectedByHR && `Rejected by ${rejecterName}.`}
            {isPendingHR && 'Pending HR approval.'}
            {isPendingLead && 'Waiting for Team Lead approval.'}
            {isRejectedByLead && 'Not applicable.'}
          </p>
           {isRejectedByHR && request.rejectionReason && (
            <p className="text-xs text-destructive/80 mt-1 italic">"{request.rejectionReason}"</p>
          )}
        </div>
      </div>
    </div>
  );
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
  const isUserAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  const [leaveType, setLeaveType] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequestWithId | null>(null);
  
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [requestToReject, setRequestToReject] = React.useState<LeaveRequestWithId | null>(null);
  
  const currentYear = getYear(new Date());
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, name: format(new Date(0, i), 'MMMM') }));

  const [startDay, setStartDay] = React.useState<string | undefined>();
  const [startMonth, setStartMonth] = React.useState<string | undefined>();
  const [startYear, setStartYear] = React.useState<string | undefined>(currentYear.toString());
  
  const [endDay, setEndDay] = React.useState<string | undefined>();
  const [endMonth, setEndMonth] = React.useState<string | undefined>();
  const [endYear, setEndYear] = React.useState<string | undefined>(currentYear.toString());

  const startDaysInMonth = (startYear && startMonth) ? getDaysInMonth(new Date(parseInt(startYear), parseInt(startMonth))) : 31;
  const endDaysInMonth = (endYear && endMonth) ? getDaysInMonth(new Date(parseInt(endYear), parseInt(endMonth))) : 31;
  const startDays = Array.from({ length: startDaysInMonth }, (_, i) => i + 1);
  const endDays = Array.from({ length: endDaysInMonth }, (_, i) => i + 1);

  const teamLeadQuery = useMemoFirebase(() => {
    if (!user || userRole !== 'Team Lead') return null;
    return query(collection(firestore, 'teams'), where('teamLeadId', '==', user.uid));
  }, [firestore, user, userRole]);

  const { data: teamsLed } = useCollection<Team>(teamLeadQuery);
  const teamMemberIds = React.useMemo(() => {
    if (userRole !== 'Team Lead' || !teamsLed || teamsLed.length === 0) return [];
    return teamsLed.flatMap(team => team.memberIds);
  }, [userRole, teamsLed]);

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!user || !userRole) return null;
    const baseQuery = collection(firestore, 'leave_requests');

    switch (userRole) {
      case 'Member':
        return query(baseQuery, where('employeeId', '==', user.uid));
      case 'Team Lead':
        if (teamMemberIds.length > 0) {
          return query(baseQuery, where('employeeId', 'in', teamMemberIds));
        }
        return query(baseQuery, where('employeeId', '==', '-----')); // No members, show no requests
      case 'HR Manager':
      case 'CEO/Admin':
        return query(baseQuery);
      default:
        return null;
    }
  }, [firestore, user, userRole, teamMemberIds]);
  
  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);


  const { data: leaveRequests, isLoading: requestsLoading } = useCollection<LeaveRequest>(leaveRequestsQuery);
  const isLoading = usersLoading || requestsLoading;
  
  const handleRequestStatus = (requestId: string, newStatus: LeaveStatus, approverId: string, approvalField: string) => {
    const requestDocRef = doc(firestore, 'leave_requests', requestId);
    updateDocumentNonBlocking(requestDocRef, { 
      status: newStatus,
      [approvalField]: approverId,
    });
    toast({ title: `Request ${newStatus}` });
  }

  const handleDeleteRequest = (requestId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'leave_requests', requestId));
    toast({ title: 'Leave Request Deleted' });
  }

  const handleRejectionSubmit = () => {
    if (!requestToReject || !rejectionReason) {
        toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason for rejection.' });
        return;
    }
    if (!user) return;

    let newStatus: LeaveStatus;
    let approvalField: string;

    if (userRole === 'Team Lead') {
        newStatus = 'Rejected by Team Lead';
        approvalField = 'approvedByTeamLeadId';
    } else if (userRole === 'HR Manager') {
        newStatus = 'Rejected by HR';
        approvalField = 'approvedByHRId';
    } else if (userRole === 'CEO/Admin') {
        newStatus = 'Rejected';
        approvalField = 'approvedByHRId'; // Attribute to admin/HR level
    } else {
        return;
    }

    const requestDocRef = doc(firestore, 'leave_requests', requestToReject.id);
    updateDocumentNonBlocking(requestDocRef, {
      status: newStatus,
      [approvalField]: user.uid,
      rejectionReason: rejectionReason,
    });

    toast({ title: `Request Rejected` });
    setRequestToReject(null);
    setRejectionReason("");
  }


  const handleCreateRequest = () => {
    if (!user || !userData || !leaveType || !reason || !startDay || !startMonth || !startYear || !endDay || !endMonth || !endYear) {
        toast({ variant: "destructive", title: "Missing Information", description: "Please fill out all fields."});
        return;
    }
    setIsRequesting(true);
    
    const fromDate = new Date(parseInt(startYear), parseInt(startMonth), parseInt(startDay));
    const toDate = new Date(parseInt(endYear), parseInt(endMonth), parseInt(endDay));

    if (toDate < fromDate) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "End date cannot be before the start date."});
        setIsRequesting(false);
        return;
    }

    const newRequest: LeaveRequest = {
        employeeId: user.uid,
        employeeName: `${(userData as any).firstName} ${(userData as any).lastName}`,
        employeeJobTitle: (userData as any).jobTitle,
        startDate: fromDate,
        endDate: toDate,
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
          setStartDay(undefined); setStartMonth(undefined); setStartYear(currentYear.toString());
          setEndDay(undefined); setEndMonth(undefined); setEndYear(currentYear.toString());
          setIsRequesting(false);
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Submission Failed", description: e.message });
        setIsRequesting(false);
      });
  }
  
  const allLeaveRequests = (leaveRequests || []).filter(req => {
    if (userRole === 'Team Lead') {
      return true; // Team lead sees all their members' requests + their own
    }
    if (userRole === 'HR Manager') {
      return ['Pending HR Approval', 'Approved', 'Rejected by HR'].includes(req.status);
    }
    return true; // Members and Admins see everything they are allowed to by rules
  });

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
            <DialogContent className="sm:max-w-md">
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
                
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Start Date</Label>
                  <div className="col-span-3 grid grid-cols-3 gap-2">
                    <Select onValueChange={setStartYear} value={startYear}>
                      <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>
                        {years.map(y => <SelectItem key={`start-year-${y}`} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setStartMonth} value={startMonth}>
                      <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {months.map(m => <SelectItem key={`start-month-${m.value}`} value={m.value.toString()}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setStartDay} value={startDay} disabled={!startMonth || !startYear}>
                      <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                      <SelectContent>
                        {startDays.map(d => <SelectItem key={`start-day-${d}`} value={d.toString()}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">End Date</Label>
                  <div className="col-span-3 grid grid-cols-3 gap-2">
                    <Select onValueChange={setEndYear} value={endYear}>
                      <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>
                        {years.map(y => <SelectItem key={`end-year-${y}`} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setEndMonth} value={endMonth}>
                      <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {months.map(m => <SelectItem key={`end-month-${m.value}`} value={m.value.toString()}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setEndDay} value={endDay} disabled={!endMonth || !endYear}>
                      <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                      <SelectContent>
                        {endDays.map(d => <SelectItem key={`end-day-${d}`} value={d.toString()}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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
      <Sheet open={!!selectedRequest} onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {(userRole !== 'Member') && <TableHead>Employee</TableHead>}
                <TableHead>Dates</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading requests...</TableCell></TableRow>
              ) : allLeaveRequests && allLeaveRequests.length > 0 ? (
                allLeaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    {(userRole !== 'Member') && <TableCell className="font-medium">{request.employeeName}</TableCell>}
                    <TableCell className="font-medium">{`${formatDate(request.startDate)} - ${formatDate(request.endDate)}`}</TableCell>
                    <TableCell>{request.leaveType}</TableCell>
                    <TableCell>
                      <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                        {request.status.replace(/ by Team Lead| by HR/g, '')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <SheetTrigger asChild>
                            <DropdownMenuItem onClick={() => setSelectedRequest(request)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                          </SheetTrigger>
                           {userRole === 'Team Lead' && request.status === 'Pending' && request.employeeId !== user?.uid && (
                              <>
                                  <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRequestToReject(request)} className="text-destructive">
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </DropdownMenuItem>
                              </>
                          )}
                          {(userRole === 'HR Manager') && request.status === 'Pending HR Approval' && (
                              <>
                                  <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => setRequestToReject(request)} className="text-destructive">
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </DropdownMenuItem>
                              </>
                          )}
                          {userRole === 'CEO/Admin' && !['Approved', 'Rejected'].some(s => request.status.includes(s)) && (
                              <>
                                  <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')}>
                                      <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                  </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => setRequestToReject(request)} className="text-destructive">
                                      <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                  </DropdownMenuItem>
                              </>
                          )}
                          {isUserAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This action cannot be undone. This will permanently delete this leave request.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteRequest(request.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No leave requests found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {selectedRequest && (
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
                      <p className="font-semibold">{selectedRequest.employeeName}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                      <p className="font-semibold">{selectedRequest.leaveType}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Dates</p>
                      <p className="font-semibold">{`${formatDate(selectedRequest.startDate)} to ${formatDate(selectedRequest.endDate)}`}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Reason</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.reason}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge variant='outline' className={cn(statusVariantMap[selectedRequest.status])}>
                          {selectedRequest.status}
                      </Badge>
                  </div>
                  <Separator className="my-4" />
                  <h4 className="font-semibold">Approval History</h4>
                  <LeaveStatusTracker request={selectedRequest} users={users} />
              </div>
              </ScrollArea>
          </SheetContent>
        )}
      </Sheet>
        <AlertDialog open={!!requestToReject} onOpenChange={(isOpen) => { if (!isOpen) setRequestToReject(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reason for Rejection</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please provide a reason for rejecting this leave request. This will be shared with the employee.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., Conflicting schedule, project deadline..."
                />
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRejectionSubmit}>Confirm Rejection</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}

    