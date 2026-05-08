
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, TrendingUp, Target, Brain, X, Plus, FileText, Briefcase, CheckCircle2, Mic, Loader2, DollarSign, ExternalLink, Download, Clock, Zap, History, UserCheck, Activity, PhoneCall, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, addDoc, getDocs, Timestamp, limit } from "firebase/firestore";
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

/**
 * UTILITY: Format date to IST String
 */
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

/**
 * COMPONENT: Common T+1 Execution Planning
 */
const ExecutionPlanFields = () => {
    const { control } = useFormContext();
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 py-3">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
                    <Target className="size-4" /> 5️⃣ Pipeline & Planning (T+1)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="meetingsTomorrow" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Meetings Tomorrow</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Intervention Trigger</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="None">None</SelectItem>
                                    <SelectItem value="Manager Input Required">Manager Input Required</SelectItem>
                                    <SelectItem value="Resource Blocked">Resource Blocked</SelectItem>
                                    <SelectItem value="Client Risk Detected">Client Risk Detected</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
                <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Pending Deliverables</FormLabel>
                        <FormControl><Textarea {...field} placeholder="List items requiring attention..." className="rounded-xl min-h-[80px]" /></FormControl>
                    </FormItem>
                )} />
                <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">T+1 Critical Path Action</FormLabel>
                        <FormControl><Textarea {...field} placeholder="The single most important objective for tomorrow." className="rounded-xl min-h-[80px]" /></FormControl>
                    </FormItem>
                )} />
            </CardContent>
        </Card>
    );
};

/**
 * COMPONENT: Business Intelligence Fields (Core)
 */
const BusinessFields = ({ isNested = false }: { isNested?: boolean }) => {
    const { control } = useFormContext();
    return (
        <div className="space-y-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Conversion</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField control={control} name="coldCalls" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="linkedinOutreach" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="emailsSent" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Emails</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="followUps" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Follow-ups</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                    <FormField control={control} name="potentialClients" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Potential Clients Identified</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="revenueCollected" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">NET Revenue Collected</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="committedRevenue" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Committed NET Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="pipelineValue" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Pipeline Value</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="revenueVariance" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Revenue Variance Reason</FormLabel><FormControl><Input {...field} placeholder="NIL" className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Activity className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="quotationsReleased" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Quotations Released</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="meetingsSecured" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Meetings Secured</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                    <FormField control={control} name="clientWin" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Client Win Highlight</FormLabel><FormControl><Textarea {...field} placeholder="NIL" className="rounded-xl min-h-[60px]" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="strategicLearning" render={({ field }) => (
                        <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Strategic Learning</FormLabel><FormControl><Textarea {...field} placeholder="NIL" className="rounded-xl min-h-[60px]" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><PhoneCall className="size-4" /> 4️⃣ Call Intelligence Log</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={control} name="bestCallRecording" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-bold">Best Call (URL)</FormLabel><FormControl><Input {...field} placeholder="Link to recording..." className="rounded-xl h-10" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="worstCallRecording" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-bold">Worst Call (URL)</FormLabel><FormControl><Input {...field} placeholder="Link to recording..." className="rounded-xl h-10" /></FormControl></FormItem>
                        )} />
                    </div>
                    <FormField control={control} name="totalCallRecordings" render={({ field }) => (
                        <FormItem><FormLabel className="text-[9px] uppercase font-bold">Total Recordings Folder (URL)</FormLabel><FormControl><Input {...field} placeholder="Google Drive Link..." className="rounded-xl h-10" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            {!isNested && <ExecutionPlanFields />}
        </div>
    );
};

/**
 * COMPONENT: Digital Marketing Hybrid Template
 */
const DigitalMarketingFields = () => {
    const { control } = useFormContext();
    const deliverables = [
        { label: 'Content', key: 'dmContent' }, 
        { label: 'Poster', key: 'dmPoster' }, 
        { label: 'Reel', key: 'dmReel' }, 
        { label: 'Shoot', key: 'dmShoot' }
    ];

    return (
        <div className="space-y-8">
            <BusinessFields isNested />
            
            <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest">Marketing Pipeline Intelligence Matrix</CardTitle></CardHeader>
                <CardContent className="pt-6">
                    <div className="border rounded-2xl overflow-hidden bg-white/50">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase py-4">Status</TableHead>
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

/**
 * COMPONENT: Technical Sprint Template
 */
const TechnicalFields = () => {
    const { control, setValue } = useFormContext();
    const tasks = useWatch({ control, name: "completedTasks" }) || [];
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
                <FormField control={control} name="logInTime" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Shift Log-In</FormLabel>
                        <FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl>
                    </FormItem>
                )} />
                <FormField control={control} name="logOutTime" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Shift Log-Out</FormLabel>
                        <FormControl><Input type="time" {...field} className="rounded-xl h-11" /></FormControl>
                    </FormItem>
                )} />
            </div>
            <div className="space-y-4">
                <p className="font-black text-[10px] text-primary uppercase tracking-widest flex items-center gap-2"><Brain className="size-4" /> Technical Sprint Modules:</p>
                {tasks.map((_, i: number) => (
                    <Card key={i} className="relative group bg-white/50 border rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-red-600" onClick={() => setValue('completedTasks', tasks.filter((_:any, idx:number) => idx !== i))}><X className="size-4" /></Button>
                        <FormField control={control} name={`completedTasks.${i}.moduleName`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Module Identification</FormLabel>
                                <FormControl><Input {...field} className="rounded-xl" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={control} name={`completedTasks.${i}.workDone`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Implementation Detail</FormLabel>
                                <FormControl><Textarea {...field} className="rounded-xl min-h-[60px]" /></FormControl>
                            </FormItem>
                        )} />
                    </Card>
                ))}
                <Button type="button" variant="outline" onClick={() => setValue('completedTasks', [...tasks, { moduleName: "", workDone: "" }])} className="w-full border-dashed rounded-2xl h-16 bg-white/50 text-xs font-black uppercase"><Plus className="size-4 mr-2" /> Add Development Module</Button>
            </div>
            <ExecutionPlanFields />
        </div>
    );
};

/**
 * COMPONENT: Report Detail Visualization (Audit View)
 */
const BusinessAuditDetail = ({ report, isNested = false }: { report: any, isNested?: boolean }) => {
    const totalOutreach = Number(report.coldCalls || 0) + Number(report.linkedinOutreach || 0) + Number(report.emailsSent || 0) + Number(report.followUps || 0);
    const potential = Number(report.potentialClients || 0);
    const efficiency = totalOutreach > 0 ? ((potential / totalOutreach) * 100).toFixed(2) : "0.00";

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Conversion</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Total Outreach</p><p className="text-xl font-black">{totalOutreach}</p></div>
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Potential Clients</p><p className="text-xl font-black">{potential}</p></div>
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Efficiency Rate</p><p className="text-xl font-black text-primary">{efficiency}%</p></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-muted/10 rounded-xl text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">Calls</p><p className="text-sm font-black">{report.coldCalls || 0}</p></div>
                    <div className="p-3 bg-muted/10 rounded-xl text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">LinkedIn</p><p className="text-sm font-black">{report.linkedinOutreach || 0}</p></div>
                    <div className="p-3 bg-muted/10 rounded-xl text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">Emails</p><p className="text-sm font-black">{report.emailsSent || 0}</p></div>
                    <div className="p-3 bg-muted/10 rounded-xl text-center"><p className="text-[8px] font-bold text-muted-foreground uppercase">Follow-ups</p><p className="text-sm font-black">{report.followUps || 0}</p></div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-black uppercase text-[10px] tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue & Financial Impact</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">NET Collected</p><p className="text-xl font-black text-green-900">${report.revenueCollected || 0}</p></div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Committed NET</p><p className="text-xl font-black text-green-900">${report.committedRevenue || 0}</p></div>
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50"><p className="text-[9px] font-black uppercase text-muted-foreground">Pipeline Value</p><p className="text-xl font-black">${report.pipelineValue || 0}</p></div>
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50"><p className="text-[9px] font-black uppercase text-muted-foreground">Revenue Variance</p><p className="text-sm font-bold truncate">{report.revenueVariance || 'NIL'}</p></div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><ShieldCheck className="size-4" /> 3️⃣ High-Value Engagements</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Quotations Released</p><p className="text-lg font-black">{report.quotationsReleased || 0}</p></div>
                    <div className="p-4 bg-white rounded-2xl ring-1 ring-border/50 text-center"><p className="text-[9px] font-black uppercase text-muted-foreground">Meetings Secured</p><p className="text-lg font-black">{report.meetingsSecured || 0}</p></div>
                </div>
                <div className="p-4 bg-muted/5 rounded-xl border border-dashed"><p className="text-[9px] font-black uppercase text-primary mb-1">Win Highlight</p><p className="text-sm italic">"{report.clientWin || 'NIL'}"</p></div>
                <div className="p-4 bg-muted/5 rounded-xl border border-dashed"><p className="text-[9px] font-black uppercase text-primary mb-1">Strategic Learning</p><p className="text-sm italic">"{report.strategicLearning || 'NIL'}"</p></div>
            </div>

            <div className="p-4 bg-primary/5 rounded-2xl space-y-3">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4" /> 4️⃣ Call Intelligence Log</p>
                <div className="grid gap-2">
                    {report.bestCallRecording && <Button variant="link" className="h-auto p-0 text-xs justify-start gap-2" asChild><Link href={report.bestCallRecording} target="_blank"><ExternalLink className="size-3" /> Best Call Recording</Link></Button>}
                    {report.worstCallRecording && <Button variant="link" className="h-auto p-0 text-xs justify-start gap-2" asChild><Link href={report.worstCallRecording} target="_blank"><ExternalLink className="size-3" /> Worst Call Recording</Link></Button>}
                    {report.totalCallRecordings && <Button variant="outline" className="h-9 text-[10px] uppercase font-bold rounded-xl bg-white w-full" asChild><Link href={report.totalCallRecordings} target="_blank"><Download className="size-3 mr-2" /> Open Total Records Folder</Link></Button>}
                </div>
            </div>
        </div>
    );
};

const MarketingAuditDetail = ({ report }: { report: any }) => {
    const deliverables = [
        { label: 'Content', key: 'dmContent' }, 
        { label: 'Poster', key: 'dmPoster' }, 
        { label: 'Reel', key: 'dmReel' }, 
        { label: 'Shoot', key: 'dmShoot' }
    ];
    return (
        <div className="space-y-6">
            <BusinessAuditDetail report={report} isNested />
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                            {deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {['Approved', 'Pending', 'Rejected'].map(status => (
                            <TableRow key={status}>
                                <TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>
                                {deliverables.map(d => (
                                    <TableCell key={d.key} className="text-center font-bold">{report[`${d.key}${status}`] || 0}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

/**
 * MAIN PAGE: Reports Dashboard
 */
export default function ReportsPage() {
  const { user } = useUser();
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
    const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(10));
    const snap = await getDocs(q);
    setMyRecentReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  React.useEffect(() => {
    fetchMyReports();
  }, [user, firestore]);

  const form = useForm<any>({
    defaultValues: {
        meetingsTomorrow: "0", criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", followUps: "0", potentialClients: "0", 
        revenueCollected: "0", committedRevenue: "0", pipelineValue: "0", revenueVariance: "NIL",
        quotationsReleased: "0", meetingsSecured: "0", clientWin: "NIL", strategicLearning: "NIL",
        bestCallRecording: "", worstCallRecording: "", totalCallRecordings: "https://drive.google.com/drive/folders/13M3L_52j1ceP1QlXHoBEty5rAowdFVtm",
        completedTasks: [], logInTime: "", logOutTime: "",
        dmContentApproved: "0", dmContentPending: "0", dmContentRejected: "0",
        dmPosterApproved: "0", dmPosterPending: "0", dmPosterRejected: "0",
        dmReelApproved: "0", dmReelPending: "0", dmReelRejected: "0",
        dmShootApproved: "0", dmShootPending: "0", dmShootRejected: "0",
        declaration: false
    },
  });

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
              </div>
          </div>
      )}

      {isLeadOrHigher && (
        <>
          <div className="relative mb-6"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search staff members..." className="pl-10 h-11 rounded-xl bg-white/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="border rounded-2xl overflow-hidden bg-white/50 shadow-sm">
            <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Fleet Official</TableHead><TableHead className="text-[10px] font-black uppercase">Role</TableHead><TableHead className="text-[10px] font-black uppercase text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>{users?.filter(u => u.firstName?.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (<TableRow key={u.id} className="border-border/50 hover:bg-muted/5 transition-colors"><TableCell className="font-bold py-4"><Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors flex items-center gap-2">{u.firstName} {u.lastName}</Link></TableCell><TableCell className="text-[10px] font-black uppercase text-muted-foreground">{u.jobTitle}</TableCell><TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px]" onClick={async () => { setSelectedUser(u); const q = query(collection(firestore, `users/${u.id}/reports`), orderBy('date', 'desc')); const snap = await getDocs(q); setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }}>Review Intelligence</Button></TableCell></TableRow>))}</TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
          <DialogContent className="max-w-2xl rounded-3xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Tactical History: {selectedUser?.firstName}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4"><div className="space-y-3 py-4">{userReports.map(r => (<Card key={r.id} className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-none ring-1 ring-border/10" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4"><div className="p-2 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div><div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Log</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>))}</div></ScrollArea>
          </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-3xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
              <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center">
                  <div className="space-y-1">
                      <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Audit Detail</DialogTitle>
                      <p className="text-xs font-bold text-muted-foreground">{formatIST(selectedReportForReview?.date)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{selectedReportForReview?.reportType}</Badge>
              </DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-secondary/10">
                  <div className="space-y-8 pb-10">
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reporting Official</p><p className="font-bold text-lg">{selectedReportForReview?.employeeName}</p></div>
                          <div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Designation</p><p className="font-bold text-lg">{selectedReportForReview?.employeeJobTitle}</p></div>
                      </div>
                      <Separator />
                      
                      {selectedReportForReview?.reportType === 'Business' && <BusinessAuditDetail report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetail report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Technical' && (
                          <div className="bg-white p-6 rounded-2xl ring-1 ring-border/50 space-y-4 shadow-sm">
                              {selectedReportForReview.completedTasks?.map((t: any, i: number) => (
                                  <div key={i} className="pb-4 border-b last:border-none space-y-1">
                                      <p className="font-black text-xs uppercase text-primary">{t.moduleName}</p>
                                      <p className="text-sm italic text-muted-foreground">"{t.workDone}"</p>
                                  </div>
                              ))}
                          </div>
                      )}

                      <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm">
                          <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Target className="size-4"/> 5️⃣ Pipeline & Planning (T+1)</CardTitle></CardHeader>
                          <CardContent className="pt-6 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Meetings Tomorrow</p><p className="font-black">{selectedReportForReview?.meetingsTomorrow || 0}</p></div>
                                  <div><p className="text-[9px] font-bold text-muted-foreground uppercase">Intervention</p><p className={cn("font-black", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-green-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div>
                              </div>
                              <div><p className="text-[10px] font-black uppercase text-orange-600 mb-1">Critical Path</p><p className="text-sm italic">"{selectedReportForReview?.criticalPathTomorrow || 'NIL'}"</p></div>
                              {selectedReportForReview?.pendingDeliverables && <div><p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Pending Deliverables</p><p className="text-sm italic">"{selectedReportForReview.pendingDeliverables}"</p></div>}
                          </CardContent>
                      </Card>

                      <div className="pt-10 flex flex-col items-center text-center space-y-6">
                          <div className="h-20 w-48 border-b-2 border-dashed border-primary/20 flex flex-col items-center justify-center opacity-60">
                              {selectedReportForReview?.signatureUrl ? (
                                  <img src={selectedReportForReview.signatureUrl} alt="E-Signature" className="h-16 object-contain grayscale invert mix-blend-multiply" />
                              ) : (
                                  <span className="font-mono text-[10px] italic">Digital Handshake via Platform</span>
                              )}
                          </div>
                          <div className="space-y-1">
                              <p className="text-sm font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle} • {selectedReportForReview?.employeeDepartment}</p>
                              <Separator className="w-10 mx-auto my-2" />
                              <p className="text-[8px] font-mono text-muted-foreground italic">Submitted {formatIST(selectedReportForReview?.date)}</p>
                          </div>
                      </div>
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl"><FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md"><div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><Briefcase className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter">Daily {currentTemplateId} Submission</DialogTitle><DialogDescription className="text-xs font-bold">{formatIST(new Date())}</DialogDescription></div></div></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-8 space-y-8">
                            <div className="space-y-6"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Analytics Template</Label>{currentTemplateId === 'Technical' ? <TechnicalFields /> : currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}</div>
                            <Separator />
                            <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-primary">Strategic Handshake</Label><FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl><FormLabel className="text-sm font-bold">I certify that this submission represents a verified and accurate account of my tactical shift output.</FormLabel></FormItem>)} /></div>
                        </div></ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard Log</Button><Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px] shadow-lg shadow-primary/20">Finalize Intelligence</Button></DialogFooter></div>
                </form></FormProvider></DialogContent>
      </Dialog>
    </div>
  );
}
