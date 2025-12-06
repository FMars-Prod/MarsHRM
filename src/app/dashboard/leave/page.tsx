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
import { PlusCircle, Calendar as CalendarIcon, Check, X } from "lucide-react";
import { leaveData } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as React from "react";

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
              <TableHead>Employee</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveData.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.employee}</TableCell>
                <TableCell>{`${request.startDate} - ${request.endDate}`}</TableCell>
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
                  {request.status === 'Pending' ? (
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700 hover:bg-green-100">
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-100">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No actions</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
