
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
import { PlusCircle, FileText, Download, Search, CheckCircle, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, getDocs } from "firebase/firestore";

type Report = { id: string; date: any; summary: string };
type TeamMember = { id: string; firstName: string; lastName: string; jobTitle: string; };

export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = React.useState<TeamMember | null>(null);
  const [isAddReportDialogOpen, setIsAddReportDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // This should get the current user's team members
  const teamMembersQuery = useMemoFirebase(() => {
    if (!user) return null;
    // For a Team Lead, this query would be more complex, e.g., querying users by teamId
    // For now, we'll just show all users as an example of the UI
    return query(collection(firestore, "users"), where('role', '!=', 'CEO/Admin'));
  }, [firestore, user]);

  const { data: usersData, isLoading: areUsersLoading } = useCollection<TeamMember>(teamMembersQuery);

  const reportsQuery = useMemoFirebase(() => {
      if (!selectedMember) return null;
      return query(collection(firestore, `users/${selectedMember.id}/reports`), orderBy('date', 'desc'));
  }, [firestore, selectedMember]);
  
  const { data: memberReports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const handleAddReport = (memberId: string, summary: string) => {
    if (!summary) {
        toast({ variant: 'destructive', title: 'Summary is required' });
        return;
    }
    const reportPayload = {
      date: new Date(),
      summary: summary
    }
    addDocumentNonBlocking(collection(firestore, `users/${memberId}/reports`), reportPayload);

    toast({
        title: "Report Saved",
        description: `Work report for ${selectedMember?.firstName} has been saved.`
    });
    setIsAddReportDialogOpen(false);
  };

  const handleExport = () => {
    if (!selectedMember || !memberReports || memberReports.length === 0) {
        toast({
            variant: "destructive",
            title: "No reports to export",
        });
        return;
    }

    const headers = ["Date", "Summary"];
    const csvRows = [
        headers.join(','),
        ...memberReports.map(report => {
            const date = `"${format(new Date(report.date.toDate()), "PPpp")}"`;
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
    link.setAttribute('download', `${selectedMember.firstName}'s Reports.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExportAll = async () => {
    if (!usersData || usersData.length === 0) {
        toast({ variant: "destructive", title: "No data to export" });
        return;
    }

    const headers = ["Team Member", "Job Title", "Report Date", "Report Summary"];
    const csvRows = [headers.join(',')];

    for (const member of usersData) {
        const reportsSnapshot = await getDocs(query(collection(firestore, `users/${member.id}/reports`), orderBy('date', 'desc')));
        const reports = reportsSnapshot.docs.map(d => d.data() as Report);
        
        if (reports.length > 0) {
            reports.forEach(report => {
                const row = [
                    `"${member.firstName} ${member.lastName}"`,
                    `"${member.jobTitle}"`,
                    `"${format(report.date.toDate(), "PPpp")}"`,
                    `"${report.summary.replace(/"/g, '""')}"`
                ];
                csvRows.push(row.join(','));
            });
        } else {
            const row = [
                `"${member.firstName} ${member.lastName}"`,
                `"${member.jobTitle}"`,
                "N/A",
                "No reports"
            ];
            csvRows.push(row.join(','));
        }
    }


    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'All_Team_Reports.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const filteredUserData = usersData?.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <>
      <PageHeader
        title="Team Reports"
        description="View your team members and their work reports."
      >
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by name..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <Button onClick={handleExportAll}>
            <Download className="mr-2" />
            Export All as CSV
            </Button>
        </div>
      </PageHeader>
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
              {areUsersLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center h-24">Loading team members...</TableCell></TableRow>
              ) : filteredUserData?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                     {member.firstName} {member.lastName}
                  </TableCell>
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
              <SheetTitle>{selectedMember.firstName}'s Reports</SheetTitle>
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
                              <DialogTitle>New Report for {selectedMember.firstName}</DialogTitle>
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
                {areReportsLoading ? (<p>Loading reports...</p>) : 
                memberReports && memberReports.length > 0 ? (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Summary</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {memberReports.map(report => (
                                    <TableRow key={report.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {format(new Date(report.date.toDate()), "MMM d, yyyy 'at' h:mm a")}
                                        </TableCell>
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
