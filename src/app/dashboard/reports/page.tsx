
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const baseReportSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  otherWork: z.string().optional(),
  signature: z.string().min(1, "Signature is required."),
});

const businessReportSchema = baseReportSchema.extend({
  callsMade: z.coerce.number().min(0, "Cannot be negative.").default(0),
  connectionsAchieved: z.coerce.number().min(0, "Cannot be negative.").default(0),
  leadsGenerated: z.coerce.number().min(0, "Cannot be negative.").default(0),
  clientInteractions: z.coerce.number().min(0, "Cannot be negative.").default(0),
});

const technicalReportSchema = baseReportSchema.extend({
  technologyUsed: z.string().min(1, "This field is required."),
  taskDescription: z.string().min(1, "This field is required."),
  workDone: z.string().min(1, "This field is required."),
  moduleWorkedOn: z.string().min(1, "This field is required."),
  taskStatus: z.enum(["Completed", "In Progress"]),
  logInTime: z.string().min(1, "Login time is required."),
  logOutTime: z.string().min(1, "Logout time is required."),
});


type BusinessReportFormValues = z.infer<typeof businessReportSchema>;
type TechnicalReportFormValues = z.infer<typeof technicalReportSchema>;
type ReportFormValues = BusinessReportFormValues | TechnicalReportFormValues;

type Report = { 
  id: string; 
  employeeId: string;
  date: any; 
  reportType: 'Business' | 'Technical';
  subject: string;
  signature: string;
  callsMade?: number;
  connectionsAchieved?: number;
  leadsGenerated?: number;
  clientInteractions?: number;
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
    <p className="font-semibold">{value ?? '-'}</p>
  </div>
);

const BusinessReportDetails = ({ report }: { report: Report }) => (
  <>
    <ReportDetailItem label="Subject" value={report.subject} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportDetailItem label="Calls Made" value={report.callsMade} />
        <ReportDetailItem label="Connections" value={report.connectionsAchieved} />
        <ReportDetailItem label="Leads/Follow-ups" value={report.leadsGenerated} />
        <ReportDetailItem label="Meetings" value={report.clientInteractions} />
    </div>
    {report.otherWork && (
        <ReportDetailItem label="Other Work/Pending" value={<p className="text-sm whitespace-pre-wrap">{report.otherWork}</p>} />
    )}
    <ReportDetailItem label="Signature" value={report.signature} />
  </>
);

const TechnicalReportDetails = ({ report }: { report: Report }) => (
  <>
    <ReportDetailItem label="Subject" value={report.subject} />
    <ReportDetailItem label="Technology / Tool Used" value={report.technologyUsed} />
    <ReportDetailItem label="Task Description" value={<p className="text-sm whitespace-pre-wrap">{report.taskDescription}</p>} />
    <ReportDetailItem label="Code / Design / Testing Work Done" value={<p className="text-sm whitespace-pre-wrap">{report.workDone}</p>} />
    <ReportDetailItem label="Module / Feature Worked On" value={report.moduleWorkedOn} />
    <ReportDetailItem label="Status" value={report.taskStatus} />
     <div className="grid grid-cols-2 gap-4">
        <ReportDetailItem label="Log in Time" value={report.logInTime} />
        <ReportDetailItem label="Log out Time" value={report.logOutTime} />
    </div>
    {report.otherWork && (
        <ReportDetailItem label="Other Work / Pending" value={<p className="text-sm whitespace-pre-wrap">{report.otherWork}</p>} />
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
    resolver: zodResolver(isTechnicalUser ? technicalReportSchema : businessReportSchema),
    defaultValues: {
      subject: "",
      otherWork: "",
      signature: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : "",
      ...(isTechnicalUser ? {
        technologyUsed: "",
        taskDescription: "",
        workDone: "",
        moduleWorkedOn: "",
        taskStatus: "In Progress",
        logInTime: "09:30",
        logOutTime: "18:30",
      } : {
        callsMade: 0,
        connectionsAchieved: 0,
        leadsGenerated: 0,
        clientInteractions: 0,
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

  const filteredUsers = usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const BusinessFormFields = () => (
    <>
      <FormField control={form.control} name="callsMade" render={({ field }) => (
        <FormItem><FormLabel>Calls Made</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="connectionsAchieved" render={({ field }) => (
        <FormItem><FormLabel>Connections Achieved</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="leadsGenerated" render={({ field }) => (
        <FormItem><FormLabel>Leads Generated / Follow-ups Done</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="clientInteractions" render={({ field }) => (
        <FormItem><FormLabel>Client Interactions / Meetings</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </>
  );

  const TechnicalFormFields = () => (
    <>
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
    </>
  );

  const AdminView = () => (
    <>
      <PageHeader title="Employee Reports" description="View daily reports submitted by employees." />
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search for an employee..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="border rounded-lg">
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
          <DialogContent className="sm:max-w-2xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>New Daily Report</DialogTitle>
                  <DialogDescription>Fill in the details of your work for today, {format(new Date(), "PPP")}.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <div className="col-span-2">
                      <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    
                    {isTechnicalUser ? <TechnicalFormFields /> : <BusinessFormFields />}
                    
                    <div className="col-span-2">
                      <FormField control={form.control} name="otherWork" render={({ field }) => (
                        <FormItem><FormLabel>Other work done / yet to be done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                     <div className="col-span-2">
                      <FormField control={form.control} name="signature" render={({ field }) => (
                        <FormItem><FormLabel>Signature</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="pt-4 border-t">
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={form.formState.isSubmitting}>Submit Report</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {areReportsLoading ? (
              <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading reports...</TableCell></TableRow>
            ) : reports && reports.length > 0 ? (
              reports.map(report => (
                <TableRow key={report.id} onClick={() => setSelectedReport(report)} className="cursor-pointer">
                  <TableCell>{format(report.date.toDate(), "PPP")}</TableCell>
                  <TableCell>{report.subject}</TableCell>
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
      
      <Sheet open={!!selectedReport || (isAdmin && !!selectedUser)} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSelectedReport(null);
          if (isAdmin) setSelectedUser(null);
        }
      }}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {isAdmin && selectedUser ? `${selectedUser.firstName}'s Reports` : "Report Details"}
            </SheetTitle>
            <SheetDescription>
              {isAdmin && selectedUser ? `Daily reports submitted by ${selectedUser.firstName}.` : "Details of your submitted report."}
            </SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          <ScrollArea className="h-[calc(100vh-8rem)] -mx-6">
            <div className="px-6">
              {areReportsLoading ? <p>Loading...</p> : reports && reports.length > 0 ? (
                  <div className="space-y-6">
                      {reports.map(report => (
                          <div key={report.id} className="border p-4 rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setSelectedReport(report)}>
                              <p className="font-semibold">{report.subject}</p>
                              <p className="text-sm text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p>
                          </div>
                      ))}
                  </div>
              ) : <p className="text-center text-muted-foreground">No reports found.</p>}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      
      <Dialog open={!!selectedReport} onOpenChange={(isOpen) => !isOpen && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedReport?.date ? format(selectedReport.date.toDate(), "PPpp") : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-4 py-4">
              {selectedReport?.reportType === 'Technical'
                ? <TechnicalReportDetails report={selectedReport} />
                : selectedReport && <BusinessReportDetails report={selectedReport} />
              }
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
