
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
import { PlusCircle, Search, Trash2, TrendingUp, Target, Brain, X, Plus, FileText, MapPin, LayoutTemplate, Briefcase, Code, Video, Camera, Link as LinkIcon, AlertCircle, CheckCircle2, Beaker } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, setDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
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

// --- High Fidelity Template Renderers ---

const BusinessReportDetails = ({ report }: { report: any }) => {
    const cold = Number(report.outreachColdCalls || 0);
    const linkedin = Number(report.outreachLinkedIn || 0);
    const email = Number(report.outreachEmails || 0);
    const totalOutreach = Math.max(0, cold + linkedin + email);
    const potential = Number(report.potentialClientsSecured || 0);
    const displayRate = (totalOutreach > 0) ? (potential / totalOutreach) * 100 : 0;
    const rateColor = displayRate < 5 ? 'text-red-600' : displayRate < 15 ? 'text-orange-600' : 'text-green-600';
    const mainSym = getCurrencySymbol(report.currency || 'USD');

    return (
        <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-3" /> Outreach & Conversion</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-white/50 rounded-xl border border-border/50 shadow-inner">
                        <ReportDetailItem label="Total Outreach" value={totalOutreach} />
                        <ReportDetailItem label="Efficiency" value={`${displayRate.toFixed(2)}%`} className={rateColor} />
                        <ReportDetailItem label="New Leads" value={report.newLeadsGenerated || 0} />
                        <ReportDetailItem label="Follow-ups" value={report.followUpCount || 0} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">Revenue Impact</CardTitle></CardHeader>
                <CardContent className="pt-4">
                    <div className="border rounded-xl overflow-hidden bg-white/50">
                        <Table>
                            <TableBody>
                                <TableRow className="border-border/50"><TableCell className="py-2 text-sm">Collected Revenue</TableCell><TableCell className="py-2 text-sm font-bold text-right">{mainSym}{report.netRevenueCollected?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="border-border/50"><TableCell className="py-2 text-sm">Committed Revenue</TableCell><TableCell className="py-2 text-sm font-bold text-right">{mainSym}{report.committedNetRevenue?.toLocaleString() ?? 0}</TableCell></TableRow>
                                <TableRow className="border-none bg-red-50/30"><TableCell className="py-2 text-sm font-semibold">Variance</TableCell><TableCell className="py-2 text-sm font-bold text-right text-red-600">-{mainSym}{report.revenueVariance?.toLocaleString() ?? 0}</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none ring-1 ring-border/50 bg-white/50"><CardHeader className="py-3"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Client Highlights</CardTitle></CardHeader><CardContent className="space-y-4"><ReportDetailItem label="Today's Win" value={report.todayHighlight} /><ReportDetailItem label="Tactical Learning" value={report.tacticalLearning} /></CardContent></Card>
                <Card className="border-none ring-1 ring-border/50 bg-white/50"><CardHeader className="py-3"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">T+1 Execution</CardTitle></CardHeader><CardContent className="space-y-4"><ReportDetailItem label="Critical Path" value={report.tomorrowCriticalPath} /><ReportDetailItem label="Trigger" value={report.interventionTrigger} /></CardContent></Card>
            </div>
        </div>
    );
};

const DigitalMarketingReportDetails = ({ report }: { report: any }) => (
    <div className="space-y-6">
        <BusinessReportDetails report={report} />
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
            <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-3" /> Marketing Pipeline Intelligence</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase text-center border-b pb-1">Content</p>
                        <div className="grid grid-cols-1 gap-1 text-center">
                            <ReportDetailItem label="Approved" value={report.dmContentApproved || 0} />
                            <ReportDetailItem label="Pending" value={report.dmContentPending || 0} />
                            <ReportDetailItem label="Rejected" value={report.dmContentRejected || 0} />
                        </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase text-center border-b pb-1">Posts</p>
                        <div className="grid grid-cols-1 gap-1 text-center">
                            <ReportDetailItem label="Approved" value={report.dmPostApproved || 0} />
                            <ReportDetailItem label="Pending" value={report.dmPostPending || 0} />
                            <ReportDetailItem label="Rejected" value={report.dmPostRejected || 0} />
                        </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase text-center border-b pb-1">Reels</p>
                        <div className="grid grid-cols-1 gap-1 text-center">
                            <ReportDetailItem label="Approved" value={report.dmReelsApproved || 0} />
                            <ReportDetailItem label="Pending" value={report.dmReelsPending || 0} />
                            <ReportDetailItem label="Rejected" value={report.dmReelsRejected || 0} />
                        </div>
                    </div>
                    <div className="p-4 bg-white/50 rounded-xl border border-border/50 space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase text-center border-b pb-1">Shoots</p>
                        <div className="grid grid-cols-1 gap-1 text-center">
                            <ReportDetailItem label="Approved" value={report.dmShootsApproved || 0} />
                            <ReportDetailItem label="Pending" value={report.dmShootsPending || 0} />
                            <ReportDetailItem label="Rejected" value={report.dmShootsRejected || 0} />
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
            <ReportDetailItem label="Login" value={report.logInTime || "N/A"} />
            <ReportDetailItem label="Logout" value={report.logOutTime || "N/A"} />
        </div>
        <div className="space-y-4">
            <p className="font-bold text-xs text-primary uppercase tracking-widest px-2">Tasks Completed Today:</p>
            <div className="grid gap-3">
                {Array.isArray(report.completedTasks) && report.completedTasks.map((task:any, i:number) => (
                    <div key={i} className="p-4 bg-white/80 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
                        <p className="font-bold text-sm">{task.moduleName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{task.workDone}</p>
                    </div>
                ))}
            </div>
        </div>
    </CardContent>
  </Card>
);

const CustomReportDetails = ({ report }: { report: any }) => (
    <div className="space-y-6">
        <Card className="bg-white/50 border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Beaker className="size-3"/> Custom Metrics Log</CardTitle></CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(report).map(([key, value]) => {
                    if (['id', 'employeeId', 'employeeName', 'employeeDepartment', 'date', 'reportType', 'signature', 'declaration'].includes(key)) return null;
                    return <ReportDetailItem key={key} label={key.replace(/([A-Z])/g, ' $1').toUpperCase()} value={String(value)} />;
                })}
            </CardContent>
        </Card>
    </div>
);

// --- Validation Schemas ---

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
  potentialClientsSecured: z.coerce.number().min(0).default(0),
  newLeadsGenerated: z.coerce.number().min(0).default(0),
  followUpCount: z.coerce.number().min(0).default(0),
  netRevenueCollected: z.coerce.number().min(0).default(0),
  committedNetRevenue: z.coerce.number().min(0).default(0),
  pipelineBusinessValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().min(0).default(0),
  quotationsReleased: z.coerce.number().min(0).default(0),
  meetingsSecured: z.array(z.object({ clientName: z.string().optional(), context: z.string().optional() })).optional().default([]),
  todayHighlight: z.string().optional(),
  tacticalLearning: z.string().optional(),
  recordingLinks: z.array(z.object({ url: z.string().url("Invalid link").or(z.literal("")) })).optional().default([]),
  meetingsTomorrow: z.coerce.number().min(0).default(0),
  tomorrowCriticalPath: z.string().optional(),
  pendingDeliverables: z.string().optional(),
  interventionTrigger: z.enum(["None (Standard)", "Manager Input Required", "Resource Blocked", "Client Risk Detected"]).default("None (Standard)"),
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
  completedTasks: z.array(z.object({ moduleName: z.string().min(1, "Required"), workDone: z.string().min(1, "Required") })).optional().default([]),
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
  const isAdmin = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'Team Lead';

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);

  const currentTemplateId = React.useMemo(() => {
      const jobTitle = currentUserData?.jobTitle || '';
      return mappingData?.mappings?.[jobTitle] || 'Business';
  }, [currentUserData?.jobTitle, mappingData]);

  const customTemplateDocRef = useMemoFirebase(() => currentTemplateId && !['Business', 'Technical', 'Digital Marketing'].includes(currentTemplateId) ? doc(firestore, 'custom_report_definitions', currentTemplateId) : null, [firestore, currentTemplateId]);
  const { data: customTemplateData } = useDoc<any>(customTemplateDocRef);

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
      currentTemplateId === 'Digital Marketing' ? digitalMarketingReportSchema :
      currentTemplateId === 'Technical' ? technicalReportSchema : businessReportSchema
    ),
    defaultValues: { signature: "", declaration: false },
  });

  const resetForm = React.useCallback(() => {
      const now = new Date();
      const istTimestamp = formatIST(now);
      const signatureStr = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName} | ${currentUserData.employmentType || "Intern"} | ${istTimestamp}` : "";
      
      const baseValues = { signature: signatureStr, declaration: false };

      if (currentTemplateId === 'Technical') {
          form.reset({
              ...baseValues,
              completedTasks: [],
              logInTime: todaysAttendance?.checkInTime ? format(todaysAttendance.checkInTime.toDate(), 'HH:mm') : "09:30",
              logOutTime: format(now, 'HH:mm'),
          });
      } else if (currentTemplateId === 'Digital Marketing' || currentTemplateId === 'Business') {
          form.reset({
              ...baseValues,
              currency: "USD", outreachColdCalls: 0, outreachLinkedIn: 0, outreachEmails: 0, potentialClientsSecured: 0, newLeadsGenerated: 0, followUpCount: 0,
              netRevenueCollected: 0, committedNetRevenue: 0, pipelineBusinessValue: 0, revenueVariance: 0, quotationsReleased: 0, meetingsSecured: [],
              todayHighlight: "", tacticalLearning: "", recordingLinks: [], meetingsTomorrow: 0, tomorrowCriticalPath: "", pendingDeliverables: "", interventionTrigger: "None (Standard)",
              ...(currentTemplateId === 'Digital Marketing' ? {
                  dmContentApproved: 0, dmContentPending: 0, dmContentRejected: 0, dmPostApproved: 0, dmPostPending: 0, dmPostRejected: 0,
                  dmReelsApproved: 0, dmReelsPending: 0, dmReelsRejected: 0, dmShootsApproved: 0, dmShootsPending: 0, dmShootsRejected: 0
              } : {})
          });
      } else {
          // Dynamic fields for custom templates
          const customValues: any = { ...baseValues };
          if (customTemplateData?.definition?.sections) {
              customTemplateData.definition.sections.forEach((s: any) => {
                  s.fields?.forEach((f: any) => { customValues[f.name] = f.defaultValue || (f.type === 'number' ? 0 : ""); });
              });
          }
          form.reset(customValues);
      }
  }, [form, currentUserData, currentTemplateId, todaysAttendance, customTemplateData]);

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
            const payload = { ...values, employeeId: user.uid, employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`, employeeDepartment: currentUserData.department, date: new Date(), reportType: currentTemplateId };
            try {
                await addDoc(collection(firestore, `users/${user.uid}/reports`), payload);
                const todayId = format(new Date(), 'yyyy-MM-dd');
                const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
                setDocumentNonBlocking(attRef, { checkOutTime: serverTimestamp(), locationCheckOutLatitude: latitude, locationCheckOutLongitude: longitude }, { merge: true });
                setIsVerifyingLocation(false);
                toast({ title: "Strategic Submission Confirmed" });
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

  // --- Dynamic UI Sub-components ---

  const BusinessFields = () => {
    const { fields: meetings, append: appendMeeting, remove: removeMeeting } = useFieldArray({ control: form.control, name: "meetingsSecured" });
    const cold = Number(useWatch({ control: form.control, name: "outreachColdCalls" }) || 0);
    const linkedin = Number(useWatch({ control: form.control, name: "outreachLinkedIn" }) || 0);
    const email = Number(useWatch({ control: form.control, name: "outreachEmails" }) || 0);
    const total = cold + linkedin + email;
    const secured = Number(useWatch({ control: form.control, name: "potentialClientsSecured" }) || 0);
    const efficiency = total > 0 ? (secured / total) * 100 : 0;

    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Outreach & Conversion Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-muted/20 rounded-2xl border border-border/50">
                        <FormField control={form.control} name="outreachColdCalls" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="outreachLinkedIn" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="outreachEmails" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Emails</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-black text-muted-foreground">Total Volume</Label><p className="text-xl font-black text-primary">{total}</p></div>
                        <FormField control={form.control} name="potentialClientsSecured" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Potential Secured</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl font-bold" /></FormControl></FormItem>)} />
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-black text-muted-foreground">Efficiency</Label><p className="text-xl font-black text-green-600">{efficiency.toFixed(2)}%</p></div>
                        <FormField control={form.control} name="newLeadsGenerated" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-black text-muted-foreground">New Leads</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl font-bold" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Target className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs uppercase font-bold">Report Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="AED">AED (د.إ)</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="netRevenueCollected" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">NET Revenue Collected</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="committedNetRevenue" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Committed NET Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-full" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Briefcase className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Meetings/Demos Secured</Label>
                        {meetings.map((f, i) => (
                          <div key={f.id} className="p-4 border rounded-2xl space-y-3 relative bg-white/50">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500" onClick={() => removeMeeting(i)}>
                              <X className="size-3" />
                            </Button>
                            <FormField control={form.control} name={`meetingsSecured.${i}.clientName`} render={({ field }) => (
                              <FormItem><FormControl><Input placeholder="Client Name" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name={`meetingsSecured.${i}.context`} render={({ field }) => (
                              <FormItem><FormControl><Textarea placeholder="Context / Objective" {...field} className="min-h-[60px]" /></FormControl></FormItem>
                            )} />
                          </div>
                        ))}
                        <Button type="button" variant="outline" className="w-full border-dashed rounded-xl h-12" onClick={() => appendMeeting({ clientName: "", context: "" })}>
                          <Plus className="size-4 mr-2" /> ADD NEW CLIENT RECORD
                        </Button>
                    </div>
                    <FormField control={form.control} name="todayHighlight" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs uppercase font-bold">Today's Highlight Win</FormLabel><FormControl><Textarea {...field} className="rounded-2xl" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><MapPin className="size-4" /> 4️⃣ Pipeline Impact & T+1 Planning</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <FormField control={form.control} name="tomorrowCriticalPath" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs uppercase font-bold">T+1 Critical Path Action</FormLabel><FormControl><Textarea {...field} className="rounded-2xl" /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="interventionTrigger" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs uppercase font-bold">Intervention Trigger Required?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="None (Standard)">None (Standard)</SelectItem>
                            <SelectItem value="Manager Input Required">Manager Input Required</SelectItem>
                            <SelectItem value="Resource Blocked">Resource Blocked</SelectItem>
                            <SelectItem value="Client Risk Detected">Client Risk Detected</SelectItem>
                          </SelectContent>
                        </Select>
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
        </div>
    );
  };

  const DigitalMarketingFields = () => (
    <div className="space-y-8">
        <BusinessFields />
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm">
            <CardHeader><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-4" /> Content & Production Audit</CardTitle></CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { name: "Content", prefix: "dmContent" },
                        { name: "Posts", prefix: "dmPost" },
                        { name: "Reels", prefix: "dmReels" },
                        { name: "Shoots", prefix: "dmShoots" }
                    ].map(group => (
                        <div key={group.name} className="p-4 bg-white/50 rounded-2xl border border-border/50 space-y-4">
                            <Label className="text-[10px] font-black uppercase text-purple-700 flex items-center gap-2"><LayoutTemplate className="size-3"/> {group.name} Status</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Approved', 'Pending', 'Rejected'].map(status => (
                                    <FormField key={status} control={form.control} name={`${group.prefix}${status}`} render={({ field }) => (
                                        <FormItem><FormLabel className={cn("text-[9px] uppercase font-bold text-center", status === 'Approved' ? 'text-green-600' : status === 'Pending' ? 'text-yellow-600' : 'text-red-600')}>{status}</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-8 text-center font-bold" /></FormControl></FormItem>
                                    )} />
                                ))}
                            </div>
                        </div>
                    ))}
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
                <FormField control={form.control} name="logInTime" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs uppercase font-bold">Shift Start</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="logOutTime" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs uppercase font-bold">Shift End</FormLabel><FormControl><Input type="time" {...field} className="rounded-full" /></FormControl></FormItem>
                )} />
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

  const CustomTemplateFields = ({ definition }: { definition: any }) => (
      <div className="space-y-8">
          {definition.sections?.map((section: any, sIdx: number) => (
              <Card key={sIdx} className="bg-white/50 border-none ring-1 ring-border/50 shadow-sm">
                  <CardHeader><CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">{section.title}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {section.fields?.map((field: any, fIdx: number) => (
                          <FormField key={fIdx} control={form.control} name={field.name} render={({ field: formField }) => (
                              <FormItem>
                                  <FormLabel className="text-[10px] font-bold uppercase">{field.label}</FormLabel>
                                  <FormControl>
                                      {field.type === 'textarea' ? (
                                          <Textarea {...formField} className="rounded-xl" />
                                      ) : field.type === 'number' ? (
                                          <Input type="number" min="0" {...formField} className="rounded-full" />
                                      ) : (
                                          <Input {...formField} className="rounded-full" />
                                      )}
                                  </FormControl>
                              </FormItem>
                          )} />
                      ))}
                  </CardContent>
              </Card>
          ))}
      </div>
  );

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

      <PageHeader title={isAdmin ? "Organizational Strategic Log" : "My Strategic Submissions"} description="Comprehensive verification of organizational shifts.">
        {!isAdmin && (
            <Button onClick={() => setIsAddDialogOpen(true)} disabled={!submissionConstraints.canSubmit} className={cn("rounded-full h-11 px-6 shadow-lg", !submissionConstraints.canSubmit && "opacity-50 cursor-not-allowed")}>
                <PlusCircle className="mr-2 h-4 w-4"/> {submissionConstraints.hasSubmittedToday ? "Submission Complete" : "Shift Completion Form"}
            </Button>
        )}
      </PageHeader>
      
      {isAdmin ? (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search organizational fleet..." className="pl-10 h-12 rounded-2xl bg-white/50 border-none ring-1 ring-border/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 ring-1 ring-border/50">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Employee</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Strategic Log</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px] text-right">Verification</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {areUsersLoading ? (<TableRow><TableCell colSpan={3} className="h-32 text-center animate-pulse">Syncing organizational matrix...</TableCell></TableRow>) : usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                        <TableRow key={u.id} className="cursor-pointer hover:bg-white/80 transition-colors border-border/50" onClick={() => setSelectedUser(u)}>
                            <TableCell className="font-bold py-4">{u.firstName} {u.lastName}</TableCell>
                            <TableCell className="py-4 text-muted-foreground font-medium uppercase text-xs">{u.jobTitle} • {u.department || 'GLOBAL'}</TableCell>
                            <TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px] uppercase">Review Logs</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
            {areReportsLoading ? (<div className="h-48 flex items-center justify-center animate-pulse">Fetching history...</div>) : reports && reports.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-3">
                    {reports.map(r => (
                        <AccordionItem value={r.id} key={r.id} className="border-none">
                            <AccordionTrigger className="border rounded-2xl px-6 h-16 hover:no-underline hover:bg-white shadow-sm bg-white/50 ring-1 ring-border/50 transition-all data-[state=open]:rounded-b-none">
                                <div className="flex-1 text-left flex items-center justify-between">
                                    <div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Strategy</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div>
                                    <Badge variant="secondary" className="mr-4 text-[10px] font-black uppercase">✅ VERIFIED</Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white/30 space-y-6 ring-1 ring-border/50 shadow-lg mt-[-1px]">
                                {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} /> : r.reportType === 'Technical' ? <TechnicalReportDetails report={r} /> : <CustomReportDetails report={r} />}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-3xl border border-dashed"><FileText className="size-10 mb-4 opacity-20" /><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No submissions found.</p></div>}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-none ring-1 ring-border/50">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                                {currentTemplateId === 'Technical' ? <Code className="size-6" /> : currentTemplateId === 'Digital Marketing' ? <LayoutTemplate className="size-6" /> : <Briefcase className="size-6" />}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily {currentTemplateId} Submission</DialogTitle>
                                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatIST(new Date())}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8">
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Template Metrics</Label>
                                {currentTemplateId === 'Technical' ? <TechnicalFields /> : 
                                 currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : 
                                 currentTemplateId === 'Business' ? <BusinessFields /> : 
                                 customTemplateData ? <CustomTemplateFields definition={customTemplateData.definition} /> : <BusinessFields />}
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
                                        <div className="space-y-1 leading-none"><FormLabel className="text-sm font-bold cursor-pointer">I certify that this strategic shift log is accurate and localized.</FormLabel></div>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md">
                        <DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col">
                            <Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard</Button>
                            <Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Finalize Log & Logout</Button>
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
                                        <div><p className="font-black text-primary uppercase tracking-tighter text-sm">{r.reportType} Summary</p><p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">{r.date ? formatIST(r.date.toDate()) : "NIL"}</p></div>
                                        <Badge variant="secondary" className="mr-4 text-[10px] font-black uppercase">✅ VERIFIED</Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-6 border border-t-0 rounded-b-2xl bg-white space-y-6 ring-1 ring-border/50 shadow-inner mt-[-1px]">
                                    <div className="flex justify-end gap-2 mb-4">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest h-8"><Trash2 className="h-3 w-3 mr-2" />Purge Log</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl">
                                              <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-black uppercase">Confirm Deletion</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently purge this record from the historical archives.</AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel className="rounded-full font-bold text-[10px] uppercase">Cancel</AlertDialogCancel>
                                                <AlertDialogAction className="rounded-full font-bold text-[10px] uppercase bg-red-600" onClick={() => deleteDoc(doc(firestore, `users/${reportUserId}/reports`, r.id))}>Purge Forever</AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                    {r.reportType === 'Business' ? <BusinessReportDetails report={r} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} /> : r.reportType === 'Technical' ? <TechnicalReportDetails report={r} /> : <CustomReportDetails report={r} />}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No submissions available.</p></div>}
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
