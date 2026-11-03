"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Target, X, Plus, FileText, Briefcase, CheckCircle2, Mic, Loader2, DollarSign, ExternalLink, Download, Clock, Zap, History, Activity, PhoneCall, Link as LinkIcon, FileDown, Trash2, Brain, Users, TrendingUp, BarChart3, ListChecks, UserPlus, GraduationCap, FileCheck, Share2, ClipboardList, Building2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from '@/lib/utils';
import { format, isSameDay, startOfDay, startOfWeek, endOfWeek, differenceInSeconds, eachDayOfInterval } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useStorage, useAuth, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, getDocs, Timestamp, limit, serverTimestamp, collectionGroup } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useWatch, FormProvider, useFormContext, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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

const BusinessAuditDetailComp = ({ report, isNested = false }: { report: any, isNested?: boolean }) => {
    const totalOutreach = Number(report.coldCalls || 0) + Number(report.linkedinOutreach || 0) + Number(report.emailsSent || 0);
    const potential = Number(report.potentialClients || 0);
    const efficiency = totalOutreach > 0 ? (potential / totalOutreach) * 100 : 0;
    
    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Activity className="size-4" /> 1️⃣ Results</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-primary text-white rounded-none shadow-xl flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest opacity-80">Efficiency</span><span className="text-4xl font-black">{efficiency.toFixed(2)}%</span></div>
                    <div className="p-6 bg-white rounded-none ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Potential Clients</span><span className="text-3xl font-black">{potential}</span></div>
                    <div className="p-6 bg-white rounded-none ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follow-ups</span><span className="text-3xl font-black">{report.followUps || 0}</span></div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-black uppercase text-[10px] tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue</div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-none border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Collected</p><p className="text-xl font-black text-green-900">₹{report.revenueCollected || 0}</p></div>
                    <div className="p-4 bg-green-50 rounded-none border border-green-100"><p className="text-[9px] font-black uppercase text-green-700">Committed</p><p className="text-xl font-black text-green-900">₹{report.committedRevenue || 0}</p></div>
                </div>
            </div>

            {(report.totalCallRecordings || report.bestCallRecording || report.worstCallRecording) && (
                <div className="p-5 bg-primary/5 rounded-none space-y-4 border border-primary/10">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <PhoneCall className="size-4" /> 3️⃣ Call Recordings & Drive Assets
                    </p>
                    <div className="grid gap-3">
                        {report.totalCallRecordings && report.reportType === 'Business' && !isNested && (
                            <Button 
                                variant="outline" 
                                className="h-11 text-[10px] uppercase font-black rounded-none bg-white w-full text-primary border-primary/20 hover:bg-primary/5 shadow-sm justify-between px-4" 
                                asChild
                            >
                                <Link href={report.totalCallRecordings} target="_blank" rel="noopener noreferrer">
                                    <span className="flex items-center gap-2 truncate">
                                        <LinkIcon className="size-3.5 text-primary" /> Daily Work Recordings (Google Drive)
                                    </span>
                                    <ExternalLink className="size-3.5 ml-2 shrink-0 opacity-70" />
                                </Link>
                            </Button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[['Best Call', report.bestCallRecording, 'text-green-600'], ['Worst Call', report.worstCallRecording, 'text-red-600']].map(([label, url, color], i) => url && (
                                <div key={i} className="p-3 bg-white rounded-none ring-1 ring-border/50 space-y-2">
                                    <p className={cn("text-[9px] font-black uppercase flex items-center gap-1.5", color)}>
                                        <Mic className="size-3"/> {label}
                                    </p>
                                    <audio controls className="w-full h-8 scale-90 -ml-2">
                                        <source src={url as string} />
                                    </audio>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MarketingAuditDetailComp = ({ report }: { report: any }) => {
    const deliverables = [{ label: 'Content', key: 'dmContent' }, { label: 'Poster', key: 'dmPoster' }, { label: 'Reel', key: 'dmReel' }, { label: 'Shoot', key: 'dmShoot' }];
    return (
        <div className="space-y-6">
            <BusinessAuditDetailComp report={report} isNested />
            <div className="border rounded-none overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase">Status</TableHead>{deliverables.map(d => <TableHead key={d.key} className="text-[10px] font-black uppercase text-center">{d.label}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                        {['Approved', 'Pending', 'Rejected'].map(status => (
                            <TableRow key={status}><TableCell className="text-xs font-black uppercase py-4">{status}</TableCell>{deliverables.map(d => (<TableCell key={d.key} className="text-center font-bold">{report[`${d.key}${status}`] || 0}</TableCell>))}</TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const TechnicalAuditDetailComp = ({ report }: { report: any }) => (
    <div className="space-y-8">
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><PhoneCall className="size-4"/> Engagements</p>
            <div className="grid grid-cols-1 gap-3">{report.technicalMeetings?.map((m: any, i: number) => (
                <div key={i} className="p-3 bg-white rounded-none border flex items-center justify-between"><div><p className="font-bold text-sm">{m.clientName}</p><p className="text-[10px] uppercase text-muted-foreground">{m.productName}</p></div><Badge variant="outline" className="text-[8px] uppercase font-black">{m.status}</Badge></div>
            )) || <p className="text-xs italic text-muted-foreground">No engagements logged.</p>}</div>
        </div>
        <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Briefcase className="size-4"/> Projects</p>
            <div className="grid grid-cols-1 gap-4">{report.technicalProjects?.map((p: any, i: number) => (
                <Card key={i} className="p-4 border-none ring-1 ring-border/50 bg-white"><div className="flex justify-between items-start mb-3"><div><p className="font-bold text-sm">{p.projectName}</p><p className="text-[10px] uppercase text-muted-foreground">{p.type}</p></div><div className="text-right"><p className="text-lg font-black text-primary">{p.statusPercent}%</p><p className="text-[8px] uppercase font-bold text-muted-foreground">Progress</p></div></div><p className="text-xs italic text-muted-foreground mb-3">"{p.description}"</p>{p.isCompleted && p.liveLink && <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] font-bold uppercase gap-2 bg-primary/5 text-primary" asChild><Link href={p.liveLink} target="_blank"><ExternalLink className="size-3"/> View Project</Link></Button>}</Card>
            )) || <p className="text-xs italic text-muted-foreground">No projects logged.</p>}</div>
        </div>
        <div className="space-y-3"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Brain className="size-4"/> Learnings</p>
            <div className="flex flex-wrap gap-2">{report.learnedToday?.map((l: string, i: number) => <Badge key={i} variant="secondary" className="px-3 py-1.5 rounded-none text-[10px] font-bold">{l}</Badge>) || <p className="text-xs italic text-muted-foreground">No learnings recorded.</p>}</div>
        </div>
    </div>
);

const HRAuditDetailComp = ({ report }: { report: any }) => (
    <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-6 bg-primary text-white rounded-none shadow-xl flex flex-col items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest opacity-60">Sourced</span><span className="text-3xl font-black">{report.resumesSourced || 0}</span></div>
            <div className="p-6 bg-white rounded-none ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Interviews</span><span className="text-3xl font-black text-emerald-600">{report.interviewsScheduled || 0}</span></div>
            <div className="p-6 bg-white rounded-none ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hired</span><span className="text-3xl font-black text-indigo-600">{report.hiredToday || 0}</span></div>
            <div className="p-6 bg-white rounded-none ring-1 ring-border shadow-sm flex flex-col items-center justify-center"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Docs</span><span className="text-3xl font-black">{report.documentationCompleted || 0}</span></div>
        </div>

        {report.consultancies?.length > 0 && (
            <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><Building2 className="size-4"/> Consultancies</p>
                <div className="grid gap-2">{report.consultancies.map((c: any, i: number) => (
                    <div key={i} className="p-4 bg-white border border-border/50 flex items-center gap-3 rounded-none shadow-sm">
                        <div className="size-1.5 rounded-none bg-primary shadow-sm" />
                        <span className="font-bold text-sm uppercase">{c.name}</span>
                    </div>
                ))}</div>
            </div>
        )}

        {report.campusDrives?.length > 0 && (
            <div className="space-y-4"><p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><GraduationCap className="size-4"/> Campus Drives</p>
                <div className="grid gap-2">{report.campusDrives.map((c: any, i: number) => (
                    <div key={i} className="p-4 bg-white border border-border/50 flex justify-between items-center rounded-none shadow-sm"><span className="font-bold text-sm uppercase">{c.instituteName}</span><Badge variant="outline" className="rounded-none text-[8px] font-black uppercase">{c.status}</Badge></div>
                ))}</div>
            </div>
        )}
    </div>
);

const ShiftHeaderFields = () => {
    const { control } = useFormContext();
    return (
        <div className="grid grid-cols-2 gap-6 mb-8 text-left">
            <FormField control={control} name="logInTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Shift Start</FormLabel>
                    <FormControl><Input type="time" {...field} className="rounded-none h-11" /></FormControl>
                </FormItem>
            )} />
            <FormField control={control} name="logOutTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Shift End</FormLabel>
                    <FormControl><Input type="time" {...field} className="rounded-none h-11" /></FormControl>
                </FormItem>
            )} />
        </div>
    );
};

const ExecutionPlanFields = () => {
    const { control } = useFormContext();
    return (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden mt-8 rounded-none text-left">
            <CardHeader className="bg-muted/10 py-3">
                <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                    <Target className="size-4" /> Tomorrow's Plan
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="meetingsTomorrow" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Meetings</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Support Needed</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="rounded-none h-11"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent className="rounded-none">
                                    <SelectItem value="None">None</SelectItem>
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
                        <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Main Goal</FormLabel>
                        <FormControl><Textarea {...field} placeholder="Main objective." className="rounded-none min-h-[80px]" /></FormControl>
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
            toast({ title: "Upload Success" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsUploadingBest(false);
            setIsUploadingWorst(false);
        }
    };

    return (
        <div className="space-y-8 text-left">
            {!isNested && <ShiftHeaderFields />}

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach</CardTitle></CardHeader>
                <CardContent className="space-y-8 pt-6 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 text-left">
                        <div className="md:col-span-8 space-y-6 text-left">
                            <div className="p-4 bg-muted/20 rounded-none border-2 border-dashed border-border/50 grid grid-cols-3 gap-4 text-left">
                                <FormField control={control} name="coldCalls" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Cold Calls</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11 bg-white" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name="linkedinOutreach" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">LinkedIn</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11 bg-white" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name="emailsSent" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Emails</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11 bg-white" /></FormControl></FormItem>
                                )} />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1 p-6 bg-primary/5 rounded-none ring-2 ring-primary/10 shadow-sm text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Total Outreach</p>
                                    <span className="text-4xl font-black text-primary tracking-tighter">{totalOutreach}</span>
                                </div>
                                <div className="w-1/3 p-6 bg-white rounded-none ring-1 ring-border/50 shadow-sm text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Follow-ups</p>
                                    <FormField control={control} name="followUps" render={({ field }) => (
                                        <FormControl><Input type="number" min="0" {...field} className="h-10 text-xl font-black text-center border-none focus-visible:ring-0" /></FormControl>
                                    )} />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-4 space-y-6">
                            <Card className="bg-white border-none ring-2 ring-primary/20 shadow-xl rounded-none overflow-hidden text-left">
                                <div className="p-4 bg-primary text-white text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Efficiency</p>
                                </div>
                                <CardContent className="p-6 space-y-6 text-center">
                                    <FormField control={control} name="potentialClients" render={({ field }) => (
                                        <FormItem className="text-center">
                                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Potentials</FormLabel>
                                            <FormControl><Input type="number" min="0" {...field} className="h-14 text-3xl font-black text-center border-2 border-primary/20 rounded-none focus:border-primary" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <Separator />
                                    <div className="text-center">
                                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Success Rate</p>
                                        <p className="text-4xl font-black tracking-tighter text-primary">{efficiency.toFixed(1)}%</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="revenueCollected" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Collected</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="committedRevenue" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Committed</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        <PhoneCall className="size-4" /> 3️⃣ Call Recordings {!isNested && "& Drive Link"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {!isNested && (
                        <>
                            <FormField control={control} name="totalCallRecordings" render={({ field }) => (
                                <FormItem className="space-y-1.5 text-left">
                                    <FormLabel className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-1.5">
                                        <LinkIcon className="size-3 text-primary" /> Daily Work Recordings (Google Drive Link)
                                    </FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="url" 
                                            placeholder="https://drive.google.com/drive/folders/..." 
                                            {...field} 
                                            className="rounded-none h-11 bg-white font-medium text-xs focus:ring-1 focus:ring-primary" 
                                        />
                                    </FormControl>
                                    <p className="text-[8px] font-medium text-muted-foreground italic">Paste the Google Drive folder or link containing your daily call recordings.</p>
                                </FormItem>
                            )} />
                            <Separator className="opacity-50" />
                        </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Best Call (Audio File)</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-none bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'bestCallRecording', setIsUploadingBest)} disabled={isUploadingBest} />
                        </div>
                        <div className="space-y-2 text-left">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground">Worst Call (Audio File)</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-none bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'worstCallRecording', setIsUploadingWorst)} disabled={isUploadingWorst} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!isNested && <ExecutionPlanFields />}
        </div>
    );
};

const TechnicalFields = () => {
    const { control } = useFormContext();
    const { fields: meetingFields, append: addMeeting, remove: removeMeeting } = useFieldArray({ control, name: "technicalMeetings" });
    const { fields: projectFields, append: addProject, remove: removeProject } = useFieldArray({ control, name: "technicalProjects" });

    return (
        <div className="space-y-8 text-left">
            <ShiftHeaderFields />
            
            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><PhoneCall className="size-4"/> Calls</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {meetingFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end group text-left">
                            <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Client</Label><FormField control={control} name={`technicalMeetings.${index}.clientName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none" /></FormControl>)} /></div>
                            <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Service</Label><FormField control={control} name={`technicalMeetings.${index}.productName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none" /></FormControl>)} /></div>
                            <div className="w-[120px] space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Status</Label><FormField control={control} name={`technicalMeetings.${index}.status`} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 rounded-none text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{["New", "Pitching", "Closing", "Support"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)} /></div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMeeting(index)} className="h-10 w-10 text-rose-500"><Trash2 className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addMeeting({ clientName: "", productName: "", status: "Pitching" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest">Add Call</Button>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Briefcase className="size-4"/> Projects</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6 text-left">
                    {projectFields.map((field, index) => (
                        <div key={field.id} className="p-4 bg-muted/5 border rounded-none space-y-4 group relative text-left">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeProject(index)} className="absolute top-2 right-2 text-rose-500 h-8 w-8"><X className="size-4"/></Button>
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Project</Label><FormField control={control} name={`technicalProjects.${index}.projectName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Module</Label><FormField control={control} name={`technicalProjects.${index}.type`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                            </div>
                            <div className="space-y-1.5 text-left"><Label className="text-[8px] font-black uppercase opacity-40">Tasks</Label><FormField control={control} name={`technicalProjects.${index}.description`} render={({ field }) => (<FormControl><Textarea {...field} className="rounded-none min-h-[60px] bg-white" /></FormControl>)} /></div>
                            <div className="grid grid-cols-2 gap-4 items-end text-left">
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Done (%)</Label><FormField control={control} name={`technicalProjects.${index}.statusPercent`} render={({ field }) => (<FormControl><Input type="number" min="0" max="100" {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <div className="flex items-center gap-2 pb-2"><FormField control={control} name={`technicalProjects.${index}.isCompleted`} render={({ field }) => (<FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none" /></FormControl>)} /><Label className="text-[10px] font-bold uppercase cursor-pointer">Finished</Label></div>
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addProject({ projectName: "", type: "", description: "", statusPercent: "0", isCompleted: false, liveLink: "" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest">Add Project</Button>
                </CardContent>
            </Card>

            <ExecutionPlanFields />
        </div>
    );
};

const DigitalMarketingFields = () => {
    const { control } = useFormContext();
    return (
        <div className="space-y-10 text-left">
            <BusinessFields isNested />
            <Separator className="opacity-50" />
            <Card className="bg-gradient-to-br from-indigo-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><Zap className="size-4" /> 4️⃣ Content</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6 text-left">
                    {[
                        { label: 'Content', key: 'dmContent' },
                        { label: 'Posters', key: 'dmPoster' },
                        { label: 'Reels', key: 'dmReel' },
                        { label: 'Shoots', key: 'dmShoot' },
                    ].map(item => (
                        <div key={item.key} className="p-4 bg-white border border-border/50 rounded-none space-y-3 text-left">
                            <p className="text-[10px] font-black uppercase text-slate-800">{item.label}</p>
                            <div className="grid grid-cols-3 gap-4 text-left">
                                <FormField control={control} name={`${item.key}Approved`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-emerald-600">Approved</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name={`${item.key}Pending`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-amber-600">Pending</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name={`${item.key}Rejected`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-rose-600">Rejected</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none" /></FormControl></FormItem>
                                )} />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <ExecutionPlanFields />
        </div>
    );
};

const HRReportFields = () => {
    const { control } = useFormContext();
    const { fields: consultancyFields, append: addConsultancy, remove: removeConsultancy } = useFieldArray({ control, name: "consultancies" });
    const { fields: taskFields, append: addTask, remove: removeTask } = useFieldArray({ control, name: "otherTasks" });

    const consultancyCount = useWatch({ control, name: "consultancyCount" });

    React.useEffect(() => {
        const count = parseInt(consultancyCount) || 0;
        const current = consultancyFields.length;
        if (count > current) {
            for (let i = 0; i < count - current; i++) addConsultancy({ name: "" });
        } else if (count < current) {
            for (let i = 0; i < current - count; i++) removeConsultancy(current - 1 - i);
        }
    }, [consultancyCount, addConsultancy, removeConsultancy, consultancyFields.length]);

    return (
        <div className="space-y-8 text-left">
            <ShiftHeaderFields />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest">Sourced</p>
                    <FormField control={control} name="resumesSourced" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 focus-visible:ring-0" /></FormControl>
                    )} />
                </Card>
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Interviews</p>
                    <FormField control={control} name="interviewsScheduled" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 text-emerald-700 focus-visible:ring-0" /></FormControl>
                    )} />
                </Card>
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Hired</p>
                    <FormField control={control} name="hiredToday" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 text-indigo-700 focus-visible:ring-0" /></FormControl>
                    )} />
                </Card>
            </div>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Building2 className="size-4"/> Agencies</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6 text-left">
                    <FormField control={control} name="consultancyCount" render={({ field }) => (
                        <FormItem className="max-w-[200px] text-left">
                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Number</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="h-10 rounded-none" /></FormControl>
                        </FormItem>
                    )} />
                    {consultancyFields.length > 0 && (
                        <div className="grid gap-3">
                            {consultancyFields.map((field, index) => (
                                <div key={field.id} className="space-y-1.5 text-left">
                                    <Label className="text-[8px] font-black uppercase opacity-40">Name #{index + 1}</Label>
                                    <FormField control={control} name={`consultancies.${index}.name`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none" /></FormControl>)} />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><ClipboardList className="size-4"/> Tasks</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {taskFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 group text-left">
                            <FormField control={control} name={`otherTasks.${index}.content`} render={({ field }) => (
                                <FormControl><Input {...field} placeholder="Task..." className="h-10 rounded-none" /></FormControl>
                            )} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(index)} className="h-10 w-10 text-rose-500 shrink-0"><X className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addTask({ content: "" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest">Add Task</Button>
                </CardContent>
            </Card>

            <ExecutionPlanFields />
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [userReports, setUserReports] = React.useState<any[]>([]);
  const [isReportsLoading, setIsReportsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedReportForReview, setSelectedReportForReview] = React.useState<any | null>(null);
  const [activeTab, setActiveTab] = React.useState<string>("daily");
  const [weeklySummaryData, setWeeklySummaryData] = React.useState<any[]>([]);
  const [isWeeklyLoading, setIsWeeklyLoading] = React.useState(false);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: currentUserData } = useDoc<any>(userDocRef);
  const isLeadOrHigher = currentUserData?.role === 'HR Manager' || currentUserData?.role === 'CEO/Admin' || currentUserData?.role === 'CEO/MD' || currentUserData?.role === 'Team Lead';
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
    return myRecentReports.some(r => {
      const d = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date);
      return isSameDay(d, new Date());
    });
  }, [myRecentReports]);

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData } = useDoc<{mappings: Record<string, string>}>(mappingDocRef);
  
  const currentTemplateId = React.useMemo(() => {
      if (currentUserData?.department === 'HR') return 'HR';
      return mappingData?.mappings?.[currentUserData?.jobTitle || ''] || 'Business';
  }, [currentUserData, mappingData]);

  const fetchWeeklySummary = React.useCallback(async () => {
    if (!users || !firestore) return;
    setIsWeeklyLoading(true);
    try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        const attQuery = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', Timestamp.fromDate(weekStart)), where('checkInTime', '<=', Timestamp.fromDate(weekEnd)));
        const attSnap = await getDocs(attQuery);
        const attData = attSnap.docs.map(d => d.data());

        const reportsQuery = query(collectionGroup(firestore, 'reports'), where('date', '>=', Timestamp.fromDate(weekStart)), where('date', '<=', Timestamp.fromDate(weekEnd)));
        const reportsSnap = await getDocs(reportsQuery);
        const reportsData = reportsSnap.docs.map(d => d.data());

        const results = users.filter(u => u.role !== 'CEO/Admin' && u.role !== 'HR Manager').map(u => {
            const userAtts = attData.filter(a => a.employeeId === u.id);
            const userReports = reportsData.filter(r => r.employeeId === u.id);
            
            let totalSeconds = 0;
            userAtts.forEach(a => {
                if (a.checkInTime && a.checkOutTime) {
                    totalSeconds += differenceInSeconds(a.checkOutTime.toDate(), a.checkInTime.toDate()) - (a.totalBreakDuration || 0);
                }
            });

            const aggregates = { potentials: 0, revenue: 0 };
            userReports.forEach((r: any) => {
                aggregates.potentials += Number(r.potentialClients || 0);
                aggregates.revenue += Number(r.revenueCollected || 0);
            });

            const totalOutreach = userReports.reduce((acc, curr: any) => acc + (Number(curr.coldCalls || 0) + Number(curr.linkedinOutreach || 0) + Number(curr.emailsSent || 0)), 0);
            const efficiency = totalOutreach > 0 ? (aggregates.potentials / totalOutreach) * 100 : 0;

            return {
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                jobTitle: u.jobTitle,
                present: userAtts.length,
                hours: (totalSeconds / 3600).toFixed(1),
                efficiency,
                revenue: aggregates.revenue
            };
        });

        setWeeklySummaryData(results);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Sync Failed' });
    } finally {
        setIsWeeklyLoading(false);
    }
  }, [users, firestore, toast]);

  React.useEffect(() => {
      if (activeTab === 'weekly' && isLeadOrHigher) fetchWeeklySummary();
  }, [activeTab, isLeadOrHigher, fetchWeeklySummary]);

  const form = useForm<any>({
    defaultValues: {
        meetingsTomorrow: "0", criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", followUps: "0", potentialClients: "0", 
        revenueCollected: "0", committedRevenue: "0", pipelineValue: "0",
        totalCallRecordings: "",
        logInTime: "", logOutTime: "",
        technicalMeetings: [], technicalProjects: [],
        learnedToday: [],
        dmContentApproved: "0", dmContentPending: "0", dmContentRejected: "0",
        dmPosterApproved: "0", dmPosterPending: "0", dmPosterRejected: "0",
        dmReelApproved: "0", dmReelPending: "0", dmReelRejected: "0",
        dmShootApproved: "0", dmShootPending: "0", dmShootRejected: "0",
        hiredToday: "0", resumesSourced: "0", interviewsScheduled: "0", consultancyCount: "0",
        consultancies: [], otherTasks: [], declaration: false
    },
  });

  const onSubmit = async (values: any) => {
    if (!user || !currentUserData) return;
    const payload = { ...values, employeeId: user.uid, employeeName: `${currentUserData.firstName} ${currentUserData.lastName}`, employeeDepartment: currentUserData.department, employeeJobTitle: currentUserData.jobTitle, date: serverTimestamp(), reportType: currentTemplateId };
    const todayId = format(new Date(), 'yyyy-MM-dd');
    const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), payload);
    setDocumentNonBlocking(attRef, { checkOutTime: serverTimestamp() }, { merge: true });
    toast({ title: "Report Saved" });
    setIsAddDialogOpen(false);
  };

  const handleDeleteReport = (report: any) => {
      if (!isPrivileged) return;
      deleteDocumentNonBlocking(doc(firestore, `users/${report.employeeId}/reports`, report.id));
      toast({ title: "Report Deleted" });
      setSelectedReportForReview(null);
      setUserReports(prev => prev.filter(r => r.id !== report.id));
  };

  const handleDownloadPdf = (report: any) => {
      const pdfDoc = new jsPDF();
      pdfDoc.text(`${report.reportType} Report - ${report.employeeName}`, 14, 20);
      autoTable(pdfDoc, { startY: 30, body: [['Date', formatIST(report.date)], ['Category', report.reportType]] });
      pdfDoc.save(`Report_${report.employeeName}.pdf`);
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader title={isLeadOrHigher ? "Reports" : "My Reports"} description="Work logs.">
          {!hasReportedToday ? (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-none h-11 px-6 shadow-lg font-black uppercase text-[10px] tracking-widest"><PlusCircle className="size-4 mr-2"/> New Report</Button>
          ) : (
            <Badge className="h-11 px-6 bg-emerald-50 text-emerald-700 border-none rounded-none font-black uppercase tracking-widest"><CheckCircle2 className="size-4 mr-2" /> Done</Badge>
          )}
      </PageHeader>
      
      {!isLeadOrHigher && (
          <div className="space-y-4 text-left"><div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><History className="size-4" /> History</div>
              <div className="grid gap-3">{myRecentReports?.map(r => (
                  <Card key={r.id} className="p-4 hover:bg-muted/50 rounded-none cursor-pointer flex items-center justify-between border-none ring-1 ring-border/50 text-left" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4 text-left"><div className="p-2 rounded-none bg-primary/10 text-primary"><Clock className="size-4" /></div><div className="text-left"><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType}</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>
              ))}</div>
          </div>
      )}

      {isLeadOrHigher && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-fit grid-cols-2 h-11 bg-white/50 border rounded-none p-1 mb-6">
                <TabsTrigger value="daily" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">Logs</TabsTrigger>
                <TabsTrigger value="weekly" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">Weekly Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="daily">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input placeholder="Search..." className="pl-10 h-11 rounded-none font-bold uppercase text-[10px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="border rounded-none overflow-hidden bg-white shadow-sm ring-1 ring-border/50">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow><TableHead className="font-black uppercase text-[9px] py-4 px-6">Employee</TableHead><TableHead className="font-black uppercase text-[9px] py-4">Title</TableHead><TableHead className="text-right text-[9px] font-black uppercase py-4 px-6">Action</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {users?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                                <TableRow key={u.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                    <TableCell className="font-black text-xs uppercase py-4 px-6"><Link href={`/dashboard/users/${u.id}`} className="hover:text-primary">{u.firstName} {u.lastName}</Link></TableCell>
                                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground">{u.jobTitle}</TableCell>
                                    <TableCell className="text-right py-4 px-6"><Button variant="outline" size="sm" className="rounded-none font-black text-[9px] uppercase tracking-widest h-8" onClick={async () => { setSelectedUser(u); setUserReports([]); setIsReportsLoading(true); const q = query(collection(firestore, `users/${u.id}/reports`), orderBy('date', 'desc')); const snap = await getDocs(q); setUserReports(snap.docs.map(d => ({id: d.id, ...d.data()}))); setIsReportsLoading(false); }}>View</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="weekly">
                <div className="border rounded-none overflow-hidden bg-white shadow-xl ring-1 ring-border/50">
                    <ScrollArea className="w-full">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow><TableHead className="font-black text-[9px] uppercase py-6 px-8">Employee</TableHead><TableHead className="font-black text-[9px] uppercase py-6 text-center">Attendance</TableHead><TableHead className="font-black text-[9px] uppercase py-6 text-center">Efficiency</TableHead><TableHead className="text-right font-black text-[9px] uppercase py-6 px-8">Revenue</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {isWeeklyLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-64 text-center animate-pulse uppercase font-black text-xs opacity-20">Loading...</TableCell></TableRow>
                                ) : weeklySummaryData.map(row => (
                                    <TableRow key={row.id} className="border-border/50">
                                        <TableCell className="py-6 px-8"><div className="flex flex-col"><span className="font-black text-xs uppercase text-primary">{row.name}</span><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">{row.jobTitle}</span></div></TableCell>
                                        <TableCell className="text-center font-bold text-xs">{row.present} Shifts</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="rounded-none font-black text-[9px] h-6 px-3">{row.efficiency.toFixed(1)}%</Badge></TableCell>
                                        <TableCell className="text-right px-8 font-black text-sm text-emerald-600">₹{row.revenue.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}><DialogContent className="max-w-2xl rounded-none border-none shadow-3xl text-left"><DialogHeader className="text-left"><DialogTitle className="text-xl font-black uppercase tracking-tighter">History: {selectedUser?.firstName}</DialogTitle></DialogHeader><ScrollArea className="max-h-[60vh] pr-4"><div className="space-y-3 py-4">
        {isReportsLoading ? (
            <div className="py-10 text-center animate-pulse font-black text-[10px] uppercase">Loading...</div>
        ) : userReports.length > 0 ? userReports.map(r => (
            <Card key={r.id} className="p-4 hover:bg-muted/50 rounded-none cursor-pointer flex items-center justify-between border-none ring-1 ring-border/10" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4"><div className="p-2 rounded-none bg-primary/10 text-primary"><Clock className="size-4" /></div><div><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType}</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>
        )) : (
            <div className="py-10 text-center text-muted-foreground italic text-xs uppercase opacity-30">None.</div>
        )}</div></ScrollArea></DialogContent></Dialog>

      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-none border-none shadow-3xl h-[85vh] flex flex-col p-0 overflow-hidden text-left">
              <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center shrink-0 text-left"><div><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Report Details</DialogTitle><p className="text-xs font-bold text-muted-foreground">{formatIST(selectedReportForReview?.date)} • Shift: {selectedReportForReview?.logInTime || '--'} - {selectedReportForReview?.logOutTime || '--'}</p></div><div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-none h-8 text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-none shadow-sm" onClick={() => handleDownloadPdf(selectedReportForReview)}><FileDown className="size-3 mr-1.5" /> Download</Button>
                  {isPrivileged && (
                      <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="rounded-none h-8 text-[9px] font-black uppercase tracking-widest"><Trash2 className="size-3 mr-1.5"/> Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent className="rounded-none border-none shadow-3xl"><AlertDialogHeader className="text-left"><AlertDialogTitle>Delete Report?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="mt-8 gap-3"><AlertDialogCancel className="rounded-none font-bold uppercase text-[10px]">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteReport(selectedReportForReview)} className="rounded-none font-bold uppercase text-[10px] bg-red-600">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                  )}
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-8 rounded-none border-primary/20 bg-primary/5 text-primary">{selectedReportForReview?.reportType}</Badge></div></DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-muted/5 text-left"><div className="space-y-8 pb-10 text-left"><div className="grid grid-cols-2 gap-6 text-left"><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Employee</p><p className="font-black text-lg uppercase tracking-tight">{selectedReportForReview?.employeeName}</p></div><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Department</p><p className="font-black text-lg uppercase tracking-tight">{selectedReportForReview?.employeeDepartment}</p></div></div><Separator className="opacity-50" />
                      {selectedReportForReview?.reportType === 'HR' && <HRAuditDetailComp report={selectedReportForReview} />}
                      {(selectedReportForReview?.reportType === 'Business' || selectedReportForReview?.reportType === 'Digital Marketing') && <BusinessAuditDetailComp report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetailComp report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Technical' && <TechnicalAuditDetailComp report={selectedReportForReview} />}
                      <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm rounded-none text-left"><CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Target className="size-4"/> Tomorrow</CardTitle></CardHeader><CardContent className="pt-6 space-y-4 text-left"><div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-black uppercase text-muted-foreground">Meetings</p><p className="font-black text-sm">{selectedReportForReview?.meetingsTomorrow || 0}</p></div><div><p className="text-[9px] font-black uppercase text-muted-foreground">Support</p><p className={cn("font-black text-sm uppercase", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-emerald-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div></div><div><p className="text-[8px] font-black uppercase text-muted-foreground mb-1">Goal</p><p className="text-sm font-medium italic text-slate-700">"{selectedReportForReview?.criticalPathTomorrow || 'N/A'}"</p></div></CardContent></Card>
                      <div className="pt-10 flex flex-col items-center text-center space-y-6"><div className="h-20 w-48 border-b-2 border-dashed border-primary/20 flex flex-col items-center justify-center">{selectedReportForReview?.signatureUrl ? (<img src={selectedReportForReview.signatureUrl} alt="Signature" className="h-16 object-contain" />) : (<span className="font-mono text-[10px] italic opacity-60 uppercase">Verified</span>)}</div><div className="space-y-1"><p className="text-sm font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle}</p></div></div></div></ScrollArea></DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-none border-none shadow-3xl overflow-hidden text-left"><FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-muted/5 text-left">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md shrink-0 text-left"><div className="flex items-center gap-3"><div className="p-3 rounded-none bg-primary/10 text-primary shadow-sm"><Briefcase className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily Report</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">{currentTemplateId} • {formatIST(new Date())}</DialogDescription></div></div></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-8 space-y-10"><div className="space-y-6 text-left"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Details</Label>
                        {currentTemplateId === 'HR' ? <HRReportFields /> : 
                         currentTemplateId === 'Technical' ? <TechnicalFields /> : 
                         currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}
                    </div><Separator className="opacity-50" /><div className="space-y-6 text-left"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Confirmation</Label><FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-none border-2 border-dashed p-8 bg-primary/5 border-primary/20"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5 rounded-none" /></FormControl><FormLabel className="text-sm font-black uppercase leading-tight">Information provided is accurate.</FormLabel></FormItem>)} /></div></div></ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-none h-14 flex-1 font-black uppercase text-[10px] bg-white shadow-sm ring-1 ring-border" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={!form.watch("declaration")} className="rounded-none h-14 flex-1 font-black uppercase text-[10px] shadow-2xl">Submit Report</Button></DialogFooter></div>
                </form></FormProvider></DialogContent></Dialog>
    </div>
  );
}

function TimelineItem({ icon: Icon, title, time, desc, color, onClick }: any) {
    return (
        <div className="flex gap-8 items-start relative group cursor-pointer text-left" onClick={onClick}>
            <div className={cn("h-12 w-12 rounded-none flex items-center justify-center shrink-0 z-10 shadow-lg transition-transform group-hover:scale-110", color)}><Icon className="size-6" /></div>
            <div className="space-y-2 flex-1 pt-1 text-left">
                <p className="font-black text-lg uppercase tracking-tight text-foreground/90 leading-none group-hover:text-primary transition-colors">{title}</p>
                <div className="flex items-center gap-4 text-left">
                    <span className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">{time}</span>
                    <Badge variant="outline" className="h-6 px-4 text-[10px] font-black uppercase border-none bg-muted/40 tracking-widest rounded-none">{desc}</Badge>
                </div>
            </div>
            <ChevronRight className="size-6 text-muted-foreground/20 group-hover:text-primary transition-all self-center" />
        </div>
    );
}

function MetricCard({ icon: Icon, title, ratio, progress, color, children }: any) {
    return (
        <Card className="border-none shadow-2xl rounded-none bg-white p-6 space-y-6 ring-1 ring-border/50 group hover:shadow-primary/5 transition-all text-left">
            <div className="flex justify-between items-start text-left">
                <div className={cn("p-4 rounded-none shadow-md", color, "bg-muted/10")}><Icon className="size-6" /></div>
                <Badge variant="outline" className="text-[10px] font-bold uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div className="text-left">
                <div className="flex items-center justify-between mb-3.5 text-left"><p className="text-[12px] font-black uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-xl font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-sm font-black", color)}>{val}</p></div>;
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-dashed border-border/50 last:border-none group gap-4">
            <span className="text-[11px] font-black uppercase text-muted-foreground/40 tracking-[0.2em] shrink-0">{label}</span>
            <span className="text-base font-black text-foreground/80 uppercase text-right leading-tight">{value}</span>
        </div>
    );
}
