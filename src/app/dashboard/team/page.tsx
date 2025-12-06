
"use client";

import * as React from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, FileText, Download } from "lucide-react";
import { teamData as initialTeamData } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type Report = { id: string; date: string; summary: string };
type TeamMember = { id: string; name: string; jobTitle: string; reports: Report[] };

export default function TeamPage() {
  const [teamData, setTeamData] = React.useState<TeamMember[]>(initialTeamData);
  const [selectedMember, setSelectedMember] = React.useState<TeamMember | null>(null);
  const { toast } = useToast();
  const [isAddReportDialogOpen, setIsAddReportDialogOpen] = React.useState(false);

  const handleAddReport = (memberId: string, summary: string) => {
    const today = new Date().toLocaleDateString();
    const member = teamData.find(m => m.id === memberId);
    const hasReportForToday = member?.reports.some(report => new Date(report.date).toLocaleDateString() === today);

    if (hasReportForToday) {
        toast({
            variant: "destructive",
            title: "Report already submitted",
            description: "A report for this team member has already been submitted today.",
        });
        return;
    }

    const newReport: Report = {
        id: `r${Date.now()}`,
        date: new Date().toLocaleString(), // Includes date and time
        summary,
    };

    setTeamData(prevData =>
        prevData.map(member => {
            if (member.id === memberId) {
                const updatedMember = { ...member, reports: [newReport, ...member.reports] };
                if (selectedMember?.id === memberId) {
                    setSelectedMember(updatedMember);
                }
                return updatedMember;
            }
            return member;
        })
    );
    toast({
        title: "Report Saved",
        description: `Work report for ${selectedMember?.name} has been saved.`
    });
    setIsAddReportDialogOpen(false);
  };

  const handleExport = () => {
    if (!selectedMember || selectedMember.reports.length === 0) {
        toast({
            variant: "destructive",
            title: "No reports to export",
        });
        return;
    }

    const headers = ["Date", "Summary"];
    const csvRows = [
        headers.join(','),
        ...selectedMember.reports.map(report => {
            const date = `"${report.date}"`;
            const summary = `"${report.summary.replace(/"/g, '""')}"`;
            return [date, summary].join(',');
        })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
        URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${selectedMember.name.replace(/\s/g, '_')}_reports.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


  return (
    <>
      <PageHeader
        title="Team Management"
        description="View your team members and their work reports."
      />
      <Sheet>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamData.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.jobTitle}</TableCell>
                  <TableCell className="text-right">
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedMember(member)}>
                        <FileText className="mr-2" />
                        View Reports
                      </Button>
                    </SheetTrigger>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {selectedMember && (
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{selectedMember.name}'s Reports</SheetTitle>
              <SheetDescription>
                Review and add work reports for this team member.
              </SheetDescription>
            </SheetHeader>
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="flex gap-2">
                <Dialog open={isAddReportDialogOpen} onOpenChange={setIsAddReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlusCircle className="mr-2" />
                      Add New Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <form onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const summary = formData.get("summary") as string;
                          if (summary && selectedMember) {
                              handleAddReport(selectedMember.id, summary);
                          }
                      }}>
                          <DialogHeader>
                              <DialogTitle>New Report for {selectedMember.name}</DialogTitle>
                              <DialogDescription>
                              Enter the details of the work report below.
                              </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                              <Label htmlFor="summary">Report Summary</Label>
                              <Textarea id="summary" name="summary" placeholder="Describe the work accomplished..." required />
                              </div>
                          </div>
                          <DialogFooter>
                              <DialogClose asChild>
                                  <Button type="button" variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button type="submit">Save Report</Button>
                          </DialogFooter>
                      </form>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2"/>
                    Export as CSV
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <h4 className="font-semibold">Existing Reports</h4>
                {selectedMember.reports.length > 0 ? (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Summary</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedMember.reports.map(report => (
                                    <TableRow key={report.id}>
                                        <TableCell className="text-sm text-muted-foreground">{report.date}</TableCell>
                                        <TableCell>{report.summary}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No reports found for this team member.
                  </p>
                )}
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
