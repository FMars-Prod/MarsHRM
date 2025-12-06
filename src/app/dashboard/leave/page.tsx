
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
import { leaveData as initialLeaveData } from "@/lib/data";
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
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, getDaysInMonth, startOfToday } from "date-fns";

type LeaveRequest = (typeof initialLeaveData)[0] & { employee?: string };

const LeaveStatusTracker = ({ request, role }: { request: LeaveRequest, role: string }) => {
    const isApprovedByLead = request.status === 'Pending HR Approval' || request.status === 'Approved';
    const isApprovedByHR = request.status === 'Approved';
    const isRejected = request.status === 'Rejected';

    return (
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white", isApprovedByLead ? 'bg-green-500' : 'bg-yellow-500' )}>
                <Check className="h-4 w-4" />
              </div>
              <div className={cn("h-12 w-0.5", isApprovedByLead ? 'bg-green-500' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className="font-semibold">Submitted</h4>
              <p className="text-sm text-muted-foreground">Request submitted on {request.startDate}.</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full",
                isApprovedByLead ? 'bg-green-500 text-white' : isRejected ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
              )}>
                {isApprovedByLead ? <Check className="h-4 w-4" /> : isRejected ? <X className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div className={cn("h-12 w-0.5", isApprovedByHR ? 'bg-green-500' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className={cn("font-semibold", isRejected && "text-red-500")}>Team Lead Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByLead ? 'Approved by Team Lead.' : isRejected ? 'Rejected by Team Lead.' : 'Pending approval.'}
              </p>
            </div>
          </div>
           <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full",
                isApprovedByHR ? 'bg-green-500 text-white' : isRejected ? 'bg-gray-300 text-gray-500' : !isApprovedByLead ? 'bg-gray-300 text-gray-500' : 'bg-yellow-500 text-white'
              )}>
                {isApprovedByHR ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
            </div>
            <div>
              <h4 className={cn("font-semibold", !isApprovedByLead && "text-muted-foreground")}>HR Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByHR ? 'Approved by HR.' : isRejected ? 'Not sent to HR.' : !isApprovedByLead ? 'Waiting for Team Lead approval.' : 'Pending HR approval.'}
              </p>
            </div>
          </div>
        </div>
    )
}

const statusVariantMap: { [key: string]: any } = {
    'Approved': 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
    'Pending': 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
    'Pending HR Approval': 'bg-blue-500/20 text-blue-700 border-transparent hover:bg-blue-500/30',
    'Rejected': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30'
};


export default function LeavePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [user, firestore]
  );
  const { data: userData } = useDoc(userDocRef);
  const userRole = (userData as any)?.role || 'Member';

  const [leaveType, setLeaveType] = React.useState<string>("");
  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>(initialLeaveData);
  
  const [startYear, setStartYear] = React.useState<number | undefined>();
  const [startMonth, setStartMonth] = React.useState<number | undefined>();
  const [startDay, setStartDay] = React.useState<number | undefined>();

  const [endYear, setEndYear] = React.useState<number | undefined>();
  const [endMonth, setEndMonth] = React.useState<number | undefined>();
  const [endDay, setEndDay] = React.useState<number | undefined>();
  
  const handleRequestStatus = (requestId: string, newStatus: 'Pending HR Approval' | 'Approved' | 'Rejected') => {
    setLeaveRequests(prev => prev.map(req => req.id === requestId ? {...req, status: newStatus} : req));
  }

  const getVisibleRequests = () => {
    switch (userRole) {
      case 'HR Manager':
      case 'CEO/Admin':
        return leaveRequests;
      case 'Team Lead':
        return leaveRequests; // Team lead sees all for now, can be filtered to their team later
      case 'Member':
      default:
        // Assuming the logged in member is 'Jane Smith' for demo purposes
        return leaveRequests.filter(r => r.employee === 'John Doe' || r.employee === 'Jane Smith');
    }
  }

  const allLeaveRequests = getVisibleRequests();

  const today = startOfToday();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => ({ label: format(new Date(0, i), 'MMMM'), value: i }));
  
  const startDaysInMonth = (startYear && startMonth !== undefined) ? getDaysInMonth(new Date(startYear, startMonth)) : 31;
  const startDays = Array.from({ length: startDaysInMonth }, (_, i) => i + 1);

  const endDaysInMonth = (endYear && endMonth !== undefined) ? getDaysInMonth(new Date(endYear, endMonth)) : 31;
  const endDays = Array.from({ length: endDaysInMonth }, (_, i) => i + 1);
  
  const isStartPastMonth = (m: number) => startYear === currentYear && m < currentMonth;
  const isStartPastDay = (d: number) => startYear === currentYear && startMonth === currentMonth && d < currentDay;

  const getStartDate = () => {
    if (startYear && startMonth !== undefined && startDay) {
        return new Date(startYear, startMonth, startDay);
    }
    return today;
  }

  const startDate = getStartDate();

  const isEndPastYear = (y: number) => y < startDate.getFullYear();
  const isEndPastMonth = (m: number) => endYear === startDate.getFullYear() && m < startDate.getMonth();
  const isEndPastDay = (d: number) => endYear === startDate.getFullYear() && endMonth === startDate.getMonth() && d < startDate.getDate();


  return (
    <>
      <PageHeader
        title="Leave Management"
        description="Request time off and track your leave balance."
      >
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
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  Start Date
                </Label>
                <div className="col-span-3 grid grid-cols-3 gap-2">
                    <Select onValueChange={(v) => { setStartYear(Number(v)); setStartMonth(undefined); setStartDay(undefined); }} value={startYear?.toString()}>
                        <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(v) => { setStartMonth(Number(v)); setStartDay(undefined); }} value={startMonth?.toString()} disabled={!startYear}>
                        <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={m.value.toString()} disabled={isStartPastMonth(m.value)}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(v) => setStartDay(Number(v))} value={startDay?.toString()} disabled={!startYear || startMonth === undefined}>
                        <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                        <SelectContent>
                            {startDays.map(d => <SelectItem key={d} value={d.toString()} disabled={isStartPastDay(d)}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  End Date
                </Label>
                <div className="col-span-3 grid grid-cols-3 gap-2">
                    <Select onValueChange={(v) => { setEndYear(Number(v)); setEndMonth(undefined); setEndDay(undefined); }} value={endYear?.toString()} disabled={!startDay}>
                        <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y.toString()} disabled={isEndPastYear(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(v) => { setEndMonth(Number(v)); setEndDay(undefined); }} value={endMonth?.toString()} disabled={!endYear}>
                        <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={m.value.toString()} disabled={isEndPastMonth(m.value)}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={(v) => setEndDay(Number(v))} value={endDay?.toString()} disabled={!endYear || endMonth === undefined}>
                        <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                        <SelectContent>
                            {endDays.map(d => <SelectItem key={d} value={d.toString()} disabled={isEndPastDay(d)}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
              </div>
               <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="reason" className="text-right pt-2">
                  Reason
                </Label>
                <Textarea id="reason" placeholder="Provide a reason for your leave..." className="col-span-3" />
              </div>
              {leaveType === 'other' && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="otherReason" className="text-right pt-2">
                    Other Reason
                  </Label>
                  <Textarea id="otherReason" placeholder="Please specify..." className="col-span-3" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            {allLeaveRequests.map((request) => (
              <TableRow key={request.id}>
                {(userRole === 'Team Lead' || userRole === 'HR Manager' || userRole === 'CEO/Admin') && <TableCell className="font-medium">{request.employee}</TableCell>}
                <TableCell className="font-medium">{`${request.startDate} - ${request.endDate}`}</TableCell>
                <TableCell>{request.type}</TableCell>
                <TableCell>
                  <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        {userRole === 'Team Lead' && request.status === 'Pending' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Pending HR Approval')}>
                                    <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected')}>
                                    <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                </Button>
                            </>
                        )}
                         {(userRole === 'HR Manager' || userRole === 'CEO/Admin') && request.status === 'Pending HR Approval' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Approved')}>
                                    <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected')}>
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
                                        <p className="font-semibold">{request.employee}</p>
                                   </div>
                                   <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                                        <p className="font-semibold">{request.type}</p>
                                   </div>
                                   <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Dates</p>
                                        <p className="font-semibold">{`${request.startDate} to ${request.endDate}`}</p>
                                   </div>
                                   <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                                        <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                                            {request.status}
                                        </Badge>
                                   </div>
                                    <Separator className="my-4" />
                                    <h4 className="font-semibold">Approval History</h4>
                                    <LeaveStatusTracker request={request} role={userRole} />
                                </div>
                                </ScrollArea>
                            </SheetContent>
                        </Sheet>
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
