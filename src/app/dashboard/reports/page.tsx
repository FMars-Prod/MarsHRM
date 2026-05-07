
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
  DialogTitle,
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
import { PlusCircle, Search, Trash2, Info, TrendingUp, Target, CalendarClock, Brain, ListTodo, Link as LinkIcon, X, Plus, Clock, FileText, AlertCircle, CheckCircle2, MapPin, LayoutTemplate, Briefcase, Code, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, setDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
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
import { Separator } from "@/components/ui/separator";

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
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'د.إ' };
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
    const totalOutreach = Math.max(0, cold + linkedin + email);
    const potential = Number(report.potentialClients || 0);
    
    const displayRate = (totalOutreach > 0) ? (potential / totalOutreach) * 100 : 0;
    const rateColor = displayRate < 5 ? 'text-red-600' : displayRate < 15 ? 'text-orange-600' : 'text-green-600';
    const mainSym = getCurrencySymbol(report.currency || 'USD');

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-3" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-white/50 rounded-xl border border-border/50 shadow-inner">
                        <ReportDetailItem label="Total Outreach" value={totalOutreach} />
                        <ReportDetailItem label="New Leads" value={report.newLeadsGenerated || 0} />
                        <ReportDetailItem label="Pipeline Value" value={`${mainSym}${report.pipelineValue?.toLocaleString() ?? 0}`} />
                        <ReportDetailItem label="Intervention" value={report.interventionTrigger || "None"} />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                        <ReportDetailItem label="Cold Calls" value={cold} />
                        <ReportDetailItem label="LinkedIn" value={linkedin} />
                        <ReportDetailItem label="Emails" value={email} />
                        <ReportDetailItem label="Potential Clients" value={potential} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Efficiency Conversion Rate (Potential/Outreach)</p>
                            <p className={cn("text-2xl font-black tracking-tighter", rateColor)}>{displayRate.toFixed(2)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Follow-ups</p>
                            <p className="text-xl font-bold">{report.followUpCount || 0}</p>
                        </div>
                    </div>
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
        </div>
    );
};

const DigitalMarketingReportDetails = ({ report }: { report: any }) => (
    <div className="space-y-6">
        <BusinessReportDetails report={report} />
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
            <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-3" /> Marketing Pipeline Intelligence</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Content Pipeline</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <ReportDetailItem label="Appr" value={report.dmContentApproved || 0} />
                            <ReportDetailItem label="Pend" value={report.dmContentPending || 0} />
                            <ReportDetailItem label="Rej" value={report.dmContentRejected || 0} />
                        </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Posts Monitoring</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <ReportDetailItem label="Appr" value={report.dmPostApproved || 0} />
                            <ReportDetailItem label="Pend" value={report.dmPostPending || 0} />
                            <ReportDetailItem label="Rej" value={report.dmPostRejected || 0} />
                        </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase">Reels & Shoots</p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <ReportDetailItem label="Reels" value={report.dmReelsApproved || 0} />
                            <ReportDetailItem label="Shoots" value={report.dmShootsApproved || 0} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
);

const TechnicalReportDetails = ({ report }: { report: any }) => (
  <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
    <CardContent className="space-y-6 pt-8 text-sm">
        <div className="grid grid-cols-2 gap-6 px-2">
            <ReportDetailItem label="Login Time" value={report.logInTime || "NIL"} />
            <ReportDetailItem label="Logout Time" value={report.logOutTime || "NIL"} />
        </div>
        
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
    </CardContent>
  </Card>
);

const commonSchema = {
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Certification required." }) }),
  signature: z.string().min(1, "Signature is required."),
};

const businessReportSchema = z.object({
  ...commonSchema,
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AED"]).default("USD"),
  outreachColdCalls: z.coerce.number().min(0).default(0),
  outreachLinkedIn: z.coerce.number().min(0).default(0),
  outreachEmails: z.coerce.number().min(0).default(0),
  newLeadsGenerated: z.coerce.number().min(0).default(0),
  potentialClients: z.coerce.number().min(0).default(0),
  followUpCount: z.coerce.number().min(0).default(0),
  netRevenueCollected: z.coerce.number().min(0).default(0),
  committedNetRevenue: z.coerce.number().min(0).default(0),
  pipelineValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().default(0),
  meetingsSecured: z.array(z.object({ 
    clientName: z.string().optional(), 
    quotationValue: z.coerce.number().min(0).default(0),
    context: z.string().optional()
  })).optional().default([]),
});

const digitalMarketingReportSchema = businessReportSchema.extend({
  dmContentApproved: z.coerce.number().min(0).default(0),
  dmContentPending: z.coerce.number().min(0).default(0),
  dmContentRejected: z.coerce.number().min(0).default(0),
  dmPostApproved: z.coerce.number().min(0).default(0),
  dmPostPending: z.coerce.number().min(0).default(0),
  dmPostRejected: z.coerce.number().min(0).default(0),
  dmReelsApproved: z.coerce.number().min(0).default(0),
  dmReelsPending: z.coerce.number().min(0).default(0),
  dmReelsRejected: z.coerce.number().min(0).default(0),
  dmShootsApproved: z.coerce.number().min(0).default(0),
  dmShootsPending: z.coerce.number().min(0).default(0),
  dmShootsRejected: z.coerce.number().min(0).default(0),
});

const technicalReportSchema = z.object({
  ...commonSchema,
  logInTime: z.string().min(1, "Required"),
  logOutTime: z.string().min(1, "Required"),
  completedTasks: z.array(z.object({ 
    moduleName: z.string().min(0), 
    workDone: z.string().min(0) 
  })).optional().default([]),
});

export default function ReportsPage() {
  const { user } = useUser();
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

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);

  const currentReportType = React.useMemo(() => {
    const jobTitle = currentUserData?.jobTitle || '';
    
    // 1. Check Global Mapping First
    if (mappingData?.mappings?.[jobTitle] && mappingData.mappings[jobTitle] !== 'default') {
      return mappingData.mappings[jobTitle] as 'Technical' | 'Business' | 'Digital Marketing';
    }

    // 2. Strict Job Title Fallback
    const titleUpper = jobTitle.toUpperCase();
    if (titleUpper === "DIGITAL MARKETING") return 'Digital Marketing';

    // 3. Departmental Fallback
    const dept = (currentUserData?.department || '').toUpperCase();
    if (dept.includes("TECHNICAL") || dept.includes("DEVELOPMENT") || dept.includes("IT")) return 'Technical';
    if (dept.includes("MARKETING") || dept.includes("SALES")) return 'Business';
    
    return 'Technical'; // Global Default
  }, [currentUserData?.jobTitle, currentUserData?.department, mappingData]);

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
    resolver: zodResolver(
      currentReportType === 'Digital Marketing' ? digitalMarketingReportSchema :
      currentReportType === 'Technical' ? technicalReportSchema : businessReportSchema
    ),
    defaultValues: { signature: "", declaration: false },
  });

  const resetForm = React.useCallback(() => {
      const now = new Date();
      const istTimestamp = formatIST(now);
      const eType = currentUserData?.employmentType || "Intern";
      const signatureStr = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName} | ${eType} | ${istTimestamp}` : "";

      form.reset({
        signature: signatureStr,
        declaration: false,
        ...(currentReportType === 'Technical' ? {
            completedTasks: [],
            logInTime: todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'HH:mm') : "09:30",
            logOutTime: format(now, 'HH:mm'),
        } : {
            currency: "USD", outreachColdCalls: 0, outreachLinkedIn: 0, outreachEmails: 0, newLeadsGenerated: 0, potentialClients: 0, followUpCount: 0,
            netRevenueCollected: 0, committedNetRevenue: 0, pipelineValue: 0, revenueVariance: 0, meetingsSecured: [],
            ...(currentReportType === 'Digital Marketing' ? {
                dmContentApproved: 0, dmContentPending: 0, dmContentRejected: 0, dmPostApproved: 0, dmPostPending: 0, dmPostRejected: 0,
                dmReelsApproved: 0, dmReelsPending: 0, dmReelsRejected: 0, dmShootsApproved: 0, dmShootsPending: 0, dmShootsRejected: 0
            } : {})
        })
      });
  }, [form, currentUserData, currentReportType, todaysAttendance]);

  React.useEffect(() => { if (isAddDialogOpen && currentUserData) resetForm(); }, [isAddDialogOpen, resetForm, currentUserData]);

  const submissionConstraints = React.useMemo(() => {
    const now = new Date();
    const hasSubmittedToday = reports?.some(r => isSameDay(r.date.toDate(), now)) || false;
    return { hasSubmittedToday, canSubmit: !hasSubmittedToday };
  }, [reports]);

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    setIsVerifyingLocation(true);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const payload = {
                ...values,
                employeeId: user.uid,
                employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`,
                employeeDepartment: currentUserData.department || currentReportType.toUpperCase(),
                employeeJobTitle: currentUserData.jobTitle,
                date: new Date(),
                reportType: currentReportType,
            };
            try {
                await addDoc(collection(firestore, `users/${user.uid}/reports`), payload);
                const todayId = format(new Date(), 'yyyy-MM-dd');
                const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
                setDocumentNonBlocking(attRef, {
                    checkOutTime: serverTimestamp(),
                    locationCheckOutLatitude: latitude,
                    locationCheckOutLongitude: longitude,
                }, { merge: true });
                setIsVerifyingLocation(false);
                toast({ title: "Work Session Complete" });
                setTimeout(async () => { await auth.signOut(); router.push('/login'); }, 1500);
            } catch (err: any) {
                setIsVerifyingLocation(false);
                toast({ variant: 'destructive', title: 'Submission Failed', description: err.message });
            }
        },
        () => { setIsVerifyingLocation(false); toast({ variant: 'destructive', title: 'GPS Verification Failed' }); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const BusinessFields = () => {
    const { fields: meetings, append: appendMeeting, remove: removeMeeting } = useFieldArray({ control: form.control, name: "meetingsSecured" });
    const cold = Number(useWatch({ control: form.control, name: "outreachColdCalls" }) || 0);
    const linkedin = Number(useWatch({ control: form.control, name: "outreachLinkedIn" }) || 0);
    const email = Number(useWatch({ control: form.control, name: "outreachEmails" }) || 0);
    const total = cold + linkedin + email;
    const potential = Number(useWatch({ control: form.control, name: "potentialClients" }) || 0);
    const rate = total > 0 ? (potential / total) * 100 : 0;

    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Outreach & Pipeline</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-muted/20 rounded-2xl border border-border/50">
                        <FormField control={form.control} name="outreachColdCalls" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="outreachLinkedIn" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="outreachEmails" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Emails</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-black text-muted-foreground">Total Outreach</Label><p className="text-xl font-black text-primary">{total}</p></div>
                        <FormField control={form.control} name="potentialClients" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Potential Clients</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl font-bold" /></FormControl></FormItem>)} />
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-black text-muted-foreground">Conv. Rate</Label><p className="text-xl font-black text-primary">{rate.toFixed(1)}%</p></div>
                        <FormField control={form.control} name="newLeadsGenerated" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-black text-muted-foreground">New Leads</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl font-bold" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Target className="size-4" /> 2️⃣ Financial Tracking</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs uppercase font-bold">Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="AED">AED (د.إ)</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="netRevenueCollected" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Revenue Collected</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="pipelineValue" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Pipeline Value</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  };

  const DigitalMarketingFields = () => (
    <div className="space-y-8">
        <BusinessFields />
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm">
            <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-4" /> 3️⃣ Content & Production</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-border/50">
                        <Label className="text-[10px] uppercase font-black text-purple-700">Content Status</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <FormField control={form.control} name="dmContentApproved" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Appr" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="dmContentPending" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Pend" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="dmContentRejected" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Rej" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                        </div>
                    </div>
                    <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-border/50">
                        <Label className="text-[10px] uppercase font-black text-purple-700">Posts Status</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <FormField control={form.control} name="dmPostApproved" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Appr" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="dmPostPending" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Pend" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="dmPostRejected" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Rej" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                        </div>
                    </div>
                    <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-border/50">
                        <Label className="text-[10px] uppercase font-black text-purple-700">Media Production</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="dmReelsApproved" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Reels" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="dmShootsApproved" render={({ field }) => (<FormItem><FormControl><Input type="number" min="0" placeholder="Shoots" {...field} className="text-xs h-8 text-center" /></FormControl></FormItem>)} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );

  const TechnicalFields = () => {
    const { fields: modules, append: appendModule, remove: removeModule } = useFieldArray({ control: form.control, name: "completedTasks" });
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="logInTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Shift Start</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="logOutTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Shift End</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>)} />
            </div>
            <div className="space-y-4">
                <p className="font-black text-[10px] text-primary uppercase tracking-[0.2em] flex items-center gap-2"><Brain className="size-4" /> Completed Modules:</p>
                {modules.map((f, i) => (
                    <Card key={f.id} className="relative group bg-white/50 border rounded-2xl overflow-hidden">
                        <CardContent className="pt-6 space-y-4">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 text-red-600 opacity-0 group-hover:opacity-100" onClick={() => removeModule(i)}><X className="size-4" /></Button>
                            <FormField control={form.control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Module Name</FormLabel><FormControl><Input {...field} className="rounded-xl" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`completedTasks.${i}.workDone`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Functionality</FormLabel><FormControl><Textarea {...field} className="min-h-[80px] rounded-xl" /></FormControl></FormItem>)} />
                        </CardContent>
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => appendModule({ moduleName: "", workDone: "" })} className="w-full border-dashed rounded-2xl h-14 bg-white/50 text-xs font-black uppercase"><Plus className="size-4 mr-2" /> Add Module</Button>
            </div>
        </div>
    );
  };

  return (
    <>
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/80 to-indigo-950/90 backdrop-blur-xl">
            <div className="relative">
                <div className="h-32 w-32 rounded-full border-4 border-white/10 border-t-purple-400 animate-spin" />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-purple-300 animate-pulse" />
            </div>
            <h2 className="mt-8 text-2xl font-black uppercase tracking-[0.3em] text-white">Verifying Point</h2>
            <div className="mt-10 w-64 h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 animate-progress-loading" />
            </div>
        </div>
      )}

      <PageHeader title={isAdmin ? "Organizational Fleet" : "My Submissions"} description="Strategic review of all department submissions.">
        {!isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} disabled={!submissionConstraints.canSubmit} className={cn("rounded-full h-11 px-6 shadow-lg", !submissionConstraints.canSubmit && "opacity-50 cursor-not-allowed")}>
                <PlusCircle className="mr-2 h-4 w-4"/> {submissionConstraints.hasSubmittedToday ? "Submission Complete" : "Shift Completion Form"}
            </Button>
        )}
      </PageHeader>
      
      {isAdmin ? (
        <>
          <div className="relative mb-6"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Filter by name..." className="pl-10 h-12 rounded-2xl bg-white/50 border-none ring-1 ring-border/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 ring-1 ring-border/50">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Employee</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Department</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px] text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {areUsersLoading ? (<TableRow><TableCell colSpan={3} className="h-32 text-center animate-pulse">Scanning database...</TableCell></TableRow>) : usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                        <TableRow key={u.id} className="cursor-pointer hover:bg-white/80 transition-colors border-border/50" onClick={() => setSelectedUser(u)}>
                            <TableCell className="font-bold py-4">{u.firstName} {u.lastName}</TableCell>
                            <TableCell className="py-4 text-muted-foreground font-medium uppercase text-xs">{u.department || 'N/A'}</TableCell>
                            <TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px] uppercase">Audit Reports</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
            {areReportsLoading ? (<div className="h-48 flex items-center justify-center animate-pulse">Loading history...</div>) : reports && reports.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-3">
                    {reports.map(r => (
                        <AccordionItem value={r.id} key={r.id} className="border-none">
                            <AccordionTrigger className="border rounded-2xl px-6 h-16 hover:no-underline hover:bg-white shadow-sm bg-white/50 ring-1 ring-border/50 transition-all data-[state=open]:rounded-b-none">
                                <div className="flex-1 text-left flex items-center justify-between">
                                    <div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Report</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div>
                                    <div className="mr-4 text-right hidden sm:block"><p className="text-[10px] font-black text-muted-foreground uppercase opacity-50">Status</p><p className="text-xs font-mono font-bold text-green-600">✅ Submitted</p></div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white/30 space-y-6 ring-1 ring-border/50 shadow-lg mt-[-1px]">
                                {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} /> : <TechnicalReportDetails report={r} />}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-3xl border border-dashed"><FileText className="size-10 mb-4 opacity-20" /><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No reports found.</p></div>}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-none ring-1 ring-border/50">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                {currentReportType === 'Technical' ? <Code className="size-6" /> : currentReportType === 'Digital Marketing' ? <LayoutTemplate className="size-6" /> : <Briefcase className="size-6" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily {currentReportType} Submission</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatIST(new Date())}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8">
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Template Metrics</Label>
                                {currentReportType === 'Technical' ? <TechnicalFields /> : currentReportType === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Digital Identity Verification</Label>
                                <FormField control={form.control} name="signature" render={({ field }) => (
                                    <FormItem><FormControl><Input {...field} readOnly className="bg-muted/50 font-mono text-[10px] h-12 rounded-xl border-none ring-1 ring-border/50 cursor-not-allowed font-bold" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="declaration" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20 shadow-sm">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl>
                                        <div className="space-y-1 leading-none"><FormLabel className="text-sm font-bold cursor-pointer">I certify that this daily shift summary is accurate and true.</FormLabel></div>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md">
                        <DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col">
                            <Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard</Button>
                            <Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Submit Shift Log & Logout</Button>
                        </DialogFooter>
                    </div>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={isOpen => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-4xl w-full flex flex-col p-0 border-none ring-1 ring-border/50 shadow-2xl rounded-l-3xl">
            <SheetHeader className="p-8 border-b bg-muted/5">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">{selectedUser?.firstName?.[0]}</div>
                    <div>
                        <SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{selectedUser?.firstName}'s Strategic Log</SheetTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedUser?.jobTitle} • {selectedUser?.department}</p>
                    </div>
                </div>
            </SheetHeader>
            <ScrollArea className="flex-1 p-8 bg-secondary/10">
                {reports && reports.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full space-y-4">
                        {reports.map(r => (
                            <AccordionItem value={r.id} key={r.id} className="border-none">
                                <AccordionTrigger className="border rounded-2xl px-6 h-16 hover:no-underline hover:bg-white shadow-sm bg-white ring-1 ring-border/50 transition-all data-[state=open]:rounded-b-none">
                                    <div className="flex-1 text-left flex items-center justify-between">
                                        <div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Report</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div>
                                        <Badge variant="secondary" className="mr-4 text-[10px] font-black uppercase">✅ VERIFIED</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white space-y-6 ring-1 ring-border/50 shadow-inner mt-[-1px]">
                                    <div className="flex justify-end gap-2 mb-4">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest h-8"><Trash2 className="h-3 w-3 mr-2" />Delete Log</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl"><AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase">Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This will permanently purge this record from the historical logs.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-full font-bold text-[10px] uppercase">Cancel</AlertDialogCancel><AlertDialogAction className="rounded-full font-bold text-[10px] uppercase bg-red-600" onClick={() => deleteDoc(doc(firestore, `users/${reportUserId}/reports`, r.id))}>Confirm Purge</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} /> : <TechnicalReportDetails report={r} />}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No submissions found for this member.</p></div>}
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
