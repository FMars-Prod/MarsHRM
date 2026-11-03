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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
          <div className="flex items-center justify-center h-6 w-6 rounded-none bg-green-500 text-white shadow-sm">
            <Check className="h-4 w-4" />
          </div>
          <div className="h-16 w-0.5 bg-primary/20"></div>
        </div>
        <div className="text-left">
          <h4 className="font-black text-sm uppercase tracking-widest">Submitted</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">On {request.createdAt ? format(request.createdAt.toDate(), "PP") : '...'}.</p>
        </div>
      </div>
      
      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-none text-white shadow-sm",
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
          <h4 className={cn("font-black text-sm uppercase tracking-widest", isRejectedByLead && "text-red-500")}>Team Lead</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
            {leadSkipped && "Executive Override."}
            {!leadSkipped && isApprovedByLead && (request.approvedByTeamLeadId ? `Approved by ${teamLeadName}.` : 'Approved.')}
            {isRejectedByLead && `Rejected.`}
            {isPendingLead && 'Waiting.'}
          </p>
        </div>
      </div>

      <div className="flex items-center">
        <div className="flex flex-col items-center mr-4">
          <div className={cn("flex items-center justify-center h-6 w-6 rounded-none shadow-sm",
            !isApprovedByLead && !isRejectedByLead && "bg-gray-200 text-white",
            isPendingHR && "bg-yellow-500 text-white",
            isApprovedByHR && "bg-green-500 text-white",
            isRejectedByHR && "bg-red-500 text-white",
            isRejectedByLead && "bg-gray-200 text-white"
          )}>
            {isApprovedByHR && <Check className="h-4 w-4" />}
            {(isRejectedByHR || isRejectedByLead) && <X className="h-4 w-4" />}
            {(isPendingHR || isPendingLead) && <Clock className="h-4 w-4" />}
          </div>
        </div>
        <div className="flex-1 text-left">
          <h4 className={cn("font-black text-sm uppercase tracking-widest", 
              isRejectedByHR && "text-red-500",
              !isApprovedByLead && !isRejectedByLead && "text-muted-foreground/30"
          )}>HR Manager</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
            {isApprovedByHR && `Approved by ${hrName}.`}
            {isRejectedByHR && `Rejected.`}
            {isPendingHR && 'Waiting.'}
            {isPendingLead && 'Pending Lead.'}
          </p>
        </div>
      </div>
    </div>
  );
}

const statusVariantMap: { [key in LeaveStatus]: string } = {
    'Approved': 'bg-green-50 text-green-700 border-none shadow-sm',
    'Pending': 'bg-yellow-50 text-yellow-700 border-none shadow-sm',
    'Pending HR Approval': 'bg-blue-50 text-blue-700 border-none shadow-sm',
    'Rejected by Team Lead': 'bg-red-50 text-red-700 border-none shadow-sm',
    'Rejected by HR': 'bg-red-50 text-red-700 border-none shadow-sm',
    'Rejected': 'bg-red-50 text-red-700 border-none shadow-sm'
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
  const isExecutiveTier = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  const [category, setCategory] = React.useState<RequestCategory>("Leave");
  const [leaveType, setLeaveType] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<LeaveRequestWithId | null>(null);
  const [requestToReject, setRequestToReject] = React.useState<LeaveRequestWithId | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  
  const [showMissed, setShowMissed] = React.useState(false);
  
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
              toast({ title: "Captured", description: "GPS signal synced." });
          },
          () => {
              setIsCapturingSignal(false);
              toast({ variant: 'destructive', title: "Signal Error", description: "Enable location." });
          },
          { enableHighAccuracy: true }
      );
  };

  const handleRequestStatus = (requestId: string, newStatus: LeaveStatus, approverId: string, approvalField: string) => {
    updateDocumentNonBlocking(doc(firestore, 'leave_requests', requestId), { status: newStatus, [approvalField]: approverId });
    toast({ title: `Status: ${newStatus}` });
  }

  const handleRejectRequest = () => {
    if (!requestToReject || !user) return;
    const newStatus: LeaveStatus = isExecutiveTier ? 'Rejected by HR' : 'Rejected by Team Lead';
    updateDocumentNonBlocking(doc(firestore, 'leave_requests', requestToReject.id), {
      status: newStatus,
      rejectionReason: rejectionReason || 'Request rejected by authority',
      ...(isExecutiveTier ? { approvedByHRId: user.uid } : { approvedByTeamLeadId: user.uid })
    });
    toast({ title: `Request Rejected`, description: `Marked as ${newStatus}` });
    setRequestToReject(null);
    setRejectionReason("");
  }

  const handleDeleteRequest = (requestId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'leave_requests', requestId));
    toast({ title: 'Request Removed' });
  }

  const handleCreateRequest = () => {
    if (!user || !userData || !reason || !startDay || !startMonth || !startYear || !leaveType) {
        toast({ variant: "destructive", title: "Missing Fields" });
        return;
    }
    if (category === 'WFH' && !wfhCoords) {
        toast({ variant: 'destructive', title: "Signal Required" });
        return;
    }
    setIsRequesting(true);
    const fromDate = new Date(parseInt(startYear), parseInt(startMonth), parseInt(startDay));
    let toDate = fromDate;
    if (category !== "Hour Permission") {
        if (!endDay || !endMonth || !endYear) { toast({ variant: "destructive", title: "End Date Required" }); setIsRequesting(false); return; }
        toDate = new Date(parseInt(endYear), parseInt(endMonth), parseInt(endDay));
        if (toDate < fromDate) { toast({ variant: "destructive", title: "Invalid Range" }); setIsRequesting(false); return; }
    }
    const isManagement = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';
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
      <PageHeader title="Leave Management" description="Submit and track your requests.">
        <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-none h-11 px-6 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest"><PlusCircle className="mr-2 size-4" /> New Request</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden text-left border-none shadow-3xl">
              <DialogHeader className="p-8 border-b bg-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Submit Request</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Submit a leave or WFH notification</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] p-8 bg-muted/5 text-left">
                  <div className="grid gap-6 text-left">
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Request Type</Label>
                          <Select value={category} onValueChange={(val: RequestCategory) => setCategory(val)}>
                              <SelectTrigger className="rounded-none h-11 font-bold"><SelectValue /></SelectTrigger>
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
                              <SelectTrigger className="rounded-none h-11 font-bold"><SelectValue placeholder="Select" /></SelectTrigger>
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
                          <div className="p-6 bg-primary/5 rounded-none border-2 border-dashed border-primary/20 space-y-4 text-center">
                              <p className="text-[10px] font-bold uppercase text-muted-foreground opacity-60">Authorize residential coordinates</p>
                              <Button type="button" variant="outline" size="sm" className="w-full rounded-none h-11 uppercase text-[10px] font-black bg-white shadow-sm border-none ring-1 ring-border" onClick={handleCaptureSignal} disabled={isCapturingSignal}>
                                  {isCapturingSignal ? <Loader2 className="size-4 animate-spin mr-2"/> : <LocateFixed className="size-4 mr-2 text-primary" />} Capture GPS Signal
                              </Button>
                          </div>
                      )}
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Start Date</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Select onValueChange={setStartYear} value={startYear}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartMonth} value={startMonth}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartDay} value={startDay} disabled={!startMonth}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{startDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                          </div>
                      </div>
                      {category !== "Hour Permission" && (
                          <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">End Date</Label>
                              <div className="grid grid-cols-3 gap-2">
                                  <Select onValueChange={setEndYear} value={endYear}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                                  <Select onValueChange={setEndMonth} value={endMonth}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                                  <Select onValueChange={setEndDay} value={endDay} disabled={!endMonth}><SelectTrigger className="rounded-none font-bold h-11"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{endDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                              </div>
                          </div>
                      )}
                      <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Mission Context / Reason</Label>
                          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide specific details..." className="rounded-none min-h-[100px] font-medium text-sm" />
                      </div>
                  </div>
              </ScrollArea>
              <div className="p-8 border-t bg-white">
                <Button onClick={handleCreateRequest} disabled={isRequesting} className="w-full rounded-none h-14 font-black uppercase tracking-widest shadow-2xl">Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
      </PageHeader>

      <div className="border-none ring-1 ring-border/50 rounded-none overflow-hidden bg-white shadow-xl">
          <Table>
            <TableHeader className="bg-muted/10 border-b">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 px-8">Employee</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Mission Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Range</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Approval</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-6 px-8">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestsLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20">Scanning Registry...</TableCell></TableRow>
              ) : displayLeaveRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No active requests.</TableCell></TableRow>
              ) : displayLeaveRequests.map((request) => (
                  <TableRow key={request.id} className="border-border/50 hover:bg-primary/5 transition-colors group">
                    <TableCell className="py-6 px-8 font-black text-sm uppercase tracking-tight">{request.employeeName}</TableCell>
                    <TableCell className="py-6"><Badge variant="outline" className="rounded-none uppercase text-[8px] font-black bg-muted/20 border-none px-2.5 h-5">{request.category}</Badge></TableCell>
                    <TableCell className="py-6 text-xs font-bold uppercase text-muted-foreground">
                        {request.category === 'Hour Permission' ? format(request.startDate.toDate(), 'PP') : `${format(request.startDate.toDate(), 'dd MMM')} — ${format(request.endDate.toDate(), 'dd MMM')}`}
                    </TableCell>
                    <TableCell className="py-6">
                      <Badge className={cn("rounded-none uppercase text-[8px] font-black px-3 h-6", statusVariantMap[request.status])}>
                        {request.status.split(' ')[0]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-6 px-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-9 w-9 hover:bg-muted/50 transition-colors"><MoreHorizontal className="h-4.5 w-4.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-none shadow-2xl p-2 w-56 text-left">
                          <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 px-3 py-2">Oversight</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelectedRequest(request)} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 hover:bg-primary/5"><Eye className="size-4 text-primary"/> Details</DropdownMenuItem>
                           
                           {userRole === 'Team Lead' && request.status === 'Pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 text-emerald-600 hover:bg-emerald-50"><Check className="size-4"/> Approve</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRequestToReject(request); setRejectionReason(""); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 text-rose-600 hover:bg-rose-50"><X className="size-4"/> Reject</DropdownMenuItem>
                              </>
                          )}
                          {isExecutiveTier && (request.status === 'Pending' || request.status === 'Pending HR Approval') && (
                              <>
                                <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 text-emerald-600 hover:bg-emerald-50"><Check className="size-4"/> Approve</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setRequestToReject(request); setRejectionReason(""); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 text-rose-600 hover:bg-rose-50"><X className="size-4"/> Reject</DropdownMenuItem>
                              </>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {(isExecutiveTier || request.employeeId === user?.uid) && <DropdownMenuItem onClick={() => handleDeleteRequest(request.id)} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 py-3 px-3 text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /> Remove</DropdownMenuItem>}
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
          <SheetContent className="rounded-none border-none shadow-3xl flex flex-col sm:max-w-md p-0 overflow-hidden">
              <SheetHeader className="p-8 pb-6 border-b shrink-0 text-left bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-none text-[8px] font-black uppercase tracking-widest h-5 px-3 border-primary/20 bg-primary/5 text-primary">{selectedRequest.category}</Badge>
                  </div>
                  <SheetTitle className="text-2xl font-black uppercase tracking-tighter text-slate-900">Request Hub</SheetTitle>
                  <SheetDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40">Ref: {selectedRequest.id.slice(0,8).toUpperCase()}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-8 space-y-8 pb-20 text-left">
                    <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Period</p><p className="font-black text-lg uppercase tracking-tight text-slate-800">{format(selectedRequest.startDate.toDate(), 'PP')} — {format(selectedRequest.endDate.toDate(), 'PP')}</p></div>
                    <div className="space-y-2 p-6 bg-white ring-1 ring-border shadow-sm rounded-none border-l-4 border-primary">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Mission Context</p>
                        <p className="text-sm font-medium text-slate-700 italic leading-relaxed">"{selectedRequest.reason}"</p>
                    </div>
                    <Separator className="opacity-50" />
                    <div className="space-y-6 text-left">
                        <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-primary">Approval Pipeline</h4>
                        <LeaveStatusTracker request={selectedRequest} users={users} />
                    </div>
                </div>
              </ScrollArea>
          </SheetContent>
        )}
      </Sheet>
      <Dialog open={!!requestToReject} onOpenChange={(open) => !open && setRequestToReject(null)}>
        <DialogContent className="sm:max-w-md rounded-none p-0 overflow-hidden text-left border-none shadow-3xl">
          <DialogHeader className="p-8 border-b bg-white">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-rose-600">Reject Request</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
              Provide justification for declining {requestToReject?.employeeName}'s {requestToReject?.category} request.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-4 bg-muted/5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reason for Rejection</Label>
              <Textarea 
                placeholder="State specific operational or scheduling reason..." 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                className="rounded-none min-h-[100px] font-medium text-sm"
              />
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-white gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestToReject(null)} className="rounded-none uppercase font-black text-xs">Cancel</Button>
            <Button onClick={handleRejectRequest} className="rounded-none uppercase font-black text-xs bg-rose-600 hover:bg-rose-700 text-white">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
