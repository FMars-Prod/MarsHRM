
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
import { collection, query, where, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
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

/**
 * DISPLAY COMPONENTS
 */
const ReportDetailItem = ({ label, value, children, className }: { label: string, value?: React.ReactNode, children?: React.ReactNode, className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{label}</p>
    <div className="font-semibold whitespace-pre-wrap text-sm text-foreground">
        {(!value && !children && value !== 0) ? <span className="text-muted-foreground/50 italic font-normal">NIL</span> : (value ?? children)}
    </div>
  </div>
);

const VerificationSection = ({ report, userProfile }: { report: any, userProfile: any }) => {
    const submittedAt = report.date?.toDate ? formatIST(report.date.toDate()) : "N/A";
    return (
        <Card className="bg-secondary/10 border-none ring-1 ring-border/50 overflow-hidden rounded-2xl">
            <CardHeader className="bg-muted/10 py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                    <ShieldCheck className="size-3" /> Tactical Verification
                </CardTitle>
                <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase">
                    <Clock className="size-2.5" /> IST: {submittedAt}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="p-4 bg-white/50 rounded-xl border border-dashed border-primary/20 flex items-center justify-center">
                            {userProfile?.signatureUrl ? (
                                <img src={userProfile.signatureUrl} alt="Verified Signature" className="h-16 object-contain grayscale invert mix-blend-multiply opacity-70" />
                            ) : (
                                <div className="text-[9px] font-black uppercase text-muted-foreground/30">Signature Not Provisioned</div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Strategic E-Signature</p>
                            <p className="text-[8px] text-muted-foreground mt-1 font-mono">{report.signature}</p>
                        </div>
                    </div>
                    <div className="space-y-4 flex flex-col justify-center">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reporting Identity</p>
                            <p className="font-bold text-sm">{report.employeeName}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Designation & Unit</p>
                            <p className="text-xs font-medium">{userProfile?.jobTitle} • {userProfile?.department}</p>
                        </div>
                        <div className="pt-2">
                            <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[8px] font-black uppercase gap-1">
                                <CheckCircle2 className="size-2.5" /> Authenticated Submission
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const ExecutionPlanView = ({ report }: { report: any }) => (
    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">🚀 T+1 Execution Planning</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 text-sm">
            <ReportDetailItem label="Meetings/Events Booked (Tomorrow)" value={report.meetingsBookedTomorrow} />
            <ReportDetailItem label="Critical Path Priority" value={report.criticalPathTomorrow} />
            <ReportDetailItem label="Pending Strategic Deliverables" value={report.pendingDeliverables} />
            <ReportDetailItem label="Leadership Intervention Trigger" value={report.interventionTrigger} className={report.interventionTrigger !== 'None (Standard)' ? 'text-red-600 font-black' : ''} />
        </CardContent>
    </Card>
);

const BusinessReportCards = ({ report }: { report: any }) => {
    const mainSym = getCurrencySymbol(report.currency || 'USD');
    const outreachTotal = (Number(report.coldCalls) || 0) + (Number(report.linkedinOutreach) || 0) + (Number(report.emailsSent) || 0);
    const efficiencyRaw = outreachTotal > 0 ? ((Number(report.potentialClients) || 0) / outreachTotal) * 100 : 0;
    const efficiency = Math.min(efficiencyRaw, 100);

    return (
        <>
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-3" /> 1️⃣ Outreach Analytics</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
                    <ReportDetailItem label="Cold Calls" value={report.coldCalls || 0} />
                    <ReportDetailItem label="LinkedIn" value={report.linkedinOutreach || 0} />
                    <ReportDetailItem label="Emails" value={report.emailsSent || 0} />
                    <ReportDetailItem label="Potential Clients" value={report.potentialClients || 0} />
                    <div className="col-span-2 p-3 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center">
                        <ReportDetailItem label="Total Volume" value={outreachTotal} />
                        <ReportDetailItem label="Efficiency" value={`${efficiency.toFixed(2)}%`} className="text-right" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Target className="size-3" /> 2️⃣ Financial Impact ({report.currency})</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
                    <ReportDetailItem label="Collected Revenue" value={`${mainSym}${report.collectedRevenue?.toLocaleString() ?? 0}`} />
                    <ReportDetailItem label="Committed Revenue" value={`${mainSym}${report.committedRevenue?.toLocaleString() ?? 0}`} />
                    <ReportDetailItem label="Pipeline Value" value={`${mainSym}${report.pipelineValue?.toLocaleString() ?? 0}`} />
                    <ReportDetailItem label="Variance" value={`${mainSym}${report.revenueVariance?.toLocaleString() ?? 0}`} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Briefcase className="size-3" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6 text-sm">
                    <ReportDetailItem label="Follow-ups Completed" value={report.followUpsCompleted || "0"} />
                    <ReportDetailItem label="Meetings Secured" value={report.meetingsSecured} />
                    <ReportDetailItem label="Client Win Highlight" value={report.clientWinHighlight} />
                    <ReportDetailItem label="Strategic Tactical Learning" value={report.strategicLearning} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Mic className="size-3" /> 4️⃣ Recording Audit</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Best Call Recording</p>
                            {report.bestCallRecording ? (
                                <audio controls className="w-full h-8" src={report.bestCallRecording} />
                            ) : <span className="text-xs text-muted-foreground italic">No recording uploaded</span>}
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Worst Call Recording</p>
                            {report.worstCallRecording ? (
                                <audio controls className="w-full h-8" src={report.worstCallRecording} />
                            ) : <span className="text-xs text-muted-foreground italic">No recording uploaded</span>}
                        </div>
                    </div>
                    {report.allCallsDriveLink && (
                        <div className="pt-4 border-t border-border/50">
                            <ReportDetailItem label="Today's All Call Recording (Drive)" value={
                                <a href={report.allCallsDriveLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5">
                                    <LinkIcon className="size-3" />
                                    View Archive
                                    <ExternalLink className="size-2.5" />
                                </a>
                            } />
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
};

const BusinessReportDetails = ({ report, userProfile }: { report: any, userProfile: any }) => (
    <div className="space-y-6">
        <BusinessReportCards report={report} />
        <ExecutionPlanView report={report} />
        <VerificationSection report={report} userProfile={userProfile} />
    </div>
);

const DigitalMarketingReportDetails = ({ report, userProfile }: { report: any, userProfile: any }) => {
    const deliverables = [
        { label: 'Content', key: 'dmContent' },
        { label: 'Posters', key: 'dmPosters' },
        { label: 'Reels', key: 'dmReels' },
        { label: 'Shoots', key: 'dmShoots' }
    ];

    const getVal = (status: string, key: string) => Number(report[`${key}${status}`] || 0);

    return (
        <div className="space-y-6">
            <BusinessReportCards report={report} />
            
            <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-3" /> Marketing Pipeline Intelligence</CardTitle></CardHeader>
                <CardContent className="pt-4">
                    <div className="border rounded-xl overflow-hidden bg-white/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Status</TableHead>
                                    {deliverables.map(d => <TableHead key={d.key} className="text-[9px] font-black uppercase tracking-widest text-center">{d.label}</TableHead>)}
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-center bg-purple-50">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {['Approved', 'Pending', 'Rejected'].map(status => {
                                    const rowTotal = deliverables.reduce((acc, d) => acc + getVal(status, d.key), 0);
                                    return (
                                        <TableRow key={status} className="border-border/50">
                                            <TableCell className="text-xs font-bold uppercase">{status}</TableCell>
                                            {deliverables.map(d => (
                                                <TableCell key={d.key} className="text-center text-xs font-medium">{getVal(status, d.key)}</TableCell>
                                            ))}
                                            <TableCell className="text-center text-xs font-black bg-purple-50/50 text-purple-700">{rowTotal}</TableCell>
                                        </TableRow>
                                    )
                                })}
                                <TableRow className="bg-muted/20 border-t-2 font-black">
                                    <TableCell className="text-xs uppercase">Total</TableCell>
                                    {deliverables.map(d => {
                                        const colTotal = ['Approved', 'Pending', 'Rejected'].reduce((acc, s) => acc + getVal(s, d.key), 0);
                                        return <TableCell key={d.key} className="text-center text-xs">{colTotal}</TableCell>
                                    })}
                                    <TableCell className="text-center text-xs bg-purple-100 text-purple-900">
                                        {deliverables.reduce((acc, d) => acc + ['Approved', 'Pending', 'Rejected'].reduce((sum, s) => sum + getVal(s, d.key), 0), 0)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ExecutionPlanView report={report} />
            <VerificationSection report={report} userProfile={userProfile} />
        </div>
    );
};

const TechnicalReportDetails = ({ report, userProfile }: { report: any, userProfile: any }) => (
  <div className="space-y-6">
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
    <ExecutionPlanView report={report} />
    <VerificationSection report={report} userProfile={userProfile} />
  </div>
);

const CustomReportDetails = ({ report, userProfile }: { report: any, userProfile: any }) => (
    <div className="space-y-6">
        <Card className="bg-white/50 border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Beaker className="size-3"/> Custom Metrics Log</CardTitle></CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(report).map(([key, value]) => {
                    if (['id', 'employeeId', 'employeeName', 'employeeDepartment', 'date', 'reportType', 'signature', 'declaration', 'meetingsBookedTomorrow', 'criticalPathTomorrow', 'pendingDeliverables', 'interventionTrigger'].includes(key)) return null;
                    return <ReportDetailItem key={key} label={key.replace(/([A-Z])/g, ' $1').toUpperCase()} value={String(value)} />;
                })}
            </CardContent>
        </Card>
        <ExecutionPlanView report={report} />
        <VerificationSection report={report} userProfile={userProfile} />
    </div>
);

/**
 * FORM SUB-COMPONENTS
 */
const ExecutionPlanFields = () => {
    const { control } = useFormContext();
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 🚀 T+1 Execution Planning</CardTitle></CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="meetingsBookedTomorrow" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold">Meetings Booked Tomorrow</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold">Manager Intervention Trigger</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="None (Standard)">None (Standard)</SelectItem><SelectItem value="Manager Input Required">Manager Input Required</SelectItem><SelectItem value="Resource Blocked">Resource Blocked</SelectItem><SelectItem value="Client Risk Detected">Client Risk Detected</SelectItem></SelectContent></Select></FormItem>
                    )} />
                </div>
                <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Top Priority / Critical Path</FormLabel><FormControl><Textarea {...field} placeholder="What is the single most important task for tomorrow?" className="rounded-xl" /></FormControl></FormItem>
                )} />
                <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] uppercase font-bold">Pending Strategic Deliverables</FormLabel><FormControl><Textarea {...field} placeholder="List items that need final completion..." className="rounded-xl" /></FormControl></FormItem>
                )} />
            </CardContent>
        </Card>
    );
};

const BusinessFields = ({ isNested = false }: { isNested?: boolean }) => {
    const { control } = useFormContext();
    const coldCalls = Number(useWatch({ control, name: "coldCalls" }) || 0);
    const linkedIn = Number(useWatch({ control, name: "linkedinOutreach" }) || 0);
    const emails = Number(useWatch({ control, name: "emailsSent" }) || 0);
    const totalOutreach = coldCalls + linkedIn + emails;
    const potential = Number(useWatch({ control, name: "potentialClients" }) || 0);
    const efficiency = totalOutreach > 0 ? Math.min((potential / totalOutreach) * 100, 100) : 0;

    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Outreach Analytics</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={control} name="coldCalls" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Cold Calls</Label><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="linkedinOutreach" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="emailsSent" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Emails Sent</Label><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-primary/5 rounded-2xl border flex flex-col items-center gap-1"><p className="text-[10px] font-black text-primary/70 uppercase">Total Outreach</p><p className="text-2xl font-black text-primary">{totalOutreach}</p></div>
                        <FormField control={control} name="potentialClients" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Potential Clients</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                    <div className="flex justify-center p-3 bg-green-50 rounded-xl border border-green-200">
                        <p className="text-xs font-black text-green-700 uppercase tracking-widest">Efficiency: {efficiency.toFixed(2)}%</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Financial Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="currency" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold">Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="AED">AED (د.إ)</SelectItem></SelectContent></Select></FormItem>
                        )} />
                        <FormField control={control} name="collectedRevenue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Collected Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={control} name="committedRevenue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Committed Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="pipelineValue" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Pipeline Value</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                        <FormField control={control} name="revenueVariance" render={({ field }) => (<FormItem><FormLabel className="text-[10px] uppercase font-bold">Revenue Variance</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>)} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Mic className="size-4" /> 3️⃣ Call Quality Audit</CardTitle></CardHeader>
                <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Best Call Record</Label>
                            <FileUploadButton fieldName="bestCallRecording" />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Worst Call Record</Label>
                            <FileUploadButton fieldName="worstCallRecording" />
                        </div>
                    </div>
                    <FormField control={control} name="allCallsDriveLink" render={({ field }) => (
                      <FormItem><FormLabel className="text-[10px] uppercase font-bold">All Calls Archive (Drive Link)</FormLabel><FormControl><Input {...field} placeholder="https://drive.google.com/..." className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            {!isNested && <ExecutionPlanFields />}
        </div>
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
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <Input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="text-xs h-9 bg-white" disabled={uploading} />
            {uploading && <Loader2 className="size-4 animate-spin text-primary" />}
            {getValues(fieldName) && <CheckCircle2 className="size-4 text-green-600" />}
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
              <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest"><LayoutTemplate className="size-4" /> 4️⃣ Tactical Output Matrix</CardTitle></CardHeader>
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
    const { control, getValues, setValue } = useFormContext();
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
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 text-red-600" onClick={() => {
                            setValue('completedTasks', tasks.filter((_:any, idx:number) => idx !== i));
                        }}><X className="size-4" /></Button>
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
                                <FormItem><FormLabel className="text-[10px] font-bold uppercase">{field.label}</FormLabel><FormControl>{field.type === 'textarea' ? <Textarea {...formField} className="rounded-xl" /> : field.type === 'number' ? <Input type="number" min="0" {...formField} className="rounded-xl h-11" /> : <Input {...formField} className="rounded-xl h-11" />}</FormControl></FormItem>
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
 * MAIN PAGE COMPONENT
 */
const commonSchema = {
  declaration: z.literal<boolean>(true, { errorMap: () => ({ message: "Certification required." }) }),
  signature: z.string().min(1, "Signature is required."),
  meetingsBookedTomorrow: z.string().default("0"),
  criticalPathTomorrow: z.string().default(""),
  pendingDeliverables: z.string().default(""),
  interventionTrigger: z.enum(["None (Standard)", "Manager Input Required", "Resource Blocked", "Client Risk Detected"]).default("None (Standard)"),
};

const businessReportSchema = z.object({
  ...commonSchema,
  coldCalls: z.coerce.number().min(0).default(0),
  linkedinOutreach: z.coerce.number().min(0).default(0),
  emailsSent: z.coerce.number().min(0).default(0),
  potentialClients: z.coerce.number().min(0).default(0),
  followUpsCompleted: z.string().default("0"),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AED"]).default("USD"),
  collectedRevenue: z.coerce.number().min(0).default(0),
  committedRevenue: z.coerce.number().min(0).default(0),
  pipelineValue: z.coerce.number().min(0).default(0),
  revenueVariance: z.coerce.number().min(0).default(0),
  meetingsSecured: z.string().default(""),
  clientWinHighlight: z.string().default(""),
  strategicLearning: z.string().default(""),
  bestCallRecording: z.string().optional(),
  worstCallRecording: z.string().optional(),
  allCallsDriveLink: z.string().optional(),
});

const digitalMarketingReportSchema = businessReportSchema.extend({
  dmContentApproved: z.coerce.number().min(0).default(0),
  dmContentPending: z.coerce.number().min(0).default(0),
  dmContentRejected: z.coerce.number().min(0).default(0),
  dmPostersApproved: z.coerce.number().min(0).default(0),
  dmPostersPending: z.coerce.number().min(0).default(0),
  dmPostersRejected: z.coerce.number().min(0).default(0),
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
  const userRole = currentUserData?.role;
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';
  const isLeadOrHigher = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'Team Lead';

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);

  const currentTemplateId = React.useMemo(() => {
      const jobTitle = currentUserData?.jobTitle || '';
      return mappingData?.mappings?.[jobTitle] || 'Business';
  }, [currentUserData?.jobTitle, mappingData]);

  const customTemplateDocRef = useMemoFirebase(() => currentTemplateId && !['Business', 'Technical', 'Digital Marketing'].includes(currentTemplateId) ? doc(firestore, 'custom_report_definitions', currentTemplateId) : null, [firestore, currentTemplateId]);
  const { data: customTemplateData } = useDoc<any>(customTemplateDocRef);

  const usersQuery = useMemoFirebase(() => (isLeadOrHigher && user) ? query(collection(firestore, "users")) : null, [firestore, isLeadOrHigher, user]);
  const { data: usersData } = useCollection<any>(usersQuery);

  const reportUserId = isLeadOrHigher ? selectedUser?.id : user?.uid;
  const reportsQuery = useMemoFirebase(() => reportUserId ? query(collection(firestore, `users/${reportUserId}/reports`), orderBy('date', 'desc')) : null, [firestore, reportUserId]);
  const { data: rawReports, isLoading: areReportsLoading } = useCollection<any>(reportsQuery);
  const reports = rawReports?.filter(r => r.reportType && r.employeeId);

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
      const signatureStr = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName} | ${currentUserData.employmentType || "Intern"} | ${formatIST(now)}` : "";
      
      const baseValues = { 
          signature: signatureStr, 
          declaration: false,
          meetingsBookedTomorrow: "0",
          criticalPathTomorrow: "",
          pendingDeliverables: "",
          interventionTrigger: "None (Standard)"
      };

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
              currency: "USD", coldCalls: 0, linkedinOutreach: 0, emailsSent: 0, potentialClients: 0, followUpsCompleted: "0", 
              collectedRevenue: 0, committedRevenue: 0, pipelineValue: 0, revenueVariance: 0,
              meetingsSecured: "", clientWinHighlight: "", strategicLearning: "", bestCallRecording: "", worstCallRecording: "", allCallsDriveLink: "",
              ...(currentTemplateId === 'Digital Marketing' ? {
                  dmContentApproved: 0, dmContentPending: 0, dmContentRejected: 0,
                  dmPostersApproved: 0, dmPostersPending: 0, dmPostersRejected: 0,
                  dmReelsApproved: 0, dmReelsPending: 0, dmReelsRejected: 0,
                  dmShootsApproved: 0, dmShootsPending: 0, dmShootsRejected: 0
              } : {})
          });
      } else {
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
                toast({ variant: 'destructive', title: 'Submission Failed' });
            }
        },
        () => { setIsVerifyingLocation(false); toast({ variant: 'destructive', title: 'GPS Verification Failed' }); },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDownloadReport = (r: any) => {
    const pdfDoc = new jsPDF();
    const dateStr = r.date?.toDate ? format(r.date.toDate(), 'PPP') : 'N/A';
    
    pdfDoc.setFontSize(16);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("FortuMars Strategic Report", 14, 20);
    
    pdfDoc.setFontSize(10);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text(`Employee: ${r.employeeName}`, 14, 30);
    pdfDoc.text(`Report Type: ${r.reportType}`, 14, 35);
    pdfDoc.text(`Date: ${dateStr}`, 14, 40);
    pdfDoc.text(`Department: ${r.employeeDepartment || 'N/A'}`, 14, 45);

    let startY = 55;

    if (r.reportType === 'Digital Marketing') {
        const deliverables = [
            { label: 'Content', key: 'dmContent' },
            { label: 'Posters', key: 'dmPosters' },
            { label: 'Reels', key: 'dmReels' },
            { label: 'Shoots', key: 'dmShoots' }
        ];

        const getVal = (s: string, k: string) => Number(r[`${k}${s}`] || 0);

        const body = ['Approved', 'Pending', 'Rejected'].map(status => {
            const row = [status];
            deliverables.forEach(d => row.push(getVal(status, d.key).toString()));
            const rowTotal = deliverables.reduce((acc, d) => acc + getVal(status, d.key), 0);
            row.push(rowTotal.toString());
            return row;
        });

        autoTable(pdfDoc, {
            startY,
            head: [['Status', 'Content', 'Posters', 'Reels', 'Shoots', 'Total']],
            body,
            theme: 'grid'
        });
        startY = (pdfDoc as any).lastAutoTable.finalY + 10;
    }

    pdfDoc.text("T+1 Execution Plan:", 14, startY);
    pdfDoc.text(`- Meetings Booked: ${r.meetingsBookedTomorrow || 0}`, 14, startY + 7);
    pdfDoc.text(`- Critical Path: ${r.criticalPathTomorrow || 'N/A'}`, 14, startY + 14);
    pdfDoc.text(`- Pending Deliverables: ${r.pendingDeliverables || 'N/A'}`, 14, startY + 21);
    pdfDoc.text(`- Trigger: ${r.interventionTrigger || 'None'}`, 14, startY + 28);

    pdfDoc.setFontSize(8);
    pdfDoc.text(`Signature: ${r.signature}`, 14, pdfDoc.internal.pageSize.height - 15);
    pdfDoc.text(`Generated on ${formatIST(new Date())}`, 14, pdfDoc.internal.pageSize.height - 10);

    pdfDoc.save(`${r.employeeName}_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <>
      {isVerifyingLocation && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/80 to-indigo-950/90 backdrop-blur-xl">
            <div className="relative"><div className="h-32 w-32 rounded-full border-4 border-white/10 border-t-purple-400 animate-spin" /><MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-purple-300 animate-pulse" /></div>
            <h2 className="mt-8 text-2xl font-black uppercase tracking-[0.3em] text-white">Verifying Point</h2>
            <div className="mt-10 w-64 h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 animate-progress-loading" /></div>
        </div>
      )}

      <PageHeader title={isLeadOrHigher ? "Organizational Strategic Log" : "My Strategic Submissions"} description="Comprehensive verification of organizational shifts.">
        {!isLeadOrHigher && (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full h-11 px-6 shadow-lg">
                <PlusCircle className="mr-2 h-4 w-4"/> Shift Completion Form
            </Button>
        )}
      </PageHeader>
      
      {isLeadOrHigher ? (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search organizational fleet..." className="pl-10 h-12 rounded-2xl bg-white/50 border-none ring-1 ring-border/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-white/50 ring-1 ring-border/50">
            <Table>
                <TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent border-border/50"><TableHead className="font-black uppercase tracking-tighter text-[10px]">Employee</TableHead><TableHead className="font-black uppercase tracking-tighter text-[10px]">Strategic Log</TableHead><TableHead className="font-black uppercase tracking-tighter text-[10px] text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                    {usersData?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                        <TableRow key={u.id} className="hover:bg-white/80 transition-colors border-border/50">
                            <TableCell className="font-bold py-4">
                                <Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors">{u.firstName} {u.lastName}</Link>
                            </TableCell>
                            <TableCell className="py-4 text-muted-foreground font-medium uppercase text-xs">{u.jobTitle} • {u.department || 'GLOBAL'}</TableCell>
                            <TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px] uppercase" onClick={() => setSelectedUser(u)}>Review Logs</Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
            {areReportsLoading ? (<div className="h-48 flex items-center justify-center animate-pulse uppercase font-black text-xs">Fetching history...</div>) : reports && reports.length > 0 ? (
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
                                {r.reportType === 'Business' ? <BusinessReportDetails report={r} userProfile={currentUserData} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} userProfile={currentUserData} /> : r.reportType === 'Technical' ? <TechnicalReportDetails report={r} userProfile={currentUserData} /> : <CustomReportDetails report={r} userProfile={currentUserData} />}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-3xl border border-dashed"><FileText className="size-10 mb-4 opacity-20" /><p className="font-bold uppercase tracking-widest text-[10px] opacity-50">No submissions found.</p></div>}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-none ring-1 ring-border/50">
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary">{currentTemplateId === 'Technical' ? <Code className="size-6" /> : currentTemplateId === 'Digital Marketing' ? <LayoutTemplate className="size-6" /> : <Briefcase className="size-6" />}</div>
                            <div><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily {currentTemplateId} Submission</DialogTitle><DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{formatIST(new Date())}</DialogDescription></div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8">
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Analytics Template</Label>
                                {currentTemplateId === 'Technical' ? <TechnicalFields /> : currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : currentTemplateId === 'Business' ? <BusinessFields /> : customTemplateData ? <CustomTemplateFields definition={customTemplateData.definition} /> : <BusinessFields />}
                            </div>
                            <Separator />
                            <div className="space-y-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Verification</Label>
                                <FormField control={form.control} name="signature" render={({ field }) => (<FormItem><FormControl><Input {...field} readOnly className="bg-muted/50 font-mono text-[10px] h-12 rounded-xl border-none ring-1 ring-border/50 cursor-not-allowed font-bold" /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="declaration" render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20 shadow-sm">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl>
                                        <div className="space-y-1 leading-none"><FormLabel className="text-sm font-bold cursor-pointer">I certify that all information provided is accurate and complete.</FormLabel></div>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard</Button><Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Finalize Log & Logout</Button></DialogFooter></div>
                </form>
            </FormProvider>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedUser} onOpenChange={isOpen => !isOpen && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-4xl w-full flex flex-col p-0 border-none ring-1 ring-border/50 shadow-2xl rounded-l-3xl">
            <SheetHeader className="p-8 border-b bg-muted/5">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">{selectedUser?.firstName?.[0]}</div>
                    <div><SheetTitle className="text-xl font-black uppercase tracking-tighter text-primary">{selectedUser?.firstName}'s Strategic Log</SheetTitle><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedUser?.jobTitle} • {selectedUser?.department}</p></div>
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
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex gap-2">
                                            {isAdmin && <Button variant="outline" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest h-8" onClick={() => handleDownloadReport(r)}><Download className="h-3 w-3 mr-2" />Download PDF</Button>}
                                            <Button variant="destructive" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest h-8" onClick={() => deleteDoc(doc(firestore, `users/${reportUserId}/reports`, r.id))}><Trash2 className="h-3 w-3 mr-2" />Purge Log</Button>
                                        </div>
                                    </div>
                                    {r.reportType === 'Business' ? <BusinessReportDetails report={r} userProfile={selectedUser} /> : r.reportType === 'Digital Marketing' ? <DigitalMarketingReportDetails report={r} userProfile={selectedUser} /> : r.reportType === 'Technical' ? <TechnicalReportDetails report={r} userProfile={selectedUser} /> : <CustomReportDetails report={r} userProfile={selectedUser} />}
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
