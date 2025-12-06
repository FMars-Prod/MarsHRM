
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
import { Input } from "@/components/ui/input";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";


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

  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [leaveType, setLeaveType] = React.useState<string>("");
  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>(initialLeaveData);
  
  const handleRequestStatus = (requestId: string, newStatus: 'Pending HR Approval' | 'Rejected') => {
    setLeaveRequests(prev => prev.map(req => req.id === requestId ? {...req, status: newStatus} : req));
  }

  const allLeaveRequests = userRole === 'Team Lead' ? leaveRequests : leaveRequests.filter(r => r.employee === 'Jane Smith');

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
                <Label htmlFor="startDate" className="text-right">
                  Start Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
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
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDate" className="text-right">
                  End Date
                </Label>
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "col-span-3 justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
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
              {userRole === 'Team Lead' && <TableHead>Employee</TableHead>}
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLeaveRequests.map((request) => (
              <TableRow key={request.id}>
                {userRole === 'Team Lead' && <TableCell className="font-medium">{request.employee}</TableCell>}
                <TableCell className="font-medium">{`${request.startDate} - ${request.endDate}`}</TableCell>
                <TableCell>{request.type}</TableCell>
                <TableCell>
                  <Badge variant='outline' className={cn(statusVariantMap[request.status])}>
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                        {userRole === 'Team Lead' && request.status === 'Pending' && request.employee !== 'Jane Smith' && (
                            <>
                                <Button variant="outline" size="sm" className="bg-green-500/20 text-green-700 hover:bg-green-500/30" onClick={() => handleRequestStatus(request.id, 'Pending HR Approval')}>
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
