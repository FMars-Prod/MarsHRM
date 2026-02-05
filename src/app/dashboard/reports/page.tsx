
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, FileText, Download, Search, Star, Filter, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, getYear, getMonth, getDaysInMonth, isValid } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, getDocs } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

type Report = { id: string; date: any; summary: string; };
type UserData = { id: string; firstName: string; lastName: string; jobTitle: string; role: string; };
type Team = { id: string; memberIds: string[] };

export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedMember, setSelectedMember] = React.useState<UserData | null>(null);
  const [isAddReportDialogOpen, setIsAddReportDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [filterYear, setFilterYear] = React.useState<string | undefined>();
  const [filterMonth, setFilterMonth] = React.useState<string | undefined>();
  const [filterDay, setFilterDay] = React.useState<string | undefined>();
  const [filterDate, setFilterDate] = React.useState<Date | undefined>();

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc(userDocRef);
  const userRole = (currentUserData as any)?.role;

  const teamQuery = useMemoFirebase(() => {
    if (!user || userRole !== 'Team Lead') return null;
    return query(collection(firestore, 'teams'), where('teamLeadId', '==', user.uid));
  }, [firestore, user, userRole]);

  const { data: teamsData, isLoading: areTeamsLoading } = useCollection<Team>(teamQuery);

  const teamMemberIds = React.useMemo(() => {
    if (!teamsData || teamsData.length === 0) return [];
    return teamsData.flatMap(team => team.memberIds.filter(id => id !== user?.uid)); // Team lead doesn't report on themselves
  }, [teamsData, user]);

  const membersQuery = useMemoFirebase(() => {
    if (userRole === 'Team Lead') {
      if (teamMemberIds.length === 0) return null;
      return query(collection(firestore, "users"), where('id', 'in', teamMemberIds));
    }
    if (userRole === 'HR Manager' || userRole === 'CEO/Admin') {
      // HR/CEO can see reports of Team Leads and Members.
      return query(collection(firestore, "users"), where('role', 'in', ['Team Lead', 'Member']));
    }
    return null;
  }, [firestore, userRole, teamMemberIds]);

  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserData>(membersQuery);

  React.useEffect(() => {
    if (filterYear && filterMonth && filterDay) {
      const newDate = new Date(parseInt(filterYear), parseInt(filterMonth), parseInt(filterDay));
      if (isValid(newDate) && newDate <= new Date()) {
        setFilterDate(newDate);
      } else {
        setFilterDate(undefined);
      }
    } else {
      setFilterDate(undefined);
    }
  }, [filterYear, filterMonth, filterDay]);

  const reportsQuery = useMemoFirebase(() => {
    if (!selectedMember) return null;
    let q = query(collection(firestore, `users/${selectedMember.id}/reports`), orderBy('date', 'desc'));
    if (filterDate) {
        q = query(q, 
            where('date', '>=', startOfDay(filterDate)),
            where('date', '<=', endOfDay(filterDate))
        );
    }
    return q;
  }, [firestore, selectedMember, filterDate]);
  
  const { data: memberReports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);
  
  const currentYear = getYear(new Date());
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), name: format(new Date(0, i), 'MMMM') }));

  const daysInMonth = (filterYear && filterMonth) ? getDaysInMonth(new Date(parseInt(filterYear), parseInt(filterMonth))) : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());


  const handleAddReport = async (memberId: string, summary: string) => {
    if (!summary) {
        toast({ variant: 'destructive', title: 'Summary is required' });
        return;
    }
    const reportPayload = {
      date: new Date(),
      summary: summary,
    }
    
    await addDocumentNonBlocking(collection(firestore, `users/${memberId}/reports`), reportPayload);
    
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
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${selectedMember.firstName}_${selectedMember.lastName}_Reports.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const handleExportAll = async () => {
    const usersToExport = filteredUserData;
    if (!usersToExport || usersToExport.length === 0) {
        toast({ variant: "destructive", title: "No data to export" });
        return;
    }

    const headers = ["Team Member", "Job Title", "Report Date", "Report Summary"];
    const csvRows = [headers.join(',')];

    for (const member of usersToExport) {
        const reportsSnapshot = await getDocs(query(collection(firestore, `users/${member.id}/reports`), orderBy('date', 'desc')));
        const reports = reportsSnapshot.docs.map(d => d.data() as Report);
        
        if (reports.length > 0) {
            reports.forEach(report => {
                const row = [
                    `"${member.firstName} ${member.lastName}"`,
                    `"${member.jobTitle}"`,
                    `"${format(report.date.toDate(), "PPpp")}"`,
                    `"${report.summary.replace(/"/g, '""')}"`,
                ];
                csvRows.push(row.join(','));
            });
        } else {
            const row = [
                `"${member.firstName} ${member.lastName}"`,
                `"${member.jobTitle}"`,
                "N/A",
                "No reports submitted",
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
  
  const clearFilters = () => {
    setFilterYear(undefined);
    setFilterMonth(undefined);
    setFilterDay(undefined);
  }

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
            <Button onClick={handleExportAll} disabled={!usersData || usersData.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
        </div>
      </PageHeader>
      <Sheet open={!!selectedMember} onOpenChange={(isOpen) => !isOpen && setSelectedMember(null)}>
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
              {areUsersLoading || areTeamsLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center h-24">Loading team members...</TableCell></TableRow>
              ) : filteredUserData && filteredUserData.length > 0 ? (
                filteredUserData.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                     {member.firstName} {member.lastName}
                  </TableCell>
                  <TableCell>{member.jobTitle}</TableCell>
                  <TableCell className="text-right">
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedMember(member)}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Reports
                      </Button>
                    </SheetTrigger>
                  </TableCell>
                </TableRow>
              ))) : (
                <TableRow><TableCell colSpan={3} className="text-center h-24">No team members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {selectedMember && (
          <SheetContent className="sm:max-w-lg flex flex-col">
            <SheetHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <SheetTitle>{selectedMember.firstName} {selectedMember.lastName}'s Reports</SheetTitle>
                        <SheetDescription>Review and add work reports for this team member.</SheetDescription>
                    </div>
                </div>
            </SheetHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Dialog open={isAddReportDialogOpen} onOpenChange={setIsAddReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
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
                <Button variant="outline" onClick={handleExport} disabled={!memberReports || memberReports.length === 0}>
                    <Download className="mr-2 h-4 w-4"/>
                    Export as CSV
                </Button>
                <div className="flex-1" />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                        <div className="px-2 py-1.5 text-sm font-semibold">Filter by Date</div>
                        <div className="grid grid-cols-3 gap-1 px-1">
                            <Select onValueChange={setFilterYear} value={filterYear}>
                                <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                                <SelectContent>
                                    {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={setFilterMonth} value={filterMonth} disabled={!filterYear}>
                                <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                                <SelectContent>
                                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                             <Select onValueChange={setFilterDay} value={filterDay} disabled={!filterMonth || !filterYear}>
                                <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                                <SelectContent>
                                    {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {(filterDate || filterYear) && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={clearFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    Clear Filters
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

              </div>
            </div>
            
            <Separator className="my-4" />

            <div className="flex-1 flex flex-col min-h-0">
                <h4 className="font-semibold text-sm shrink-0">
                    {filterDate ? `Reports for ${format(filterDate, "PPP")}` : 'Existing Reports'}
                </h4>
                <ScrollArea className="mt-2 -mx-6">
                    <div className="px-6">
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
                            No reports found for this period.
                          </p>
                        )}
                    </div>
                </ScrollArea>
              </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
