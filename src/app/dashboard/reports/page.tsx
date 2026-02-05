
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


const reportSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  callsMade: z.coerce.number().min(0, "Cannot be negative.").default(0),
  connectionsAchieved: z.coerce.number().min(0, "Cannot be negative.").default(0),
  leadsGenerated: z.coerce.number().min(0, "Cannot be negative.").default(0),
  clientInteractions: z.coerce.number().min(0, "Cannot be negative.").default(0),
  crmUpdated: z.boolean().default(false),
  crmUpdateDetails: z.string().optional(),
  otherWork: z.string().optional(),
  signature: z.string().min(1, "Signature is required."),
});

type ReportFormValues = z.infer<typeof reportSchema>;

type Report = ReportFormValues & { 
  id: string; 
  employeeId: string;
  date: any; 
};

type UserData = { id: string; firstName: string; lastName: string; jobTitle: string; role: string; };

const ReportDetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="font-semibold">{value ?? '-'}</p>
  </div>
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
  const { data: currentUserData } = useDoc(userDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  
  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, "users"), where('role', 'in', ['Team Lead', 'Member']));
  }, [firestore, isAdmin]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserData>(usersQuery);

  const reportsQuery = useMemoFirebase(() => {
    const targetUserId = isAdmin ? selectedUser?.id : user?.uid;
    if (!targetUserId) return null;
    return query(collection(firestore, `users/${targetUserId}/reports`), orderBy('date', 'desc'));
  }, [firestore, user, isAdmin, selectedUser]);
  
  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      subject: "",
      callsMade: 0,
      connectionsAchieved: 0,
      leadsGenerated: 0,
      clientInteractions: 0,
      crmUpdated: false,
      crmUpdateDetails: "",
      otherWork: "",
      signature: (currentUserData as any)?.firstName ? `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}` : "",
    },
  });

  React.useEffect(() => {
    if(currentUserData) {
      form.reset({
        ...form.getValues(),
        signature: `${(currentUserData as any).firstName} ${(currentUserData as any).lastName}`
      });
    }
  }, [currentUserData, form]);

  const onSubmit = async (values: ReportFormValues) => {
    if (!user) return;
    
    const reportPayload = {
      ...values,
      employeeId: user.uid,
      date: new Date(),
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
              <TableHead>Role</TableHead>
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
                <TableCell>{u.role}</TableCell>
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
                <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="grid gap-4 py-4">
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField control={form.control} name="callsMade" render={({ field }) => (
                      <FormItem><FormLabel>Calls Made</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="connectionsAchieved" render={({ field }) => (
                      <FormItem><FormLabel>Connections</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="leadsGenerated" render={({ field }) => (
                      <FormItem><FormLabel>Leads/Follow-ups</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="clientInteractions" render={({ field }) => (
                      <FormItem><FormLabel>Meetings</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="crmUpdated" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <div className="space-y-1 leading-none"><FormLabel>CRM / Data Updated?</FormLabel></div>
                    </FormItem>
                  )} />
                   {form.watch('crmUpdated') && (
                     <FormField control={form.control} name="crmUpdateDetails" render={({ field }) => (
                        <FormItem><FormLabel>CRM Update Details</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                   )}
                  <FormField control={form.control} name="otherWork" render={({ field }) => (
                    <FormItem><FormLabel>Other Work / Pending Tasks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="signature" render={({ field }) => (
                    <FormItem><FormLabel>Signature</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
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
      
      {/* Detail view for a single report */}
      <Dialog open={!!selectedReport} onOpenChange={(isOpen) => !isOpen && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedReport?.date ? format(selectedReport.date.toDate(), "PPpp") : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 px-6">
          <div className="space-y-4 py-4">
              <ReportDetailItem label="Subject" value={selectedReport?.subject} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ReportDetailItem label="Calls Made" value={selectedReport?.callsMade} />
                  <ReportDetailItem label="Connections" value={selectedReport?.connectionsAchieved} />
                  <ReportDetailItem label="Leads / Follow-ups" value={selectedReport?.leadsGenerated} />
                  <ReportDetailItem label="Meetings" value={selectedReport?.clientInteractions} />
              </div>
              <ReportDetailItem label="CRM Updated" value={selectedReport?.crmUpdated ? "Yes" : "No"} />
              {selectedReport?.crmUpdated && selectedReport.crmUpdateDetails && (
                  <ReportDetailItem label="CRM Details" value={<p className="text-sm whitespace-pre-wrap">{selectedReport.crmUpdateDetails}</p>} />
              )}
              {selectedReport?.otherWork && (
                  <ReportDetailItem label="Other Work / Pending" value={<p className="text-sm whitespace-pre-wrap">{selectedReport.otherWork}</p>} />
              )}
              <ReportDetailItem label="Signature" value={selectedReport?.signature} />
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

    