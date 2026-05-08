
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Trash2, TrendingUp, Target, Brain, X, Plus, FileText, MapPin, LayoutTemplate, Briefcase, Code, Link as LinkIcon, CheckCircle2, Beaker, Mic, Loader2, DollarSign, ExternalLink, ShieldCheck, Download, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, setDocumentNonBlocking, useDoc, useStorage } from "@/firebase";
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp, getDocs, collectionGroup } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * UTILITIES
 */
const formatIST = (date: any) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(d) + " IST";
};

/**
 * SUB-COMPONENTS
 */
const ExecutionPlanFields = () => {
    const { control } = useFormContext();
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 py-3">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
                    <TrendingUp className="size-4" /> 🚀 T+1 Execution Planning
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="meetingsBookedTomorrow" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Meetings Booked Tomorrow</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Manager Intervention Trigger</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="None (Standard)">None (Standard)</SelectItem><SelectItem value="Manager Input Required">Manager Input Required</SelectItem><SelectItem value="Resource Blocked">Resource Blocked</SelectItem><SelectItem value="Client Risk Detected">Client Risk Detected</SelectItem></SelectContent></Select></FormItem>)} />
                </div>
                <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Top Priority / Critical Path</FormLabel><FormControl><Textarea {...field} placeholder="What is the single most important task for tomorrow?" className="rounded-xl" /></FormControl></FormItem>)} />
                <FormField control={control} name="pendingDeliverables" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Pending Strategic Deliverables</FormLabel><FormControl><Textarea {...field} placeholder="List items that need final completion..." className="rounded-xl" /></FormControl></FormItem>)} />
            </CardContent>
        </Card>
    );
};

const FileUploadButton = ({ fieldName }: { fieldName: string }) => {
    const { setValue, getValues } = useFormContext();
    const storage = useStorage();
    const { user } = useUser();
    const [uploading, setUploading] = React.useState(false);
    const handleUpload = async (file: File) => {
        if (!user) return;
        setUploading(true);
        try {
            const fileRef = ref(storage, `reports/${user.uid}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setValue(fieldName, url);
        } finally { setUploading(false); }
    };
    return (
        <div className="flex items-center gap-3">
            <Input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="text-xs h-9 bg-white" disabled={uploading} />
            {uploading && <Loader2 className="size-4 animate-spin text-primary" />}
            {getValues(fieldName) && <CheckCircle2 className="size-4 text-green-600" />}
        </div>
    );
};

const BusinessFields = ({ isNested = false }: { isNested?: boolean }) => {
    const { control } = useFormContext();
    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Outreach Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={control} name="coldCalls" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="linkedinOutreach" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="emailsSent" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Emails Sent</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                    <FormField control={control} name="potentialClients" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Potential Clients Identified</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Financial Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="currency" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Currency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="AED">AED (د.إ)</SelectItem></SelectContent></Select></FormItem>)} />
                        <FormField control={control} name="collectedRevenue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Collected Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Mic className="size-4" /> 3️⃣ Call Quality Audit</CardTitle></CardHeader>
                <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-muted-foreground">Best Call Record</Label><FileUploadButton fieldName="bestCallRecording" /></div>
                        <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-muted-foreground">Worst Call Record</Label><FileUploadButton fieldName="worstCallRecording" /></div>
                    </div>
                </CardContent>
            </Card>
            {!isNested && <ExecutionPlanFields />}
        </div>
    );
};

const DigitalMarketingFields = () => {
    const { control } = useFormContext();
    const deliverables = [
        { label: 'Content', key: 'dmContent' }, 
        { label: 'Posters', key: 'dmPosters' }, 
        { label: 'Reels', key: 'dmReels' }, 
        { label: 'Shoots', key: 'dmShoots' }
    ];
    return (
      <div className="space-y-8">
          <BusinessFields isNested />
          <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
              <CardHeader className="bg-purple-500/10 py-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest">
                      <LayoutTemplate className="size-4" /> 4️⃣ Marketing Pipeline Intelligence
                  </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                  <div className="border rounded-2xl overflow-hidden bg-white/50">
                      <Table>
                          <TableHeader className="bg-muted/30">
                              <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Status</TableHead>
                                  {deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase tracking-widest text-center py-4">{d.label}</TableHead>)}
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {['Approved', 'Pending', 'Rejected'].map(status => (
                                  <TableRow key={status} className="border-border/50">
                                      <TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>
                                      {deliverables.map(d => (
                                          <TableCell key={d.key} className="py-2">
                                              <FormField control={control} name={`${d.key}${status}`} render={({ field }) => (
                                                  <FormItem><FormControl><Input type="number" min="0" {...field} className="h-9 w-16 mx-auto text-center font-bold rounded-lg bg-white/50" /></FormControl></FormItem>
                                              )} />
                                          </TableCell>
                                      ))}
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              </CardContent>
          </Card>
          <ExecutionPlanFields />
      </div>
    );
};

const TechnicalFields = () => {
    const { control, setValue } = useFormContext();
    const tasks = useWatch({ control, name: "completedTasks" }) || [];
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
                <FormField control={control} name="logInTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Shift Start</FormLabel><FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                <FormField control={control} name="logOutTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase font-bold">Shift End</FormLabel><FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
            </div>
            <div className="space-y-4">
                <p className="font-black text-[10px] text-primary uppercase tracking-widest flex items-center gap-2"><Brain className="size-4" /> Development Modules:</p>
                {tasks.map((_: any, i: number) => (
                    <Card key={i} className="relative group bg-white/50 border rounded-2xl overflow-hidden shadow-sm pt-6 px-6 pb-6 space-y-4">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 text-red-600" onClick={() => setValue('completedTasks', tasks.filter((_:any, idx:number) => idx !== i))}><X className="size-4" /></Button>
                        <FormField control={control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Module</FormLabel><FormControl><Input {...field} className="rounded-xl" /></FormControl></FormItem>)} />
                        <FormField control={control} name={`completedTasks.${i}.workDone`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Description</FormLabel><FormControl><Textarea {...field} className="rounded-xl" /></FormControl></FormItem>)} />
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => setValue('completedTasks', [...tasks, { moduleName: "", workDone: "" }])} className="w-full border-dashed rounded-2xl h-16 bg-white/50 text-xs font-black uppercase"><Plus className="size-4 mr-2" /> Add Module</Button>
            </div>
            <ExecutionPlanFields />
        </div>
    );
};

const CustomTemplateFields = ({ definition }: { definition: any }) => {
    const { control } = useFormContext();
    return (
        <div className="space-y-8">
            {definition.sections?.map((section: any, sIdx: number) => (
                <Card key={sIdx} className="bg-white/50 border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">{section.title}</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        {section.fields?.map((field: any, fIdx: number) => (
                            <FormField key={fIdx} control={control} name={field.name} render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-bold uppercase">{field.label}</FormLabel>
                                    <FormControl>
                                        {field.type === 'textarea' ? <Textarea {...formField} className="rounded-xl" /> : 
                                         field.type === 'number' ? <Input type="number" min="0" {...formField} className="rounded-xl h-11" /> : 
                                         <Input {...formField} className="rounded-xl h-11" />}
                                    </FormControl>
                                </FormItem>
                            )} />
                        ))}
                    </CardContent>
                </Card>
            ))}
            <ExecutionPlanFields />
        </div>
    );
};

/**
 * MAIN PAGE
 */
export default function ReportsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [userReports, setUserReports] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedReportForReview, setSelectedReportForReview] = React.useState<any | null>(null);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isLeadOrHigher = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'Team Lead';

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);
  const currentTemplateId = mappingData?.mappings?.[currentUserData?.jobTitle || ''] || 'Business';

  const customTemplateDocRef = useMemoFirebase(() => !['Business', 'Technical', 'Digital Marketing'].includes(currentTemplateId) ? doc(firestore, 'custom_report_definitions', currentTemplateId) : null, [firestore, currentTemplateId]);
  const { data: customTemplateData } = useDoc<any>(customTemplateDocRef);

  const form = useForm<any>({
    defaultValues: {
        signature: "", 
        declaration: false, 
        meetingsBookedTomorrow: "0", 
        criticalPathTomorrow: "", 
        pendingDeliverables: "", 
        interventionTrigger: "None (Standard)",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", potentialClients: "0",
        collectedRevenue: "0", currency: "INR",
        completedTasks: [], logInTime: "", logOutTime: "",
        dmContentApproved: "0", dmContentPending: "0", dmContentRejected: "0",
        dmPostersApproved: "0", dmPostersPending: "0", dmPostersRejected: "0",
        dmReelsApproved: "0", dmReelsPending: "0", dmReelsRejected: "0",
        dmShootsApproved: "0", dmShootsPending: "0", dmShootsRejected: "0",
    },
  });

  React.useEffect(() => {
    if (currentUserData) {
        form.reset({
            ...form.getValues(),
            signature: currentUserData.signatureUrl || "Identity Verified via Digital Handshake",
        });
    }
  }, [currentUserData, form]);

  const fetchUserReports = async (uid: string) => {
      const q = query(collection(firestore, `users/${uid}/reports`), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    try {
        const payload = { 
            ...values, 
            employeeId: user.uid, 
            employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`, 
            employeeDepartment: currentUserData.department,
            employeeJobTitle: currentUserData.jobTitle,
            date: new Date(), 
            reportType: currentTemplateId,
            signatureUrl: currentUserData.signatureUrl || null
        };
        await addDoc(collection(firestore, `users/${user.uid}/reports`), payload);
        toast({ title: "Strategic Submission Confirmed" });
        setTimeout(async () => { await auth.signOut(); router.push('/login'); }, 1500);
    } catch (err) { toast({ variant: 'destructive', title: 'Submission Failed' }); }
  };

  const handleExportPdf = (report: any) => {
    const pdfDoc = new jsPDF();
    const dateStr = formatIST(report.date);

    pdfDoc.setFontSize(18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("FortuMars Strategic Shift Report", 14, 20);
    
    pdfDoc.setFontSize(10);
    pdfDoc.setTextColor(100);
    pdfDoc.text(`Submission ID: ${report.id}`, 14, 28);
    pdfDoc.text(`Generated On: ${format(new Date(), 'PPP p')}`, 14, 33);

    autoTable(pdfDoc, {
        startY: 40,
        head: [['Strategic Field', 'Recorded Value']],
        body: [
            ['Employee Name', report.employeeName],
            ['Designation', report.employeeJobTitle],
            ['Department', report.employeeDepartment],
            ['Submission Time', dateStr],
            ['Report Type', report.reportType],
            ['T+1 Critical Path', report.criticalPathTomorrow || 'N/A']
        ],
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });

    if (report.signatureUrl) {
        const finalY = (pdfDoc as any).lastAutoTable.finalY + 10;
        pdfDoc.text("Verification E-Signature:", 14, finalY);
        pdfDoc.addImage(report.signatureUrl, 'PNG', 14, finalY + 5, 40, 20);
    }

    pdfDoc.save(`Report_${report.employeeName.replace(/\s/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const filteredUsers = allUsers?.filter(u => 
    u.id !== user?.uid && 
    (u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader title={isLeadOrHigher ? "Organizational Strategic Log" : "My Strategic Submissions"} description="Comprehensive verification of organizational shifts.">
        {!isLeadOrHigher && (<Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full h-11 px-6 shadow-lg"><PlusCircle className="mr-2 h-4 w-4"/> Shift Completion Form</Button>)}
      </PageHeader>
      
      {isLeadOrHigher ? (
        <>
          <div className="relative mb-6"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search organizational fleet..." className="pl-10 h-12 rounded-2xl bg-white/50 border-none ring-1 ring-border/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 ring-1 ring-border/50">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Employee</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px]">Strategic Log</TableHead>
                        <TableHead className="font-black uppercase tracking-tighter text-[10px] text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers?.map(u => (
                        <TableRow key={u.id} className="hover:bg-white/80 transition-colors border-border/50">
                            <TableCell className="font-bold py-4">
                                <Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                                    {u.firstName} {u.lastName}
                                </Link>
                            </TableCell>
                            <TableCell className="py-4 text-muted-foreground font-medium uppercase text-xs">{u.jobTitle}</TableCell>
                            <TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px] uppercase" onClick={() => { setSelectedUser(u); fetchUserReports(u.id); }}>Review Logs</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </>
      ) : (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <FileText className="size-10 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-sm font-bold text-muted-foreground">Historical shift records are stored in your tactical profile.</p>
              <Button variant="link" asChild className="mt-2 text-primary font-black uppercase text-[10px]"><Link href="/dashboard/profile">View Profile Ops Log</Link></Button>
          </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
          <DialogContent className="max-w-2xl rounded-3xl shadow-2xl">
              <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Shift History: {selectedUser?.firstName} {selectedUser?.lastName}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="space-y-3 py-4">
                      {userReports.length > 0 ? userReports.map(r => (
                          <Card key={r.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer border-none ring-1 ring-border/50 flex items-center justify-between" onClick={() => setSelectedReportForReview(r)}>
                              <div className="flex items-center gap-4">
                                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div>
                                  <div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{r.reportType} Log</p></div>
                              </div>
                              <Button variant="ghost" size="icon" className="rounded-full"><ExternalLink className="size-4" /></Button>
                          </Card>
                      )) : <p className="text-center py-10 text-muted-foreground italic">No historical logs found.</p>}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

      {/* Deep Detail Dialog */}
      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-3xl shadow-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-8 border-b bg-white">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Tactical Audit Detail</DialogTitle>
                        <p className="text-xs font-bold text-muted-foreground uppercase">{formatIST(selectedReportForReview?.date)}</p>
                    </div>
                    <Button onClick={() => handleExportPdf(selectedReportForReview)} size="sm" className="rounded-full font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-primary/20"><Download className="size-3" /> Export Tactical PDF</Button>
                  </div>
              </DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-secondary/10">
                  <div className="space-y-8 pb-10">
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground">Reporting Official</p><p className="font-bold">{selectedReportForReview?.employeeName}</p></div>
                          <div className="space-y-1"><p className="text-[10px] font-black uppercase text-muted-foreground">Designation</p><p className="font-bold">{selectedReportForReview?.employeeJobTitle}</p></div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Shift Intelligence</p>
                          <div className="bg-white p-6 rounded-2xl ring-1 ring-border/50 shadow-sm space-y-4">
                              {selectedReportForReview?.reportType === 'Technical' && (
                                  <div className="space-y-4">
                                      {selectedReportForReview.completedTasks?.map((t: any, i: number) => (
                                          <div key={i} className="pb-4 border-b last:border-none space-y-1">
                                              <p className="font-black text-xs uppercase">{t.moduleName}</p>
                                              <p className="text-sm text-muted-foreground italic leading-relaxed">"{t.workDone}"</p>
                                          </div>
                                      ))}
                                  </div>
                              )}
                              {selectedReportForReview?.criticalPathTomorrow && (
                                  <div className="pt-2">
                                      <p className="text-[10px] font-black uppercase text-orange-600 mb-2">T+1 Critical Path</p>
                                      <p className="text-sm font-medium leading-relaxed">"{selectedReportForReview.criticalPathTomorrow}"</p>
                                  </div>
                              )}
                          </div>
                      </div>
                      
                      <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Tactical Verification</p>
                          <div className="bg-muted/30 p-6 rounded-2xl ring-1 ring-border/50 space-y-6 flex flex-col items-center text-center">
                              {selectedReportForReview?.signatureUrl ? (
                                  <div className="space-y-4">
                                      <img src={selectedReportForReview.signatureUrl} alt="E-Signature" className="h-16 object-contain grayscale invert mix-blend-multiply opacity-60" />
                                      <div className="space-y-0.5">
                                          <p className="text-[10px] font-black uppercase tracking-tighter">{selectedReportForReview.employeeName}</p>
                                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview.employeeJobTitle}</p>
                                          <p className="text-[8px] font-mono text-muted-foreground mt-2">{formatIST(selectedReportForReview.date)}</p>
                                      </div>
                                  </div>
                              ) : <p className="text-xs font-bold text-muted-foreground italic">Digital Handshake Verified via Platform Auth</p>}
                          </div>
                      </div>
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-none ring-1 ring-border/50">
            <FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><Briefcase className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily {currentTemplateId} Submission</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatIST(new Date())}</DialogDescription></div></div>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8">
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Analytics Template</Label>
                                {currentTemplateId === 'Technical' ? <TechnicalFields /> : 
                                 currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : 
                                 currentTemplateId === 'Business' ? <BusinessFields /> : 
                                 customTemplateData ? <CustomTemplateFields definition={customTemplateData.definition} /> : <BusinessFields />}
                            </div>
                            <Separator />
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Verification</Label>
                                <FormField control={form.control} name="signature" render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input {...field} readOnly className="bg-muted/50 font-mono text-[10px] h-12 rounded-xl border-none ring-1 ring-border/50 cursor-not-allowed font-bold" />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="declaration" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20 shadow-sm">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl>
                                        <div className="space-y-1 leading-none"><FormLabel className="text-sm font-bold cursor-pointer">I certify that all information provided is accurate and complete.</FormLabel></div>
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
                </form></FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
