
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Trash2, Info, Download, Mail, TrendingUp, DollarSign, Target, CalendarClock, Brain, ListTodo, Link as LinkIcon, X, Plus, Clock, FileText, AlertCircle, CheckCircle2, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay, isAfter, setHours, setMinutes } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc, useFirebase, useStorage } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Types ---

type Report = { 
  id: string; 
  employeeId: string;
  employeeName?: string;
  employeeDepartment?: string;
  date: any; 
  reportType: 'Business' | 'Technical';
  signature: string;
  currency?: 'USD' | 'EUR' | 'GBP' | 'INR';
  outreachTotal?: number;
  outreachColdCalls?: number;
  outreachLinkedIn?: number;
  outreachEmails?: number;
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
  bestCallRecording?: string;
  worstCallRecording?: string;
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

// --- Schemas ---

const businessReportSchema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "INR"]),
  outreachColdCalls: z.coerce.number().min(0).default(0),
  outreachLinkedIn: z.coerce.number().min(0).default(0),
  outreachEmails: z.coerce.number().min(0).default(0),
  newLeadsGenerated: z.coerce.number().min(0).default(0),
  potentialClients: z.coerce.number().min(0).default(0),
  followUpsCompleted: z.string().optional(),
  netRevenueCollected: z.coerce.number().min(0).default(0),
  committedNetRevenue: z.coerce.number().min(0).default(0),
  pipelineValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().default(0),
  meetingsSecured: z.array(z.object({ 
    clientName: z.string().optional(), 
    quotationValue: z.coerce.number().min(0).default(0),
    context: z.string().optional()
  })),
  clientWinHighlight: z.string().optional(),
  strategicLearning: z.string().optional(),
  meetingsBookedTomorrow: z.coerce.number().min(0).default(0),
  criticalPathTomorrow: z.string().optional(),
  pendingDeliverables: z.string().optional(),
  interventionTrigger: z.enum(["None", "Coaching", "Technical Support", "Client meeting"]),
  interventionReason: z.string().optional(),
  bestCallRecording: z.string().optional(),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Required" }) }),
  signature: z.string().min(1, "Signature is required."),
});

const technicalReportSchema = z.object({
  logInTime: z.string().min(1, "Required"),
  logOutTime: z.string().min(1, "Required"),
  tasksAssigned: z.array(z.object({ value: z.string() })),
  completedTasks: z.array(z.object({ 
    moduleName: z.string(), 
    workDone: z.string() 
  })),
  repoLinks: z.array(z.object({ value: z.string() })),
  workInProgress: z.array(z.object({ value: z.string() })),
  pendingTasks: z.array(z.object({ value: z.string() })),
  whatILearned: z.array(z.object({ value: z.string() })),
  challengesFaced: z.array(z.object({ value: z.string() })),
  nextSteps: z.array(z.object({ value: z.string() })),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Required" }) }),
  signature: z.string().min(1, "Signature is required."),
});

// --- Helper Components ---

const ReportDetailItem = ({ label, value, children }: { label: string, value?: React.ReactNode, children?: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    <div className="font-semibold whitespace-pre-wrap text-sm">
        {(!value && !children) ? <span className="text-muted-foreground italic">NIL</span> : (value ?? children)}
    </div>
  </div>
);

const ChipDisplay = ({ items }: { items?: { value: string }[] }) => {
    if (!items || !Array.isArray(items) || items.length === 0 || (items.length === 1 && !items[0].value)) return <span className="text-muted-foreground italic">NIL</span>;
    return (
        <div className="flex flex-wrap gap-2 mt-1">
            {items.map((item, i) => item.value ? (
                <Badge key={i} variant="secondary" className="px-2 py-1 font-medium">{item.value}</Badge>
            ) : null)}
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
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ReportDetailItem label="Total Outreach" value={outreach || "NIL"} />
                        <ReportDetailItem label="Cold Calls" value={report.outreachColdCalls ?? "NIL"} />
                        <ReportDetailItem label="LinkedIn" value={report.outreachLinkedIn ?? "NIL"} />
                        <ReportDetailItem label="Emails" value={report.outreachEmails ?? "NIL"} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <ReportDetailItem label="New Leads" value={report.newLeadsGenerated ?? "NIL"} />
                        <ReportDetailItem label="Active Potential" value={report.potentialClients ?? "NIL"} />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
                            <Badge variant={conversionRate >= 15 ? 'default' : 'outline'} className="text-lg font-bold">{conversionRate.toFixed(2)}%</Badge>
                        </div>
                    </div>
                    <ReportDetailItem label="Follow-ups Completed" value={report.followUpsCompleted || "NIL"} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow><TableHead>Category</TableHead><TableHead>Amount ({sym})</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow><TableCell>NET Revenue Collected</TableCell><TableCell className="font-bold">{sym}{report.netRevenueCollected?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow><TableCell>Committed NET Revenue</TableCell><TableCell className="font-bold">{sym}{report.committedNetRevenue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow><TableCell>Pipeline Business Value</TableCell><TableCell className="font-bold">{sym}{report.pipelineValue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="bg-muted/30"><TableCell>Revenue Variance</TableCell><TableCell className="font-bold text-red-600">{sym}{report.revenueVariance?.toLocaleString() ?? 0}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Meetings/Demos & Quotations</p>
                        <div className="space-y-2">
                            {Array.isArray(report.meetingsSecured) && report.meetingsSecured.length > 0 && report.meetingsSecured.some(m => m.clientName) ? report.meetingsSecured.map((m, i) => m.clientName ? (
                                <div key={i} className="p-3 bg-muted/30 rounded-md border text-sm">
                                    <p className="font-bold">{m.clientName} - {sym}{m.quotationValue?.toLocaleString() ?? 0}</p>
                                    <p className="text-muted-foreground">{m.context || "NIL"}</p>
                                </div>
                            ) : null) : <span className="text-muted-foreground italic">NIL</span>}
                        </div>
                    </div>
                    <ReportDetailItem label="Client Win/Highlight" value={report.clientWinHighlight || "NIL"} />
                    <ReportDetailItem label="Strategic Learning" value={report.strategicLearning || "NIL"} />
                    {report.bestCallRecording && (
                        <ReportDetailItem label="Audio Submission">
                            <audio controls className="w-full h-8 mt-1"><source src={report.bestCallRecording} /></audio>
                        </ReportDetailItem>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarClock className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ReportDetailItem label="Meetings Tomorrow" value={report.meetingsBookedTomorrow ?? "NIL"} />
                        <ReportDetailItem label="Intervention" value={report.interventionTrigger || "NIL"} />
                    </div>
                    <ReportDetailItem label="T+1 Critical Path" value={report.criticalPathTomorrow || "NIL"} />
                    <ReportDetailItem label="Pending Deliverables" value={report.pendingDeliverables || "NIL"} />
                    {report.interventionTrigger !== 'None' && report.interventionReason && (
                        <ReportDetailItem label="Reason for Trigger" value={report.interventionReason} />
                    )}
                </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-2 text-sm">
                    <div className="flex items-center gap-2 font-bold"><span className="text-xl">🖋️</span> Signature Section</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
                        <p><span className="text-muted-foreground">Intern Name:</span> <span className="font-bold">{report.employeeName || "NIL"}</span></p>
                        <p><span className="text-muted-foreground">Department:</span> <span className="font-bold">{report.employeeDepartment || "NIL"}</span></p>
                        <p><span className="text-muted-foreground">E-Signature:</span> <span className="text-green-600 font-bold">✅ Verified</span></p>
                        <p><span className="text-muted-foreground">Timestamp:</span> <span className="font-mono">{report.signature?.split(' | ')[2] || "NIL"}</span></p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const TechnicalReportDetails = ({ report }: { report: Report }) => (
  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
    <CardContent className="space-y-6 pt-6 text-sm">
        <div className="space-y-1">
            <p className="text-sm italic text-muted-foreground">Dear Sir / Ma’am,</p>
            <p className="font-semibold text-lg">Daily report summary:</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <ReportDetailItem label="Login Time" value={report.logInTime || "NIL"} />
            <ReportDetailItem label="Logout Time" value={report.logOutTime || "NIL"} />
        </div>
        <ReportDetailItem label="Tasks Assigned for the Day">
            {Array.isArray(report.tasksAssigned) && report.tasksAssigned.length > 0 && report.tasksAssigned.some(t => t.value) ? (
                <ul className="list-disc pl-5 space-y-1 mt-1">
                    {report.tasksAssigned.map((t, i) => t.value ? <li key={i}>{t.value}</li> : null)}
                </ul>
            ) : <span className="text-muted-foreground italic">NIL</span>}
        </ReportDetailItem>
        <div className="space-y-4">
            <p className="font-bold text-sm text-primary uppercase tracking-widest">Tasks Completed Today:</p>
            <div className="space-y-4">
                {Array.isArray(report.completedTasks) && report.completedTasks.length > 0 && report.completedTasks.some(t => t.moduleName) ? report.completedTasks.map((task, i) => task.moduleName ? (
                    <div key={i} className="pl-4 border-l-4 border-primary/20 space-y-1 py-1">
                        <p className="font-bold text-sm">{i + 1}. {task.moduleName}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.workDone || "NIL"}</p>
                    </div>
                ) : null) : <span className="text-muted-foreground italic">NIL</span>}
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
            <ReportDetailItem label="Signature" value={report.signature || "NIL"} />
        </div>
    </CardContent>
  </Card>
);

// --- Page ---

export default function ReportsPage() {
  const { user } = useFirebase();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [submitProgress, setSubmitProgress] = React.useState(0);
  const [audioUploadProgress, setAudioUploadProgress] = React.useState<{ [key: string]: number }>({});

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<UserData>(userDocRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const currentReportType = React.useMemo(() => {
    const title = (currentUserData?.jobTitle || '').toUpperCase();
    if (title.includes("TECHNICAL SUPPORT INTERN")) return 'Technical';
    if (title.includes("BUSINESS EXECUTIVE INTERN")) return 'Business';
    return 'Technical';
  }, [currentUserData?.jobTitle]);

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

  const intervention = useWatch({ control: form.control, name: "interventionTrigger" });

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
            bestCallRecording: ""
        } : {
            tasksAssigned: [{ value: "" }], completedTasks: [{ moduleName: "", workDone: "" }], repoLinks: [{ value: "" }],
            workInProgress: [], pendingTasks: [], whatILearned: [], challengesFaced: [], nextSteps: [],
            logInTime: todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'HH:mm') : "09:30",
            logOutTime: todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'HH:mm') : format(now, 'HH:mm'),
        })
      });
      setSubmitProgress(0);
      setAudioUploadProgress({});
  }, [form, currentUserData, isBusinessUser, todaysAttendance]);

  React.useEffect(() => { if (isAddDialogOpen) resetForm(); }, [isAddDialogOpen, resetForm]);

  const submissionConstraints = React.useMemo(() => {
    const now = new Date();
    const isDeadlinePassed = now.getHours() >= 18;
    const hasSubmittedToday = reports?.some(r => isSameDay(r.date.toDate(), now)) || false;
    return { isDeadlinePassed, hasSubmittedToday, canSubmit: !isDeadlinePassed && !hasSubmittedToday };
  }, [reports]);

  const handleAudioUpload = async (file: File, fieldName: string) => {
    if (!user || !currentUserData) return;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const fileName = `${currentUserData.firstName}_${currentUserData.lastName}_${dateStr}_${fieldName}_${Date.now()}`;
    const storageRef = ref(storage, `reports/${user.uid}/${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => setAudioUploadProgress(prev => ({ ...prev, [fieldName]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
        (error) => reject(error), 
        async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
      );
    });
  };

  const handleDeleteReport = async (report: Report) => {
    if (!isAdmin || !reportUserId) return;
    
    try {
      // 1. Delete from Firestore
      const reportRef = doc(firestore, `users/${reportUserId}/reports`, report.id);
      await deleteDoc(reportRef);

      // 2. Clean up storage if files exist
      if (report.bestCallRecording) {
        try {
          const fileRef = ref(storage, report.bestCallRecording);
          await deleteObject(fileRef);
        } catch (err) {
          console.warn("Could not delete audio file from storage", err);
        }
      }
      
      toast({ title: "Report Deleted", description: "The record and its audio files have been removed." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    setSubmitProgress(10);
    const outreach = Number(values.outreachColdCalls || 0) + Number(values.outreachLinkedIn || 0) + Number(values.outreachEmails || 0);
    const payload = {
      ...values,
      outreachTotal: isBusinessUser ? outreach : undefined,
      employeeId: user.uid,
      employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`,
      employeeDepartment: currentUserData.department || (isBusinessUser ? 'Sales-BD' : 'Engineering'),
      date: new Date(),
      reportType: currentReportType,
    };
    setSubmitProgress(70);
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), payload);
    setSubmitProgress(100);
    setTimeout(() => { toast({ title: "Report Submitted" }); setIsAddDialogOpen(false); }, 500);
  };

  const filteredUsers = usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const BusinessFormFields = () => {
    const { fields: meetings, append: appendMeeting, remove: removeMeeting } = useFieldArray({ control: form.control, name: "meetingsSecured" });
    const cold = Number(useWatch({ control: form.control, name: "outreachColdCalls" }) || 0);
    const linkedin = Number(useWatch({ control: form.control, name: "outreachLinkedIn" }) || 0);
    const email = Number(useWatch({ control: form.control, name: "outreachEmails" }) || 0);
    const total = cold + linkedin + email;
    const leads = Number(useWatch({ control: form.control, name: "newLeadsGenerated" }) || 0);
    const rate = total > 0 ? (leads / total) * 100 : 0;

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="outreachColdCalls" render={({ field }) => (<FormItem><FormLabel>Cold Calls</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="outreachLinkedIn" render={({ field }) => (<FormItem><FormLabel>LinkedIn</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="outreachEmails" render={({ field }) => (<FormItem><FormLabel>Emails</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <div className="md:col-span-3 p-3 bg-muted/30 rounded-md border text-sm font-bold">Total Outreach Volume: {total}</div>
                    <FormField control={form.control} name="newLeadsGenerated" render={({ field }) => (<FormItem><FormLabel>New Leads Generated</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="potentialClients" render={({ field }) => (<FormItem><FormLabel>Active Potential Clients</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <div className="md:col-span-1 flex flex-col justify-end"><Label className="mb-2">Conversion Rate</Label><Badge className="text-lg py-1">{rate.toFixed(2)}%</Badge></div>
                    <div className="md:col-span-3"><FormField control={form.control} name="followUpsCompleted" render={({ field }) => (<FormItem><FormLabel>Follow-ups Completed</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} /></div>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="INR">INR</SelectItem></SelectContent></Select></FormItem>)} />
                    <FormField control={form.control} name="netRevenueCollected" render={({ field }) => (<FormItem><FormLabel>NET Revenue Collected Today</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="committedNetRevenue" render={({ field }) => (<FormItem><FormLabel>Committed NET Revenue</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="pipelineValue" render={({ field }) => (<FormItem><FormLabel>Pipeline Business Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="revenueVariance" render={({ field }) => (<FormItem><FormLabel>Revenue Variance</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {meetings.map((field, index) => (
                        <div key={field.id} className="p-4 border rounded-md relative group space-y-3">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeMeeting(index)} disabled={meetings.length <= 1}><X className="size-4" /></Button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`meetingsSecured.${index}.clientName`} render={({ field }) => (<FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name={`meetingsSecured.${index}.quotationValue`} render={({ field }) => (<FormItem><FormLabel>Quotation Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                            </div>
                            <FormField control={form.control} name={`meetingsSecured.${index}.context`} render={({ field }) => (<FormItem><FormLabel>Brief Context</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                        </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => appendMeeting({ clientName: "", quotationValue: 0, context: "" })}><Plus className="size-4 mr-2" /> Add Engagement</Button>
                    <FormField control={form.control} name="clientWinHighlight" render={({ field }) => (<FormItem><FormLabel>Client Win/Highlight</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="strategicLearning" render={({ field }) => (<FormItem><FormLabel>Strategic Learning</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                    <div className="space-y-2 border-t pt-4">
                        <Label className="text-xs text-muted-foreground">Audio Recording (Max 5MB)</Label>
                        <div className="flex items-center gap-2">
                            <Input type="file" accept="audio/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file && file.size <= 5 * 1024 * 1024) {
                                    const url = await handleAudioUpload(file, 'bestCallRecording');
                                    form.setValue('bestCallRecording', url);
                                } else if (file) toast({ variant: 'destructive', title: 'File too large' });
                            }} />
                            {audioUploadProgress['bestCallRecording'] < 100 && <div className="text-xs animate-pulse">Uploading... {Math.round(audioUploadProgress['bestCallRecording'])}%</div>}
                            {form.getValues('bestCallRecording') && <CheckCircle2 className="size-5 text-green-600" />}
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><CalendarClock className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="meetingsBookedTomorrow" render={({ field }) => (<FormItem><FormLabel>Meetings Booked for Tomorrow</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="criticalPathTomorrow" render={({ field }) => (<FormItem><FormLabel>T+1 Critical Path</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="pendingDeliverables" render={({ field }) => (<FormItem><FormLabel>Pending Deliverables</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="interventionTrigger" render={({ field }) => (
                        <FormItem><FormLabel>Intervention Trigger</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="None">None</SelectItem><SelectItem value="Coaching">Coaching</SelectItem><SelectItem value="Technical Support">Technical Support</SelectItem><SelectItem value="Client meeting">Client meeting</SelectItem></SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    {intervention !== 'None' && <FormField control={form.control} name="interventionReason" render={({ field }) => (<FormItem><FormLabel>Reason for Trigger</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />}
                </CardContent>
            </Card>
        </div>
    );
  };

  const TechnicalFormFields = () => {
    const { fields: tasks, append: appendTask, remove: removeTask } = useFieldArray({ control: form.control, name: "tasksAssigned" });
    const { fields: modules, append: appendModule, remove: removeModule } = useFieldArray({ control: form.control, name: "completedTasks" });
    const ChipInput = ({ name, label, icon: Icon, placeholder }: { name: string, label: string, icon: any, placeholder: string }) => {
        const { fields, append, remove } = useFieldArray({ control: form.control, name });
        const [val, setVal] = React.useState("");
        const add = () => { if (val.trim()) { append({ value: val.trim() }); setVal(""); } };
        return (
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader className="py-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Icon className="size-4 text-primary" />{label}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2"><Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}/><Button type="button" size="icon" onClick={add}><Plus className="size-4" /></Button></div>
                    <div className="flex flex-wrap gap-2">{fields.map((f, i) => (<Badge key={f.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 group"><span className="text-xs">{(f as any).value}</span><button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100"><X className="size-3" /></button></Badge>))}</div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <p className="text-sm italic text-muted-foreground">Dear Sir / Ma’am,</p><p className="font-semibold text-lg">Daily report summary:</p>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6"><FormField control={form.control} name="logInTime" render={({ field }) => (<FormItem><FormLabel>Login Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} /><FormField control={form.control} name="logOutTime" render={({ field }) => (<FormItem><FormLabel>Logout Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} /></CardContent></Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ListTodo className="size-4 text-primary" /> Tasks Assigned</CardTitle></CardHeader>
                <CardContent className="space-y-3">{tasks.map((f, i) => (<div key={f.id} className="flex gap-2"><FormField control={form.control} name={`tasksAssigned.${i}.value`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input {...field} placeholder={`Task ${i + 1}`} /></FormControl></FormItem>)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeTask(i)} disabled={tasks.length <= 1}><Trash2 className="size-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendTask({ value: "" })} className="w-full"><Plus className="size-4 mr-2" /> Add Task</Button></CardContent>
            </Card>
            <div className="space-y-4"><p className="font-bold text-sm text-primary uppercase tracking-widest flex items-center gap-2"><Brain className="size-4" /> Tasks Completed Today:</p>
                {modules.map((f, i) => (
                    <Card key={f.id} className="relative group bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                        <CardContent className="pt-6 space-y-4">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => removeModule(i)} disabled={modules.length <= 1}><X className="size-4" /></Button>
                            <FormField control={form.control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (<FormItem><FormLabel>Module Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)}/>
                            <FormField control={form.control} name={`completedTasks.${i}.workDone`} render={({ field }) => (<FormItem><FormLabel>Work Done</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)}/>
                        </CardContent>
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => appendModule({ moduleName: "", workDone: "" })} className="w-full border-dashed"><Plus className="size-4 mr-2" /> Add Completed Module</Button>
            </div>
            <ChipInput name="repoLinks" label="Repo Links" icon={LinkIcon} placeholder="https://..." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInput name="workInProgress" label="Work in Progress" icon={Clock} placeholder="Ongoing..." /><ChipInput name="pendingTasks" label="Pending Tasks" icon={Clock} placeholder="Pending..." /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInput name="whatILearned" label="What I Learned" icon={Brain} placeholder="Learning..." /><ChipInput name="challengesFaced" label="Challenges" icon={Info} placeholder="Challenge..." /></div>
            <ChipInput name="nextSteps" label="Next Steps" icon={Plus} placeholder="Step..." />
            <div className="pt-4 border-t space-y-4"><p className="text-sm italic">Thank you.</p></div>
        </div>
    );
  };

  return (
    <>
      <PageHeader title={isAdmin ? "Employee Reports" : "My Daily Reports"} description={isAdmin ? "Review daily reports submitted by team members." : "Submit your work report for review."}>
        {!isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} disabled={!submissionConstraints.canSubmit} className={cn(!submissionConstraints.canSubmit && "bg-muted text-muted-foreground")}>
                <PlusCircle className="mr-2 h-4 w-4"/> 
                {submissionConstraints.hasSubmittedToday ? "Already Submitted" : submissionConstraints.isDeadlinePassed ? "Deadline Passed (6 PM)" : "Add Today's Report"}
            </Button>
        )}
      </PageHeader>
      
      {!isAdmin && !submissionConstraints.canSubmit && (
          <Alert variant="destructive" className="mb-6 animate-fade-in-up border-orange-500 bg-orange-50 text-orange-900">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertTitle>Submission Restriction</AlertTitle>
              <AlertDescription>{submissionConstraints.hasSubmittedToday ? "You have already submitted a report for today." : "The 6:00 PM deadline has passed. Late submissions are blocked."}</AlertDescription>
          </Alert>
      )}

      {isAdmin ? (
        <><div className="flex flex-col sm:flex-row gap-4 mb-4"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search employee..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
          <div className="border rounded-lg overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Job Title</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{areUsersLoading ? (<TableRow><TableCell colSpan={3} className="h-24 text-center">Loading...</TableCell></TableRow>) : filteredUsers?.map(u => (<TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}><TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell><TableCell>{u.jobTitle}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm">View Reports</Button></TableCell></TableRow>))}</TableBody></Table></div></>
      ) : (
        <div className="space-y-2">{areReportsLoading ? (<p className="text-center py-10 text-muted-foreground">Loading...</p>) : reports && reports.length > 0 ? (<Accordion type="single" collapsible className="w-full space-y-2">{reports.map(r => (
                <AccordionItem value={r.id} key={r.id} className="border-none"><AccordionTrigger className="border rounded-md px-4 hover:no-underline hover:bg-muted/50 shadow-sm"><div className="flex-1 text-left"><p className="font-semibold text-primary">{r.reportType} Report</p><p className="text-xs text-muted-foreground">{format(r.date.toDate(), "PPpp")}</p></div></AccordionTrigger>
                  <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "PDF Ready" })}><Download className="h-4 w-4 mr-2" />PDF</Button>
                        <Button variant="outline" size="sm" onClick={() => toast({ title: "Email Shared" })}><Mail className="h-4 w-4 mr-2" />Email</Button>
                        {isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently remove the report and its audio files to save storage space.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteReport(r)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : <TechnicalReportDetails report={r} />}
                  </AccordionContent>
                </AccordionItem>
              ))}</Accordion>) : <Card><CardContent className="h-48 flex items-center justify-center text-muted-foreground">No reports found.</CardContent></Card>}</div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                    <DialogHeader className="p-6 pb-4 border-b"><DialogTitle>New {currentReportType} Report</DialogTitle><DialogDescription>{format(new Date(), "PPP")}</DialogDescription></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-6 space-y-6">
                        {isBusinessUser ? <BusinessFormFields /> : <TechnicalFormFields />}
                        <div className="pt-6 border-t space-y-4">
                            <FormField control={form.control} name="signature" render={({ field }) => (<FormItem><FormLabel>Verified Signature</FormLabel><FormControl><Input {...field} readOnly className="bg-muted font-mono text-xs cursor-not-allowed" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-primary/5 border-primary/20"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>I confirm that all information provided is accurate.</FormLabel></div></FormItem>)} />
                        </div>
                    </div></ScrollArea>
                    <div className="p-4 border-t space-y-4">
                        {submitProgress > 0 && (<div className="space-y-2"><div className="flex justify-between text-xs font-medium"><span>Submitting...</span><span>{submitProgress}%</span></div><Progress value={submitProgress} className="h-2" /></div>)}
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button type="submit">Submit Report</Button></DialogFooter>
                    </div>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={isOpen => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-3xl w-full flex flex-col p-0">
            <SheetHeader className="p-6 border-b"><SheetTitle>{selectedUser?.firstName}'s Reports</SheetTitle></SheetHeader>
            <ScrollArea className="flex-1 p-6">{reports && reports.length > 0 ? (<Accordion type="single" collapsible className="w-full space-y-2">{reports.map(r => (
                <AccordionItem value={r.id} key={r.id} className="border-none">
                    <AccordionTrigger className="border rounded-md px-4 mb-2 shadow-sm"><div className="flex-1 text-left"><p className="font-semibold text-primary">{r.reportType} Report</p><p className="text-xs text-muted-foreground">{format(r.date.toDate(), "PPpp")}</p></div></AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                        <div className="flex justify-end gap-2 mb-4">
                            <Button variant="outline" size="sm" onClick={() => toast({ title: "PDF Ready" })}><Download className="h-4 w-4 mr-2" />PDF</Button>
                            <Button variant="outline" size="sm" onClick={() => toast({ title: "Email Shared" })}><Mail className="h-4 w-4 mr-2" />Email</Button>
                            {isAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove the report and its audio files to save storage space.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteReport(r)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                        {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : <TechnicalReportDetails report={r} />}
                    </AccordionContent>
                </AccordionItem>))}</Accordion>) : <p className="text-center py-10 text-muted-foreground">No reports found.</p>}</ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
