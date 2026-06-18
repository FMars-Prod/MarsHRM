
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
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye, Clock, ThumbsUp, ThumbsDown, MoreHorizontal, Trash2, History, Timer, MapPin, Briefcase, LocateFixed, Signal, ExternalLink } from "lucide-react";
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
          <h4 className="font-semibold text-sm uppercase font-black">Submitted</h4>
          <p className="text-xs text-muted-foreground">Submitted on {request.createdAt ? format(request.createdAt.toDate(), "PP") : '...'}.</p>
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
          <h4 className={cn("font-semibold text-sm uppercase font-black", isRejectedByLead && "text-red-500")}>Team Lead Approval</h4>
          <p className="text-xs text-muted-foreground">
            {leadSkipped && "Skipped (Executive Override)."}
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
          <h4 className={cn("font-semibold text-sm uppercase font-black", 
              isRejectedByHR && "text-red-500",
              !isApprovedByLead && !isRejectedByLead && "text-muted-foreground"
          )}>HR Approval</h4>
          <p className="text-xs text-muted-foreground">
            {isApprovedByHR && `Approved by ${hrName}.`}
            {isRejectedByHR && `Rejected.`}
            {isPendingHR && 'Pending HR approval.'}
            {isPendingLead && 'Waiting for primary authentication.'}
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
  
  // WFH Location States
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
  
  const handleCaptureSignal = () => {
      setIsCapturingSignal(true);
      navigator.geolocation.getCurrentPosition(
          (p) => {
              setWfhCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
              setIsCapturingSignal(false);
              toast({ title: "WFH Signal Captured", description: "GPS coordinates anchored to request." });
          },
          () => {
              setIsCapturingSignal(false);
              toast({ variant: 'destructive', title: "Signal Lost", description: "Please enable location services." });
          },
          { enableHighAccuracy: true }
      );
  };

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
    toast({ title: 'Request Deleted' });
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
    if (!requestToReject) return;
    if (!user) return;

    let newStatus: LeaveStatus;
    let approvalField: string;

    if (userRole === 'Team Lead' && requestToReject.status === 'Pending') {
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
      rejectionReason: rejectionReason.trim() || null,
    });

    toast({ title: `Request Rejected` });
    setRequestToReject(null);
    setRejectionReason("");
  }

  const handleCreateRequest = () => {
    if (!user || !userData || !reason || !startDay || !startMonth || !startYear) {
        toast({ variant: "destructive", title: "Missing Info" });
        return;
    }

    if (!leaveType) {
        toast({ variant: "destructive", title: "Select leave classification" });
        return;
    }

    if (category === 'WFH' && !wfhCoords) {
        toast({ variant: 'destructive', title: "Location Required", description: "Please capture your WFH signal." });
        return;
    }

    setIsRequesting(true);
    
    const fromDate = new Date(parseInt(startYear), parseInt(startMonth), parseInt(startDay));
    let toDate = fromDate;

    if (category !== "Hour Permission") {
        if (!endDay || !endMonth || !endYear) {
            toast({ variant: "destructive", title: "End date required" });
            setIsRequesting(false);
            return;
        }
        toDate = new Date(parseInt(endYear), parseInt(endMonth), parseInt(endDay));
        if (toDate < fromDate) {
            toast({ variant: "destructive", title: "Invalid date range" });
            setIsRequesting(false);
            return;
        }
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
        category,
        reason,
        status: initialStatus,
        createdAt: serverTimestamp(),
        leaveType: leaveType,
    }

    if (category === "Hour Permission") {
        newRequest.startTime = startTime;
        newRequest.endTime = endTime;
    }

    if (category === 'WFH' && wfhCoords) {
        newRequest.latitude = wfhCoords.lat;
        newRequest.longitude = wfhCoords.lng;
    }
    
    addDocumentNonBlocking(collection(firestore, 'leave_requests'), newRequest)
      .then(() => {
          toast({ title: "Request Submitted" });
          setLeaveType("");
          setReason("");
          setCategory("Leave");
          setWfhCoords(null);
          setIsRequesting(false);
      })
      .catch(() => setIsRequesting(false));
  }

  const formatDateLabel = (timestamp: any) => timestamp ? format(timestamp.toDate(), 'PP') : '';

  return (
    <>
      <PageHeader
        title="Leave & WFH Requests"
        description="Manage your professional absence and remote work authorizations."
        className="animate-fade-in-up"
      >
        <div className="flex gap-2">
          {isExecutiveTier && selectedIds.length > 0 && (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-2 rounded-full">
                          <Trash2 className="size-4" />
                          Delete ({selectedIds.length})
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                      <AlertDialogHeader>
                          <AlertDialogTitle className="font-black uppercase tracking-tighter">Confirm Deletion</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove {selectedIds.length} records. This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full font-bold uppercase text-xs">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold uppercase text-xs">Confirm Delete</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}
          {isExecutiveTier && (
            <Button 
              variant={showMissed ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setShowMissed(!showMissed)}
              className="gap-2 rounded-full"
            >
              {showMissed ? <History className="size-4" /> : <Clock className="size-4" />}
              {showMissed ? "Archive View" : "Past Requests"}
            </Button>
          )}
          {userRole === 'Member' && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full shadow-lg">
                  <PlusCircle className="mr-2 size-4" />
                  New Submission
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Tactical Submission</DialogTitle>
                  <DialogDescription>Submit a formal request for absence or remote sector operations.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="grid gap-6 p-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Request Type</Label>
                            <Select value={category} onValueChange={(val: RequestCategory) => setCategory(val)}>
                                <SelectTrigger className="rounded-xl h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Leave">Full Day Leave</SelectItem>
                                    <SelectItem value="Hour Permission">Hour Permission</SelectItem>
                                    <SelectItem value="WFH">Work From Home (Remote Sector)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Classification</Label>
                            <Select onValueChange={setLeaveType} value={leaveType}>
                                <SelectTrigger className="rounded-xl h-11">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Vacation">Vacation</SelectItem>
                                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                    <SelectItem value="Personal">Personal</SelectItem>
                                    <SelectItem value="Strategic Shift">Strategic Shift (WFH)</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {category === 'WFH' && (
                            <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-4 animate-fade-in-up">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <Signal className="size-3" /> Remote Signal
                                    </Label>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 rounded-full text-[9px] font-black uppercase tracking-widest px-4 border border-primary/20 hover:bg-primary/5"
                                        onClick={handleCaptureSignal}
                                        disabled={isCapturingSignal}
                                    >
                                        {isCapturingSignal ? <Loader2 className="size-3 animate-spin mr-2"/> : <LocateFixed className="size-3 mr-2" />} 
                                        Capture Mission Signal
                                    </Button>
                                </div>
                                {wfhCoords && (
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/10">
                                        <div>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase">LAT</p>
                                            <p className="text-xs font-mono font-bold text-primary">{wfhCoords.lat.toFixed(6)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-bold text-muted-foreground uppercase">LNG</p>
                                            <p className="text-xs font-mono font-bold text-primary">{wfhCoords.lng.toFixed(6)}</p>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[9px] text-muted-foreground italic font-bold">Approved location will be authorized for shift logging during this period.</p>
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">{category === "Hour Permission" ? "Mission Date" : "Start Date"}</Label>
                            <div className="grid grid-cols-3 gap-2">
                            <Select onValueChange={setStartYear} value={startYear}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartMonth} value={startMonth}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                            <Select onValueChange={setStartDay} value={startDay} disabled={!startMonth}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{startDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>

                        {category !== "Hour Permission" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">End Date</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <Select onValueChange={setEndYear} value={endYear}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
                                    <Select onValueChange={setEndMonth} value={endMonth}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.name}</SelectItem>)}</SelectContent></Select>
                                    <Select onValueChange={setEndDay} value={endDay} disabled={!endMonth}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{endDays.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}</SelectContent></Select>
                                </div>
                            </div>
                        )}

                        {category === "Hour Permission" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Start Time</Label>
                                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="rounded-xl h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">End Time</Label>
                                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="rounded-xl h-11" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Reason / Description</Label>
                            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Please explain the strategic reason for this request..." className="rounded-2xl min-h-[100px]" />
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="p-6 pt-0">
                  <Button onClick={handleCreateRequest} disabled={isRequesting} className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">Finalize Submission</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </PageHeader>

      <Sheet open={!!selectedRequest} onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}>
        <div className="border rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                {isExecutiveTier && (
                  <TableHead className="w-[50px] py-4 px-6">
                    <Checkbox 
                      checked={selectedIds.length === displayLeaveRequests.length && displayLeaveRequests.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                {(userRole !== 'Member') && <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Employee</TableHead>}
                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Type</TableHead>
                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Dates & Time</TableHead>
                <TableHead className="font-black uppercase tracking-tighter text-[10px] py-4">Status</TableHead>
                <TableHead className="text-right font-black uppercase tracking-tighter text-[10px] py-4 px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow><TableCell colSpan={isExecutiveTier ? 6 : 5} className="h-32 text-center animate-pulse font-bold text-muted-foreground uppercase text-xs">Loading logs...</TableCell></TableRow>
              ) : displayLeaveRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={isExecutiveTier ? 6 : 5} className="h-32 text-center text-muted-foreground italic font-medium">{showMissed ? "No archived records found." : "No active requests in queue."}</TableCell></TableRow>
              ) : displayLeaveRequests.map((request) => (
                  <TableRow key={request.id} className="border-border/50 group">
                    {isExecutiveTier && (
                      <TableCell className="py-4 px-6">
                        <Checkbox 
                          checked={selectedIds.includes(request.id)}
                          onCheckedChange={(checked) => handleSelectRow(request.id, !!checked)}
                        />
                      </TableCell>
                    )}
                    {(userRole !== 'Member') && (
                        <TableCell className="py-4 font-bold">
                            <div className="flex flex-col">
                                <span>{request.employeeName}</span>
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">{request.employeeJobTitle}</span>
                            </div>
                        </TableCell>
                    )}
                    <TableCell className="py-4">
                        <Badge variant="outline" className={cn(
                            "rounded-full text-[9px] uppercase font-black tracking-widest gap-1 border-none",
                            request.category === 'Hour Permission' ? 'bg-orange-100 text-orange-700' : 
                            request.category === 'WFH' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        )}>
                            {request.category === 'Hour Permission' ? <Timer className="size-2.5"/> : 
                             request.category === 'WFH' ? <MapPin className="size-2.5"/> : <Briefcase className="size-2.5"/>}
                            {request.category}
                        </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                        <div className="flex flex-col">
                            <span className="font-bold text-xs">
                                {request.category === 'Hour Permission' ? format(request.startDate.toDate(), 'PP') : `${formatDateLabel(request.startDate)} - ${formatDateLabel(request.endDate)}`}
                            </span>
                            {request.category === 'Hour Permission' && (
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest">{request.startTime} - {request.endTime}</span>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant='outline' className={cn("rounded-full uppercase text-[9px] font-black tracking-widest", statusVariantMap[request.status])}>
                        {request.status.replace(/ by Team Lead| by HR/g, '')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4 px-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <SheetTrigger asChild>
                            <DropdownMenuItem onClick={() => setSelectedRequest(request)} className="font-bold text-xs uppercase tracking-tight"><Eye className="mr-2 h-3.5 w-3.5"/> View Details</DropdownMenuItem>
                          </SheetTrigger>
                           {userRole === 'Team Lead' && request.status === 'Pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Pending HR Approval', user!.uid, 'approvedByTeamLeadId')} className="text-green-600 font-bold text-xs uppercase tracking-tight"><Check className="mr-2 h-3.5 w-3.5"/> Approve</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRequestToReject(request)} className="text-red-600 font-bold text-xs uppercase tracking-tight"><ThumbsDown className="mr-2 h-3.5 w-3.5"/> Reject</DropdownMenuItem>
                              </>
                          )}
                          {isExecutiveTier && (request.status === 'Pending' || request.status === 'Pending HR Approval') && (
                              <>
                                <DropdownMenuItem onClick={() => handleRequestStatus(request.id, 'Approved', user!.uid, 'approvedByHRId')} className="text-green-600 font-bold text-xs uppercase tracking-tight">
                                    <Check className="mr-2 h-3.5 w-3.5"/> {request.status === 'Pending' ? 'Direct Approve' : 'Finalize'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRequestToReject(request)} className="text-red-600 font-bold text-xs uppercase tracking-tight">
                                    <ThumbsDown className="mr-2 h-3.5 w-3.5"/> Reject</DropdownMenuItem>
                              </>
                          )}
                          {isExecutiveTier && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive font-bold text-xs uppercase tracking-tight">
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-black uppercase tracking-tighter">Purge Record</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove this tactical submission from the ledger.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-full font-bold uppercase text-xs">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteRequest(request.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold uppercase text-xs">
                                    Confirm Purge
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

        <Dialog open={!!requestToReject} onOpenChange={(o) => !o && setRequestToReject(null)}>
            <DialogContent className="rounded-3xl sm:max-w-md border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Deny Authorization</DialogTitle>
                    <DialogDescription>Provide an optional reason for rejecting {requestToReject?.employeeName}'s submission.</DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Rejection Justification (Optional)</Label>
                    <Textarea 
                        value={rejectionReason} 
                        onChange={e => setRejectionReason(e.target.value)} 
                        placeholder="e.g., Critical in-office briefing required or sector signal invalid..." 
                        className="rounded-2xl min-h-[120px] bg-muted/20 border-muted"
                    />
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setRequestToReject(null)} className="rounded-full h-11 flex-1 font-bold uppercase text-[10px]">Go Back</Button>
                    <Button onClick={handleRejectionSubmit} variant="destructive" className="rounded-full h-11 flex-1 font-bold uppercase text-[10px] shadow-lg shadow-red-600/20">Confirm Rejection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {selectedRequest && (
          <SheetContent className="rounded-l-3xl border-none shadow-2xl flex flex-col sm:max-w-md p-0">
              <SheetHeader className="p-8 pb-6 border-b shrink-0">
                  <SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">Submission Intelligence</SheetTitle>
                  <SheetDescription>ID: {selectedRequest.id.slice(0, 8)} • {selectedRequest.category} Submission</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-8 pb-20">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Type</p><Badge variant="secondary" className="rounded-lg">{selectedRequest.category}</Badge></div>
                        {selectedRequest.leaveType && <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Class</p><p className="font-bold">{selectedRequest.leaveType}</p></div>}
                    </div>

                    {selectedRequest.category === 'WFH' && selectedRequest.latitude && (
                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><MapPin className="size-3"/> Requested Sector Coordinates</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-[8px] font-bold text-muted-foreground uppercase">LAT</p><p className="text-xs font-mono font-bold">{selectedRequest.latitude}</p></div>
                                <div><p className="text-[8px] font-bold text-muted-foreground uppercase">LNG</p><p className="text-xs font-mono font-bold">{selectedRequest.longitude}</p></div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full h-9 rounded-xl text-[10px] font-bold uppercase gap-2 bg-white" asChild>
                                <Link href={`https://www.google.com/maps/search/?api=1&query=${selectedRequest.latitude},${selectedRequest.longitude}`} target="_blank">
                                    <ExternalLink className="size-3"/> Verify On Satellite
                                </Link>
                            </Button>
                        </div>
                    )}
                    
                    <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Temporal Period</p>
                        <p className="font-bold text-sm">
                            {selectedRequest.category === 'Hour Permission' ? format(selectedRequest.startDate.toDate(), 'PPPP') : `${formatDateLabel(selectedRequest.startDate)} — ${formatDateLabel(selectedRequest.endDate)}`}
                        </p>
                        {selectedRequest.category === 'Hour Permission' && (
                            <p className="text-primary font-black uppercase text-xs tracking-widest mt-1">{selectedRequest.startTime} - {selectedRequest.endTime}</p>
                        )}
                    </div>

                    <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reason / Justification</p><p className="text-sm italic leading-relaxed whitespace-pre-wrap text-foreground/80">"{selectedRequest.reason}"</p></div>
                    
                    {selectedRequest.rejectionReason && (
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-[10px] font-black uppercase text-red-700 mb-1">Rejection Justification</p>
                            <p className="text-sm font-medium italic text-red-900">"{selectedRequest.rejectionReason}"</p>
                        </div>
                    )}

                    <Separator className="opacity-50" />
                    
                    <div className="space-y-4">
                        <h4 className="font-black uppercase text-[10px] tracking-[0.2em] text-primary">Hierarchy Authorization Status</h4>
                        <LeaveStatusTracker request={selectedRequest} users={users} />
                    </div>
                </div>
              </ScrollArea>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

