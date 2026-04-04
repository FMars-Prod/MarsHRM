
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Trash2, Info, Download, Mail, TrendingUp, DollarSign, Target, CalendarClock, Brain, ListTodo, Link as LinkIcon, X, Plus, Clock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc, useFirebase } from "@/firebase";
import { collection, query, where, orderBy, doc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// --- Types ---

type ReportTemplatesConfig = {
  businessKeywords: string[];
  technicalKeywords: string[];
  businessGuidelines: string;
  technicalGuidelines: string;
};

const defaultTemplatesConfig: ReportTemplatesConfig = {
  businessKeywords: ["BUSINESS EXECUTIVE INTERN", "business", "sales", "marketing"],
  technicalKeywords: ["TECHNICAL SUPPORT INTERN", "technical", "developer", "engineer"],
  businessGuidelines: "Focus on client interactions, monetary contributions, pipeline growth, and planning for tomorrow.",
  technicalGuidelines: "Provide details on code modules worked on, specific technologies used, and any technical hurdles encountered."
};

// --- Schemas ---

const businessReportSchema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "INR"]),
  outreachColdCalls: z.coerce.number().min(0).default(0),
  outreachLinkedIn: z.coerce.number().min(0).default(0),
  outreachEmails: z.coerce.number().min(0).default(0),
  newLeadsGenerated: z.coerce.number().min(0).default(0),
  potentialClients: z.coerce.number().min(0).default(0),
  followUpsCompleted: z.string().min(1, "Required"),
  netRevenueCollected: z.coerce.number().min(0).default(0),
  committedNetRevenue: z.coerce.number().min(0).default(0),
  pipelineValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().default(0),
  meetingsSecured: z.array(z.object({ 
    clientName: z.string().min(1, "Client name required"), 
    quotationValue: z.coerce.number().min(0),
    context: z.string().min(1, "Context required")
  })),
  clientWinHighlight: z.string().min(1, "Required"),
  strategicLearning: z.string().min(1, "Required"),
  meetingsBookedTomorrow: z.coerce.number().min(0).default(0),
  criticalPathTomorrow: z.string().min(1, "Required"),
  pendingDeliverables: z.string().min(1, "Required"),
  interventionTrigger: z.enum(["None", "Coaching", "Technical Support", "Client meeting"]),
  interventionReason: z.string().optional(),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Required" }) }),
  signature: z.string().min(1, "Signature is required."),
});

const technicalReportSchema = z.object({
  logInTime: z.string().min(1, "Required"),
  logOutTime: z.string().min(1, "Required"),
  tasksAssigned: z.array(z.object({ value: z.string().min(1, "Required") })).min(1, "Required"),
  completedTasks: z.array(z.object({ 
    moduleName: z.string().min(1, "Required"), 
    workDone: z.string().min(1, "Required") 
  })).min(1, "Required"),
  repoLinks: z.array(z.object({ value: z.string().url("Invalid URL").or(z.literal("")) })),
  workInProgress: z.array(z.object({ value: z.string().min(1, "Required") })),
  pendingTasks: z.array(z.object({ value: z.string().min(1, "Required") })),
  whatILearned: z.array(z.object({ value: z.string().min(1, "Required") })),
  challengesFaced: z.array(z.object({ value: z.string().min(1, "Required") })),
  nextSteps: z.array(z.object({ value: z.string().min(1, "Required") })),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Required" }) }),
  signature: z.string().min(1, "Signature is required."),
});

type Report = { 
  id: string; 
  employeeId: string;
  employeeName?: string;
  employeeDepartment?: string;
  date: any; 
  reportType: 'Business' | 'Technical';
  signature: string;
  currency?: 'USD' | 'EUR' | 'GBP' | 'INR';
  outreachColdCalls?: number;
  outreachLinkedIn?: number;
  outreachEmails?: number;
  outreachTotal?: number;
  newLeadsGenerated?: number;
  potentialClients?: number;
  followUpsCompleted?: string;
  netRevenueCollected?: number;
  committedNetRevenue?: number;
  pipelineValue?: number;
  revenueVariance?: number;
  meetingsSecured?: { clientName: string, quotationValue: number, context: string }[];
  clientWinHighlight?: string;
  strategicLearning?: string;
  meetingsBookedTomorrow?: number;
  criticalPathTomorrow?: string;
  pendingDeliverables?: string;
  interventionTrigger?: string;
  interventionReason?: string;
  logInTime?: string;
  logOutTime?: string;
  tasksAssigned?: { value: string }[];
  completedTasks?: { moduleName: string, workDone: string }[];
  repoLinks?: { value: string }[];
  workInProgress?: { value: string }[];
  pendingTasks?: { value: string }[];
  whatILearned?: { value: string }[];
  challengesFaced?: { value: string }[];
  nextSteps?: { value: string }[];
};

type UserData = { id: string; firstName: string; lastName: string; jobTitle: string; role: string; department?: string; };

// --- Components ---

const ReportDetailItem = ({ label, value, children }: { label: string, value?: React.ReactNode, children?: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    <div className="font-semibold whitespace-pre-wrap text-sm">
        {value === "" || value === null || value === undefined ? "NIL" : (value ?? children ?? "NIL")}
    </div>
  </div>
);

const ChipDisplay = ({ items }: { items?: { value: string }[] }) => {
    if (!items || !Array.isArray(items) || items.length === 0) return <span className="text-muted-foreground font-semibold">NIL</span>;
    return (
        <div className="flex flex-wrap gap-2 mt-1">
            {items.map((item, i) => (
                <Badge key={i} variant="secondary" className="px-2 py-1 font-medium">{item.value || "NIL"}</Badge>
            ))}
        </div>
    );
};

const BusinessReportDetails = ({ report }: { report: Report }) => {
    const currencySymbol: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
    const sym = currencySymbol[report.currency || 'USD'];
    const outreach = Number(report.outreachTotal || 0);
    const leads = Number(report.newLeadsGenerated || 0);
    const conversionRate = (outreach > 0) ? (leads / outreach) * 100 : 0;
    
    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ReportDetailItem label="Total Outreach" value={outreach} />
                        <ReportDetailItem label="Cold Calls" value={report.outreachColdCalls ?? 0} />
                        <ReportDetailItem label="LinkedIn" value={report.outreachLinkedIn ?? 0} />
                        <ReportDetailItem label="Emails" value={report.outreachEmails ?? 0} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <ReportDetailItem label="New Leads Generated" value={report.newLeadsGenerated ?? 0} />
                        <ReportDetailItem label="Active Potential Clients" value={report.potentialClients ?? 0} />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
                            <Badge variant={conversionRate >= 15 ? 'default' : 'outline'} className="text-lg font-bold">{conversionRate.toFixed(2)}%</Badge>
                        </div>
                    </div>
                    <ReportDetailItem label="Follow-ups Completed" value={report.followUpsCompleted} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount ({sym})</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow><TableCell>NET Revenue Collected Today</TableCell><TableCell className="font-bold">{sym}{report.netRevenueCollected?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow><TableCell>Committed NET Revenue</TableCell><TableCell className="font-bold">{sym}{report.committedNetRevenue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow><TableCell>Pipeline Business Value</TableCell><TableCell className="font-bold">{sym}{report.pipelineValue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="bg-muted/30"><TableCell>Revenue Variance</TableCell><TableCell className="font-bold text-red-600">{sym}{report.revenueVariance?.toLocaleString() ?? 0}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Meetings/Demos & Quotations</p>
                        <div className="space-y-2">
                            {Array.isArray(report.meetingsSecured) && report.meetingsSecured.length > 0 ? report.meetingsSecured.map((m, i) => (
                                <div key={i} className="p-3 bg-muted/30 rounded-md border text-sm">
                                    <p className="font-bold">{m.clientName || "NIL"} - {sym}{m.quotationValue?.toLocaleString() ?? 0}</p>
                                    <p className="text-muted-foreground">{m.context || "NIL"}</p>
                                </div>
                            )) : <span className="text-muted-foreground italic font-semibold">NIL</span>}
                        </div>
                    </div>
                    <ReportDetailItem label="Client Win/Highlight" value={report.clientWinHighlight} />
                    <ReportDetailItem label="Strategic Learning" value={report.strategicLearning} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarClock className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ReportDetailItem label="Meetings Booked Tomorrow" value={report.meetingsBookedTomorrow ?? 0} />
                        <ReportDetailItem label="Intervention Trigger" value={report.interventionTrigger || 'None'} />
                    </div>
                    <ReportDetailItem label="T+1 Critical Path" value={report.criticalPathTomorrow} />
                    <ReportDetailItem label="Pending Deliverables" value={report.pendingDeliverables} />
                    {report.interventionTrigger !== 'None' && (
                        <ReportDetailItem label="Reason for Trigger" value={report.interventionReason} />
                    )}
                </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-2 text-sm">
                    <div className="flex items-center gap-2 font-bold"><span className="text-xl">🖋️</span> Signature Section</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
                        <p><span className="text-muted-foreground">Intern Name:</span> <span className="font-bold">{report.employeeName || "NIL"}</span></p>
                        <p><span className="text-muted-foreground">Department:</span> <span className="font-bold">{report.employeeDepartment || 'Sales-BD'}</span></p>
                        <p><span className="text-muted-foreground">E-Signature:</span> <span className="text-green-600 font-bold">✅ Verified</span></p>
                        <p><span className="text-muted-foreground">Timestamp:</span> <span className="font-mono">{report.signature?.split(' | ')[2] || 'NIL'}</span></p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const TechnicalReportDetails = ({ report }: { report: Report }) => (
  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
    <CardContent className="space-y-6 pt-6 text-sm">
        <div className="space-y-1">
            <p className="text-sm italic text-muted-foreground">Dear Sir / Ma’am,</p>
            <p className="font-semibold text-lg">Daily report summary:</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <ReportDetailItem label="Login Time" value={report.logInTime} />
            <ReportDetailItem label="Logout Time" value={report.logOutTime} />
        </div>
        <ReportDetailItem label="Tasks Assigned for the Day">
            {Array.isArray(report.tasksAssigned) && report.tasksAssigned.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    {report.tasksAssigned.map((t, i) => (<li key={i}>{t.value || "NIL"}</li>))}
                </ul>
            ) : <span className="text-muted-foreground font-semibold">NIL</span>}
        </ReportDetailItem>
        <div className="space-y-4">
            <p className="font-bold text-sm text-primary uppercase tracking-widest">Tasks Completed Today:</p>
            <div className="space-y-4">
                {Array.isArray(report.completedTasks) && report.completedTasks.length > 0 ? report.completedTasks.map((task, i) => (
                    <div key={i} className="pl-4 border-l-4 border-primary/20 space-y-1 py-1">
                        <p className="font-bold text-sm">{i + 1}. {task.moduleName || "NIL"}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.workDone || "NIL"}</p>
                    </div>
                )) : <span className="text-muted-foreground font-semibold">NIL</span>}
            </div>
        </div>
        <ReportDetailItem label="GitHub / Repo Links"><ChipDisplay items={report.repoLinks} /></ReportDetailItem>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportDetailItem label="Work in Progress"><ChipDisplay items={report.workInProgress} /></ReportDetailItem>
            <ReportDetailItem label="Pending Tasks"><ChipDisplay items={report.pendingTasks} /></ReportDetailItem>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReportDetailItem label="What I Learned Today"><ChipDisplay items={report.whatILearned} /></ReportDetailItem>
            <ReportDetailItem label="Challenges Faced"><ChipDisplay items={report.challengesFaced} /></ReportDetailItem>
        </div>
        <ReportDetailItem label="Next Steps"><ChipDisplay items={report.nextSteps} /></ReportDetailItem>
        <div className="pt-4 border-t space-y-4">
            <p className="text-sm italic">Thank you.</p>
            <ReportDetailItem label="Signature" value={report.signature} />
        </div>
    </CardContent>
  </Card>
);

// --- Page ---

export default function ReportsPage() {
  const { user } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedJobTitle, setSelectedJobTitle] = React.useState("All Job Titles");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [submitProgress, setSubmitProgress] = React.useState(0);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<UserData>(userDocRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const templatesDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: templatesData } = useDoc<ReportTemplatesConfig>(templatesDocRef);
  const templates = templatesData || defaultTemplatesConfig;

  const getReportType = React.useCallback((jobTitle: string = ''): 'Business' | 'Technical' => {
    const title = jobTitle.toUpperCase();
    if (title.includes("TECHNICAL SUPPORT INTERN")) return 'Technical';
    if (title.includes("BUSINESS EXECUTIVE INTERN")) return 'Business';
    if (templates.technicalKeywords.some(kw => title.includes(kw.toUpperCase()))) return 'Technical';
    if (templates.businessKeywords.some(kw => title.includes(kw.toUpperCase()))) return 'Business';
    return 'Technical';
  }, [templates]);

  const currentReportType = React.useMemo(() => getReportType(currentUserData?.jobTitle), [getReportType, currentUserData?.jobTitle]);
  const isBusinessUser = currentReportType === 'Business';

  const usersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, "users")) : null, [firestore, isAdmin]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserData>(usersQuery);

  const reportUserId = isAdmin ? selectedUser?.id : user?.uid;
  const reportsQuery = useMemoFirebase(() => reportUserId ? query(collection(firestore, `users/${reportUserId}/reports`), orderBy('date', 'desc')) : null, [firestore, reportUserId]);
  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);
  
  const attendanceQuery = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return query(collection(firestore, `users/${user.uid}/attendances`), where('id', '==', todayId));
  }, [user, firestore]);
  const { data: attendanceData } = useCollection(attendanceQuery);
  const todaysAttendance = attendanceData?.[0];

  const form = useForm<any>({
    resolver: zodResolver(isBusinessUser ? businessReportSchema : technicalReportSchema),
    defaultValues: { signature: "", declaration: false },
  });

  const resetForm = React.useCallback(() => {
      const now = new Date();
      const timestampStr = format(now, 'dd/MM/yyyy | HH:mm:ss') + ' IST';
      form.reset({
        signature: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName} | ${currentUserData.jobTitle} | ${timestampStr}` : "",
        declaration: false,
        ...(isBusinessUser ? {
            currency: "USD", outreachColdCalls: 0, outreachLinkedIn: 0, outreachEmails: 0, newLeadsGenerated: 0, potentialClients: 0, followUpsCompleted: "",
            netRevenueCollected: 0, committedNetRevenue: 0, pipelineValue: 0, revenueVariance: 0, meetingsSecured: [{ clientName: "", quotationValue: 0, context: "" }],
            clientWinHighlight: "", strategicLearning: "", meetingsBookedTomorrow: 0, criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None", interventionReason: "",
        } : {
            tasksAssigned: [{ value: "" }], completedTasks: [{ moduleName: "", workDone: "" }], repoLinks: [{ value: "" }],
            workInProgress: [], pendingTasks: [], whatILearned: [], challengesFaced: [], nextSteps: [],
            logInTime: todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'HH:mm') : "09:30",
            logOutTime: todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'HH:mm') : format(now, 'HH:mm'),
        })
      });
      setSubmitProgress(0);
  }, [form, currentUserData, isBusinessUser, todaysAttendance]);

  React.useEffect(() => { if (isAddDialogOpen) resetForm(); }, [isAddDialogOpen, resetForm]);

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    setSubmitProgress(10);
    const cold = Number(values.outreachColdCalls || 0);
    const linkedin = Number(values.outreachLinkedIn || 0);
    const emails = Number(values.outreachEmails || 0);
    const outreachTotal = cold + linkedin + emails;

    const reportPayload = {
      ...values,
      outreachTotal: isBusinessUser ? outreachTotal : undefined,
      employeeId: user.uid,
      employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`,
      employeeDepartment: currentUserData.department || (isBusinessUser ? 'Sales-BD' : 'Engineering'),
      date: new Date(),
      reportType: currentReportType,
    }
    setSubmitProgress(70);
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), reportPayload);
    setSubmitProgress(100);
    setTimeout(() => { toast({ title: "Report Submitted" }); setIsAddDialogOpen(false); resetForm(); }, 500);
  };

  const filteredUsers = usersData?.filter(u => {
    const nameMatch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const jobTitleMatch = selectedJobTitle === 'All Job Titles' || u.jobTitle === selectedJobTitle;
    return nameMatch && jobTitleMatch;
  });

  const BusinessFormFields = () => {
    const { fields: engagementFields, append: appendEngagement, remove: removeEngagement } = useFieldArray({ control: form.control, name: "meetingsSecured" });
    const cold = Number(useWatch({ control: form.control, name: "outreachColdCalls" }) || 0);
    const linkedin = Number(useWatch({ control: form.control, name: "outreachLinkedIn" }) || 0);
    const emails = Number(useWatch({ control: form.control, name: "outreachEmails" }) || 0);
    const leads = Number(useWatch({ control: form.control, name: "newLeadsGenerated" }) || 0);
    const totalOutreach = cold + linkedin + emails;
    const conversionRate = (totalOutreach > 0) ? (leads / totalOutreach) * 100 : 0;
    const intervention = useWatch({ control: form.control, name: "interventionTrigger" });

    return (
        <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/20"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Info className="h-4 w-4 text-primary" /><CardTitle className="text-sm font-medium">Guidelines</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{templates.businessGuidelines}</p></CardContent></Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="outreachColdCalls" render={({ field }) => (<FormItem><FormLabel>Cold Calls</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="outreachLinkedIn" render={({ field }) => (<FormItem><FormLabel>LinkedIn</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="outreachEmails" render={({ field }) => (<FormItem><FormLabel>Emails</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="md:col-span-3 p-3 bg-muted/30 rounded-md border text-sm font-bold">Total Outreach Volume: {totalOutreach}</div>
                    <FormField control={form.control} name="newLeadsGenerated" render={({ field }) => (<FormItem><FormLabel>New Leads Generated</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="potentialClients" render={({ field }) => (<FormItem><FormLabel>Active Potential Clients</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="md:col-span-1 flex flex-col justify-end"><Label className="mb-2">Conversion Rate</Label><Badge className="text-lg py-1">{conversionRate.toFixed(2)}%</Badge></div>
                    <div className="md:col-span-3"><FormField control={form.control} name="followUpsCompleted" render={({ field }) => (<FormItem><FormLabel>Follow-ups Completed</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="INR">INR (₹)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="netRevenueCollected" render={({ field }) => (<FormItem><FormLabel>NET Revenue Collected</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="committedNetRevenue" render={({ field }) => (<FormItem><FormLabel>Committed NET Revenue</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="pipelineValue" render={({ field }) => (<FormItem><FormLabel>Pipeline Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="revenueVariance" render={({ field }) => (<FormItem><FormLabel>Revenue Variance</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {engagementFields.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-md relative group space-y-3">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeEngagement(index)} disabled={engagementFields.length <= 1}><X className="size-4" /></Button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`meetingsSecured.${index}.clientName`} render={({ field }) => (<FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`meetingsSecured.${index}.quotationValue`} render={({ field }) => (<FormItem><FormLabel>Quotation Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name={`meetingsSecured.${index}.context`} render={({ field }) => (<FormItem><FormLabel>Context</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendEngagement({ clientName: "", quotationValue: 0, context: "" })}><Plus className="size-4 mr-2" /> Add Engagement</Button>
                    <FormField control={form.control} name="clientWinHighlight" render={({ field }) => (<FormItem><FormLabel>Client Win/Highlight</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="strategicLearning" render={({ field }) => (<FormItem><FormLabel>Strategic Learning</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarClock className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="meetingsBookedTomorrow" render={({ field }) => (<FormItem><FormLabel>Meetings Booked Tomorrow</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="criticalPathTomorrow" render={({ field }) => (<FormItem><FormLabel>Critical Path (Next Day)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="pendingDeliverables" render={({ field }) => (<FormItem><FormLabel>Pending Deliverables</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="interventionTrigger" render={({ field }) => (<FormItem><FormLabel>Intervention Trigger</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="None">None</SelectItem><SelectItem value="Coaching">Coaching</SelectItem><SelectItem value="Technical Support">Technical Support</SelectItem><SelectItem value="Client meeting">Client meeting</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    {intervention !== 'None' && (<FormField control={form.control} name="interventionReason" render={({ field }) => (<FormItem><FormLabel>Reason for Trigger</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />)}
                </CardContent>
            </Card>
        </div>
    );
  };

  const TechnicalFormFields = () => {
    const { fields: taskFields, append: appendTask, remove: removeTask } = useFieldArray({ control: form.control, name: "tasksAssigned" });
    const { fields: completedTaskFields, append: appendCompleted, remove: removeCompleted } = useFieldArray({ control: form.control, name: "completedTasks" });
    
    const ChipInputSection = ({ name, label, icon: Icon, placeholder }: { name: string, label: string, icon: any, placeholder: string }) => {
        const { fields, append, remove } = useFieldArray({ control: form.control, name });
        const [tempValue, setTempValue] = React.useState("");
        const handleAdd = () => { if (tempValue.trim()) { append({ value: tempValue.trim() }); setTempValue(""); } };
        return (
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50"><CardHeader className="py-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Icon className="size-4 text-primary" />{label}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2"><Input value={tempValue} onChange={(e) => setTempValue(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}/><Button type="button" size="icon" onClick={handleAdd}><Plus className="size-4" /></Button></div>
                    <div className="flex flex-wrap gap-2">{fields.map((field, index) => (<Badge key={field.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 group"><span className="text-xs">{(field as any).value}</span><button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100"><X className="size-3" /></button></Badge>))}{fields.length === 0 && <span className="text-xs text-muted-foreground italic">NIL</span>}</div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/20"><CardHeader className="flex flex-row items-center gap-2 pb-2"><Info className="h-4 w-4 text-primary" /><CardTitle className="text-sm font-medium">Guidelines</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{templates.technicalGuidelines}</p></CardContent></Card>
            <p className="text-sm italic text-muted-foreground">Dear Sir / Ma’am,</p><p className="font-semibold text-lg">Daily report summary:</p>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50"><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6"><FormField control={form.control} name="logInTime" render={({ field }) => (<FormItem><FormLabel>Login Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="logOutTime" render={({ field }) => (<FormItem><FormLabel>Logout Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50"><CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ListTodo className="size-4 text-primary" /> Tasks Assigned</CardTitle></CardHeader>
                <CardContent className="space-y-3">{taskFields.map((field, index) => (<div key={field.id} className="flex gap-2"><FormField control={form.control} name={`tasksAssigned.${index}.value`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input {...field} placeholder={`Task ${index + 1}`} /></FormControl><FormMessage /></FormItem>)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeTask(index)} disabled={taskFields.length <= 1}><Trash2 className="size-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendTask({ value: "" })} className="w-full"><Plus className="size-4 mr-2" /> Add Task</Button></CardContent>
            </Card>
            <div className="space-y-4"><p className="font-bold text-sm text-primary uppercase tracking-widest flex items-center gap-2"><Brain className="size-4" /> Tasks Completed Today:</p>
                {completedTaskFields.map((field, index) => (
                    <Card key={field.id} className="relative group bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeCompleted(index)} disabled={completedTaskFields.length <= 1}><X className="size-4" /></Button>
                            <div className="grid grid-cols-1 gap-4">
                                <FormField control={form.control} name={`completedTasks.${index}.moduleName`} render={({ field }) => (<FormItem><FormLabel>Module Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name={`completedTasks.${index}.workDone`} render={({ field }) => (<FormItem><FormLabel>Work Done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => appendCompleted({ moduleName: "", workDone: "" })} className="w-full border-dashed"><Plus className="size-4 mr-2" /> Add Completed Module</Button>
            </div>
            <ChipInputSection name="repoLinks" label="Repo Links" icon={LinkIcon} placeholder="https://..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInputSection name="workInProgress" label="Work in Progress" icon={Clock} placeholder="Ongoing..." /><ChipInputSection name="pendingTasks" label="Pending Tasks" icon={Clock} placeholder="Pending..." /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInputSection name="whatILearned" label="What I Learned" icon={Brain} placeholder="Learning..." /><ChipInputSection name="challengesFaced" label="Challenges" icon={Info} placeholder="Challenge..." /></div>
            <ChipInputSection name="nextSteps" label="Next Steps" icon={Plus} placeholder="Step..." />
            <div className="pt-4 border-t space-y-4"><p className="text-sm italic">Thank you.</p></div>
        </div>
    );
  };

  return (
    <>
      <PageHeader title={isAdmin ? "Employee Reports" : "My Daily Reports"} description={isAdmin ? "Review daily reports." : "Submit your work report."}>
        {!isAdmin && (<Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Add Today's Report</Button>)}
      </PageHeader>
      
      {isAdmin ? (
        <><div className="flex flex-col sm:flex-row gap-4 mb-4"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search employee..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
          <div className="border rounded-lg overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Job Title</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{areUsersLoading ? (<TableRow><TableCell colSpan={3} className="h-24 text-center">Loading...</TableCell></TableRow>) : filteredUsers?.map(u => (<TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}><TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell><TableCell>{u.jobTitle}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm">View Reports</Button></TableCell></TableRow>))}</TableBody></Table></div></>
      ) : (
        <div className="space-y-2">{areReportsLoading ? (<p className="text-center py-10 text-muted-foreground">Loading reports...</p>) : reports && reports.length > 0 ? (<Accordion type="single" collapsible className="w-full space-y-2">{reports.map(report => (
                <AccordionItem value={report.id} key={report.id} className="border-none"><AccordionTrigger className="border rounded-md px-4 hover:no-underline hover:bg-muted/50"><div className="flex-1 text-left"><p className="font-semibold">{report.reportType} Report</p><p className="text-sm text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p></div></AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "PDF Ready" })}><Download className="h-4 w-4 mr-2" />Save as PDF</Button>
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "Email Shared" })}><Mail className="h-4 w-4 mr-2" />Share via Email</Button>
                    </div>
                    {report.reportType === 'Business' ? <BusinessReportDetails report={report} /> : <TechnicalReportDetails report={report} />}
                  </AccordionContent>
                </AccordionItem>
              ))}</Accordion>) : (<Card><CardContent className="h-48 flex flex-col items-center justify-center text-muted-foreground"><p className="mb-4">No reports yet.</p><Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Add Today's Report</Button></CardContent></Card>)}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                    <DialogHeader className="p-6 pb-4 border-b"><DialogTitle>New {currentReportType} Report</DialogTitle><DialogDescription>{format(new Date(), "PPP")}</DialogDescription></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-6 space-y-6">
                        {isBusinessUser ? <BusinessFormFields /> : <TechnicalFormFields />}
                        <FormField control={form.control} name="signature" render={({ field }) => (<FormItem><FormLabel>Signature</FormLabel><FormControl><Input {...field} readOnly className="bg-muted font-mono text-xs" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>I confirm this information is accurate.</FormLabel></div></FormItem>)} />
                    </div></ScrollArea>
                    <div className="p-4 border-t space-y-4">{submitProgress > 0 && (<div className="space-y-2"><div className="flex justify-between text-xs font-medium"><span>Submitting...</span><span>{submitProgress}%</span></div><Progress value={submitProgress} className="h-2" /></div>)}<DialogFooter className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={form.formState.isSubmitting}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Submitting..." : "Submit Report"}</Button></DialogFooter></div>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-3xl w-full flex flex-col p-0">
            <SheetHeader className="p-6 border-b"><SheetTitle>{selectedUser?.firstName}'s Activity</SheetTitle></SheetHeader>
            <ScrollArea className="flex-1 p-6">
                {reports && reports.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {reports.map(report => (
                          <AccordionItem value={report.id} key={report.id} className="border-none">
                              <AccordionTrigger className="border rounded-md px-4 mb-2"><div className="flex-1 text-left"><p className="font-semibold">{report.reportType}</p><p className="text-xs text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p></div></AccordionTrigger>
                              <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                                  {report.reportType === 'Business' ? <BusinessReportDetails report={report} /> : <TechnicalReportDetails report={report} />}
                              </AccordionContent>
                          </AccordionItem>
                      ))}
                    </Accordion>
                ) : <p className="text-center text-muted-foreground">No reports.</p>}
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
