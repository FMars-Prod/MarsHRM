"use client";

import { useState } from "react";
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
import { Label } from "@/componentsui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { attendanceData as initialData } from "@/lib/data";

type AttendanceRecord = (typeof initialData)[0];

export default function AttendancePage() {
  const [attendanceData, setAttendanceData] = useState(initialData);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [open, setOpen] = useState(false);

  const handleEditClick = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setOpen(true);
  };

  const handleSaveChanges = () => {
    // Logic to save changes would go here.
    // For now, we just close the dialog.
    if (editingRecord) {
        // Example of updating state:
        // setAttendanceData(attendanceData.map(r => r.id === editingRecord.id ? editingRecord : r));
    }
    setOpen(false);
    setEditingRecord(null);
  };

  return (
    <>
      <PageHeader
        title="Attendance Records"
        description="View and manage employee attendance."
      >
        <Button variant="outline">
          <Download className="mr-2" />
          Export to CSV
        </Button>
      </PageHeader>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceData.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.employee}</TableCell>
                <TableCell>{record.date}</TableCell>
                <TableCell>{record.clockIn}</TableCell>
                <TableCell>{record.clockOut}</TableCell>
                <TableCell>
                  <Badge variant={record.status === 'Present' ? 'default' : record.status === 'Late' ? 'secondary' : 'destructive'}
                    className={cn(
                        record.status === 'Present' && 'bg-green-500/20 text-green-700 border-transparent hover:bg-green-500/30',
                        record.status === 'Late' && 'bg-yellow-500/20 text-yellow-700 border-transparent hover:bg-yellow-500/30',
                        record.status === 'Absent' && 'bg-red-500/20 text-red-700 border-transparent hover:bg-red-500/30'
                    )}
                  >{record.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(record)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Manually adjust attendance for {editingRecord?.employee}. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockIn" className="text-right">
                Clock In
              </Label>
              <Input id="clockIn" defaultValue={editingRecord?.clockIn} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockOut" className="text-right">
                Clock Out
              </Label>
              <Input id="clockOut" defaultValue={editingRecord?.clockOut} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="reason" className="text-right pt-2">
                Reason
              </Label>
              <Textarea id="reason" placeholder="Enter reason for change..." className="col-span-3" required />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveChanges}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
