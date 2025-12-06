
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
import { format, getDaysInMonth, startOfToday, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type LeaveRequest = (typeof initialLeaveData)[0] & { employee?: string };
type LeaveStatus = 'Pending' | 'Pending HR Approval' | 'Approved' | 'Rejected by Team Lead' | 'Rejected by HR' | 'Rejected';

const LeaveStatusTracker = ({ request }: { request: LeaveRequest }) => {
    const isSubmitted = true;
    const isApprovedByLead = ['Pending HR Approval', 'Approved', 'Rejected by HR'].includes(request.status);
    const isRejectedByLead = request.status === 'Rejected by Team Lead';
    const isApprovedByHR = request.status === 'Approved';
    const isRejectedByHR = request.status === 'Rejected by HR';


    return (
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white bg-green-500")}>
                <Check className="h-4 w-4" />
              </div>
              <div className={cn("h-12 w-0.5", (isApprovedByLead || isRejectedByLead) ? 'bg-green-500' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className="font-semibold">Submitted</h4>
              <p className="text-sm text-muted-foreground">Request submitted for {request.startDate}.</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white",
                isApprovedByLead && 'bg-green-500',
                isRejectedByLead && 'bg-red-500',
                !isApprovedByLead && !isRejectedByLead && 'bg-yellow-500'
              )}>
                {isApprovedByLead && <Check className="h-4 w-4" />}
                {isRejectedByLead && <X className="h-4 w-4" />}
                {!isApprovedByLead && !isRejectedByLead && <Clock className="h-4 w-4" />}
              </div>
              <div className={cn("h-12 w-0.5", isApprovedByHR || isRejectedByHR ? 'bg-green-500' : 'bg-gray-200')}></div>
            </div>
            <div>
              <h4 className={cn("font-semibold", isRejectedByLead && "text-red-500")}>Team Lead Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByLead && 'Approved by Team Lead.'}
                {isRejectedByLead && 'Rejected by Team Lead.'}
                {!isApprovedByLead && !isRejectedByLead && 'Pending approval.'}
              </p>
            </div>
          </div>
           <div className="flex items-center">
            <div className="flex flex-col items-center mr-4">
              <div className={cn("flex items-center justify-center h-6 w-6 rounded-full text-white",
                isApprovedByHR && 'bg-green-500',
                isRejectedByHR && 'bg-red-500',
                !(isApprovedByLead || isRejectedByLead) && 'bg-gray-300',
                (isApprovedByLead && !isRejectedByHR && !isApprovedByHR) && 'bg-yellow-500',
                isRejectedByLead && 'bg-gray-300',
              )}>
                {isApprovedByHR && <Check className="h-4 w-4" />}
                {isRejectedByHR && <X className="h-4 w-4" />}
                {!(isApprovedByHR || isRejectedByHR) && <Clock className="h-4 w-4" />}
              </div>
            </div>
            <div>
              <h4 className={cn("font-semibold", isRejectedByHR && "text-red-500", !(isApprovedByLead || isRejectedByLead) && "text-muted-foreground")}>HR Approval</h4>
              <p className="text-sm text-muted-foreground">
                {isApprovedByHR && 'Approved by HR.'}
                {isRejectedByHR && 'Rejected by HR.'}
                {isRejectedByLead && 'Not applicable.'}
                {!isApprovedByLead && !isRejectedByLead && 'Waiting for Team Lead approval.'}
                {isApprovedByLead && !isApprovedByHR && !isRejectedByHR && 'Pending HR approval.'}
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
    'Rejected by Team Lead': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30',
    'Rejected by HR': 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30',
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
  const [startDate, setStartDate] = React.useState<Date>();
  const [endDate, setEndDate] = React.useState<Date>();
  
  const handleRequestStatus = (requestId: string, newStatus: LeaveStatus) => {
    setLeaveRequests(prev => prev.map(req => req.id === requestId ? {...req, status: newStatus} : req));
  }

  const getVisibleRequests = () => {
    switch (userRole) {
      case 'CEO/Admin':
        return leaveRequests;
      case 'HR Manager':
         // HR and CEO see requests approved by TL, or already actioned by HR
        return leaveRequests.filter(r => ['Pending HR Approval', 'Approved', 'Rejected by HR', 'Rejected by Team Lead'].includes(r.status));
      case 'Team Lead':
        // Team lead sees all for now, can be filtered to their team later
        return leaveRequests;
      case 'Member':
      default:
        // Assuming the logged in member is 'John Doe' for demo purposes
        return leaveRequests.filter(r => r.employee === 'John Doe');
    }
  }

  const allLeaveRequests = getVisibleRequests();

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
                  <Label htmlFor="start-date" className="text-right">Start Date</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              id="start-date"
                              variant={"outline"}
                              className={cn(
                                  "col-span-3 justify-start text-left font-normal",
                                  !startDate && "text-muted-foreground"
                              )}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={setStartDate}
                              disabled={(date) => date < startOfToday()}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="end-date" className="text-right">End Date</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              id="end-date"
                              variant={"outline"}
                              className={cn(
                                  "col-span-3 justify-start text-left font-normal",
                                  !endDate && "text-muted-foreground"
                              )}
                              disabled={!startDate}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={setEndDate}
                              disabled={(date) => date < (startDate || startOfToday())}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
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
                    {request.status.replace(/ by Team Lead| by HR/g, '')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        {userRole === 'CEO/Admin' && !['Approved', 'Rejected'].includes(request.status) && (
                             <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Approved')}>
                                    <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected')}>
                                    <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                </Button>
                            </>
                        )}
                        {userRole === 'Team Lead' && request.status === 'Pending' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Pending HR Approval')}>
                                    <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected by Team Lead')}>
                                    <ThumbsDown className="mr-2 h-4 w-4"/> Reject
                                </Button>
                            </>
                        )}
                         {(userRole === 'HR Manager') && request.status === 'Pending HR Approval' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Approved')}>
                                    <ThumbsUp className="mr-2 h-4 w-4"/> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="bg-red-500/20 text-red-700 hover:bg-red-500/30" onClick={() => handleRequestStatus(request.id, 'Rejected by HR')}>
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
                                    <LeaveStatusTracker request={request} />
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
