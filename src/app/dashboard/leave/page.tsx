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
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye, Clock, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2, History, Timer, MapPin, Briefcase, LocateFixed, Signal, ExternalLink, Loader2 } from "lucide-react";
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
import { doc, collection, query, where, serverTimestamp, or } from "firebase/firestore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfToday, getDaysInMonth, getYear, getMonth, getDate, isBefore } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type LeaveStatus = 'Pending' | 'Pending HR Approval' | 'Approved' | 'Rejected' | 'Rejected by Team Lead' | 'Rejected by HR';
type RequestCategory = 'Leave' | 'Hour Permission' | 'WFH';

type LeaveRequest = {
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string;
  startDate: any;
  endDate: any;
  startTime?: string;
  endTime?: string;
  category: RequestCategory;
  leaveType?: string;
  reason: string;
  status: LeaveStatus;
  approvedByTeamLeadId?: string | null;
  approvedByHRId?: string | null;
  rejectionReason?: string;
  createdAt: any;
  latitude?: number;
  longitude?: number;
};

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    reportingHeadIds?: string[];
    teamId?: string | null;
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
          <div className="flex items-center justify-center h-6 w-6 rounded-none bg-green-500 text-white">
            <Check className="h-4 w-4" />
          </div>
          <div className="h-16 w-0.5 bg-primary/20"></div>
        </div>
        <div className="text-left">
          <h4 className="font-semibold text-sm uppercase font-black">Submitted</h4>
          <p className="text-xs text-muted-foreground">On {request.createdAt ? format(request.createdAt.toDate(), "PP") : '...'}.</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-none text-white",
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
        <div className="flex-1 text-left">
          <h4 className={cn("font-semibold text-sm uppercase font-black", isRejectedByLead && "text-red-500")}>Team Lead</h4>
          <p className="text-xs text-muted-foreground">
            {leadSkipped && "Executive Override."}
            {!leadSkipped && isApprovedByLead && (request.approvedByTeamLeadId ? `Approved by ${teamLeadName}.` : 'Approved.')}
            {isRejectedByLead && `Rejected.`}
            {isPendingLead && 'Pending.'}
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-none",
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
        <div className="flex-1 text-left">
          <h4 className={cn("font-semibold text-sm uppercase font-black", 
              isRejectedByHR && "text-red-500",
              !isApprovedByLead && !isRejectedByLead && "text-muted-foreground"
          )}>HR Manager</h4>
          <p className="text-xs text-muted-foreground">
            {isApprovedByHR && `Approved by ${hrName}.`}
            {isRejectedByHR && `Rejected.`}
            {isPendingHR && 'Pending HR.'}
            {isPendingLead && 'Waiting.'}
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
  const isExecutiveTier = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  const [category, setCategory] = React.useState<RequestCategory>("Leave");
  const [leaveType, setLeaveType] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequestWithId | null>(null);
  
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [requestToReject, setRequestToReject] = React.useState<LeaveRequestWithId | null>(null);
  const [showMissed, setShowMissed] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  
  const [wfhCoords, setWfhCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingSignal, setIsCapturingSignal] = React.useState(false);

  const currentYear = getYear(new Date());
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, name: format(new Date(0, i), 'MMMM') }));

  const [startDay, setStartDay] = React.useState<string | undefined>();
  const [startMonth, setStartMonth] = React.useState<string | undefined>();
  const [startYear, setStartYear] = React.useState<string | undefined>(currentYear.toString());
  
  const [endDay, setEndDay] = React.useState<string | undefined>();
  const [endMonth, setEndMonth] = React.useState<string | undefined>();
  const [endYear, setEndYear] = React.useState<string | undefined>(currentYear.toString());

  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("17:00");

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

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const reportingSubordinateIds = React.useMemo(() => {
      if (!user || !users) return [];
      return users.filter(u => u.reportingHeadIds?.includes(user.uid)).map(u => u.id);
  }, [user, users]);

  const allTeamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
  const { data: allTeams } = useCollection<Team>(allTeamsQuery);

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!user || !userRole) return null;
    const baseQuery = collection(firestore, 'leave_requests');
    if (userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD') return query(baseQuery);
    if (userRole === 'Team Lead') {
      const ids = Array.from(new Set([user.uid, ...teamMemberIds, ...reportingSubordinateIds]));
      if (ids.length > 0) return query(baseQuery, where('employeeId', 'in', ids.slice(0, 30)));
    }
    return query(baseQuery, where('employeeId', '==', user.uid));
  }, [firestore, user, userRole, teamMemberIds, reportingSubordinateIds]);
  
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

  const handleCaptureSignal = () => {
      setIsCapturingSignal(true);
      navigator.geolocation.getCurrentPosition(
          (p) => {
              setWfhCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
              setIsCapturingSignal(false);
              toast({ title: "Captured", description: "GPS coordinates saved." });
          },
          () => {
              setIsCapturingSignal(false);
              toast({ variant: 'destructive', title: "Error", description: "Enable location services." });
          },
          { enableHighAccuracy: true }
      );
  };

  const handleRequestStatus = (requestId: string, newStatus: LeaveStatus, approverId: string, approvalField: string) => {
    updateDocumentNonBlocking(doc(firestore, 'leave_requests', requestId), { status: newStatus, [approvalField]: approverId });
    toast({ title: `Updated to ${newStatus}` });
  }

  const handleDeleteRequest = (requestId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'leave_requests', requestId));
    toast({ title: 'Request Deleted' });
  }

  const handleCreateRequest = () => {
    if (!user || !userData || !reason || !startDay || !startMonth || !startYear || !leaveType) {
        toast({ variant: "destructive", title: "Missing fields" });
        return;
    }
    if (category === 'WFH' && !wfhCoords) {
        toast({ variant: 'destructive', title: "Location required" });
        return;
    }
    setIsRequesting(true);
    const fromDate = new Date(parseInt(startYear), parseInt(startMonth), parseInt(startDay));
    let toDate = fromDate;
    if (category !== "Hour Permission") {
        if (!endDay || !endMonth || !endYear) { toast({ variant: "destructive", title: "End date required" }); setIsRequesting(false); return; }
        toDate = new Date(parseInt(endYear), parseInt(endMonth), parseInt(endDay));
        if (toDate < fromDate) { toast({ variant: "destructive", title: "Invalid range" }); setIsRequesting(false); return; }
    }
    const isManagement = userRole === 'HR Manager' || userRole === 'CEO/Admin';
    const initialStatus: LeaveStatus = (userRole === 'Team Lead' || isManagement) ? 'Pending HR Approval' : 'Pending';
    const newRequest: LeaveRequest = {
        employeeId: user.uid, employeeName: `${(userData as any).firstName} ${(userData as any).lastName}`,
        employeeJobTitle: (userData as any).jobTitle, startDate: fromDate, endDate: toDate,
        category, reason, status: initialStatus, createdAt: serverTimestamp(), leaveType,
    }
    if (category === "Hour Permission") { newRequest.startTime = startTime; newRequest.endTime = endTime; }
    if (category === 'WFH' && wfhCoords) { newRequest.latitude = wfhCoords.lat; newRequest.longitude = wfhCoords.lng; }
    addDocumentNonBlocking(collection(firestore, 'leave_requests'), newRequest).then(() => {
          toast({ title: "Request Submitted" });
          setIsRequesting(false);
    }).catch(() => setIsRequesting(false));
  }

  return (
    <>
      <PageHeader title="Leave Management" description="Submit and track your leave or WFH requests.">
        <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-none h-11 shadow-lg"><PlusCircle className="mr-2 size-4" /> New Request</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden text-left">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">Submit Request</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] p-6 pt-0 text-left">
                  <div className="grid gap-6 pt-6">
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Type</Label>
                          <Select value={category} onValueChange={(val: RequestCategory) => setCategory(val)}>
                              <SelectTrigger className="rounded-none h-11"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                  <SelectItem value="Leave">Full Day Leave</SelectItem>
                                  <SelectItem value="Hour Permission">Hour Permission</SelectItem>
                                  <SelectItem value="WFH">Work From Home</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reason Category</Label>
                          <Select onValueChange={setLeaveType} value={leaveType}>
                              <SelectTrigger className="rounded-none h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent className="rounded-none">
                                  <SelectItem value="Vacation">Vacation</SelectItem>
                                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                  <SelectItem value="Personal">Personal</SelectItem>
                                  <SelectItem value="Work From Home">Work From Home</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {category === 'WFH' && (
                          <div className="p-4 bg-primary/5 rounded-none border-2 border-dashed border-primary/20 space-y-4">
                              <Button type="button" variant="outline" size="sm" className="w-full rounded-none h-10 uppercase text-[10px] font-black" onClick={handleCaptureSignal} disabled={isCapturingSignal}>
                                  {isCapturingSignal ? <Loader2 className="size-3 animate-spin mr-2"/> : <LocateFixed className="size-3 mr-2" />} Capture My Location
                              </Button>
                          </div>
                      )}
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Start Date</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Select onValueChange={setStartYear} value={startYear}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartMonth} value={startMonth}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartDay} value={startDay} disabled={!startMonth}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{startDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                          </div>
                      </div>
                      {category !== "Hour Permission" && (
                          <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">End Date</Label>
                              <div className="grid grid-cols-3 gap-2">
                                  <Select onValueChange={setEndYear} value={endYear}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                                  <Select onValueChange={setEndMonth} value={endMonth}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                                  <Select onValueChange={setEndDay} value={endDay} disabled={!endMonth}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{endDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                              </div>
                          </div>
                      )}
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Description</Label>
                          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide details..." className="rounded-none min-h-[100px]" />
                      </div>
                  </div>
              </ScrollArea>
              <DialogFooter className="p-6 pt-0"><Button onClick={handleCreateRequest} disabled={isRequesting} className="w-full rounded-none h-14 font-black uppercase tracking-widest shadow-xl">Submit Request</Button></DialogFooter>
            </DialogContent>
          </Dialog>
      </PageHeader>

      <div className="border rounded-none overflow-hidden bg-white/50 shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-black uppercase py-4">Employee</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Dates</TableHead>
                <TableHead className="text-[10px] font-black uppercase py-4">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase py-4 px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestsLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse">Loading...</TableCell></TableRow>
              ) : displayLeaveRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center opacity-40">No active requests.</TableCell></TableRow>
              ) : displayLeaveRequests.map((request) => (
                  <TableRow key={request.id} className="border-border/50">
                    <TableCell className="py-4 font-bold">{request.employeeName}</TableCell>
                    <TableCell className="py-4"><Badge variant="outline" className="rounded-none uppercase text-[8px] font-black">{request.category}</Badge></TableCell>
                    <TableCell className="py-4 text-xs">
                        {request.category === 'Hour Permission' ? format(request.startDate.toDate(), 'PP') : `${format(request.startDate.toDate(), 'dd MMM')} - ${format(request.endDate.toDate(), 'dd MMM')}`}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant='outline' className={cn("rounded-none uppercase text-[8px] font-black", statusVariantMap[request.status])}>
                        {request.status.split(' ')[0]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-none"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none">
                          <SheetTrigger asChild><DropdownMenuItem onClick={() => setSelectedRequest(request)} className="rounded-none"><Eye className="mr-2 h-4 w-4"/> Details</DropdownMenuItem></SheetTrigger>
                           {userRole === 'Team Lead' && request.status === 'Pending' && (
                              <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')} className="text-green-600 rounded-none"><Check className="mr-2 h-4 w-4"/> Approve</DropdownMenuItem>
                          )}
                          {isExecutiveTier && (request.status === 'Pending' || request.status === 'Pending HR Approval') && (
                              <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')} className="text-green-600 rounded-none"><Check className="mr-2 h-4 w-4"/> Approve</DropdownMenuItem>
                          )}
                          {isExecutiveTier && <DropdownMenuItem onClick={() => handleDeleteRequest(request.id)} className="text-destructive rounded-none"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
      </div>

      <Sheet open={!!selectedRequest} onOpenChange={o => !o && setSelectedRequest(null)}>
        {selectedRequest && (
          <SheetContent className="rounded-none border-none shadow-2xl flex flex-col sm:max-w-md p-0">
              <SheetHeader className="p-8 pb-6 border-b shrink-0 text-left">
                  <SheetTitle className="text-xl font-black uppercase tracking-tighter">Request Details</SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-8 pb-20 text-left">
                    <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Period</p><p className="font-bold text-sm">{format(selectedRequest.startDate.toDate(), 'PP')} — {format(selectedRequest.endDate.toDate(), 'PP')}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Reason</p><p className="text-sm italic">"{selectedRequest.reason}"</p></div>
                    <Separator />
                    <div className="space-y-4 text-left"><h4 className="font-black uppercase text-[10px] tracking-widest text-primary">Approval Progress</h4><LeaveStatusTracker request={selectedRequest} users={users} /></div>
                </div>
              </ScrollArea>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
