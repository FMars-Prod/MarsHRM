
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, FileText, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

const outreachReportSchema = z.object({
  outreachTotal: z.coerce.number().min(0, "Cannot be negative.").default(0),
  potentialClients: z.coerce.number().min(0, "Cannot be negative.").default(0),
  followUpsCompleted: z.string().min(1, "This field is required."),
  meetingsSecured: z.string().min(1, "This field is required."),
  pipelineValue: z.coerce.number().min(0, "Cannot be negative.").default(0),
  strategicLearning: z.string().min(1, "This field is required."),
  clientWinHighlight: z.string().min(1, "This field is required."),
  pendingDeliverables: z.string().min(1, "This field is required."),
  meetingsBookedTomorrow: z.string().min(1, "This field is required."),
  criticalPathTomorrow: z.string().min(1, "This field is required."),
  interventionTrigger: z.enum(["None", "Coaching", "Technical Support", "Client meeting"]),
  signature: z.string().min(1, "Signature is required."),
});

const technicalReportSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  technologyUsed: z.string().min(1, "This field is required."),
  taskDescription: z.string().min(1, "This field is required."),
  workDone: z.string().min(1, "This field is required."),
  moduleWorkedOn: z.string().min(1, "This field is required."),
  taskStatus: z.enum(["Completed", "In Progress"]),
  logInTime: z.string().min(1, "Login time is required."),
  logOutTime: z.string().min(1, "Logout time is required."),
  otherWork: z.string().optional(),
  signature: z.string().min(1, "Signature is required."),
});


type ReportFormValues = z.infer<typeof outreachReportSchema> | z.infer<typeof technicalReportSchema>;

type Report = { 
  id: string; 
  employeeId: string;
  date: any; 
  reportType: 'Business' | 'Technical';
  signature: string;
  // Business
  outreachTotal?: number;
  potentialClients?: number;
  followUpsCompleted?: string;
  meetingsSecured?: string;
  pipelineValue?: number;
  strategicLearning?: string;
  clientWinHighlight?: string;
  pendingDeliverables?: string;
  meetingsBookedTomorrow?: string;
  criticalPathTomorrow?: string;
  interventionTrigger?: 'None' | 'Coaching' | 'Technical Support' | 'Client meeting';
  // Technical
  subject?: string;
  technologyUsed?: string;
  taskDescription?: string;
  workDone?: string;
  moduleWorkedOn?: string;
  taskStatus?: 'Completed' | 'In Progress';
  logInTime?: string;
  logOutTime?: string;
  otherWork?: string;
};

type UserData = { id: string; firstName: string; lastName: string; jobTitle: string; role: string; department?: string; };

const ReportDetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="font-semibold whitespace-pre-wrap">{value ?? '-'}</p>
  </div>
);

const OutreachReportDetails = ({ report }: { report: Report }) => (
  <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportDetailItem label="Total Outreach" value={report.outreachTotal} />
        <ReportDetailItem label="Potential Clients" value={report.potentialClients} />
        <ReportDetailItem label="Pipeline Value" value={`$${(report.pipelineValue || 0).toLocaleString()}`} />
        <ReportDetailItem label="Intervention" value={report.interventionTrigger} />
    </div>
    <ReportDetailItem label="Follow-ups Completed" value={report.followUpsCompleted} />
    <ReportDetailItem label="Meetings/Demos Secured & Quotations" value={report.meetingsSecured} />
    <ReportDetailItem label="Strategic Learning" value={report.strategicLearning} />
    <ReportDetailItem label="Client Win/Highlight" value={report.clientWinHighlight} />
    <ReportDetailItem label="Pending Deliverables / Pipeline Impact" value={report.pendingDeliverables} />
    <ReportDetailItem label="Meetings/Demos Booked for Tomorrow" value={report.meetingsBookedTomorrow} />
    <ReportDetailItem label="Tomorrow's Critical Path" value={report.criticalPathTomorrow} />
    <ReportDetailItem label="Signature" value={report.signature} />
  </>
);

const TechnicalReportDetails = ({ report }: { report: Report }) => (
  <>
    <ReportDetailItem label="Subject" value={report.subject} />
    <ReportDetailItem label="Technology / Tool Used" value={report.technologyUsed} />
    <ReportDetailItem label="Task Description" value={report.taskDescription} />
    <ReportDetailItem label="Code / Design / Testing Work Done" value={report.workDone} />
    <ReportDetailItem label="Module / Feature Worked On" value={report.moduleWorkedOn} />
    <ReportDetailItem label="Status" value={report.taskStatus} />
     <div className="grid grid-cols-2 gap-4">
        <ReportDetailItem label="Log in Time" value={report.logInTime} />
        <ReportDetailItem label="Log out Time" value={report.logOutTime} />
    </div>
    {report.otherWork && (
        <ReportDetailItem label="Other Work / Pending" value={report.otherWork} />
    )}
    <ReportDetailItem label="Signature" value={report.signature} />
  </>
);


export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedJobTitle, setSelectedJobTitle] = React.useState("All Job Titles");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<UserData>(userDocRef);
  const userRole = currentUserData?.role;
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const technicalDepartments = ['Engineering', 'Technology', 'IT'];
  const isTechnicalUser = currentUserData?.department ? technicalDepartments.includes(currentUserData.department) : false;

  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, "users"));
  }, [firestore, isAdmin]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserData>(usersQuery);

  const reportsQuery = useMemoFirebase(() => {
    const targetUserId = isAdmin ? selectedUser?.id : user?.uid;
    if (!targetUserId) return null;
    return query(collection(firestore, `users/${targetUserId}/reports`), orderBy('date', 'desc'));
  }, [firestore, user, isAdmin, selectedUser]);
  
  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(isTechnicalUser ? technicalReportSchema : outreachReportSchema),
    defaultValues: {
      signature: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : "",
      ...(isTechnicalUser ? {
        subject: "",
        technologyUsed: "",
        taskDescription: "",
        workDone: "",
        moduleWorkedOn: "",
        taskStatus: "In Progress",
        logInTime: "09:30",
        logOutTime: "18:30",
        otherWork: "",
      } : {
        outreachTotal: 0,
        potentialClients: 0,
        followUpsCompleted: "",
        meetingsSecured: "",
        pipelineValue: 0,
        strategicLearning: "",
        clientWinHighlight: "",
        pendingDeliverables: "",
        meetingsBookedTomorrow: "",
        criticalPathTomorrow: "",
        interventionTrigger: "None",
      })
    },
  });

  React.useEffect(() => {
    if(currentUserData) {
      form.reset({
        ...form.getValues(),
        signature: `${currentUserData.firstName} ${currentUserData.lastName}`
      });
    }
  }, [currentUserData, form]);

  const onSubmit = async (values: ReportFormValues) => {
    if (!user) return;
    
    const reportPayload = {
      ...values,
      employeeId: user.uid,
      date: new Date(),
      reportType: isTechnicalUser ? 'Technical' : 'Business',
    }
    
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), reportPayload);
    
    toast({
        title: "Report Submitted",
        description: "Your daily work report has been saved."
    });
    setIsAddDialogOpen(false);
    form.reset();
  };

  const jobTitles = React.useMemo(() => {
    if (!usersData) return [];
    const allJobTitles = usersData.map(u => u.jobTitle).filter(Boolean);
    return ["All Job Titles", ...Array.from(new Set(allJobTitles))];
  }, [usersData]);

  const filteredUsers = usersData?.filter(u => {
    const nameMatch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const jobTitleMatch = selectedJobTitle === 'All Job Titles' || u.jobTitle === selectedJobTitle;
    return nameMatch && jobTitleMatch;
  });

  const OutreachFormFields = () => {
    const { control } = form;
    const [outreach, potential] = useWatch({
        control,
        name: ["outreachTotal", "potentialClients"]
    });
    const conversionRate = (outreach > 0) ? ((potential / outreach) * 100).toFixed(1) : 0;

    return (
        <>
            <FormField control={control} name="outreachTotal" render={({ field }) => (
                <FormItem><FormLabel>Total Outreach</FormLabel><FormControl><Input type="number" min="0" {...field} placeholder="e.g., 30" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="potentialClients" render={({ field }) => (
                <FormItem><FormLabel>Potential Clients</FormLabel><FormControl><Input type="number" min="0" {...field} placeholder="e.g., 6" /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="col-span-2">
                <Label>Conversion Rate</Label>
                <Card className="mt-2">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold">{conversionRate}%</p>
                        <p className="text-sm text-muted-foreground">({potential} conversions / {outreach} outreach)</p>
                    </CardContent>
                </Card>
            </div>
            <FormField control={control} name="followUpsCompleted" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Follow-ups Completed</FormLabel><FormControl><Textarea {...field} placeholder="Details on existing client follow-ups..." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="meetingsSecured" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Meetings/Demos Secured & Quotations</FormLabel><FormControl><Textarea {...field} placeholder="Client names and brief context..." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="pipelineValue" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Pipeline Business Value ($)</FormLabel><FormControl><Input type="number" min="0" {...field} placeholder="e.g., 100000" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="strategicLearning" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Strategic Learning</FormLabel><FormControl><Textarea {...field} placeholder="What did you learn today about the industry, product, or client behavior?" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="clientWinHighlight" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Client Win/Highlight</FormLabel><FormControl><Textarea {...field} placeholder="A brief narrative of the best conversation of the day..." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Pending Deliverables / Pipeline Impact</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="meetingsBookedTomorrow" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Meetings/Demos Booked for Tomorrow</FormLabel><FormControl><Textarea {...field} placeholder="Confirmed calendar invites sent..." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>T+1 Critical Path</FormLabel><FormControl><Textarea {...field} placeholder="Tomorrow's plan and the #1 most important task..." /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={control} name="interventionTrigger" render={({ field }) => (
                <FormItem className="col-span-2">
                    <FormLabel>Intervention Trigger</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Coaching">Coaching</SelectItem>
                            <SelectItem value="Technical Support">Technical Support</SelectItem>
                            <SelectItem value="Client meeting">Client meeting</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
        </>
    );
  }

  const TechnicalFormFields = () => (
    <>
      <FormField control={form.control} name="subject" render={({ field }) => (
          <FormItem className="col-span-2"><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="technologyUsed" render={({ field }) => (
        <FormItem className="col-span-2"><FormLabel>Technology / Tool Used / Learnt</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="taskDescription" render={({ field }) => (
        <FormItem className="col-span-2"><FormLabel>Task Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="workDone" render={({ field }) => (
        <FormItem className="col-span-2"><FormLabel>Code / Design / Testing Work Done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="moduleWorkedOn" render={({ field }) => (
        <FormItem className="col-span-2"><FormLabel>Module / Feature Worked On</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
       <FormField control={form.control} name="taskStatus" render={({ field }) => (
        <FormItem>
          <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          <FormMessage />
        </FormItem>
      )} />
      <div/>
      <FormField control={form.control} name="logInTime" render={({ field }) => (
        <FormItem><FormLabel>Log in Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="logOutTime" render={({ field }) => (
        <FormItem><FormLabel>Log out Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="otherWork" render={({ field }) => (
          <FormItem className="col-span-2"><FormLabel>Other work done / yet to be done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </>
  );

  const AdminView = () => (
    <>
      <PageHeader title="Employee Reports" description="View daily reports submitted by employees." />
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search for an employee..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
            <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by job title" />
            </SelectTrigger>
            <SelectContent>
                {jobTitles.map(title => (
                    <SelectItem key={title} value={title}>{title}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areUsersLoading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading users...</TableCell></TableRow>
            ) : filteredUsers?.map(u => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelectedUser(u)}>
                <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.jobTitle}</TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(u)}>
                    View Reports
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );

  const EmployeeView = () => (
    <>
      <PageHeader title="My Daily Reports" description="Submit and review your daily work reports.">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Today's Report</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl p-0 flex flex-col h-[90vh] max-h-[90vh]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                <DialogHeader className="p-6 pb-4">
                  <DialogTitle>New Daily Report</DialogTitle>
                  <DialogDescription>Fill in the details of your work for today, {format(new Date(), "PPP")}.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                    
                    {isTechnicalUser ? <TechnicalFormFields /> : <OutreachFormFields />}
                    
                    <div className="col-span-2">
                      <FormField control={form.control} name="signature" render={({ field }) => (
                        <FormItem><FormLabel>Signature</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t">
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={form.formState.isSubmitting}>Submit Report</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Subject / Type</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {areReportsLoading ? (
              <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading reports...</TableCell></TableRow>
            ) : reports && reports.length > 0 ? (
              reports.map(report => (
                <TableRow key={report.id} onClick={() => setSelectedReport(report)} className="cursor-pointer">
                  <TableCell>{format(report.date.toDate(), "PPP")}</TableCell>
                  <TableCell>{report.reportType === 'Technical' ? report.subject : `Outreach Report`}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="h-24 text-center">No reports submitted yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <>
      {isAdmin ? <AdminView /> : <EmployeeView />}
      
      <Sheet open={!!selectedUser && !selectedReport} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSelectedReport(null);
          if (isAdmin) setSelectedUser(null);
        }
      }}>
        <SheetContent className="sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {isAdmin && selectedUser ? `${selectedUser.firstName}'s Reports` : "Report Details"}
            </SheetTitle>
            <SheetDescription>
              {isAdmin && selectedUser ? `Daily reports submitted by ${selectedUser.firstName}.` : "Details of your submitted report."}
            </SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          <div className="flex-1 overflow-y-auto -mx-6">
            <div className="px-6">
              {areReportsLoading ? <p>Loading...</p> : reports && reports.length > 0 ? (
                  <div className="space-y-4">
                      {reports.map(report => (
                          <div key={report.id} className="border p-4 rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setSelectedReport(report)}>
                              <p className="font-semibold">{report.reportType === 'Technical' ? report.subject : 'Outreach Report'}</p>
                              <p className="text-sm text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p>
                          </div>
                      ))}
                  </div>
              ) : <p className="text-center text-muted-foreground py-6">No reports found for this user.</p>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      <Dialog open={!!selectedReport} onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedReport(null)
      }}>
        <DialogContent className="sm:max-w-3xl p-0 flex flex-col h-[90vh] max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedReport?.date ? format(selectedReport.date.toDate(), "PPpp") : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-6 py-4">
              {selectedReport?.reportType === 'Business'
                ? <OutreachReportDetails report={selectedReport} />
                : selectedReport && <TechnicalReportDetails report={selectedReport} />
              }
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
