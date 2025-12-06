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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calendar as CalendarIcon, Check, X, Eye } from "lucide-react";
import { leaveData } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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

const LeaveStatusTracker = () => (
    <div className="space-y-6">
      <div className="flex items-start">
        <div className="flex flex-col items-center mr-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500 text-white">
            <Check className="h-5 w-5" />
          </div>
          <div className="h-16 w-0.5 bg-green-500"></div>
        </div>
        <div>
          <h4 className="font-semibold">Submitted</h4>
          <p className="text-sm text-muted-foreground">You submitted this request on July 26, 2024.</p>
        </div>
      </div>
      <div className="flex items-start">
        <div className="flex flex-col items-center mr-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-500 text-white">
            <Clock className="h-5 w-5" />
          </div>
          <div className="h-16 w-0.5 bg-gray-200"></div>
        </div>
        <div>
          <h4 className="font-semibold">Team Lead Approval</h4>
          <p className="text-sm text-muted-foreground">Pending approval from your team lead.</p>
        </div>
      </div>
       <div className="flex items-start">
        <div className="flex flex-col items-center mr-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-300 text-gray-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-muted-foreground">HR Approval</h4>
          <p className="text-sm text-muted-foreground">Waiting for Team Lead approval.</p>
        </div>
      </div>
    </div>
)


export default function LeavePage() {
  const [date, setDate] = React.useState<Date>();

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
                <Select>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
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
                            "w-[240px] justify-start text-left font-normal col-span-3",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
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
                            "w-[240px] justify-start text-left font-normal col-span-3",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
              </div>
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
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveData.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{`${request.startDate} - ${request.endDate}`}</TableCell>
                <TableCell>{request.type}</TableCell>
                <TableCell>
                  <Badge variant={request.status === 'Approved' ? 'default' : request.status === 'Pending' ? 'secondary' : 'destructive'}
                    className={cn(
                        request.status === 'Approved' && 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
                        request.status === 'Pending' && 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
                        request.status === 'Rejected' && 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30'
                    )}
                  >{request.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
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
                                    Track the approval status of your request.
                                </SheetDescription>
                            </SheetHeader>
                            <Separator className="my-4" />
                            <div className="space-y-4">
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
                                    <Badge variant={request.status === 'Approved' ? 'default' : request.status === 'Pending' ? 'secondary' : 'destructive'}
                                        className={cn(
                                            request.status === 'Approved' && 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
                                            request.status === 'Pending' && 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
                                            request.status === 'Rejected' && 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30'
                                        )}
                                    >{request.status}</Badge>
                               </div>
                                <Separator className="my-4" />
                                <h4 className="font-semibold">Approval History</h4>
                                <LeaveStatusTracker />
                            </div>
                        </SheetContent>
                    </Sheet>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
