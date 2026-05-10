"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Target, X, Plus, FileText, Briefcase, CheckCircle2, Mic, Loader2, DollarSign, ExternalLink, Download, Clock, Zap, History, Activity, PhoneCall, Link as LinkIcon, ShieldCheck, FileDown, Trash2, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay, startOfDay } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useStorage, useAuth, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, getDocs, Timestamp, limit, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, FormProvider, useFormContext, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

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

const ShiftHeaderFields = () => {
    const { control } = useFormContext();
    return (
        <div className="grid grid-cols-2 gap-6 mb-8">
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
    );
};

const ExecutionPlanFields = () => {
    const { control } = useFormContext();
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden mt-8">
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

const BusinessFields = ({ isNested = false }: { isNested?: boolean }) => {
    const { control, setValue } = useFormContext();
    const storage = useStorage();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [isUploadingBest, setIsUploadingBest] = React.useState(false);
    const [isUploadingWorst, setIsUploadingWorst] = React.useState(false);

    const coldCalls = Number(useWatch({ control, name: 'coldCalls' }) || 0);
    const linkedin = Number(useWatch({ control, name: 'linkedinOutreach' }) || 0);
    const emails = Number(useWatch({ control, name: 'emailsSent' }) || 0);
    const potential = Number(useWatch({ control, name: 'potentialClients' }) || 0);
    
    const totalOutreach = coldCalls + linkedin + emails;
    const efficiency = totalOutreach > 0 ? (potential / totalOutreach) * 100 : 0;

    const handleAudioUpload = async (file: File, fieldName: string, setUploading: (v: boolean) => void) => {
        if (!user || !storage) return;
        setUploading(true);
        try {
            const storageRef = ref(storage, `call_recordings/${user.uid}/${Date.now()}-${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            setValue(fieldName, url);
            toast({ title: "Recording Sync Success", description: "Audio asset provisioned." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Storage Error", description: error.message });
        } finally {
            setUploading(false);
        }
    };
    
    const getEfficiencyColor = (val: number) => {
        if (val < 10) return "text-red-600";
        if (val <= 15) return "text-orange-500";
        return "text-green-600";
    };

    return (
        <div className="space-y-8">
            {!isNested && <ShiftHeaderFields />}

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Conversion</CardTitle></CardHeader>
                <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-8 space-y-6">
                            <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-border/50 grid grid-cols-3 gap-4">
                                <FormField control={control} name="coldCalls" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11 bg-white" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name="linkedinOutreach" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11 bg-white" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name="emailsSent" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Emails</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11 bg-white" /></FormControl></FormItem>
                                )} />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 p-6 bg-primary/5 rounded-3xl ring-2 ring-primary/10 shadow-sm text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Total Outreach</p>
                                    <span className="text-4xl font-black text-primary tracking-tighter">{totalOutreach}</span>
                                </div>
                                <div className="w-1/3 p-6 bg-white rounded-3xl ring-1 ring-border/50 shadow-sm text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Follow-ups</p>
                                    <FormField control={control} name="followUps" render={({ field }) => (
                                        <FormControl><Input type="number" min="0" {...field} className="h-10 text-xl font-black text-center border-none focus-visible:ring-0" /></FormControl>
                                    )} />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-4 space-y-6">
                            <Card className="bg-white border-none ring-2 ring-primary/20 shadow-xl rounded-3xl overflow-hidden">
                                <div className="p-4 bg-primary text-white text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Tactical Results</p>
                                </div>
                                <CardContent className="p-6 space-y-6">
                                    <FormField control={control} name="potentialClients" render={({ field }) => (
                                        <FormItem className="text-center">
                                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Potential Client</FormLabel>
                                            <FormControl><Input type="number" min="0" {...field} className="h-14 text-3xl font-black text-center border-2 border-primary/20 rounded-2xl focus:border-primary" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <Separator />
                                    <div className="text-center">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Efficiency Rate</p>
                                        <p className={cn("text-4xl font-black tracking-tighter", getEfficiencyColor(efficiency))}>{efficiency.toFixed(2)}%</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
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
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><ShieldCheck className="size-4" /> 3️⃣ High-Value Engagements</CardTitle></CardHeader>
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
                <CardContent className="space-y-6 pt-6">
                    <FormField control={control} name="totalCallRecordings" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-bold text-primary">Today's Total Call Recording Drive Link</FormLabel>
                            <FormControl><Input {...field} placeholder="Paste Drive link here..." className="rounded-xl h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Best Call Recording</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-xl cursor-pointer bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'bestCallRecording', setIsUploadingBest)} disabled={isUploadingBest} />
                            {isUploadingBest && <div className="flex items-center gap-2 text-[8px] font-black text-primary uppercase animate-pulse"><Loader2 className="size-3 animate-spin"/> Syncing audio...</div>}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Worst Call Recording</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-xl cursor-pointer bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'worstCallRecording', setIsUploadingWorst)} disabled={isUploadingWorst} />
                            {isUploadingWorst && <div className="flex items-center gap-2 text-[8px] font-black text-primary uppercase animate-pulse"><Loader2 className="size-3 animate-spin"/> Syncing audio...</div>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!isNested && <ExecutionPlanFields />}
        </div>
    );
};

const MarketingMatrixTable = () => {
    const { control } = useFormContext();
    const deliverables = [
        { label: 'Content', key: 'dmContent' }, 
        { label: 'Poster', key: 'dmPoster' }, 
        { label: 'Reel', key: 'dmReel' }, 
        { label: 'Shoot', key: 'dmShoot' }
    ];

    const totals = deliverables.map(d => {
        const approved = Number(useWatch({ control, name: `${d.key}Approved` }) || 0);
        const pending = Number(useWatch({ control, name: `${d.key}Pending` }) || 0);
        const rejected = Number(useWatch({ control, name: `${d.key}Rejected` }) || 0);
        return approved + pending + rejected;
    });

    return (
        <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-purple-500/20 shadow-sm overflow-hidden">
            <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest">Marketing Pipeline Matrix</CardTitle></CardHeader>
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
                            <TableRow className="bg-muted/10">
                                <TableCell className="text-xs font-black uppercase py-4 text-primary">Category Total</TableCell>
                                {totals.map((t, i) => (
                                    <TableCell key={i} className="text-center font-black text-sm text-primary">{t}</TableCell>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

const DigitalMarketingFields = () => (
    <div className="space-y-8">
        <ShiftHeaderFields />
        <BusinessFields isNested />
        <MarketingMatrixTable />
        <ExecutionPlanFields />
    </div>
);

const TechnicalProjectItem = ({ index, control }: { index: number, control: any }) => {
    const isCompleted = useWatch({ control, name: `technicalProjects.${index}.isCompleted` });
    return (
        <Card className="p-6 rounded-2xl border shadow-none space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={control} name={`technicalProjects.${index}.projectName`} render={({ field }) => (
                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Project Name</FormLabel><FormControl><Input {...field} className="rounded-xl" /></FormControl></FormItem>
                )} />
                <FormField control={control} name={`technicalProjects.${index}.type`} render={({ field }) => (
                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Client">Client</SelectItem><SelectItem value="In House">In House</SelectItem><SelectItem value="Demo">Demo</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField control={control} name={`technicalProjects.${index}.statusPercent`} render={({ field }) => (
                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Status (%)</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} className="rounded-xl" /></FormControl></FormItem>
                )} />
            </div>
            <FormField control={control} name={`technicalProjects.${index}.description`} render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Shift Implementation Detail</FormLabel><FormControl><Textarea {...field} className="rounded-xl min-h-[60px]" /></FormControl></FormItem>
            )} />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <FormField control={control} name={`technicalProjects.${index}.isCompleted`} render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-[10px] font-black uppercase">Yes Completed</FormLabel>
                    </FormItem>
                )} />
                {isCompleted && (
                    <FormField control={control} name={`technicalProjects.${index}.liveLink`} render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input {...field} placeholder="Paste live project link..." className="rounded-xl h-9" /></FormControl></FormItem>
                    )} />
                )}
            </div>
        </Card>
    );
};

const TechnicalMeetingItem = ({ index, control }: { index: number, control: any }) => {
    return (
        <div className="p-4 rounded-2xl border bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={control} name={`technicalMeetings.${index}.clientName`} render={({ field }) => (<FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Client Name</FormLabel><FormControl><Input {...field} className="rounded-lg h-9" /></FormControl></FormItem>)} />
            <FormField control={control} name={`technicalMeetings.${index}.productName`} render={({ field }) => (<FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Product Name</FormLabel><FormControl><Input {...field} className="rounded-lg h-9" /></FormControl></FormItem>)} />
            <FormField control={control} name={`technicalMeetings.${index}.status`} render={({ field }) => (
                <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="rounded-lg h-9"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Won", "Close", "Pending", "In Review", "Followup", "New"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
        </div>
    );
};

const TechnicalFields = () => {
    const { control, setValue } = useFormContext();
    const { fields: meetingFields, append: addMeeting, remove: removeMeeting } = useFieldArray({ control, name: "technicalMeetings" });
    const { fields: projectFields, append: addProject, remove: removeProject } = useFieldArray({ control, name: "technicalProjects" });
    const meetingsCount = useWatch({ control, name: "clientMeetingsCount" }) || 0;
    const projectsCount = useWatch({ control, name: "projectsWorkedCount" }) || 0;
    const learnings = useWatch({ control, name: "learnedToday" }) || [];
    const [learningInput, setLearningRegistryInput] = React.useState("");

    React.useEffect(() => {
        const count = parseInt(meetingsCount) || 0;
        if (count > meetingFields.length) {
            for (let i = meetingFields.length; i < count; i++) addMeeting({ clientName: "", productName: "", status: "New" });
        } else if (count < meetingFields.length) {
            for (let i = meetingFields.length - 1; i >= count; i--) removeMeeting(i);
        }
    }, [meetingsCount, meetingFields.length, addMeeting, removeMeeting]);

    React.useEffect(() => {
        const count = parseInt(projectsCount) || 0;
        if (count > projectFields.length) {
            for (let i = projectFields.length; i < count; i++) addProject({ projectName: "", type: "Client", statusPercent: "0", description: "", isCompleted: false, liveLink: "" });
        } else if (count < projectFields.length) {
            for (let i = projectFields.length - 1; i >= count; i--) removeProject(i);
        }
    }, [projectsCount, projectFields.length, addProject, removeProject]);

    const addLearning = () => {
        if (!learningInput.trim()) return;
        setValue("learnedToday", [...learnings, learningInput.trim()]);
        setLearningRegistryInput("");
    };

    return (
        <div className="space-y-8">
            <ShiftHeaderFields />
            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><PhoneCall className="size-4"/> 1️⃣ Tactical Client Engagements</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <FormField control={control} name="clientMeetingsCount" render={({ field }) => (
                        <FormItem className="max-w-[200px]"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">No. of Client Meetings</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                    <div className="space-y-4">
                        {meetingFields.map((field, index) => (
                            <TechnicalMeetingItem key={field.id} index={index} control={control} />
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Briefcase className="size-4"/> 2️⃣ Sprint Module Pipeline</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <FormField control={control} name="projectsWorkedCount" render={({ field }) => (
                        <FormItem className="max-w-[200px]"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Total Projects Worked</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                    )} />
                    <div className="space-y-6">
                        {projectFields.map((field, index) => (
                            <TechnicalProjectItem key={field.id} index={index} control={control} />
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Brain className="size-4"/> 3️⃣ Tactical Knowledge Assets</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex gap-2">
                        <Input value={learningInput} onChange={e => setLearningRegistryInput(e.target.value)} placeholder="What did you learn today?" className="rounded-xl h-11" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLearning())} />
                        <Button type="button" size="icon" className="h-11 w-11 rounded-xl" onClick={addLearning}><Plus className="size-5" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {learnings.map((l: string, i: number) => (
                            <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-full text-[10px] font-bold gap-2">{l}<X className="size-3 cursor-pointer opacity-50" onClick={() => setValue("learnedToday", learnings.filter((_:any, idx:number) => idx !== i))} /></Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <ExecutionPlanFields />
        </div>
    );
};

const BusinessAuditDetail = ({ report, isNested = false }: { report: any, isNested?: boolean }) => {
    const totalOutreach = Number(report.coldCalls || 0) + Number(report.linkedinOutreach || 0) + Number(report.emailsSent || 0);
    const potential = Number(report.potentialClients || 0);
    const efficiency = totalOutreach > 0 ? (potential / totalOutreach) * 100 : 0;
    const getEfficiencyColor = (val: number) => val < 10 ? "text-red-600" : val <= 15 ? "text-orange-500" : "text-green-600";

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Conversion</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-primary text-white rounded-3xl shadow-xl flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest opacity-80">Efficiency Rate</span><span className="text-4xl font-black">{efficiency.toFixed(2)}%</span></div>
                    <div className="p-6 bg-white rounded-3xl ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Potential Clients</span><span className="text-3xl font-black">{potential}</span></div>
                    <div className="p-6 bg-white rounded-3xl ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follow-ups</span><span className="text-3xl font-black">{report.followUps || 0}</span></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {[['Cold Calls', report.coldCalls], ['LinkedIn', report.linkedinOutreach], ['Emails', report.emailsSent], ['Total Out', totalOutreach]].map(([l, v], i) => (
                        <div key={i} className="p-3 bg-muted/20 rounded-xl text-center"><p className="text-[8px] font-black uppercase text-muted-foreground">{l}</p><p className="font-bold">{v || 0}</p></div>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-black uppercase text-[10px] tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue & Impact</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">NET Collected</p><p className="text-xl font-black text-green-900">${report.revenueCollected || 0}</p></div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Committed NET</p><p className="text-xl font-black text-green-900">${report.committedRevenue || 0}</p></div>
                </div>
            </div>
            <div className="p-4 bg-primary/5 rounded-2xl space-y-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4" /> 4️⃣ Call Intelligence</p>
                <div className="grid gap-4">
                    {report.totalCallRecordings && <Button variant="outline" className="h-10 text-[10px] uppercase font-bold rounded-xl bg-white w-full text-primary" asChild><Link href={report.totalCallRecordings} target="_blank"><Download className="size-3 mr-2" /> Today's Total Call Recording Drive Link</Link></Button>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[['Best Call', report.bestCallRecording, 'text-green-600'], ['Worst Call', report.worstCallRecording, 'text-red-600']].map(([l, v, c], i) => v && (
                            <div key={i} className="p-3 bg-white rounded-xl ring-1 ring-border/50 space-y-2"><p className={cn("text-[9px] font-black uppercase flex items-center gap-1.5", c)}><Mic className="size-3"/> {l}</p><audio controls className="w-full h-8 scale-90 -ml-2"><source src={v} /></audio></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MarketingAuditDetail = ({ report }: { report: any }) => {
    const deliverables = [{ label: 'Content', key: 'dmContent' }, { label: 'Poster', key: 'dmPoster' }, { label: 'Reel', key: 'dmReel' }, { label: 'Shoot', key: 'dmShoot' }];
    const totals = deliverables.map(d => Number(report[`${d.key}Approved`] || 0) + Number(report[`${d.key}Pending`] || 0) + Number(report[`${d.key}Rejected`] || 0));
    return (
        <div className="space-y-6">
            <BusinessAuditDetail report={report} isNested />
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Status</TableHead>{deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                        {['Approved', 'Pending', 'Rejected'].map(status => (
                            <TableRow key={status}><TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>{deliverables.map(d => (<TableCell key={d.key} className="text-center font-bold">{report[`${d.key}${status}`] || 0}</TableCell>))}</TableRow>
                        ))}
                        <TableRow className="bg-muted/10"><TableCell className="text-xs font-black uppercase py-4 text-primary">Category Total</TableCell>{totals.map((t, i) => (<TableCell key={i} className="text-center font-black text-sm text-primary">{t}</TableCell>))}</TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const TechnicalAuditDetail = ({ report }: { report: any }) => (
    <div className="space-y-8">
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4"/> Tactical Engagements</p>
            <div className="grid grid-cols-1 gap-3">{report.technicalMeetings?.map((m: any, i: number) => (
                <div key={i} className="p-3 bg-white rounded-xl border flex items-center justify-between"><div><p className="font-bold text-sm">{m.clientName}</p><p className="text-[10px] uppercase text-muted-foreground">{m.productName}</p></div><Badge variant="outline" className="text-[8px] uppercase font-black">{m.status}</Badge></div>
            )) || <p className="text-xs italic text-muted-foreground">No engagements logged.</p>}</div>
        </div>
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Briefcase className="size-4"/> Sprint Progress</p>
            <div className="grid grid-cols-1 gap-4">{report.technicalProjects?.map((p: any, i: number) => (
                <Card key={i} className="p-4 border-none ring-1 ring-border/50 bg-white"><div className="flex justify-between items-start mb-3"><div><p className="font-bold text-sm">{p.projectName}</p><p className="text-[10px] uppercase text-muted-foreground">{p.type}</p></div><div className="text-right"><p className="text-lg font-black text-primary">{p.statusPercent}%</p><p className="text-[8px] uppercase font-bold text-muted-foreground">Coverage</p></div></div><p className="text-xs italic text-muted-foreground mb-3">"{p.description}"</p>{p.isCompleted && p.liveLink && <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] font-bold uppercase gap-2 bg-primary/5 text-primary" asChild><Link href={p.liveLink} target="_blank"><LinkIcon className="size-3"/> Live Deployment Proof</Link></Button>}</Card>
            )) || <p className="text-xs italic text-muted-foreground">No projects logged.</p>}</div>
        </div>
        <div className="space-y-3"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Brain className="size-4"/> Knowledge Assets</p>
            <div className="flex flex-wrap gap-2">{report.learnedToday?.map((l: string, i: number) => <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-full text-[10px] font-bold">{l}</Badge>) || <p className="text-xs italic text-muted-foreground">No learnings recorded.</p>}</div>
        </div>
    </div>
);

export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [userReports, setUserReports] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedReportForReview, setSelectedReportForReview] = React.useState<any | null>(null);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isLeadOrHigher = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'Team Lead';
  const isPrivileged = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin';

  const usersQuery = useMemoFirebase(() => query(collection(firestore, "users")), [firestore]);
  const { data: users } = useCollection<any>(usersQuery);

  const myReportsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(10));
  }, [user, firestore]);
  const { data: myRecentReports } = useCollection(myReportsQuery);

  const hasReportedToday = React.useMemo(() => {
    if (!myRecentReports) return false;
    const today = startOfDay(new Date());
    return myRecentReports.some(r => {
      const d = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date);
      return isSameDay(d, new Date());
    });
  }, [myRecentReports]);

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);
  const currentTemplateId = mappingData?.mappings?.[currentUserData?.jobTitle || ''] || 'Business';

  const form = useForm<any>({
    defaultValues: {
        meetingsTomorrow: "0", criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", followUps: "0", potentialClients: "0", 
        revenueCollected: "0", committedRevenue: "0", pipelineValue: "0", revenueVariance: "NIL",
        quotationsReleased: "0", meetingsSecured: "0", clientWin: "NIL", strategicLearning: "NIL",
        bestCallRecording: "", worstCallRecording: "", totalCallRecordings: "https://drive.google.com/drive/folders/13M3L_52j1ceP1QlXHoBEty5rAowdFVtm",
        logInTime: "", logOutTime: "",
        technicalMeetings: [], clientMeetingsCount: "0",
        technicalProjects: [], projectsWorkedCount: "0",
        learnedToday: [],
        dmContentApproved: "0", dmContentPending: "0", dmContentRejected: "0",
        dmPosterApproved: "0", dmPosterPending: "0", dmPosterRejected: "0",
        dmReelApproved: "0", dmReelPending: "0", dmReelRejected: "0",
        dmShootApproved: "0", dmShootPending: "0", dmShootRejected: "0",
        declaration: false
    },
  });

  const onSubmit = (values: any) => {
    if (!user || !currentUserData) return;
    
    const payload = { 
        ...values, 
        employeeId: user.uid, 
        employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`, 
        employeeDepartment: currentUserData.department, 
        employeeJobTitle: currentUserData.jobTitle, 
        date: serverTimestamp(), 
        reportType: currentTemplateId, 
        signatureUrl: currentUserData.signatureUrl || null 
    };
    
    // 1. Submit Report
    addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), payload);
    
    // 2. Automated Clock-Out (Final Stamp for shifts)
    const todayId = format(new Date(), 'yyyy-MM-dd');
    const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
    setDocumentNonBlocking(attRef, { checkOutTime: serverTimestamp() }, { merge: true });

    toast({ title: "Strategic Submission Confirmed", description: "You have been clocked out for the day." });
    setIsAddDialogOpen(false);
  };

  const handleDeleteReport = (report: any) => {
      if (!isPrivileged) return;
      const reportRef = doc(firestore, `users/${report.employeeId}/reports`, report.id);
      deleteDocumentNonBlocking(reportRef);
      toast({ title: "Report Expunged" });
      setSelectedReportForReview(null);
      if (selectedUser) {
        setUserReports(prev => prev.filter(r => r.id !== report.id));
      }
  };

  const handleDownloadPdf = (report: any) => {
      const pdfDoc = new jsPDF();
      pdfDoc.setFontSize(16);
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.text("FortuMars AI Technologies & Business Solutions.", pdfDoc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(100);
      pdfDoc.text(`${report.reportType} Tactical Audit Report`, pdfDoc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(0);
      pdfDoc.text(`Employee: ${report.employeeName}`, 14, 45);
      pdfDoc.text(`Designation: ${report.employeeJobTitle} | Dept: ${report.employeeDepartment}`, 14, 50);
      pdfDoc.text(`Submission Time: ${formatIST(report.date)}`, 14, 55);
      pdfDoc.text(`Shift Hours: ${report.logInTime || '--:--'} to ${report.logOutTime || '--:--'}`, 14, 60);

      const tableData: any[] = [];
      if (report.reportType === 'Business' || report.reportType === 'Digital Marketing') {
          tableData.push(['Cold Calls', report.coldCalls], ['LinkedIn', report.linkedinOutreach], ['Emails', report.emailsSent], ['Follow-ups', report.followUps], ['Potential Client', report.potentialClients], ['Revenue Collected', `$${report.revenueCollected}`]);
      }
      autoTable(pdfDoc, { startY: 70, head: [['Metric', 'Value']], body: tableData, theme: 'striped', headStyles: { fillColor: [107, 33, 168] } });
      const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
      pdfDoc.setFontSize(11);
      pdfDoc.text("T+1 Strategic Planning:", 14, finalY);
      pdfDoc.setFontSize(9);
      pdfDoc.text(`Critical Path: ${report.criticalPathTomorrow || 'NIL'}`, 14, finalY + 10);
      pdfDoc.save(`${report.employeeName}_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={isLeadOrHigher ? "Strategic Fleet Log" : "My Shift Log"} description="Comprehensive verification of tactical submissions.">
          {!hasReportedToday ? (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-full h-11 px-6 shadow-lg"><PlusCircle className="mr-2 h-4 w-4"/> Shift Form</Button>
          ) : (
            <Badge className="h-11 px-6 bg-green-100 text-green-700 border-none rounded-full font-bold uppercase tracking-widest"><CheckCircle2 className="size-4 mr-2" /> Reported Today</Badge>
          )}
      </PageHeader>
      
      {!isLeadOrHigher && (
          <div className="space-y-4"><div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><History className="size-4" /> My Recent Tactics</div>
              <div className="grid gap-3">{myRecentReports?.map(r => (
                  <Card key={r.id} className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-none ring-1 ring-border/50" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4"><div className="p-2 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div><div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Log</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>
              ))}</div>
          </div>
      )}

      {isLeadOrHigher && (
        <><div className="relative mb-6"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search staff members..." className="pl-10 h-11 rounded-xl bg-white/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
          <div className="border rounded-2xl overflow-hidden bg-white/50 shadow-sm"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Fleet Official</TableHead><TableHead className="text-[10px] font-black uppercase">Role</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Action</TableHead></TableRow></TableHeader>
                <TableBody>{users?.filter(u => u.firstName?.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (<TableRow key={u.id} className="border-border/50 hover:bg-muted/5 transition-colors"><TableCell className="font-bold py-4"><Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors flex items-center gap-2">{u.firstName} {u.lastName}</Link></TableCell><TableCell className="text-[10px] font-black uppercase text-muted-foreground">{u.jobTitle}</TableCell><TableCell className="text-right py-4"><Button variant="outline" size="sm" className="rounded-full font-bold text-[10px]" onClick={async () => { setSelectedUser(u); const q = query(collection(firestore, `users/${u.id}/reports`), orderBy('date', 'desc')); const snap = await getDocs(q); setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }}>Review Intelligence</Button></TableCell></TableRow>))}</TableBody></Table></div>
        </>
      )}

      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}><DialogContent className="max-w-2xl rounded-3xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Tactical History: {selectedUser?.firstName}</DialogTitle></DialogHeader><ScrollArea className="max-h-[60vh] pr-4"><div className="space-y-3 py-4">{userReports.map(r => (<Card key={r.id} className="p-4 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-none ring-1 ring-border/10" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4"><div className="p-2 rounded-xl bg-primary/10 text-primary"><Clock className="size-4" /></div><div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Log</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>))}</div></ScrollArea></DialogContent></Dialog>

      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-3xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
              <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center"><div><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Audit Detail</DialogTitle><p className="text-xs font-bold text-muted-foreground">{formatIST(selectedReportForReview?.date)} • Shift: {selectedReportForReview?.logInTime || '--'} - {selectedReportForReview?.logOutTime || '--'}</p></div><div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary" onClick={() => handleDownloadPdf(selectedReportForReview)}><FileDown className="size-3 mr-1.5" /> Download Report</Button>
                  {isPrivileged && (
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest"><Trash2 className="size-3 mr-1.5"/> Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Expunge Strategic Log?</AlertDialogTitle>
                                  <AlertDialogDescription>This action will permanently remove this tactical submission from the fleet records.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteReport(selectedReportForReview)} className="rounded-full font-bold uppercase text-[10px] bg-red-600">Confirm Deletion</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  )}
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-8">{selectedReportForReview?.reportType}</Badge></div></DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-secondary/10"><div className="space-y-8 pb-10"><div className="grid grid-cols-2 gap-6"><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reporting Official</p><p className="font-bold text-lg">{selectedReportForReview?.employeeName}</p></div><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Designation</p><p className="font-bold text-lg">{selectedReportForReview?.employeeJobTitle}</p></div></div><Separator />
                      {(selectedReportForReview?.reportType === 'Business' || selectedReportForReview?.reportType === 'Digital Marketing') && <BusinessAuditDetail report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetail report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Technical' && <TechnicalAuditDetail report={selectedReportForReview} />}
                      <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm"><CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><Target className="size-4"/> 5️⃣ Pipeline & Planning (T+1)</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-bold text-muted-foreground uppercase">Meetings Tomorrow</p><p className="font-black">{selectedReportForReview?.meetingsTomorrow || 0}</p></div><div><p className="text-[9px] font-bold text-muted-foreground uppercase">Intervention</p><p className={cn("font-black", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-green-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div></div><div><p className="text-[10px] font-black uppercase text-orange-600 mb-1">Critical Path</p><p className="text-sm italic">"{selectedReportForReview?.criticalPathTomorrow || 'NIL'}"</p></div></CardContent></Card>
                      <div className="pt-10 flex flex-col items-center text-center space-y-6"><div className="h-20 w-48 border-b-2 border-dashed border-primary/20 flex flex-col items-center justify-center">{selectedReportForReview?.signatureUrl ? (<img src={selectedReportForReview.signatureUrl} alt="E-Signature" className="h-16 object-contain" />) : (<span className="font-mono text-[10px] italic opacity-60">Digital Verification via Platform</span>)}</div><div className="space-y-1"><p className="text-sm font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle} • {selectedReportForReview?.employeeDepartment}</p><Separator className="w-10 mx-auto my-2" /><p className="text-[8px] font-mono text-muted-foreground italic">Submitted {formatIST(selectedReportForReview?.date)}</p></div></div></div></ScrollArea></DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl"><FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-secondary/30">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md"><div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-primary/10 text-primary"><Briefcase className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter">Daily {currentTemplateId} Submission</DialogTitle><DialogDescription className="text-xs font-bold">{formatIST(new Date())}</DialogDescription></div></div></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-8 space-y-8"><div className="space-y-6"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Tactical Analytics Template</Label>{currentTemplateId === 'Technical' ? <TechnicalFields /> : currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}</div><Separator /><div className="space-y-6"><Label className="text-[10px] font-black uppercase text-primary">Strategic Certification</Label><FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-6 bg-primary/5 border-primary/20"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5" /></FormControl><FormLabel className="text-sm font-bold">I certify that this submission represents a verified and accurate account of my tactical shift output.</FormLabel></FormItem>)} /></div></div></ScrollArea>
                    <div className="p-6 border-t bg-white/80 backdrop-blur-md"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px]" onClick={() => setIsAddDialogOpen(false)}>Discard Log</Button><Button type="submit" className="rounded-full h-12 flex-1 font-bold uppercase text-[10px] shadow-lg shadow-primary/20">Finalize Intelligence</Button></DialogFooter></div>
                </form></FormProvider></DialogContent></Dialog>
    </div>
  );
}
