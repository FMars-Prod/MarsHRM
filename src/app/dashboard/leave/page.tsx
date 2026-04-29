
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
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye, Clock, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2, History } from "lucide-react";
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
import { format, startOfToday, getDaysInMonth, getYear, getMonth, getDate, isBefore } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Checkbox } from "@/components/ui/checkbox";

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

  const isApprovedByLead = ['Pending HR Approval', 'Approved', 'Rejected by HR'].includes(request.status);
  const isRejectedByLead = request.status === 'Rejected by Team Lead';
  const isApprovedByHR = request.status === 'Approved';
  const isRejectedByHR = request.status === 'Rejected by HR' || request.status === 'Rejected';

  const isPendingLead = request.status === 'Pending';
  const isPendingHR = request.status === 'Pending HR Approval';

  const leadSkipped = !request.approvedByTeamLeadId && isApprovedByLead;

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500 text-white">
            <Check className="h-4 w-4" />
          </div>
          <div className="h-16 w-0.5 bg-primary/20"></div>
        </div>
        <div>
          <h4 className="font-semibold">Submitted</h4>
          <p className="text-sm text-muted-foreground">Submitted on {request.createdAt ? format(request.createdAt.toDate(), "PP") : '...'}.</p>
        </div>
      </div>
      
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
            {leadSkipped && "Skipped (No Team Lead)."}
            {!leadSkipped && isApprovedByLead && (request.approvedByTeamLeadId ? `Approved by ${teamLeadName}.` : 'Pending.')}
            {isRejectedByLead && `Rejected.`}
            {isPendingLead && 'Pending approval.'}
          </p>
        </div>
      </div>

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
            {isRejectedByHR && `Rejected.`}
            {isPendingHR && 'Pending HR approval.'}
            {isPendingLead && 'Waiting for Team Lead.'}
          </p>
        </div>
      </div>
    </div>
  );
}

const statusVariantMap: { [key in LeaveStatus]: string } = {
    'Approved': 'bg-green-500/20 text-green-700 border-transparent',
    'Pending': 'bg-yellow-500/20 text-yellow-700 border-transparent',
    'Pending HR Approval': 'bg-blue-500/20 text-blue-700 border-transparent',
    'Rejected by Team Lead': 'bg-red-500/20 text-red-700 border-transparent',
    'Rejected by HR': 'bg-red-500/20 text-red-700 border-transparent',
    'Rejected': 'bg-red-500/20 text-red-700 border-transparent'
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
  const [showMissed, setShowMissed] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  
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

  const allTeamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
  const { data: allTeams } = useCollection<Team>(allTeamsQuery);

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
        return query(baseQuery, where('employeeId', '==', '-----'));
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
  
  const displayLeaveRequests = React.useMemo(() => {
    if (!leaveRequests) return [];
    const today = startOfToday();
    return leaveRequests.filter(request => {
      const startDate = request.startDate?.toDate ? request.startDate.toDate() : new Date(request.startDate);
      const isPast = isBefore(startDate, today);
      if (showMissed) return isPast;
      return !isPast;
    });
  }, [leaveRequests, showMissed]);

  const isLoading = usersLoading || requestsLoading;

  React.useEffect(() => {
    setSelectedIds([]);
  }, [showMissed, leaveRequests]);
  
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

  const handleBulkDelete = () => {
    selectedIds.forEach(id => {
      deleteDocumentNonBlocking(doc(firestore, 'leave_requests', id));
    });
    setSelectedIds([]);
    toast({ title: `${selectedIds.length} Requests Deleted` });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(displayLeaveRequests.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleRejectionSubmit = () => {
    if (!requestToReject || !rejectionReason) {
        toast({ variant: 'destructive', title: 'Reason Required' });
        return;
    }
    if (!user) return;

    let newStatus: LeaveStatus;
    let approvalField: string;

    if (userRole === 'Team Lead') {
        newStatus = 'Rejected by Team Lead';
        approvalField = 'approvedByTeamLeadId';
    } else {
        newStatus = 'Rejected by HR';
        approvalField = 'approvedByHRId';
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
        toast({ variant: "destructive", title: "Missing Info" });
        return;
    }
    setIsRequesting(true);
    
    const fromDate = new Date(parseInt(startYear), parseInt(startMonth), parseInt(startDay));
    const toDate = new Date(parseInt(endYear), parseInt(endMonth), parseInt(endDay));

    if (toDate < fromDate) {
        toast({ variant: "destructive", title: "Invalid Dates" });
        setIsRequesting(false);
        return;
    }

    const userTeam = allTeams?.find(t => t.id === (userData as any).teamId);
    const hasTeamLead = !!userTeam?.teamLeadId;
    const isUserTeamLead = userRole === 'Team Lead';
    const isManagement = userRole === 'HR Manager' || userRole === 'CEO/Admin';

    const initialStatus: LeaveStatus = (isUserTeamLead || !hasTeamLead || isManagement) ? 'Pending HR Approval' : 'Pending';

    const newRequest: LeaveRequest = {
        employeeId: user.uid,
        employeeName: `${(userData as any).firstName} ${(userData as any).lastName}`,
        employeeJobTitle: (userData as any).jobTitle,
        startDate: fromDate,
        endDate: toDate,
        leaveType,
        reason,
        status: initialStatus,
        createdAt: serverTimestamp(),
    }
    
    addDocumentNonBlocking(collection(firestore, 'leave_requests'), newRequest)
      .then(() => {
          toast({ title: "Request Submitted" });
          setLeaveType("");
          setReason("");
          setIsRequesting(false);
      })
      .catch(() => setIsRequesting(false));
  }

  const formatDate = (timestamp: any) => timestamp ? format(timestamp.toDate(), 'PP') : '';

  return (
    <>
      <PageHeader
        title="Leave Management"
        description="Request time off and track approvals."
        className="animate-fade-in-up"
      >
        <div className="flex gap-2">
          {isUserAdmin && selectedIds.length > 0 && (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2">
                          <Trash2 className="size-4" />
                          Delete ({selectedIds.length})
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Bulk Delete Requests</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you want to delete {selectedIds.length} selected leave requests?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}
          {isUserAdmin && (
            <Button 
              variant={showMissed ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setShowMissed(!showMissed)}
              className="gap-2"
            >
              {showMissed ? <History className="size-4" /> : <Clock className="size-4" />}
              {showMissed ? "Viewing Missed" : "Missed Leaves"}
            </Button>
          )}
          {userRole === 'Member' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusCircle className="mr-2 size-4" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Leave Request</DialogTitle>
                  <DialogDescription>Submit your time off details.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-x-4 gap-y-2">
                    <Label htmlFor="leaveType" className="text-left sm:text-right">Type</Label>
                    <Select onValueChange={setLeaveType}>
                        <SelectTrigger className="col-span-1 sm:col-span-3">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Vacation">Vacation</SelectItem>
                            <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                            <SelectItem value="Personal">Personal</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-x-4 gap-y-2">
                    <Label className="text-left sm:text-right pt-2">Start</Label>
                    <div className="col-span-1 sm:col-span-3 grid grid-cols-3 gap-2">
                      <Select onValueChange={setStartYear} value={startYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                      <Select onValueChange={setStartMonth} value={startMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                      <Select onValueChange={setStartDay} value={startDay} disabled={!startMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{startDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-x-4 gap-y-2">
                    <Label className="text-left sm:text-right pt-2">End</Label>
                    <div className="col-span-1 sm:col-span-3 grid grid-cols-3 gap-2">
                      <Select onValueChange={setEndYear} value={endYear}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                      <Select onValueChange={setEndMonth} value={endMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                      <Select onValueChange={setEndDay} value={endDay} disabled={!endMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{endDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-x-4 gap-y-2">
                    <Label htmlFor="reason" className="text-left sm:text-right pt-2">Reason</Label>
                    <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="col-span-1 sm:col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateRequest} disabled={isRequesting}>Submit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </PageHeader>
      <Sheet open={!!selectedRequest} onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}>
        <div className="border rounded-lg overflow-x-auto animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Table>
            <TableHeader>
              <TableRow>
                {isUserAdmin && (
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedIds.length === displayLeaveRequests.length && displayLeaveRequests.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                {(userRole !== 'Member') && <TableHead>Employee</TableHead>}
                <TableHead>Dates</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow><TableCell colSpan={isUserAdmin ? 6 : 5} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : displayLeaveRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={isUserAdmin ? 6 : 5} className="h-24 text-center text-muted-foreground">{showMissed ? "No missed records found." : "No upcoming leave records found."}</TableCell></TableRow>
              ) : displayLeaveRequests.map((request) => (
                  <TableRow key={request.id} className="bg-gradient-to-br from-primary/5 to-transparent">
                    {isUserAdmin && (
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(request.id)}
                          onCheckedChange={(checked) => handleSelectRow(request.id, !!checked)}
                        />
                      </TableCell>
                    )}
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
                            <DropdownMenuItem onClick={() => setSelectedRequest(request)}>View Details</DropdownMenuItem>
                          </SheetTrigger>
                           {userRole === 'Team Lead' && request.status === 'Pending' && (
                              <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')}>Approve</DropdownMenuItem>
                          )}
                          {(userRole === 'HR Manager' || userRole === 'CEO/Admin') && request.status === 'Pending HR Approval' && (
                              <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')}>Final Approve</DropdownMenuItem>
                          )}
                          {isUserAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Request
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the leave request.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteRequest(request.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {selectedRequest && (
          <SheetContent>
              <SheetHeader>
                  <SheetTitle>Request Details</SheetTitle>
              </SheetHeader>
              <Separator className="my-4" />
              <div className="space-y-4">
                  <div><p className="text-xs text-muted-foreground">Reason</p><p className="text-sm">{selectedRequest.reason}</p></div>
                  <h4 className="font-semibold text-sm">Approval Tracker</h4>
                  <LeaveStatusTracker request={selectedRequest} users={users} />
              </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
