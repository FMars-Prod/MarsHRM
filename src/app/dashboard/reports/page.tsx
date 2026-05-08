
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, TrendingUp, Target, Brain, X, Plus, FileText, Briefcase, CheckCircle2, Mic, Loader2, DollarSign, ExternalLink, Download, Clock, Zap, History, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatIST = (date: any) => {
    if (!date) return "N/A";
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
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
                    <FormField control={control} name="meetingsBookedTomorrow" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Meetings Booked Tomorrow</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Manager Intervention Trigger</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="None (Standard)">None (Standard)</SelectItem>
                                    <SelectItem value="Manager Input Required">Manager Input Required</SelectItem>
                                    <SelectItem value="Resource Blocked">Resource Blocked</SelectItem>
                                    <SelectItem value="Client Risk Detected">Client Risk Detected</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
                <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Top Priority / Critical Path</FormLabel>
                        <FormControl><Textarea {...field} placeholder="What is the single most important task for tomorrow?" className="rounded-xl min-h-[80px]" /></FormControl>
                    </FormItem>
                )} />
                <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Pending Strategic Deliverables</FormLabel>
                        <FormControl><Textarea {...field} placeholder="List items that need final completion..." className="rounded-xl min-h-[80px]" /></FormControl>
                    </FormItem>
                )} />
            </CardContent>
        </Card>
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
                        <FormField control={control} name="coldCalls" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Cold Calls</FormLabel>
                                <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={control} name="linkedinOutreach" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">LinkedIn</FormLabel>
                                <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={control} name="emailsSent" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Emails Sent</FormLabel>
                                <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                            </FormItem>
                        )} />
                    </div>
                    <FormField control={control} name="potentialClients" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Potential Clients Identified</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Financial Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Currency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="AED">AED (د.إ)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={control} name="collectedRevenue" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Collected Revenue</FormLabel>
                                <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                            </FormItem>
                        )} />
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
              <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest">4️⃣ Marketing Pipeline Intelligence</CardTitle></CardHeader>
              <CardContent className="pt-6">
                  <div className="border rounded-2xl overflow-hidden bg-white/50">
                      <Table>
                          <TableHeader className="bg-muted/30">
                              <TableRow>
                                  <TableHead className="text-[10px] font-black uppercase py-4">Status / Category</TableHead>
                                  {deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {['Approved', 'Pending', 'Rejected'].map(status => (
                                  <TableRow key={status}>
                                      <TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>
                                      {deliverables.map(d => (
                                          <TableCell key={d.key} className="py-2">
                                              <FormField control={control} name={`${d.key}${status}`} render={({ field }) => (
                                                  <FormItem><FormControl><Input type="number" min="0" {...field} className="h-9 w-16 mx-auto text-center rounded-lg bg-white/50" /></FormControl></FormItem>
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
                <FormField control={control} name="logInTime" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Shift Start</FormLabel>
                        <FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl>
                    </FormItem>
                )} />
                <FormField control={control} name="logOutTime" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Shift End</FormLabel>
                        <FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl>
                    </FormItem>
                )} />
            </div>
            <div className="space-y-4">
                <p className="font-black text-[10px] text-primary uppercase tracking-widest flex items-center gap-2"><Brain className="size-4" /> Development Modules:</p>
                {tasks.map((_, i: number) => (
                    <Card key={i} className="relative group bg-white/50 border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-red-600" onClick={() => setValue('completedTasks', tasks.filter((_:any, idx:number) => idx !== i))}><X className="size-4" /></Button>
                        <FormField control={control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Module</FormLabel>
                                <FormControl><Input {...field} className="rounded-xl" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={control} name={`completedTasks.${i}.workDone`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Description</FormLabel>
                                <FormControl><Textarea {...field} className="rounded-xl min-h-[60px]" /></FormControl>
                            </FormItem>
                        )} />
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => setValue('completedTasks', [...tasks, { moduleName: "", workDone: "" }])} className="w-full border-dashed rounded-2xl h-16 bg-white/50 text-xs font-black uppercase"><Plus className="size-4 mr-2" /> Add Module</Button>
            </div>
            <ExecutionPlanFields />
        </div>
    );
};

const MarketingAuditDetail = ({ report }: { report: any }) => {
    const deliverables = [
        { label: 'Content', key: 'dmContent' }, 
        { label: 'Posters', key: 'dmPosters' }, 
        { label: 'Reels', key: 'dmReels' }, 
        { label: 'Shoots', key: 'dmShoots' }
    ];
    const getVal = (k: string, s: string) => Number(report[`${k}${s}`] || 0);
    const totals = deliverables.map(d => ({
        label: d.label,
        approved: getVal(d.key, 'Approved'),
        pending: getVal(d.key, 'Pending'),
        rejected: getVal(d.key, 'Rejected'),
        total: getVal(d.key, 'Approved') + getVal(d.key, 'Pending') + getVal(d.key, 'Rejected')
    }));
    const grandTotalSubmitted = totals.reduce((acc, curr) => acc + curr.total, 0);
    const grandTotalApproved = totals.reduce((acc, curr) => acc + curr.approved, 0);
    const successRate = grandTotalSubmitted > 0 ? ((grandTotalApproved / grandTotalSubmitted) * 100).toFixed(1) : "0.0";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-purple-50 p-4 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600 text-white rounded-lg"><Zap className="size-4" /></div>
                    <div><p className="text-[10px] font-black uppercase text-purple-700">Success Metric</p><p className="text-xl font-black text-purple-900">{successRate}% Approval Rate</p></div>
                </div>
            </div>
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Status / Item</TableHead>
                            {deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}
                            <TableHead className="text-[10px] font-black uppercase text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {['Approved', 'Pending', 'Rejected'].map(status => {
                            const statusTotal = totals.reduce((acc, curr) => acc + Number(report[`${deliverables.find(d => d.label === curr.label)?.key}${status}`] || 0), 0);
                            return (
                                <TableRow key={status}>
                                    <TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>
                                    {deliverables.map(d => (
                                        <TableCell key={d.key} className="text-center font-bold">{report[`${d.key}${status}`] || 0}</TableCell>
                                    ))}
                                    <TableCell className="text-right font-black">{statusTotal}</TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow className="bg-muted/10">
                            <TableCell className="text-xs font-black uppercase py-4">Total</TableCell>
                            {totals.map(t => <TableCell key={t.label} className="text-center font-black">{t.total}</TableCell>)}
                            <TableCell className="text-right font-black text-primary">{grandTotalSubmitted}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const BusinessAuditDetail = ({ report }: { report: any }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Cold Calls</p><p className="text-xl font-black">{report.coldCalls || 0}</p></div>
            <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">LinkedIn</p><p className="text-xl font-black">{report.linkedinOutreach || 0}</p></div>
            <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Emails</p><p className="text-xl font-black">{report.emailsSent || 0}</p></div>
            <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Potential</p><p className="text-xl font-black">{report.potentialClients || 0}</p></div>
        </div>
        <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-4"><div className="p-3 bg-green-600 text-white rounded-xl"><DollarSign className="size-5" /></div><div><p className="text-[10px] font-black uppercase text-green-700">Revenue</p><p className="text-2xl font-black text-green-900">{report.currency || 'INR'} {report.collectedRevenue || 0}</p></div></div>
        </div>
    </div>
);

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
  const [myRecentReports, setMyRecentReports] = React.useState<any[]>([]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isLeadOrHigher = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'Team Lead';

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users } = useCollection<any>(usersQuery);

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);
  const currentTemplateId = mappingData?.mappings?.[currentUserData?.jobTitle || ''] || 'Business';

  const fetchMyReports = async () => {
    if (!user) return;
    const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(5));
    const snap = await getDocs(q);
    setMyRecentReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  React.useEffect(() => {
    fetchMyReports();
  }, [user, firestore]);

  const form = useForm<any>({
    defaultValues: {
        signature: "", declaration: false, meetingsBookedTomorrow: "0", criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None (Standard)",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", potentialClients: "0", collectedRevenue: "0", currency: "INR",
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
            signature: currentUserData.signatureUrl || "Digital Handshake Verified via Platform Auth",
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
        fetchMyReports();
        setIsAddDialogOpen(false);
    } catch (err) { toast({ variant: 'destructive', title: 'Submission Failed' }); }
  };

  const handleExportPdf = (report: any) => {
    const pdfDoc = new jsPDF();
    const dateStr = formatIST(report.date);
    pdfDoc.setFontSize(18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("FortuMars Strategic Shift Report", 14, 20);
    autoTable(pdfDoc, {
        startY: 30,
        head: [['Strategic Field', 'Recorded Value']],
        body: [['Employee', report.employeeName], ['Designation', report.employeeJobTitle], ['Time', dateStr], ['Type', report.reportType], ['T+1 Path', report.criticalPathTomorrow || 'N/A']],
        theme: 'striped',
        headStyles: { fillColor: [107, 33, 168] }
    });
    if (report.signatureUrl) {
        try {
            const finalY = (pdfDoc as any).lastAutoTable.finalY + 10;
            pdfDoc.addImage(report.signatureUrl, 'PNG', 14, finalY, 40, 20);
        } catch (e) {
            console.warn("Signature image skip due to cross-origin or format issue.");
        }
    }
    pdfDoc.save(`Report_${report.employeeName.replace(/\s/g, '_')}.pdf`);
  };

  const filteredUsers = users?.filter(u => 
    u.id !== user?.uid && 
    (u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader title={isLeadOrHigher ? "Strategic Fleet Log" : "My Shift Log"} description="Comprehensive verification of tactical submissions.">
        <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full h-11 px-6 shadow-lg"><PlusCircle className="mr-2 h-4 w-4"/> Shift Completion Form</Button>
      </PageHeader>
      
      {!isLeadOrHigher && (
          <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><History className="size-4" /> My Recent Tactics</div>
              <div className="grid gap-3">
                  {myRecentReports.map(r => (
                      <Card key={r.id} className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-none ring-1 ring-border/50" onClick={() => setSelectedReportForReview(r)}>
                          <div className="flex items-center gap-4">
                              <div className="p-2 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div>
                              <div>
                                  <p className="font-bold text-sm">{formatIST(r.date)}</p>
                                  <p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Log</p>
                              </div>
                          </div>
                          <ExternalLink className="size-4 opacity-30" />
                      </Card>
                  ))}
                  {myRecentReports.length === 0 && <div className="text-center py-10 bg-muted/20 rounded-3xl border-2 border-dashed"><p className="text-xs font-bold text-muted-foreground">No reports recorded yet.</p></div>}
              </div>
          </div>
      )}

      {isLeadOrHigher && (
        <>
          <div className="relative mb-6"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search staff..." className="pl-10 h-11 rounded-xl bg-white/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="border rounded-2xl overflow-hidden bg-white/50">
            <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Employee</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{filteredUsers?.map(u => (<TableRow key={u.id} className="border-border/50"><TableCell className="font-bold py-4"><Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors flex items-center gap-2">{u.firstName} {u.lastName} <UserCheck className="size-3 text-green-600 opacity-0 group-hover:opacity-100"/></Link></TableCell><TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px]" onClick={() => { setSelectedUser(u); fetchUserReports(u.id); }}>Review Logs</Button></TableCell></TableRow>))}</TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
          <DialogContent className="max-w-2xl rounded-3xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase">Shift History: {selectedUser?.firstName}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4"><div className="space-y-3 py-4">{userReports.map(r => (<Card key={r.id} className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4"><div className="p-2 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div><div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Log</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>))}</div></ScrollArea>
          </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center"><div className="space-y-1"><DialogTitle className="text-xl font-black uppercase tracking-tighter">Tactical Audit Detail</DialogTitle><p className="text-xs font-bold text-muted-foreground">{formatIST(selectedReportForReview?.date)}</p></div><Button onClick={() => handleExportPdf(selectedReportForReview)} size="sm" className="rounded-full font-black uppercase text-[10px] gap-2"><Download className="size-3" /> Export PDF</Button></DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-secondary/10"><div className="space-y-8 pb-10">
                      <div className="grid grid-cols-2 gap-6"><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Reporting Official</p><p className="font-bold">{selectedReportForReview?.employeeName}</p></div><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase">Designation</p><p className="font-bold">{selectedReportForReview?.employeeJobTitle}</p></div></div>
                      <Separator />
                      <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Shift Intelligence</p>
                          {selectedReportForReview?.reportType === 'Business' && <BusinessAuditDetail report={selectedReportForReview} />}
                          {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetail report={selectedReportForReview} />}
                          {selectedReportForReview?.reportType === 'Technical' && (<div className="bg-white p-6 rounded-2xl ring-1 ring-border/50 space-y-4">{selectedReportForReview.completedTasks?.map((t: any, i: number) => (<div key={i} className="pb-4 border-b last:border-none space-y-1"><p className="font-black text-xs uppercase">{t.moduleName}</p><p className="text-sm italic">"{t.workDone}"</p></div>))}</div>)}
                          {(selectedReportForReview?.criticalPathTomorrow || selectedReportForReview?.pendingDeliverables) && (<Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden"><CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Target className="size-4"/> T+1 Objectives</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><div><p className="text-[10px] font-black uppercase text-orange-600">Critical Path</p><p className="text-sm italic">"{selectedReportForReview.criticalPathTomorrow}"</p></div></CardContent></Card>)}
                      </div>
                      <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary">Tactical Verification</p>
                        <div className="bg-white p-8 rounded-3xl ring-1 ring-border/50 flex flex-col items-center text-center space-y-6 shadow-inner">
                            {selectedReportForReview?.signatureUrl ? (
                                <img src={selectedReportForReview.signatureUrl} alt="Approved Signature" className="h-24 object-contain grayscale invert mix-blend-multiply opacity-60" />
                            ) : (
                                <div className="p-6 border-2 border-dashed rounded-2xl text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-muted/10">Digital Identity Asset Not Provisioned</div>
                            )}
                            <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle} • {selectedReportForReview?.employeeDepartment}</p>
                                <Separator className="w-12 mx-auto my-2" />
                                <p className="text-[9px] font-mono text-muted-foreground italic">Timestamp: {formatIST(selectedReportForReview?.date)}</p>
                            </div>
                        </div>
                      </div>
                  </div></ScrollArea>
          </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl"><FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md"><div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><Briefcase className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter">Daily {currentTemplateId} Submission</DialogTitle><DialogDescription className="text-xs font-bold">{formatIST(new Date())}</DialogDescription></div></div></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-8 space-y-8">
                            <div className="space-y-6"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Analytics Template</Label>{currentTemplateId === 'Technical' ? <TechnicalFields /> : currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}</div>
                            <Separator />
                            <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-primary">Tactical Verification</Label><FormField control={form.control} name="signature" render={({ field }) => (<FormItem><FormControl><Input {...field} readOnly className="bg-muted/50 font-mono text-[10px] h-12 rounded-xl cursor-not-allowed font-bold" /></FormControl></FormItem>)} /><FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl><FormLabel className="text-sm font-bold">I certify that all information provided is accurate and my digital handshake is e-signed.</FormLabel></FormItem>)} /></div>
                        </div></ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard</Button><Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px] shadow-lg">Finalize & Submit</Button></DialogFooter></div>
                </form></FormProvider></DialogContent>
      </Dialog>
    </div>
  );
}
