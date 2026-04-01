
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, PartyPopper, Trash2, Settings2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useDoc, setDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, Timestamp } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Types ---

type ReportTemplatesConfig = {
  businessKeywords: string[];
  technicalKeywords: string[];
  businessGuidelines: string;
  technicalGuidelines: string;
};

const defaultTemplatesConfig: ReportTemplatesConfig = {
  businessKeywords: ["business", "sales", "marketing", "executive", "admin"],
  technicalKeywords: ["technical", "developer", "engineer", "designer", "it", "product"],
  businessGuidelines: "Please focus on client interactions, pipeline growth, and strategic outreach results for today.",
  technicalGuidelines: "Provide details on code modules worked on, specific technologies used, and any technical hurdles encountered."
};

// --- Schemas ---

const businessReportSchema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "INR"]),
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
  bestCallRecording: z.string().optional(),
  worstCallRecording: z.string().optional(),
  declaration: z.literal<boolean>(true, {
    errorMap: () => ({ message: "You must acknowledge the declaration." }),
  }),
  signature: z.string(),
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
  declaration: z.literal<boolean>(true, {
    errorMap: () => ({ message: "You must acknowledge the declaration." }),
  }),
  signature: z.string(),
});

const formSchema = z.union([businessReportSchema, technicalReportSchema]);
type ReportFormValues = z.infer<typeof formSchema>;

type Report = { 
  id: string; 
  employeeId: string;
  date: any; 
  reportType: 'Business' | 'Technical';
  signature: string;
  bestCallRecording?: string;
  worstCallRecording?: string;
  // Business
  currency?: 'USD' | 'EUR' | 'GBP' | 'INR';
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

const motivationalQuotes = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The only way to do great work is to love what you do.",
    "Believe you can and you're halfway there.",
    "Your limitation is only your imagination.",
    "The secret of getting ahead is getting started.",
    "Well done is better than well said.",
    "The future depends on what you do today."
];

// --- Components ---

const ReportDetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="font-semibold whitespace-pre-wrap">{value ?? '-'}</p>
  </div>
);

const OutreachReportDetails = ({ report }: { report: Report }) => {
    const currencySymbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
    const conversionRate = (report.outreachTotal && report.outreachTotal > 0) ? ((report.potentialClients || 0) / report.outreachTotal) * 100 : 0;
    const isHighPerformer = conversionRate >= 15;
    const [randomQuote, setRandomQuote] = React.useState('');

    React.useEffect(() => {
        if (isHighPerformer) {
            setRandomQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
        }
    }, [isHighPerformer]);
    
    return (
        <div className="space-y-4">
            {isHighPerformer && (
                <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                    <CardHeader className="flex-row items-center gap-4">
                        <PartyPopper className="h-10 w-10 text-green-600 animate-pulse" />
                        <div>
                            <CardTitle className="text-green-700 dark:text-green-400">Well Done!</CardTitle>
                            <CardDescription className="text-green-600 dark:text-green-500">Exceptional performance on this report.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <blockquote className="border-l-2 border-green-300 pl-4 italic text-green-800/80 dark:text-green-300/80">
                            {randomQuote}
                        </blockquote>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader><CardTitle>Outreach Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ReportDetailItem label="Total Outreach" value={report.outreachTotal} />
                        <ReportDetailItem label="Potential Clients" value={report.potentialClients} />
                        <ReportDetailItem label="Pipeline Value" value={`${currencySymbol[report.currency || 'USD']}${(report.pipelineValue || 0).toLocaleString()}`} />
                        <ReportDetailItem label="Intervention" value={report.interventionTrigger} />
                    </div>
                     <Card className={cn(conversionRate < 15 && conversionRate > 0 && "bg-gradient-to-r from-red-50 to-orange-50 border-red-200")}>
                        <CardContent className="p-4">
                            <p className={cn("text-2xl font-bold", conversionRate < 15 && conversionRate > 0 && "text-red-600")}>{conversionRate.toFixed(2)}%</p>
                            <p className="text-sm text-muted-foreground">Conversion Rate</p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Daily Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <ReportDetailItem label="Follow-ups Completed" value={report.followUpsCompleted} />
                    <ReportDetailItem label="Meetings/Demos Secured & Quotations" value={report.meetingsSecured} />
                    <ReportDetailItem label="Strategic Learning" value={report.strategicLearning} />
                    <ReportDetailItem label="Client Win/Highlight" value={report.clientWinHighlight} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Planning & Outlook</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <ReportDetailItem label="Pending Deliverables / Pipeline Impact" value={report.pendingDeliverables} />
                    <ReportDetailItem label="Meetings/Demos Booked for Tomorrow" value={report.meetingsBookedTomorrow} />
                    <ReportDetailItem label="Tomorrow's Critical Path" value={report.criticalPathTomorrow} />
                </CardContent>
            </Card>
             {report.bestCallRecording && (
                <ReportDetailItem
                    label="Best Call Record"
                    value={<audio controls src={report.bestCallRecording} className="w-full" />}
                />
            )}
            {report.worstCallRecording && (
                <ReportDetailItem
                    label="Worst Call Record"
                    value={<audio controls src={report.worstCallRecording} className="w-full" />}
                />
            )}
            <ReportDetailItem label="Signature" value={report.signature} />
        </div>
    );
};

const TechnicalReportDetails = ({ report }: { report: Report }) => (
  <Card>
    <CardContent className="space-y-4 pt-6">
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
    </CardContent>
  </Card>
);

// --- Page ---

export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedJobTitle, setSelectedJobTitle] = React.useState("All Job Titles");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = React.useState(false);

  const [bestCallAudioURL, setBestCallAudioURL] = React.useState<string | undefined>();
  const [worstCallAudioURL, setWorstCallAudioURL] = React.useState<string | undefined>();

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<UserData>(userDocRef);
  const userRole = currentUserData?.role;
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  const templatesDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: templatesData } = useDoc<ReportTemplatesConfig>(templatesDocRef);
  
  const templates = templatesData || defaultTemplatesConfig;

  // Determine report type based on job title keywords
  const getReportType = (jobTitle: string = ''): 'Business' | 'Technical' => {
    const title = jobTitle.toLowerCase();
    
    // Check technical keywords first
    if (templates.technicalKeywords.some(kw => title.includes(kw.toLowerCase()))) {
        return 'Technical';
    }
    // Default to Business if keywords match, or if it's the catch-all
    if (templates.businessKeywords.some(kw => title.includes(kw.toLowerCase()))) {
        return 'Business';
    }
    // Fallback: Default to Business if job title is missing or doesn't match
    return 'Business';
  };

  const currentReportType = getReportType(currentUserData?.jobTitle);
  const isBusinessUser = currentReportType === 'Business';
  const isTechnicalUser = currentReportType === 'Technical';

  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, "users"));
  }, [firestore, isAdmin]);
  const { data: usersData, isLoading: areUsersLoading } = useCollection<UserData>(usersQuery);

  const reportUserId = isAdmin ? selectedUser?.id : user?.uid;
  
  const reportsQuery = useMemoFirebase(() => {
    if (!reportUserId) return null;
    return query(collection(firestore, `users/${reportUserId}/reports`), orderBy('date', 'desc'));
  }, [firestore, reportUserId]);
  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);
  
  const attendanceQuery = useMemoFirebase(() => {
      if (!user) return null;
      const todayId = format(new Date(), 'yyyy-MM-dd');
      return query(collection(firestore, `users/${user.uid}/attendances`), where('id', '==', todayId));
  }, [user, firestore]);

  const { data: attendanceData } = useCollection(attendanceQuery);
  const todaysAttendance = attendanceData?.[0];

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(isBusinessUser ? businessReportSchema : technicalReportSchema),
    defaultValues: {
      signature: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : "",
      declaration: false,
      ...(isBusinessUser ? {
        currency: "USD",
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
        bestCallRecording: undefined,
        worstCallRecording: undefined,
      } : {
        subject: "",
        technologyUsed: "",
        taskDescription: "",
        workDone: "",
        moduleWorkedOn: "",
        taskStatus: "In Progress",
        logInTime: "09:30",
        logOutTime: "18:30",
        otherWork: "",
      })
    },
  });
  
  const resetForm = React.useCallback(() => {
      form.reset({
        signature: currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : "",
        declaration: false,
        ...(isBusinessUser ? {
            currency: "USD",
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
            bestCallRecording: undefined,
            worstCallRecording: undefined,
        } : {
            subject: "",
            technologyUsed: "",
            taskDescription: "",
            workDone: "",
            moduleWorkedOn: "",
            taskStatus: "In Progress",
            logInTime: "09:30",
            logOutTime: "18:30",
            otherWork: "",
        })
      });
      setBestCallAudioURL(undefined);
      setWorstCallAudioURL(undefined);
  }, [form, currentUserData, isBusinessUser]);

  React.useEffect(() => {
    if (isAddDialogOpen) {
      if (isTechnicalUser) {
        if (todaysAttendance?.checkInTime) {
          form.setValue('logInTime', format(todaysAttendance.checkInTime.toDate(), 'HH:mm'));
        }
        
        if (todaysAttendance?.checkOutTime) {
          form.setValue('logOutTime', format(todaysAttendance.checkOutTime.toDate(), 'HH:mm'));
        } else {
          form.setValue('logOutTime', format(new Date(), 'HH:mm'));
        }
      }
      
      if (currentUserData) {
          form.setValue('signature', `${currentUserData.firstName} ${currentUserData.lastName}`)
      }
    }
  }, [isAddDialogOpen, todaysAttendance, isTechnicalUser, form, currentUserData]);

  const handleAudioUpload = (
      event: React.ChangeEvent<HTMLInputElement>,
      fieldName: 'bestCallRecording' | 'worstCallRecording',
      setUrl: React.Dispatch<React.SetStateAction<string | undefined>>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
                variant: "destructive",
                title: "File too large",
                description: "Please upload an audio file smaller than 5MB.",
            });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setUrl(dataUrl);
            form.setValue(fieldName, dataUrl);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleDeleteRecording = (
      fieldName: 'bestCallRecording' | 'worstCallRecording',
      setUrl: React.Dispatch<React.SetStateAction<string | undefined>>
  ) => {
    setUrl(undefined);
    form.setValue(fieldName, undefined);
  };


  const onSubmit = async (values: ReportFormValues) => {
    if (!user || !currentUserData) return;
    
    const signatureWithTimestamp = `${values.signature} | ${currentUserData.jobTitle} | ${format(new Date(), 'PPpp')}`;
    
    const reportPayload = {
      ...values,
      employeeId: user.uid,
      date: new Date(),
      reportType: isBusinessUser ? 'Business' : 'Technical',
      signature: signatureWithTimestamp,
    }
    
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), reportPayload);
    
    toast({
        title: "Report Submitted",
        description: "Your daily work report has been saved."
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleSaveConfig = (values: ReportTemplatesConfig) => {
      setDocumentNonBlocking(templatesDocRef, values, { merge: true });
      toast({ title: "Configuration Saved", description: "Report templates have been updated." });
      setIsConfigDialogOpen(false);
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

  const BusinessFormFields = () => {
    const { control } = form;
    const [outreach, potential] = useWatch({
        control,
        name: ["outreachTotal", "potentialClients"]
    });
    const conversionRate = (outreach > 0) ? ((potential / outreach) * 100) : 0;

    return (
        <>
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Guidelines</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{templates.businessGuidelines}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Outreach Analytics</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={control} name="currency" render={({ field }) => (
                        <FormItem><FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                <SelectItem value="GBP">GBP (£)</SelectItem>
                                <SelectItem value="INR">INR (₹)</SelectItem>
                            </SelectContent>
                          </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="pipelineValue" render={({ field }) => (
                        <FormItem><FormLabel>Pipeline Business Value</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="outreachTotal" render={({ field }) => (
                        <FormItem><FormLabel>Outreach (Total)</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="potentialClients" render={({ field }) => (
                        <FormItem><FormLabel>Potential Clients (Conversions)</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="md:col-span-2">
                        <Label>Conversion Rate</Label>
                        <Card className={cn("mt-2", conversionRate < 15 && conversionRate > 0 && "bg-gradient-to-r from-red-50 to-orange-50 border-red-200")}>
                            <CardContent className="p-4">
                                <p className={cn("text-2xl font-bold", conversionRate < 15 && conversionRate > 0 && "text-red-600")}>{conversionRate.toFixed(2)}%</p>
                                <p className="text-sm text-muted-foreground">({potential} conversions / {outreach} outreach)</p>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Daily Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={control} name="followUpsCompleted" render={({ field }) => (
                        <FormItem><FormLabel>Follow-ups Completed</FormLabel><FormControl><Textarea {...field} placeholder="Details on existing client follow-ups..." /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="meetingsSecured" render={({ field }) => (
                        <FormItem><FormLabel>Meetings/Demos Secured & Quotations</FormLabel><FormControl><Textarea {...field} placeholder="Client names and brief context..." /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="strategicLearning" render={({ field }) => (
                        <FormItem><FormLabel>Strategic Learning</FormLabel><FormControl><Textarea {...field} placeholder="What did you learn today about the industry, product, or client behavior?" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="clientWinHighlight" render={({ field }) => (
                        <FormItem><FormLabel>Client Win/Highlight</FormLabel><FormControl><Textarea {...field} placeholder="A brief narrative of the best conversation of the day..." /></FormControl><FormMessage /></FormItem>
                    )} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Planning & Outlook</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                        <FormItem><FormLabel>Pending Deliverables / Pipeline Impact</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="meetingsBookedTomorrow" render={({ field }) => (
                        <FormItem><FormLabel>Meetings/Demos Booked for Tomorrow</FormLabel><FormControl><Textarea {...field} placeholder="Confirmed calendar invites sent..." /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                        <FormItem><FormLabel>T+1 Critical Path</FormLabel><FormControl><Textarea {...field} placeholder="Tomorrow's plan and the #1 most important task..." /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem>
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
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Best Call Record</CardTitle>
                    <CardDescription>Upload the best call recording of the day (max 5MB).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!bestCallAudioURL && (
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="best-call-upload">Upload Audio</Label>
                            <Input id="best-call-upload" type="file" accept="audio/*" onChange={(e) => handleAudioUpload(e, 'bestCallRecording', setBestCallAudioURL)} />
                        </div>
                    )}
                    {bestCallAudioURL && (
                        <div className="space-y-2">
                            <audio src={bestCallAudioURL} controls className="w-full" />
                            <Button type="button" onClick={() => handleDeleteRecording('bestCallRecording', setBestCallAudioURL)} variant="outline" size="sm" className="w-full">
                                <Trash2 className="mr-2" />
                                Remove Recording
                            </Button>
                        </div>
                    )}
                    <FormField control={control} name="bestCallRecording" render={({ field }) => (
                        <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Worst Call Record</CardTitle>
                    <CardDescription>Upload the call recording that needs improvement (max 5MB).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!worstCallAudioURL && (
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="worst-call-upload">Upload Audio</Label>
                            <Input id="worst-call-upload" type="file" accept="audio/*" onChange={(e) => handleAudioUpload(e, 'worstCallRecording', setWorstCallAudioURL)} />
                        </div>
                    )}
                    {worstCallAudioURL && (
                        <div className="space-y-2">
                            <audio src={worstCallAudioURL} controls className="w-full" />
                            <Button type="button" onClick={() => handleDeleteRecording('worstCallRecording', setWorstCallAudioURL)} variant="outline" size="sm" className="w-full">
                                <Trash2 className="mr-2" />
                                Remove Recording
                            </Button>
                        </div>
                    )}
                    <FormField control={control} name="worstCallRecording" render={({ field }) => (
                        <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>
        </>
    );
  }

  const TechnicalFormFields = () => (
    <div className="space-y-6">
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Info className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{templates.technicalGuidelines}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Technical Work Report</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="technologyUsed" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Technology / Tool Used / Learnt</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="taskDescription" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Task Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="workDone" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Code / Design / Testing Work Done</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormMessage>
                )} />
                <FormField control={form.control} name="moduleWorkedOn" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Module / Feature Worked On</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                    <FormItem className="md:col-span-2"><FormLabel>Other work done (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
        </Card>
    </div>
  );

  const AdminView = () => (
    <>
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
              <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(u)}>
                <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.jobTitle}</TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">
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
    <div className="space-y-2">
      {areReportsLoading ? (
          <p className="text-center py-10 text-muted-foreground">Loading reports...</p>
      ) : reports && reports.length > 0 ? (
        <Accordion type="single" collapsible className="w-full space-y-2">
          {reports.map(report => (
            <AccordionItem value={report.id} key={report.id} className="border-none">
              <AccordionTrigger className="border rounded-md px-4 hover:no-underline hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:rounded-b-none">
                  <div className="flex-1 text-left">
                      <p className="font-semibold">{report.reportType === 'Technical' ? report.subject : 'Business Report'}</p>
                      <p className="text-sm text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p>
                  </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 border border-t-0 rounded-b-md">
                {report.reportType === 'Business'
                    ? <OutreachReportDetails report={report} />
                    : <TechnicalReportDetails report={report} />
                }
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
          <Card>
              <CardContent className="h-48 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <p className="mb-4">No reports submitted yet. Time to file one!</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Add Today's Report</Button>
              </CardContent>
          </Card>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={isAdmin ? "Employee Reports" : "My Daily Reports"}
        description={isAdmin ? "Review and analyze daily reports." : "Submit and view your work reports."}
      >
        <div className="flex gap-2">
            {isAdmin && (
                <Button variant="outline" onClick={() => setIsConfigDialogOpen(true)}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure Templates
                </Button>
            )}
            {!isAdmin && (
                <Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Add Today's Report</Button>
            )}
        </div>
      </PageHeader>
      
      {isAdmin ? <AdminView /> : <EmployeeView />}
      
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsAddDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl w-full h-[90vh] max-h-[90vh] flex flex-col p-0">
          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle className="font-headline text-xl">New {currentReportType} Report</DialogTitle>
              <DialogDescription>Fill in the details of your work for today, {format(new Date(), "PPP")}.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                    {isBusinessUser ? <BusinessFormFields /> : <TechnicalFormFields />}
                    <FormField
                        control={form.control}
                        name="declaration"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>Declaration</FormLabel>
                                <FormDescription>
                                I hereby declare that the information provided in this report is true and accurate to the best of my knowledge.
                                </FormDescription>
                                <FormMessage />
                            </div>
                            </FormItem>
                        )}
                    />
                </div>
              </ScrollArea>
              <DialogFooter className="p-4 border-t bg-background/95 backdrop-blur-sm flex flex-col sm:flex-row sm:justify-between items-center gap-4">
                <FormField control={form.control} name="signature" render={({ field }) => (
                  <FormItem className="text-xs text-muted-foreground text-center sm:text-left">
                      <FormControl><Input {...field} readOnly disabled className="bg-transparent border-none p-0 h-auto" /></FormControl>
                      <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
                      {form.formState.isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </DialogFooter>
          </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Template Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Configure Report Templates</DialogTitle>
                  <DialogDescription>Map job titles to specific report types and customize guidelines.</DialogDescription>
              </DialogHeader>
              <TemplateConfigForm 
                initialValues={templates} 
                onSave={handleSaveConfig} 
                onCancel={() => setIsConfigDialogOpen(false)} 
              />
          </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-2xl w-full flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>
              {selectedUser ? `${selectedUser.firstName}'s Reports` : "Reports"}
            </SheetTitle>
            <SheetDescription>
              {selectedUser ? `Daily reports submitted by ${selectedUser.firstName}.` : ""}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-2">
              {areReportsLoading ? <p className="text-center py-6">Loading...</p> : reports && reports.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                      {reports.map(report => (
                          <AccordionItem value={report.id} key={report.id} className="border-none">
                              <AccordionTrigger className="border rounded-md px-4 hover:no-underline hover:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:rounded-b-none">
                                  <div className="flex-1 text-left">
                                      <p className="font-semibold">{report.reportType === 'Technical' ? report.subject : 'Business Report'}</p>
                                      <p className="text-sm text-muted-foreground">{format(report.date.toDate(), "PPpp")}</p>
                                  </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 border border-t-0 rounded-b-md">
                                {report.reportType === 'Business'
                                    ? <OutreachReportDetails report={report} />
                                    : <TechnicalReportDetails report={report} />
                                }
                              </AccordionContent>
                          </AccordionItem>
                      ))}
                  </Accordion>
              ) : <p className="text-center text-muted-foreground py-6">No reports found for this user.</p>}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

// --- Sub-Components ---

function TemplateConfigForm({ 
    initialValues, 
    onSave, 
    onCancel 
}: { 
    initialValues: ReportTemplatesConfig, 
    onSave: (val: ReportTemplatesConfig) => void, 
    onCancel: () => void 
}) {
    const [config, setConfig] = React.useState<ReportTemplatesConfig>(initialValues);

    const handleListChange = (field: keyof ReportTemplatesConfig, value: string) => {
        const keywords = value.split(',').map(k => k.trim()).filter(Boolean);
        setConfig(prev => ({ ...prev, [field]: keywords }));
    };

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Business Report Mapping</h4>
                <div className="grid gap-2">
                    <Label>Job Title Keywords (comma separated)</Label>
                    <Input 
                        value={config.businessKeywords.join(', ')} 
                        onChange={(e) => handleListChange('businessKeywords', e.target.value)} 
                        placeholder="e.g. business, sales, marketing"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Business Report Guidelines</Label>
                    <Textarea 
                        value={config.businessGuidelines} 
                        onChange={(e) => setConfig(prev => ({ ...prev, businessGuidelines: e.target.value }))}
                        className="h-24"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Technical Report Mapping</h4>
                <div className="grid gap-2">
                    <Label>Job Title Keywords (comma separated)</Label>
                    <Input 
                        value={config.technicalKeywords.join(', ')} 
                        onChange={(e) => handleListChange('technicalKeywords', e.target.value)} 
                        placeholder="e.g. technical, developer, engineer"
                    />
                </div>
                <div className="grid gap-2">
                    <Label>Technical Report Guidelines</Label>
                    <Textarea 
                        value={config.technicalGuidelines} 
                        onChange={(e) => setConfig(prev => ({ ...prev, technicalGuidelines: e.target.value }))}
                        className="h-24"
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button onClick={() => onSave(config)}>Save Configuration</Button>
            </DialogFooter>
        </div>
    );
}
