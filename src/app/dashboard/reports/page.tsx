
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Trash2, Info, Download, Mail, TrendingUp, Target, CalendarClock, Brain, ListTodo, Link as LinkIcon, X, Plus, Clock, FileText, AlertCircle, CheckCircle2, Mic, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay, differenceInSeconds } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useFirebase, useAuth, setDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
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
import { useRouter } from "next/navigation";
import Link from "next/link";

const formatIST = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date).replace(',', ' |') + " IST";
};

const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
    return symbols[code] || '$';
};

const ReportDetailItem = ({ label, value, children, className }: { label: string, value?: React.ReactNode, children?: React.ReactNode, className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{label}</p>
    <div className="font-semibold whitespace-pre-wrap text-sm text-foreground">
        {(!value && !children && value !== 0) ? <span className="text-muted-foreground/50 italic font-normal">NIL</span> : (value ?? children)}
    </div>
  </div>
);

const ChipDisplay = ({ items }: { items?: { value: string }[] }) => {
    if (!items || !Array.isArray(items) || items.length === 0 || (items.length === 1 && !items[0].value)) return <span className="text-muted-foreground/50 italic font-normal text-sm">NIL</span>;
    return (
        <div className="flex flex-wrap gap-2 mt-1">
            {items.map((item, i) => item.value ? (
                <Badge key={i} variant="secondary" className="px-2 py-1 font-medium bg-muted/50 border-none">{item.value}</Badge>
            ) : null)}
        </div>
    );
};

const BusinessReportDetails = ({ report }: { report: any }) => {
    const cold = Number(report.outreachColdCalls || 0);
    const linkedin = Number(report.outreachLinkedIn || 0);
    const email = Number(report.outreachEmails || 0);
    const totalOutreach = cold + linkedin + email;
    const leads = Number(report.newLeadsGenerated || 0);
    
    // Formula Correction: Cap at 100% to represent conversion efficiency
    const rawRate = (totalOutreach > 0) ? (leads / totalOutreach) * 100 : 0;
    const displayRate = Math.min(100, Math.max(0, rawRate));
    
    const rateColor = displayRate < 5 ? 'text-red-600' : displayRate < 15 ? 'text-orange-600' : 'text-green-600';
    const mainSym = getCurrencySymbol(report.currency || 'USD');

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-3" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-white/50 rounded-xl border border-border/50 shadow-inner">
                        <ReportDetailItem label="Total Outreach" value={totalOutreach} />
                        <ReportDetailItem label="Potential Clients" value={report.potentialClients} />
                        <ReportDetailItem label="Pipeline Value" value={`${mainSym}${report.pipelineValue?.toLocaleString() ?? 0}`} />
                        <ReportDetailItem label="Intervention" value={report.interventionTrigger || "None"} />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                        <ReportDetailItem label="Cold Calls" value={cold} />
                        <ReportDetailItem label="LinkedIn" value={linkedin} />
                        <ReportDetailItem label="Emails" value={email} />
                        <ReportDetailItem label="New Leads" value={leads} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Efficiency Conversion Rate</p>
                            <p className={cn("text-2xl font-black tracking-tighter", rateColor)}>{displayRate.toFixed(2)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Follow-ups</p>
                            <p className="text-xl font-bold">{report.followUpCount || 0}</p>
                        </div>
                    </div>

                    {report.followUpClients && report.followUpClients.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clients Followed Up:</p>
                            <div className="flex flex-wrap gap-2">
                                {report.followUpClients.map((c: string, i: number) => <Badge key={i} variant="outline" className="bg-white">{c}</Badge>)}
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent className="pt-4">
                    <div className="border rounded-xl overflow-hidden bg-white/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="h-8 text-[10px] uppercase font-bold">Financial Category</TableHead>
                                    <TableHead className="h-8 text-[10px] uppercase font-bold text-right">Amount ({mainSym})</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-border/50"><TableCell className="py-2 text-sm">NET Revenue Collected</TableCell><TableCell className="py-2 text-sm font-bold text-right">{mainSym}{report.netRevenueCollected?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="border-border/50"><TableCell className="py-2 text-sm">Committed NET Revenue</TableCell><TableCell className="py-2 text-sm font-bold text-right">{mainSym}{report.committedNetRevenue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="border-none bg-red-50/30"><TableCell className="py-2 text-sm font-semibold">Revenue Variance</TableCell><TableCell className="py-2 text-sm font-bold text-right text-red-600">-{mainSym}{report.revenueVariance?.toLocaleString() ?? 0}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Target className="size-3" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 mb-4">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Quotations Released Today</p>
                        <p className="text-2xl font-black text-primary">{report.quotationsReleased || 0}</p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Meetings/Demos Secured Today:</p>
                        <div className="grid gap-3">
                            {Array.isArray(report.meetingsSecured) && report.meetingsSecured.length > 0 && report.meetingsSecured.some((m: any) => m.clientName) ? report.meetingsSecured.map((m: any, i: number) => m.clientName ? (
                                <div key={i} className="p-3 bg-white/80 rounded-xl border border-border/50 shadow-sm text-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                                    <p className="font-bold flex items-center justify-between">
                                        <span>Serial No. {i + 1}: {m.clientName}</span> 
                                        <span className="text-primary">{getCurrencySymbol(m.currency || report.currency || 'USD')}{m.quotationValue?.toLocaleString() ?? 0}</span>
                                    </p>
                                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{m.context || "NIL"}</p>
                                </div>
                            ) : null) : <div className="text-muted-foreground/50 italic text-sm p-4 bg-muted/10 rounded-lg text-center border border-dashed">No meetings/demos reported (NIL)</div>}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ReportDetailItem label="Client Win/Highlight" value={report.clientWinHighlight || "NIL"} />
                        <ReportDetailItem label="Strategic Learning" value={report.strategicLearning || "NIL"} />
                    </div>
                    
                    <div className="pt-4 border-t border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Call Recording Drive Links:</p>
                        <div className="flex flex-wrap gap-2">
                            {Array.isArray(report.callRecordingLinks) && report.callRecordingLinks.length > 0 ? report.callRecordingLinks.map((link: any, i: number) => (
                                <Badge key={i} variant="outline" className="bg-white hover:bg-muted transition-colors">
                                    <Link href={link.value} target="_blank" className="flex items-center gap-1.5 py-1">
                                        <LinkIcon className="size-3" /> Link {i + 1}
                                    </Link>
                                </Badge>
                            )) : <span className="text-muted-foreground/50 italic text-sm">NIL</span>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><CalendarClock className="size-3" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                        <ReportDetailItem label="Meetings Tomorrow" value={report.meetingsBookedTomorrow ?? 0} />
                        <ReportDetailItem label="Critical Path T+1" value={report.criticalPathTomorrow || "NIL"} />
                    </div>
                    <ReportDetailItem label="Pending Deliverables" value={report.pendingDeliverables || "NIL"} />
                    {report.interventionTrigger !== 'None' && report.interventionReason && (
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <ReportDetailItem label="Intervention Reason" value={report.interventionReason} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                <div className="flex items-center gap-2 font-bold text-primary uppercase tracking-widest text-xs">🖋️ Signature Section</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-sm">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">{(report.employeeEmploymentType || 'Intern') === 'Intern' ? 'Intern' : 'Employee'} Name</p>
                        <p className="font-bold">{report.employeeName || "NIL"}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Department</p>
                        <p className="font-bold">{report.employeeDepartment || "NIL"}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">E-Signature Status</p>
                        <p className="text-green-600 font-bold flex items-center gap-1.5"><CheckCircle2 className="size-4" /> ✅ Verified Identity</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Timestamp (IST)</p>
                        <p className="font-mono text-xs font-semibold bg-white/50 px-2 py-1 rounded inline-block">
                            {report.date ? formatIST(report.date.toDate()) : "NIL"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TechnicalReportDetails = ({ report }: { report: any }) => (
  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
    <CardContent className="space-y-6 pt-8 text-sm">
        <div className="space-y-1 p-4 bg-muted/10 rounded-xl border border-dashed">
            <p className="text-sm italic text-muted-foreground leading-relaxed">Dear Sir / Ma’am,</p>
            <p className="font-bold text-lg tracking-tight">Here is my daily work summary for today:</p>
        </div>
        <div className="grid grid-cols-2 gap-6 px-2">
            <ReportDetailItem label="Login Time" value={report.logInTime || "NIL"} />
            <ReportDetailItem label="Logout Time" value={report.logOutTime || "NIL"} />
        </div>
        
        <Card className="bg-white/50 border-none shadow-none ring-1 ring-border/50">
            <CardHeader className="py-3 px-4"><CardTitle className="text-xs font-bold text-primary uppercase tracking-widest">Tasks Assigned for the Day</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
                {Array.isArray(report.tasksAssigned) && report.tasksAssigned.length > 0 && report.tasksAssigned.some((t:any) => t.value) ? (
                    <ul className="list-disc pl-5 space-y-2">
                        {report.tasksAssigned.map((t:any, i:number) => t.value ? <li key={i} className="text-sm font-medium">{t.value}</li> : null)}
                    </ul>
                ) : <span className="text-muted-foreground/50 italic">NIL</span>}
            </CardContent>
        </Card>

        <div className="space-y-4">
            <p className="font-bold text-xs text-primary uppercase tracking-widest px-2">Tasks Completed Today:</p>
            <div className="grid gap-4">
                {Array.isArray(report.completedTasks) && report.completedTasks.length > 0 && report.completedTasks.some((t:any) => t.moduleName) ? report.completedTasks.map((task:any, i:number) => task.moduleName ? (
                    <div key={i} className="p-4 bg-white/80 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20" />
                        <p className="font-bold text-sm text-foreground">{i + 1}. {task.moduleName}</p>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">{task.workDone || "NIL"}</p>
                    </div>
                ) : null) : <div className="p-6 bg-muted/10 rounded-2xl border border-dashed text-center text-muted-foreground/50 italic">No tasks completed reported (NIL)</div>}
            </div>
        </div>

        <div className="grid gap-6 px-2">
            <ReportDetailItem label="GitHub / Repository Links"><ChipDisplay items={report.repoLinks} /></ReportDetailItem>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportDetailItem label="Work in Progress"><ChipDisplay items={report.workInProgress} /></ReportDetailItem>
                <ReportDetailItem label="Pending Tasks"><ChipDisplay items={report.pendingTasks} /></ReportDetailItem>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportDetailItem label="Key Learnings Today"><ChipDisplay items={report.whatILearned} /></ReportDetailItem>
                <ReportDetailItem label="Challenges Faced"><ChipDisplay items={report.challengesFaced} /></ReportDetailItem>
            </div>
            <ReportDetailItem label="Immediate Next Steps"><ChipDisplay items={report.nextSteps} /></ReportDetailItem>
        </div>

        <div className="pt-8 border-t border-dashed space-y-6">
            <div className="px-2">
                <p className="text-sm italic font-medium text-muted-foreground">Thank you.</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-sm">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">{(report.employeeEmploymentType || 'Intern') === 'Intern' ? 'Intern' : 'Employee'} Name</p>
                        <p className="font-bold">{report.employeeName || "NIL"}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Department</p>
                        <p className="font-bold">{report.employeeDepartment || "NIL"}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">E-Signature Status</p>
                        <p className="text-green-600 font-bold flex items-center gap-1.5"><CheckCircle2 className="size-4" /> ✅ Verified Identity</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Timestamp (IST)</p>
                        <p className="font-mono text-xs font-semibold bg-white/50 px-2 py-1 rounded inline-block">
                            {report.date ? formatIST(report.date.toDate()) : "NIL"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </CardContent>
  </Card>
);

const businessReportSchema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "INR"]).default("USD"),
  outreachColdCalls: z.coerce.number().min(0).default(0),
  outreachLinkedIn: z.coerce.number().min(0).default(0),
  outreachEmails: z.coerce.number().min(0).default(0),
  newLeadsGenerated: z.coerce.number().min(0).default(0),
  potentialClients: z.coerce.number().min(0).default(0),
  followUpCount: z.coerce.number().min(0).default(0),
  followUpClients: z.array(z.string().min(0)).optional().default([]),
  quotationsReleased: z.coerce.number().min(0).default(0),
  netRevenueCollected: z.coerce.number().min(0).default(0),
  committedNetRevenue: z.coerce.number().min(0).default(0),
  pipelineValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().default(0),
  meetingsSecured: z.array(z.object({ 
    clientName: z.string().optional(), 
    currency: z.enum(["USD", "EUR", "GBP", "INR"]).default("USD"),
    quotationValue: z.coerce.number().min(0).default(0),
    context: z.string().optional()
  })).optional().default([]),
  clientWinHighlight: z.string().optional().default(""),
  strategicLearning: z.string().optional().default(""),
  meetingsBookedTomorrow: z.coerce.number().min(0).default(0),
  criticalPathTomorrow: z.string().optional().default(""),
  pendingDeliverables: z.string().optional().default(""),
  interventionTrigger: z.enum(["None", "Coaching", "Technical Support", "Client meeting"]).default("None"),
  interventionReason: z.string().optional().default(""),
  callRecordingLinks: z.array(z.object({ value: z.string().url("Invalid Drive Link") })).optional().default([]),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Certification required." }) }),
  signature: z.string().min(1, "Signature is required."),
});

const technicalReportSchema = z.object({
  logInTime: z.string().min(1, "Required"),
  logOutTime: z.string().min(1, "Required"),
  tasksAssigned: z.array(z.object({ value: z.string() })).optional().default([]),
  completedTasks: z.array(z.object({ 
    moduleName: z.string().min(0), 
    workDone: z.string().min(0) 
  })).optional().default([]),
  repoLinks: z.array(z.object({ value: z.string() })).optional().default([]),
  workInProgress: z.array(z.object({ value: z.string() })).optional().default([]),
  pendingTasks: z.array(z.object({ value: z.string() })).optional().default([]),
  whatILearned: z.array(z.object({ value: z.string() })).optional().default([]),
  challengesFaced: z.array(z.object({ value: z.string() })).optional().default([]),
  nextSteps: z.array(z.object({ value: z.string() })).optional().default([]),
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Certification required." }) }),
  signature: z.string().min(1, "Signature is required."),
});

export default function ReportsPage() {
  const { user } = useFirebase();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = React.useState(false);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const currentReportType = React.useMemo(() => {
    const title = (currentUserData?.jobTitle || '').toUpperCase();
    if (
        title.includes("TECHNICAL") || 
        title.includes("DEVELOPER") || 
        title.includes("ENGINEER") || 
        title.includes("QA") || 
        title.includes("TECH") ||
        title.includes("FRONTEND") ||
        title.includes("BACKEND") ||
        title.includes("FULLSTACK")
    ) return 'Technical';
    return 'Business';
  }, [currentUserData?.jobTitle]);

  const isBusinessUser = currentReportType === 'Business';

  const usersQuery = useMemoFirebase(() => (isAdmin && user) ? query(collection(firestore, "users")) : null, [firestore, isAdmin, user]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<any>(usersQuery);

  const reportUserId = isAdmin ? selectedUser?.id : user?.uid;
  const reportsQuery = useMemoFirebase(() => reportUserId ? query(collection(firestore, `users/${reportUserId}/reports`), orderBy('date', 'desc')) : null, [firestore, reportUserId]);
  const { data: reports, isLoading: areReportsLoading } = useCollection<any>(reportsQuery);
  
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
  const followUpCount = useWatch({ control: form.control, name: "followUpCount" }) || 0;

  const resetForm = React.useCallback(() => {
      const now = new Date();
      const istTimestamp = formatIST(now);
      const eType = currentUserData?.employmentType || "Intern";
      const signatureStr = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName} | ${eType} | ${istTimestamp}` : "";

      form.reset({
        signature: signatureStr,
        declaration: false,
        ...(isBusinessUser ? {
            currency: "USD", outreachColdCalls: 0, outreachLinkedIn: 0, outreachEmails: 0, newLeadsGenerated: 0, potentialClients: 0, followUpCount: 0, followUpClients: [],
            quotationsReleased: 0, netRevenueCollected: 0, committedNetRevenue: 0, pipelineValue: 0, revenueVariance: 0, meetingsSecured: [],
            clientWinHighlight: "", strategicLearning: "", meetingsBookedTomorrow: 0, criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None", interventionReason: "",
            callRecordingLinks: []
        } : {
            tasksAssigned: [], completedTasks: [], repoLinks: [],
            workInProgress: [], pendingTasks: [], whatILearned: [], challengesFaced: [], nextSteps: [],
            logInTime: todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'HH:mm') : "09:30",
            logOutTime: todaysAttendance?.checkOutTime ? format(todaysAttendance.checkOutTime.toDate(), 'HH:mm') : format(now, 'HH:mm'),
        })
      });
  }, [form, currentUserData, isBusinessUser, todaysAttendance]);

  React.useEffect(() => { if (isAddDialogOpen && currentUserData) resetForm(); }, [isAddDialogOpen, resetForm, currentUserData]);

  const submissionConstraints = React.useMemo(() => {
    const now = new Date();
    const istTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now);
    
    const [istHour, istMinute] = istTimeStr.split(':').map(Number);
    const isDeadlinePassed = (istHour > 18) || (istHour === 18 && istMinute >= 30);
    const hasSubmittedToday = reports?.some(r => isSameDay(r.date.toDate(), now)) || false;
    
    return { 
        isDeadlinePassed, 
        hasSubmittedToday, 
        canSubmit: !hasSubmittedToday && !isDeadlinePassed 
    };
  }, [reports]);

  const handleDeleteReport = async (report: any) => {
    if (!isAdmin || !reportUserId) return;
    try {
      await deleteDoc(doc(firestore, `users/${reportUserId}/reports`, report.id));
      toast({ title: "Report Deleted" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const cleanPayload = (obj: any) => {
    const result: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    });
    return result;
  };

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    
    setIsVerifyingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            
            const commonPayload = {
                signature: values.signature,
                declaration: values.declaration,
                employeeId: user.uid,
                employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`,
                employeeDepartment: currentUserData.department || (isBusinessUser ? 'BUSINESS' : 'TECHNICAL'),
                employeeJobTitle: currentUserData.jobTitle,
                employeeEmploymentType: currentUserData.employmentType || "Intern",
                date: new Date(),
                reportType: currentReportType,
            };

            const dataPayload = isBusinessUser ? {
                currency: values.currency,
                outreachColdCalls: values.outreachColdCalls,
                outreachLinkedIn: values.outreachLinkedIn,
                outreachEmails: values.outreachEmails,
                outreachTotal: Number(values.outreachColdCalls || 0) + Number(values.outreachLinkedIn || 0) + Number(values.outreachEmails || 0),
                newLeadsGenerated: values.newLeadsGenerated,
                potentialClients: values.potentialClients,
                followUpCount: values.followUpCount,
                followUpClients: values.followUpClients,
                quotationsReleased: values.quotationsReleased,
                netRevenueCollected: values.netRevenueCollected,
                committedNetRevenue: values.committedNetRevenue,
                pipelineValue: values.pipelineValue,
                revenueVariance: values.revenueVariance,
                meetingsSecured: values.meetingsSecured,
                clientWinHighlight: values.clientWinHighlight,
                strategicLearning: values.strategicLearning,
                meetingsBookedTomorrow: values.meetingsBookedTomorrow,
                criticalPathTomorrow: values.criticalPathTomorrow,
                pendingDeliverables: values.pendingDeliverables,
                interventionTrigger: values.interventionTrigger,
                interventionReason: values.interventionReason,
                callRecordingLinks: values.callRecordingLinks,
            } : {
                logInTime: values.logInTime,
                logOutTime: values.logOutTime,
                tasksAssigned: values.tasksAssigned,
                completedTasks: values.completedTasks,
                repoLinks: values.repoLinks,
                workInProgress: values.workInProgress,
                pendingTasks: values.pendingTasks,
                whatILearned: values.whatILearned,
                challengesFaced: values.challengesFaced,
                nextSteps: values.nextSteps,
            };

            const finalPayload = cleanPayload({ ...commonPayload, ...dataPayload });

            try {
                // 1. Save Report
                await addDoc(collection(firestore, `users/${user.uid}/reports`), finalPayload);
                
                // 2. Finalize Attendance (Clock Out)
                const todayId = format(new Date(), 'yyyy-MM-dd');
                const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
                
                const attendanceUpdates: any = {
                    checkOutTime: serverTimestamp(),
                    locationCheckOutLatitude: latitude,
                    locationCheckOutLongitude: longitude,
                };

                // Handle hanging break if user forgot to end it
                if (todaysAttendance?.locationLunchOutLatitude && !todaysAttendance?.locationLunchInLatitude) {
                    attendanceUpdates.locationLunchInLatitude = latitude;
                    attendanceUpdates.locationLunchInLongitude = longitude;
                    attendanceUpdates.lunchInTime = serverTimestamp();
                }

                setDocumentNonBlocking(attRef, attendanceUpdates, { merge: true });

                setIsVerifyingLocation(false);
                toast({ title: "Work Session Complete", description: "Report saved and clock-out confirmed. Logging out..." });
                
                // 3. Logout
                setTimeout(async () => {
                    await auth.signOut();
                    router.push('/login');
                }, 1500);
                
            } catch (err: any) {
                setIsVerifyingLocation(false);
                toast({ variant: 'destructive', title: 'Submission Failed', description: err.message });
            }
        },
        (error) => {
            setIsVerifyingLocation(false);
            toast({ variant: 'destructive', title: 'GPS Verification Failed', description: "Required for final clock-out. Please enable location." });
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const filteredUsers = usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const BusinessFormFields = () => {
    const { fields: meetings, append: appendMeeting, remove: removeMeeting } = useFieldArray({ control: form.control, name: "meetingsSecured" });
    const { fields: links, append: appendLink, remove: removeLink } = useFieldArray({ control: form.control, name: "callRecordingLinks" });
    
    // Efficiency Calculation Update
    const cold = Number(useWatch({ control: form.control, name: "outreachColdCalls" }) || 0);
    const linkedin = Number(useWatch({ control: form.control, name: "outreachLinkedIn" }) || 0);
    const email = Number(useWatch({ control: form.control, name: "outreachEmails" }) || 0);
    const total = cold + linkedin + email;
    const leads = Number(useWatch({ control: form.control, name: "newLeadsGenerated" }) || 0);
    
    // Formula: (Leads / Total Effort) * 100
    // Capped at 100% to represent conversion of trials to leads correctly
    const rawRate = (total > 0 && leads >= 0) ? (leads / total) * 100 : 0;
    const rate = Math.min(100, Math.max(0, rawRate));
    
    const rateColor = rate < 5 ? 'text-red-600' : rate < 15 ? 'text-orange-600' : 'text-green-600';

    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-muted/20 rounded-2xl border border-border/50">
                        <FormField control={form.control} name="outreachColdCalls" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs uppercase font-bold">Cold Calls</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="outreachLinkedIn" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs uppercase font-bold">LinkedIn</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="outreachEmails" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs uppercase font-bold">Emails</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>
                        )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end px-2">
                        <div className="p-4 bg-white rounded-2xl border shadow-sm">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground">Total Outreach Volume</Label>
                            <p className="text-2xl font-black text-primary tracking-tighter">{total}</p>
                        </div>
                        <FormField control={form.control} name="newLeadsGenerated" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-black text-muted-foreground">New Leads Generated</FormLabel><FormControl><Input type="number" {...field} className="rounded-2xl h-12 text-lg font-bold" /></FormControl></FormItem>
                        )} />
                        <div className="p-4 bg-white rounded-2xl border shadow-sm">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground">Conversion Rate (Efficiency)</Label>
                            <p className={cn("text-2xl font-black tracking-tighter", rateColor)}>{rate.toFixed(2)}%</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed">
                        <FormField control={form.control} name="potentialClients" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs uppercase font-bold">Active Potential Clients</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="followUpCount" render={({ field }) => (
                            <FormItem><FormLabel className="text-xs uppercase font-bold">Number of Follow-ups</FormLabel><Select onValueChange={field.onChange} value={field.value?.toString() || "0"}><FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{Array.from({ length: 21 }).map((_, i) => (<SelectItem key={i} value={i.toString()}>{i}</SelectItem>))}</SelectContent></Select></FormItem>
                        )} />
                    </div>
                    {Number(followUpCount) > 0 && (
                        <div className="space-y-3 p-4 bg-muted/10 rounded-2xl border border-dashed">
                            <p className="text-[10px] uppercase font-black text-muted-foreground mb-2">Enter Follow-up Client Names:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: Number(followUpCount) }).map((_, i) => (
                                <FormField key={i} control={form.control} name={`followUpClients.${i}`} render={({ field }) => (<FormControl><Input {...field} placeholder={`Client Name ${i + 1}`} className="rounded-xl h-10 text-xs bg-white" /></FormControl>)} />
                            ))}</div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">2️⃣ Revenue & Financial Impact</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Default Report Currency</FormLabel><Select onValueChange={field.onChange} value={field.value || "USD"}><FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="INR">INR (₹)</SelectItem></SelectContent></Select></FormItem>)} /><FormField control={form.control} name="netRevenueCollected" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">NET Revenue Collected Today</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>)} /><FormField control={form.control} name="committedNetRevenue" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Committed NET Revenue</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>)} /><FormField control={form.control} name="pipelineValue" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Pipeline Business Value</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>)} /><FormField control={form.control} name="revenueVariance" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Revenue Variance (Optional)</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>)} /></CardContent></Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Target className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader><CardContent className="space-y-6"><div className="p-4 bg-muted/10 rounded-2xl border border-dashed mb-4"><FormField control={form.control} name="quotationsReleased" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-primary">No. of Quotations Released Today</FormLabel><FormControl><Input type="number" {...field} className="rounded-full font-bold" /></FormControl></FormItem>)} /></div><div className="space-y-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Meetings/Demos Secured Today:</p>{meetings.map((field, index) => (<div key={field.id} className="p-5 bg-white/50 border rounded-2xl relative group space-y-4 transition-all hover:shadow-md"><Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 rounded-full bg-red-50 border border-red-100 text-red-600 opacity-0 group-hover:opacity-100 h-8 w-8" onClick={() => removeMeeting(index)}><X className="size-4" /></Button><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name={`meetingsSecured.${index}.clientName`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Serial No. {index + 1}: Client Name</FormLabel><FormControl><Input {...field} className="rounded-xl" /></FormControl></FormItem>)} /><div className="grid grid-cols-3 gap-2"><FormField control={form.control} name={`meetingsSecured.${index}.currency`} render={({ field }) => (<FormItem className="col-span-1"><FormLabel className="text-[10px] uppercase font-bold">Cur</FormLabel><Select onValueChange={field.onChange} value={field.value || "USD"}><FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">$</SelectItem><SelectItem value="EUR">€</SelectItem><SelectItem value="GBP">£</SelectItem><SelectItem value="INR">₹</SelectItem></SelectContent></Select></FormItem>)} /><FormField control={form.control} name={`meetingsSecured.${index}.quotationValue`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className="text-[10px] uppercase font-bold">Quotation / Deal Value</FormLabel><FormControl><Input type="number" {...field} className="rounded-xl" /></FormControl></FormItem>)} /></div></div><FormField control={form.control} name={`meetingsSecured.${index}.context`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Engagement Context</FormLabel><FormControl><Textarea {...field} className="min-h-[60px] rounded-xl" /></FormControl></FormItem>)} /></div>))}<Button type="button" variant="outline" className="w-full border-dashed rounded-xl h-12 bg-white/50 text-xs font-bold" onClick={() => appendMeeting({ clientName: "", currency: "USD", quotationValue: 0, context: "" })}><Plus className="size-4 mr-2" /> ADD NEW CLIENT RECORD</Button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed"><FormField control={form.control} name="clientWinHighlight" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Client Win / Today's Highlight</FormLabel><FormControl><Textarea {...field} className="min-h-[100px] rounded-xl" /></FormControl></FormItem>)} /><FormField control={form.control} name="strategicLearning" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Strategic Tactical Learning</FormLabel><FormControl><Textarea {...field} className="min-h-[100px] rounded-xl" /></FormControl></FormItem>)} /></div><div className="pt-4 border-t border-dashed space-y-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Call Recording Drive Links:</p>{links.map((field, index) => (<div key={field.id} className="flex gap-2"><FormField control={form.control} name={`callRecordingLinks.${index}.value`} render={({ field }) => (
                            <FormItem className="flex-1"><FormControl><Input {...field} placeholder="https://drive.google.com/..." className="rounded-xl h-10 text-xs" /></FormControl><FormMessage /></FormItem>
                        )}/><Button type="button" variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-destructive" onClick={() => removeLink(index)}><Trash2 className="size-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendLink({ value: "" })} className="w-full border-dashed rounded-xl h-10 text-[10px] font-black uppercase tracking-widest"><Plus className="size-3 mr-2" /> Add Drive Link</Button></div></CardContent></Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><CalendarClock className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="meetingsBookedTomorrow" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Meetings Booked for Tomorrow</FormLabel><FormControl><Input type="number" {...field} className="rounded-full" /></FormControl></FormItem>)} /><FormField control={form.control} name="criticalPathTomorrow" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">T+1 Critical Path Action</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl" /></FormControl></FormItem>)} /></div><FormField control={form.control} name="pendingDeliverables" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Pending Deliverables / Follow-ups</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl" /></FormControl></FormItem>)} /><FormField control={form.control} name="interventionTrigger" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold text-primary">Intervention Trigger Required?</FormLabel><Select onValueChange={field.onChange} value={field.value || "None"}><FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="None">None (Standard)</SelectItem><SelectItem value="Coaching">Coaching Needed</SelectItem><SelectItem value="Technical Support">Technical Support Needed</SelectItem><SelectItem value="Client meeting">Client Meeting Support</SelectItem></SelectContent></Select></FormItem>)} />{intervention !== 'None' && <FormField control={form.control} name="interventionReason" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Reason for Support Trigger</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl bg-orange-50/30 border-orange-100" /></FormControl></FormItem>)} />}</CardContent></Card>
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
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader className="py-3 px-4"><CardTitle className="text-[10px] font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Icon className="size-3" />{label}</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4"><div className="flex gap-2"><Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} className="rounded-full h-9 flex-1 text-xs" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}/><Button type="button" size="icon" className="rounded-full h-9 w-9 shrink-0" onClick={add}><Plus className="size-4" /></Button></div><div className="flex flex-wrap gap-2 mt-2">{fields.map((f, i) => (<Badge key={f.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 group bg-muted/50 border-none transition-all hover:bg-muted"><span className="text-[10px] font-bold">{(f as any).value}</span><button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100"><X className="size-3" /></button></Badge>))}</div></CardContent></Card>
        );
    };
    return (
        <div className="space-y-8"><div className="space-y-1 p-6 bg-muted/10 rounded-2xl border border-dashed text-center"><p className="text-sm italic text-muted-foreground leading-relaxed">Dear Sir / Ma’am,</p><p className="font-bold text-lg tracking-tight">Here is my daily work summary for today:</p></div><Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden"><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6"><FormField control={form.control} name="logInTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Actual Login Time</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>)} /><FormField control={form.control} name="logOutTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Actual Logout Time</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>)} /></CardContent></Card><Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm"><CardHeader className="py-3 px-4 border-b bg-muted/5"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><ListTodo className="size-4" /> Tasks Assigned for the Day</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">{tasks.map((f, i) => (<div key={f.id} className="flex gap-2"><FormField control={form.control} name={`tasksAssigned.${i}.value`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input {...field} placeholder={`Specific Task ${i + 1}`} className="rounded-xl h-10 text-sm" /></FormControl></FormItem>)} /><Button type="button" variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-destructive" onClick={() => removeTask(i)}><Trash2 className="size-4" /></Button></div>))}<Button type="button" variant="outline" size="sm" onClick={() => appendTask({ value: "" })} className="w-full border-dashed rounded-xl h-10 text-[10px] font-black uppercase tracking-widest"><Plus className="size-3 mr-2" /> Add Task Item</Button></CardContent></Card><div className="space-y-4"><p className="font-black text-[10px] text-primary uppercase tracking-[0.2em] flex items-center gap-2 px-2"><Brain className="size-4" /> Tasks Completed Today:</p>{modules.map((f, i) => (<Card key={f.id} className="relative group bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-2xl transition-all hover:shadow-md"><CardContent className="pt-6 space-y-4 px-6 pb-6"><Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full bg-red-50 border border-red-100 text-red-600 opacity-0 group-hover:opacity-100 h-8 w-8" onClick={() => removeModule(i)}><X className="size-4" /></Button><FormField control={form.control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Module / Component Name</FormLabel><FormControl><Input {...field} className="rounded-xl font-bold" /></FormControl></FormItem>)}/><FormField control={form.control} name={`completedTasks.${i}.workDone`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Work Details / Functionality Implemented</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl" /></FormControl></FormItem>)}/></CardContent></Card>))}<Button type="button" variant="outline" onClick={() => appendModule({ moduleName: "", workDone: "" })} className="w-full border-dashed rounded-2xl h-14 bg-white/50 text-xs font-black uppercase tracking-[0.1em]"><Plus className="size-4 mr-2" /> ADD COMPLETED MODULE RECORD</Button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInput name="repoLinks" label="Repository / Documentation Links" icon={LinkIcon} placeholder="https://github.com/..." /><div className="grid grid-cols-1 gap-6"><ChipInput name="workInProgress" label="Work in Progress (Current)" icon={Clock} placeholder="Ongoing module..." /><ChipInput name="pendingTasks" label="Pending Tasks (Backlog)" icon={Clock} placeholder="Blocked or upcoming..." /></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChipInput name="whatILearned" label="Key Technical Learnings" icon={Brain} placeholder="Learned about..." /><ChipInput name="challengesFaced" label="Technical Challenges Faced" icon={Info} placeholder="Fixed a bug in..." /></div><ChipInput name="nextSteps" label="Immediate Next Steps (Tomorrow)" icon={Plus} placeholder="Implement API for..." /><div className="pt-8 border-t border-dashed space-y-4 px-2"><p className="text-sm italic font-medium text-muted-foreground">Thank you.</p></div></div>
    );
  };

  return (
    <>
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="relative">
                <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
            </div>
            <h2 className="mt-6 text-xl font-black uppercase tracking-tighter text-primary">Finalizing Shift</h2>
            <p className="text-sm text-muted-foreground font-medium">Verifying end-of-day location...</p>
            <div className="mt-8 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-progress-loading" />
            </div>
        </div>
      )}

      <PageHeader title={isAdmin ? "Organization Reports" : "My Daily Submissions"} description={isAdmin ? "Review submissions from Interns and Employees." : "Standardized professional reporting."}>
        {!isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} disabled={!submissionConstraints.canSubmit} className={cn("rounded-full h-11 px-6 shadow-lg transition-all active:scale-95", !submissionConstraints.canSubmit ? "bg-muted text-muted-foreground border-none cursor-not-allowed opacity-50" : "bg-primary hover:bg-primary/90")}>
                <PlusCircle className="mr-2 h-4 w-4"/> {submissionConstraints.hasSubmittedToday ? "Submission Complete" : "Add Daily Report"}
            </Button>
        )}
      </PageHeader>
      
      {!isAdmin && submissionConstraints.isDeadlinePassed && !submissionConstraints.hasSubmittedToday && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="size-5" />
            <div>
                <p className="font-bold">Report Restriction Policy</p>
                <p className="text-sm">The 6:30 PM IST submission deadline has passed. You can no longer submit a report for today.</p>
            </div>
        </div>
      )}
      
      {isAdmin ? (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-6"><div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search member by name..." className="pl-10 h-12 rounded-2xl shadow-sm border-none ring-1 ring-border/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 ring-1 ring-border/50"><Table><TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent border-border/50"><TableHead className="font-black uppercase tracking-tighter text-[10px]">Name</TableHead><TableHead className="font-black uppercase tracking-tighter text-[10px]">Job Title</TableHead><TableHead className="font-black uppercase tracking-tighter text-[10px] text-right">Action</TableHead></TableRow></TableHeader><TableBody>{areUsersLoading ? (<TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground animate-pulse font-medium">Scanning employee database...</TableCell></TableRow>) : filteredUsers?.length === 0 ? (<TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic font-normal">No team members match your search.</TableCell></TableRow>) : filteredUsers?.map(u => (<TableRow key={u.id} className="cursor-pointer hover:bg-white/80 transition-colors border-border/50" onClick={() => setSelectedUser(u)}><TableCell className="font-bold py-4">{u.firstName} {u.lastName}</TableCell><TableCell className="py-4 text-muted-foreground font-medium">{u.jobTitle}</TableCell><TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-xs uppercase tracking-tighter h-8 px-4 bg-white">Open Reports</Button></TableCell></TableRow>))}</TableBody></Table></div>
        </>
      ) : (
        <div className="space-y-4">{areReportsLoading ? (<div className="h-48 flex items-center justify-center text-muted-foreground animate-pulse font-medium">Loading history...</div>) : reports && reports.length > 0 ? (<Accordion type="single" collapsible className="w-full space-y-3">{reports.map(r => (<AccordionItem value={r.id} key={r.id} className="border-none"><AccordionTrigger className="border rounded-2xl px-6 h-16 hover:no-underline hover:bg-white/80 shadow-sm bg-white/50 ring-1 ring-border/50 transition-all data-[state=open]:rounded-b-none data-[state=open]:ring-primary/20"><div className="flex-1 text-left flex items-center justify-between"><div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Report</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div><div className="mr-4 text-right hidden sm:block"><p className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Status</p><p className="text-xs font-mono font-bold text-green-600">✅ Submitted</p></div></div></AccordionTrigger><AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white/30 space-y-6 ring-1 ring-border/50 shadow-lg mt-[-1px]">{r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : <TechnicalReportDetails report={r} />}</AccordionContent></AccordionItem>))}</Accordion>) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground p-10 bg-muted/10 rounded-3xl border border-dashed"><FileText className="size-10 mb-4 opacity-20" /><p className="font-bold uppercase tracking-widest text-xs opacity-50">No reports found.</p></div>}</div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[92vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-none ring-1 ring-border/50">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md">
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily {currentReportType} Submission</DialogTitle>
                        <DialogDescription className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{formatIST(new Date())}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-10 max-w-4xl mx-auto">
                            {isBusinessUser ? <BusinessFormFields /> : <TechnicalFormFields />}
                            <div className="pt-10 border-t border-dashed space-y-6">
                                <FormField control={form.control} name="signature" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs font-black uppercase tracking-[0.2em] text-primary">Digital Identity Verification (Locked)</FormLabel><FormControl><Input {...field} readOnly className="bg-muted/50 font-mono text-[10px] h-12 rounded-xl border-none ring-1 ring-border/50 cursor-not-allowed font-bold" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="declaration" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20 shadow-sm">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5 rounded-md" /></FormControl>
                                        <div className="space-y-1 leading-none"><FormLabel className="text-sm font-bold leading-relaxed cursor-pointer">I certify that all information provided is accurate and complete.</FormLabel></div>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md space-y-4">
                        <DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col">
                            <Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard</Button>
                            <Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Submit Report & Logout</Button>
                        </DialogFooter>
                    </div>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={isOpen => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-4xl w-full flex flex-col p-0 border-none ring-1 ring-border/50 shadow-2xl rounded-l-3xl">
            <SheetHeader className="p-8 border-b bg-muted/5"><SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{selectedUser?.firstName}'s Submissions</SheetTitle><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedUser?.jobTitle}</p></SheetHeader>
            <ScrollArea className="flex-1 p-8 bg-secondary/10">
                {reports && reports.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {reports.map(r => (
                            <AccordionItem value={r.id} key={r.id} className="border-none">
                                <AccordionTrigger className="border rounded-2xl px-6 h-16 hover:no-underline hover:bg-white shadow-sm bg-white ring-1 ring-border/50 transition-all data-[state=open]:rounded-b-none"><div className="flex-1 text-left flex items-center justify-between"><div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Report</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div><Badge variant="secondary" className="mr-4 text-[10px] font-black uppercase">✅ SUBMITTED</Badge></div></AccordionTrigger>
                                <AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white space-y-6 ring-1 ring-border/50 shadow-inner mt-[-1px]">
                                    <div className="flex justify-end gap-2 mb-4">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest h-8">
                                                    <Trash2 className="h-3 w-3 mr-2" />Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl p-8">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-xl font-black uppercase">Confirm Deletion</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently remove the record.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="rounded-full font-bold text-[10px] uppercase">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="rounded-full font-bold text-[10px] uppercase bg-red-600" onClick={() => handleDeleteReport(r)}>Confirm Purge</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : <TechnicalReportDetails report={r} />}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No reports available.</p></div>
                )}
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
