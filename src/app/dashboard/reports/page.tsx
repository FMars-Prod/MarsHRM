
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, Search, Target, X, Plus, FileText, Briefcase, CheckCircle2, Mic, Loader2, DollarSign, ExternalLink, Download, Clock, Zap, History, Activity, PhoneCall, Link as LinkIcon, FileDown, Trash2, Brain, Users, TrendingUp, BarChart3, ListChecks, UserPlus, GraduationCap, FileCheck, Share2, ClipboardList } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
        <div className="grid grid-cols-2 gap-6 mb-8 text-left">
            <FormField control={control} name="logInTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Log-In Time</FormLabel>
                    <FormControl><Input type="time" {...field} className="rounded-none h-11" /></FormControl>
                </FormItem>
            )} />
            <FormField control={control} name="logOutTime" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-[10px] uppercase font-black text-muted-foreground">Log-Out Time</FormLabel>
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
                    <Target className="size-4" /> 5️⃣ Tomorrow's Plan
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="meetingsTomorrow" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Meetings Tomorrow</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={control} name="interventionTrigger" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Support Required</FormLabel>
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
                <FormField control={control} name="pendingDeliverables" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Pending Tasks</FormLabel>
                        <FormControl><Textarea {...field} placeholder="List items requiring attention..." className="rounded-none min-h-[80px]" /></FormControl>
                    </FormItem>
                )} />
                <FormField control={control} name="criticalPathTomorrow" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Main Goal</FormLabel>
                        <FormControl><Textarea {...field} placeholder="The single most important objective for tomorrow." className="rounded-none min-h-[80px]" /></FormControl>
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
            toast({ title: "Upload Success", description: "Audio file uploaded." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Storage Error", description: error.message });
        } finally {
            setIsUploadingBest(false);
            setIsUploadingWorst(false);
        }
    };
    
    const getEfficiencyColor = (val: number) => {
        if (val < 10) return "text-red-600";
        if (val <= 15) return "text-orange-500";
        return "text-green-600";
    };

    return (
        <div className="space-y-8 text-left">
            {!isNested && <ShiftHeaderFields />}

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><Activity className="size-4" /> 1️⃣ Outreach & Results</CardTitle></CardHeader>
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
                                    <p className="text-[10px] font-black uppercase tracking-widest">Daily Performance</p>
                                </div>
                                <CardContent className="p-6 space-y-6 text-center">
                                    <FormField control={control} name="potentialClients" render={({ field }) => (
                                        <FormItem className="text-center">
                                            <FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Potential Clients</FormLabel>
                                            <FormControl><Input type="number" min="0" {...field} className="h-14 text-3xl font-black text-center border-2 border-primary/20 rounded-none focus:border-primary" /></FormControl>
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

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Revenue Impact</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="revenueCollected" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Revenue Collected</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="committedRevenue" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Committed Revenue</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="pipelineValue" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Pipeline Value</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="revenueVariance" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Revenue Notes</FormLabel><FormControl><Input {...field} placeholder="Notes..." className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><CheckCircle2 className="size-4" /> 3️⃣ Key Engagements</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={control} name="quotationsReleased" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Quotations Released</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                        <FormField control={control} name="meetingsSecured" render={({ field }) => (
                            <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Meetings Secured</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                        )} />
                    </div>
                    <FormField control={control} name="clientWin" render={({ field }) => (
                        <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Success Highlight</FormLabel><FormControl><Textarea {...field} placeholder="Details of any successful deal..." className="rounded-none min-h-[60px]" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="strategicLearning" render={({ field }) => (
                        <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground">Key Learnings</FormLabel><FormControl><Textarea {...field} placeholder="What did you learn today?" className="rounded-none min-h-[60px]" /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><PhoneCall className="size-4" /> 4️⃣ Call Logs</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <FormField control={control} name="totalCallRecordings" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[9px] uppercase font-black text-primary">Call Recordings Folder</FormLabel>
                            <FormControl><Input {...field} placeholder="Paste shared link here..." className="rounded-none h-11" /></FormControl>
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Best Call File</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-none cursor-pointer bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'bestCallRecording', setIsUploadingBest)} disabled={isUploadingBest} />
                            {isUploadingBest && <div className="flex items-center gap-2 text-[8px] font-black text-primary uppercase animate-pulse"><Loader2 className="size-3 animate-spin"/> Uploading...</div>}
                        </div>
                        <div className="space-y-2 text-left">
                            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Worst Call File</Label>
                            <Input type="file" accept="audio/*" className="h-11 rounded-none cursor-pointer bg-white" onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0], 'worstCallRecording', setIsUploadingWorst)} disabled={isUploadingWorst} />
                            {isUploadingWorst && <div className="flex items-center gap-2 text-[8px] font-black text-primary uppercase animate-pulse"><Loader2 className="size-3 animate-spin"/> Uploading...</div>}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!isNested && <ExecutionPlanFields />}
        </div>
    );
};

const TechnicalFields = () => {
    const { control, setValue } = useFormContext();
    const { fields: meetingFields, append: addMeeting, remove: removeMeeting } = useFieldArray({ control, name: "technicalMeetings" });
    const { fields: projectFields, append: addProject, remove: removeProject } = useFieldArray({ control, name: "technicalProjects" });
    const { fields: learningFields, append: addLearning, remove: removeLearning } = useFieldArray({ control, name: "learnedToday" });

    return (
        <div className="space-y-8 text-left">
            <ShiftHeaderFields />
            
            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><PhoneCall className="size-4"/> Client Engagements</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {meetingFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end group text-left">
                            <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Client Name</Label><FormField control={control} name={`technicalMeetings.${index}.clientName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none" /></FormControl>)} /></div>
                            <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Product/Service</Label><FormField control={control} name={`technicalMeetings.${index}.productName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none" /></FormControl>)} /></div>
                            <div className="w-[120px] space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Status</Label><FormField control={control} name={`technicalMeetings.${index}.status`} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 rounded-none font-bold text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{["New", "Pitching", "Closing", "Support"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)} /></div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMeeting(index)} className="h-10 w-10 text-rose-500"><Trash2 className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addMeeting({ clientName: "", productName: "", status: "Pitching" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest"><Plus className="size-3 mr-2"/> Add Meeting Log</Button>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Briefcase className="size-4"/> Task Progress</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6 text-left">
                    {projectFields.map((field, index) => (
                        <div key={field.id} className="p-4 bg-muted/5 border rounded-none space-y-4 group relative text-left">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeProject(index)} className="absolute top-2 right-2 text-rose-500 h-8 w-8"><X className="size-4"/></Button>
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Project Name</Label><FormField control={control} name={`technicalProjects.${index}.projectName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Module/Type</Label><FormField control={control} name={`technicalProjects.${index}.type`} render={({ field }) => (<FormControl><Input {...field} placeholder="e.g. Frontend" className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                            </div>
                            <div className="space-y-1.5 text-left"><Label className="text-[8px] font-black uppercase opacity-40">Tasks Completed</Label><FormField control={control} name={`technicalProjects.${index}.description`} render={({ field }) => (<FormControl><Textarea {...field} className="rounded-none min-h-[60px] bg-white" /></FormControl>)} /></div>
                            <div className="grid grid-cols-2 gap-4 items-end text-left">
                                <div className="space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Completion (%)</Label><FormField control={control} name={`technicalProjects.${index}.statusPercent`} render={({ field }) => (<FormControl><Input type="number" min="0" max="100" {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <div className="flex items-center gap-2 pb-2"><FormField control={control} name={`technicalProjects.${index}.isCompleted`} render={({ field }) => (<FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none" /></FormControl>)} /><Label className="text-[10px] font-bold uppercase cursor-pointer">Live Deployment?</Label></div>
                            </div>
                            <FormField control={control} name={`technicalProjects.${index}.liveLink`} render={({ field }) => (
                                <FormItem className="space-y-1.5 text-left">
                                    <FormLabel className="text-[8px] font-black uppercase opacity-40">Deployment URL</FormLabel>
                                    <FormControl><Input {...field} placeholder="https://..." className="h-10 rounded-none bg-white" /></FormControl>
                                </FormItem>
                            )} />
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addProject({ projectName: "", type: "", description: "", statusPercent: "0", isCompleted: false, liveLink: "" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest"><Plus className="size-3 mr-2"/> Add Project Log</Button>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Brain className="size-4"/> Notes & Learnings</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {learningFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 group text-left">
                            <FormField control={control} name={`learnedToday.${index}`} render={({ field }) => (<FormControl><Input {...field} placeholder="What did you learn or fix today?" className="h-10 rounded-none" /></FormControl>)} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLearning(index)} className="h-10 w-10 text-rose-500 shrink-0"><X className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addLearning("")} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest"><Plus className="size-3 mr-2"/> Log Learning</Button>
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
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest"><Zap className="size-4" /> 4️⃣ Marketing Deliverables</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6 text-left">
                    {[
                        { label: 'Content (Writing)', key: 'dmContent' },
                        { label: 'Posters (Design)', key: 'dmPoster' },
                        { label: 'Reels (Video)', key: 'dmReel' },
                        { label: 'Shoots (Field)', key: 'dmShoot' },
                    ].map(item => (
                        <div key={item.key} className="p-4 bg-white border border-border/50 rounded-none space-y-3 text-left">
                            <p className="text-[10px] font-black uppercase text-slate-800">{item.label}</p>
                            <div className="grid grid-cols-3 gap-4 text-left">
                                <FormField control={control} name={`${item.key}Approved`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-emerald-600">Approved</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none border-emerald-100" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name={`${item.key}Pending`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-amber-600">Pending</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none border-amber-100" /></FormControl></FormItem>
                                )} />
                                <FormField control={control} name={`${item.key}Rejected`} render={({ field }) => (
                                    <FormItem><FormLabel className="text-[8px] uppercase font-bold text-rose-600">Rejected</FormLabel><FormControl><Input type="number" min="0" {...field} className="h-9 rounded-none border-rose-100" /></FormControl></FormItem>
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
    const { fields: campusFields, append: addCampus, remove: removeCampus } = useFieldArray({ control, name: "campusDrives" });
    const { fields: sourcedFields, append: addSourced, remove: removeSourced } = useFieldArray({ control, name: "othersSourced" });
    const { fields: taskFields, append: addTask, remove: removeTask } = useFieldArray({ control, name: "otherTasks" });

    const othersSourcedSwitch = useWatch({ control, name: "othersSourcedSwitch" });

    return (
        <div className="space-y-8 text-left">
            <ShiftHeaderFields />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest">Total Sourced</p>
                    <FormField control={control} name="resumesSourced" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 p-0 focus-visible:ring-0" /></FormControl>
                    )} />
                </Card>
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Interviews Today</p>
                    <FormField control={control} name="interviewsScheduled" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 p-0 focus-visible:ring-0 text-emerald-700" /></FormControl>
                    )} />
                </Card>
                <Card className="p-6 bg-white border-none ring-1 ring-border/50 rounded-none shadow-sm text-center space-y-2">
                    <p className="text-[9px] font-black uppercase text-indigo-600 tracking-widest">Selected/Hired</p>
                    <FormField control={control} name="hiredToday" render={({ field }) => (
                        <FormControl><Input type="number" min="0" {...field} className="text-3xl font-black text-center border-none h-10 p-0 focus-visible:ring-0 text-indigo-700" /></FormControl>
                    )} />
                </Card>
            </div>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><GraduationCap className="size-4"/> Campus Drive Protocol</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {campusFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end group text-left">
                            <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Institute Name</Label><FormField control={control} name={`campusDrives.${index}.instituteName`} render={({ field }) => (<FormControl><Input {...field} placeholder="e.g. SRM University" className="h-10 rounded-none" /></FormControl>)} /></div>
                            <div className="w-[140px] space-y-1.5 text-left"><Label className="text-[8px] font-black uppercase opacity-40">Status</Label><FormField control={control} name={`campusDrives.${index}.status`} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-10 rounded-none font-bold text-xs"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-none">{["New", "Pending", "Success", "Cancelled", "On Hold"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)} /></div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeCampus(index)} className="h-10 w-10 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addCampus({ instituteName: "", status: "New" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest"><Plus className="size-3 mr-2"/> Add Campus Drive</Button>
                </CardContent>
            </Card>

            <div className="space-y-4 text-left">
                <div className="p-4 bg-muted/20 border border-dashed border-border/50 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-black uppercase tracking-tight">Staff Resume Sourcing</Label>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">Did other staff members source resumes today?</p>
                    </div>
                    <FormField control={control} name="othersSourcedSwitch" render={({ field }) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)} />
                </div>

                {othersSourcedSwitch && (
                    <div className="p-6 bg-primary/5 border-2 border-dashed border-primary/20 space-y-4 animate-fade-in-up text-left">
                        {sourcedFields.map((field, index) => (
                            <div key={field.id} className="flex gap-2 items-end group text-left">
                                <div className="flex-1 space-y-1.5"><Label className="text-[8px] font-black uppercase opacity-40">Staff Name</Label><FormField control={control} name={`othersSourced.${index}.staffName`} render={({ field }) => (<FormControl><Input {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <div className="w-[100px] space-y-1.5 text-left"><Label className="text-[8px] font-black uppercase opacity-40">Count</Label><FormField control={control} name={`othersSourced.${index}.count`} render={({ field }) => (<FormControl><Input type="number" min="0" {...field} className="h-10 rounded-none bg-white" /></FormControl>)} /></div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeSourced(index)} className="h-10 w-10 text-rose-500"><Trash2 className="size-4"/></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={() => addSourced({ staffName: "", count: "0" })} className="w-full h-10 rounded-none bg-white font-black uppercase text-[8px] tracking-widest"><PlusCircle className="size-3 mr-2"/> Add Staff Contribution</Button>
                    </div>
                )}
            </div>

            <Card className="border-none ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><ClipboardList className="size-4"/> Operational Objectives (Others)</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-4 text-left">
                    {taskFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 group text-left">
                            <FormField control={control} name={`otherTasks.${index}.content`} render={({ field }) => (
                                <FormControl><Input {...field} placeholder="Specific task or objective..." className="h-10 rounded-none" /></FormControl>
                            )} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(index)} className="h-10 w-10 text-rose-500 shrink-0"><X className="size-4"/></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => addTask({ content: "" })} className="w-full h-10 rounded-none border-dashed border-primary/40 font-black uppercase text-[8px] tracking-widest"><Plus className="size-3 mr-2"/> Log Task Objective</Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <FormField control={control} name="documentationCompleted" render={({ field }) => (
                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-2"><FileCheck className="size-3"/> Documentation Work Completed</FormLabel><FormControl><Input type="number" min="0" {...field} className="rounded-none h-11" /></FormControl></FormItem>
                )} />
                <FormField control={control} name="callRecordingsLink" render={({ field }) => (
                    <FormItem><FormLabel className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-2"><LinkIcon className="size-3"/> Call Recording Link (Optional)</FormLabel><FormControl><Input {...field} placeholder="Share link..." className="rounded-none h-11" /></FormControl></FormItem>
                )} />
            </div>

            <ExecutionPlanFields />
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function ReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
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

        const attQuery = query(
            collectionGroup(firestore, 'attendances'),
            where('checkInTime', '>=', Timestamp.fromDate(weekStart)),
            where('checkInTime', '<=', Timestamp.fromDate(weekEnd))
        );
        const attSnap = await getDocs(attQuery);
        const attData = attSnap.docs.map(d => d.data());

        const reportsQuery = query(
            collectionGroup(firestore, 'reports'),
            where('date', '>=', Timestamp.fromDate(weekStart)),
            where('date', '<=', Timestamp.fromDate(weekEnd))
        );
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

            const aggregates = {
                coldCalls: 0, linkedin: 0, emails: 0, followUps: 0, potentials: 0, revenue: 0, meetingsSecured: 0, links: [] as string[]
            };

            userReports.forEach((r: any) => {
                aggregates.coldCalls += Number(r.coldCalls || 0);
                aggregates.linkedin += Number(r.linkedinOutreach || 0);
                aggregates.emails += Number(r.emailsSent || 0);
                aggregates.followUps += Number(r.followUps || 0);
                aggregates.potentials += Number(r.potentialClients || 0);
                aggregates.revenue += Number(r.revenueCollected || 0);
                aggregates.meetingsSecured += Number(r.meetingsSecured || 0);
                if (r.totalCallRecordings) aggregates.links.push(r.totalCallRecordings);
                if (r.bestCallRecording) aggregates.links.push(r.bestCallRecording);
            });

            const totalOutreach = aggregates.coldCalls + aggregates.linkedin + aggregates.emails;
            const efficiency = totalOutreach > 0 ? (aggregates.potentials / totalOutreach) * 100 : 0;

            return {
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                jobTitle: u.jobTitle,
                present: userAtts.length,
                late: userAtts.filter(a => a.status === 'late').length,
                hours: (totalSeconds / 3600).toFixed(1),
                aggregates,
                efficiency,
                totalOutreach
            };
        });

        setWeeklySummaryData(results);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Summary Sync Failed' });
    } finally {
        setIsWeeklyLoading(false);
    }
  }, [users, firestore, toast]);

  React.useEffect(() => {
      if (activeTab === 'weekly' && isLeadOrHigher) {
          fetchWeeklySummary();
      }
  }, [activeTab, isLeadOrHigher, fetchWeeklySummary]);

  const form = useForm<any>({
    defaultValues: {
        meetingsTomorrow: "0", criticalPathTomorrow: "", pendingDeliverables: "", interventionTrigger: "None",
        coldCalls: "0", linkedinOutreach: "0", emailsSent: "0", followUps: "0", potentialClients: "0", 
        revenueCollected: "0", committedRevenue: "0", pipelineValue: "0", revenueVariance: "NIL",
        quotationsReleased: "0", meetingsSecured: "0", clientWin: "NIL", strategicLearning: "NIL",
        bestCallRecording: "", worstCallRecording: "", totalCallRecordings: "",
        logInTime: "", logOutTime: "",
        technicalMeetings: [], clientMeetingsCount: "0",
        technicalProjects: [], projectsWorkedCount: "0",
        learnedToday: [],
        dmContentApproved: "0", dmContentPending: "0", dmContentRejected: "0",
        dmPosterApproved: "0", dmPosterPending: "0", dmPosterRejected: "0",
        dmReelApproved: "0", dmReelPending: "0", dmReelRejected: "0",
        dmShootApproved: "0", dmShootPending: "0", dmShootRejected: "0",
        hiredToday: "0", campusDrives: [], documentationCompleted: "0", resumesSourced: "0", 
        othersSourcedSwitch: false, othersSourced: [], interviewsScheduled: "0", callRecordingsLink: "", 
        otherTasks: [],
        declaration: false
    },
  });

  const onSubmit = async (values: any) => {
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
    
    const todayId = format(new Date(), 'yyyy-MM-dd');
    const attRef = doc(firestore, `users/${user.uid}/attendances`, todayId);
    
    await addDocumentNonBlocking(collection(firestore, `users/${user.uid}/reports`), payload);
    setDocumentNonBlocking(attRef, { checkOutTime: serverTimestamp() }, { merge: true });

    toast({ title: "Report Submitted", description: "Saved successfully." });
    setIsAddDialogOpen(false);
  };

  const handleDeleteReport = (report: any) => {
      if (!isPrivileged) return;
      const reportRef = doc(firestore, `users/${report.employeeId}/reports`, report.id);
      deleteDocumentNonBlocking(reportRef);
      toast({ title: "Report Deleted" });
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
      pdfDoc.text(`${report.reportType} Daily Report`, pdfDoc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(0);
      pdfDoc.text(`Employee: ${report.employeeName}`, 14, 45);
      pdfDoc.text(`Designation: ${report.employeeJobTitle} | Dept: ${report.employeeDepartment}`, 14, 50);
      pdfDoc.text(`Submission Time: ${formatIST(report.date)}`, 14, 55);
      pdfDoc.text(`Shift Hours: ${report.logInTime || '--:--'} to ${report.logOutTime || '--:--'}`, 14, 60);

      const tableData: any[] = [];
      if (report.reportType === 'Business' || report.reportType === 'Digital Marketing') {
          tableData.push(['Cold Calls', report.coldCalls], ['LinkedIn', report.linkedinOutreach], ['Emails', report.emailsSent], ['Follow-ups', report.followUps], ['Potential Clients', report.potentialClients], ['Revenue Collected', `$${report.revenueCollected}`]);
      }
      autoTable(pdfDoc, { startY: 70, head: [['Metric', 'Value']], body: tableData, theme: 'striped', headStyles: { fillColor: [107, 33, 168] } });
      const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
      pdfDoc.setFontSize(11);
      pdfDoc.text("Tomorrow's Plan:", 14, finalY);
      pdfDoc.setFontSize(9);
      pdfDoc.text(`Goal: ${report.criticalPathTomorrow || 'NIL'}`, 14, finalY + 10);
      pdfDoc.save(`${report.employeeName}_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleReviewUser = async (u: any) => {
      setSelectedUser(u);
      setUserReports([]);
      setIsReportsLoading(true);
      try {
          const q = query(collection(firestore, `users/${u.id}/reports`), orderBy('date', 'desc'));
          const snap = await getDocs(q);
          setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err: any) {
          toast({ variant: 'destructive', title: 'Sync Failed', description: err.message });
      } finally {
          setIsReportsLoading(false);
      }
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader title={isLeadOrHigher ? "Reports" : "My Reports"} description="Submit and review work activity logs.">
          {!hasReportedToday ? (
            <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-none h-11 px-6 shadow-lg font-black uppercase text-[10px] tracking-widest"><PlusCircle className="mr-2 h-4 w-4"/> New Report</Button>
          ) : (
            <Badge className="h-11 px-6 bg-emerald-50 text-emerald-700 border-none rounded-none font-black uppercase tracking-widest"><CheckCircle2 className="size-4 mr-2" /> Reported Today</Badge>
          )}
      </PageHeader>
      
      {!isLeadOrHigher && (
          <div className="space-y-4 text-left"><div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><History className="size-4" /> Recent Reports</div>
              <div className="grid gap-3">{myRecentReports?.map(r => (
                  <Card key={r.id} className="p-4 hover:bg-muted/50 rounded-none cursor-pointer flex items-center justify-between border-none ring-1 ring-border/50 text-left" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4 text-left"><div className="p-2 rounded-none bg-primary/10 text-primary"><Clock className="size-4" /></div><div className="text-left"><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Report</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>
              ))}</div>
          </div>
      )}

      {isLeadOrHigher && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-fit grid-cols-2 h-11 bg-white/50 border rounded-none p-1 mb-6">
                <TabsTrigger value="daily" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">
                    <History className="size-3.5"/> Individual Logs
                </TabsTrigger>
                <TabsTrigger value="weekly" className="rounded-none font-black uppercase text-[10px] tracking-widest gap-2">
                    <TrendingUp className="size-3.5"/> Weekly Summary
                </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="mt-0 text-left">
                <div className="relative mb-6 text-left">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input placeholder="Search staff..." className="pl-10 h-11 rounded-none bg-white/50 border-none ring-1 ring-border/50 font-bold uppercase text-[10px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="border rounded-none overflow-hidden bg-white/50 shadow-sm ring-1 ring-border/50 text-left">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Employee</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">Title</TableHead>
                                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest py-4 px-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users?.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                                <TableRow key={u.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                    <TableCell className="font-black text-xs uppercase py-4 px-6 text-left">
                                        <Link href={`/dashboard/users/${u.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                                            {u.firstName} {u.lastName}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground text-left">{u.jobTitle}</TableCell>
                                    <TableCell className="text-right py-4 px-6">
                                        <Button variant="outline" size="sm" className="rounded-none font-black text-[9px] uppercase tracking-widest h-8" onClick={() => handleReviewUser(u)}>View Logs</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>

            <TabsContent value="weekly" className="mt-0 text-left">
                <div className="border rounded-none overflow-hidden bg-white shadow-xl ring-1 ring-border/50 text-left">
                    <ScrollArea className="w-full">
                        <Table>
                            <TableHeader className="bg-muted/10 border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 px-8 min-w-[200px]">Employee</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 text-center">Attendance</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 text-center">Efficiency</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 text-center">Total Outreach</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 text-center">Potentials</TableHead>
                                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-6 text-center">Revenue</TableHead>
                                    <TableHead className="text-right font-black uppercase tracking-widest text-[9px] py-6 px-8">Recordings</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isWeeklyLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Loading summary...</TableCell></TableRow>
                                ) : weeklySummaryData.length > 0 ? (
                                    weeklySummaryData.map(row => (
                                        <TableRow key={row.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                            <TableCell className="py-6 px-8 text-left">
                                                <div className="flex flex-col text-left">
                                                    <span className="font-black text-xs uppercase text-primary">{row.name}</span>
                                                    <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">{row.jobTitle}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black">{row.present} / 7</span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase">Shifts</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={cn(
                                                    "rounded-none font-black text-[9px] h-6 px-3 border-none",
                                                    row.efficiency >= 15 ? "bg-emerald-50 text-emerald-700" : row.efficiency >= 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                                )}>
                                                    {row.efficiency.toFixed(1)}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black">{row.totalOutreach}</span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase">Outreach</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-indigo-600">{row.aggregates.potentials}</span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase">High-Value</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-black text-emerald-600">${row.aggregates.revenue.toLocaleString()}</span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase">Revenue</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right px-8">
                                                <div className="flex justify-end gap-1.5">
                                                    {row.aggregates.links.length > 0 ? (
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none bg-primary/5 text-primary hover:bg-primary/10">
                                                                    <Mic className="size-3.5" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="rounded-none border-none shadow-3xl">
                                                                <DialogHeader className="text-left">
                                                                    <DialogTitle className="text-lg font-black uppercase tracking-tighter">Call Recordings</DialogTitle>
                                                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest">{row.name}'s recent recordings</DialogDescription>
                                                                </DialogHeader>
                                                                <ScrollArea className="max-h-[300px] py-4 text-left">
                                                                    <div className="space-y-2 text-left">
                                                                        {row.aggregates.links.map((link: string, i: number) => (
                                                                            <Link href={link} key={i} target="_blank" className="flex items-center justify-between p-3 rounded-none bg-muted/30 hover:bg-muted/50 transition-all border border-transparent hover:border-primary/20 text-left">
                                                                                <div className="flex items-center gap-3 text-left">
                                                                                    <div className="p-2 bg-primary/10 text-primary rounded-none text-left"><LinkIcon className="size-3.5" /></div>
                                                                                    <span className="text-[10px] font-black uppercase truncate max-w-[200px]">{link.includes('best') ? 'Best Call' : link.includes('worst') ? 'Worst Call' : `Recording ${i+1}`}</span>
                                                                                </div>
                                                                                <ExternalLink className="size-3 opacity-30" />
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                </ScrollArea>
                                                            </DialogContent>
                                                        </Dialog>
                                                    ) : (
                                                        <div className="size-8 rounded-none bg-muted/10 flex items-center justify-center opacity-20"><Mic className="size-3.5" /></div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No activity detected this week.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}><DialogContent className="max-w-2xl rounded-none border-none shadow-3xl text-left"><DialogHeader className="text-left"><DialogTitle className="text-xl font-black uppercase tracking-tighter text-left">Report History: {selectedUser?.firstName}</DialogTitle></DialogHeader><ScrollArea className="max-h-[60vh] pr-4 text-left"><div className="space-y-3 py-4 text-left">
        {isReportsLoading ? (
            <div className="py-10 text-center animate-pulse uppercase font-black text-[10px] tracking-widest">Scanning records...</div>
        ) : userReports.length > 0 ? userReports.map(r => (
            <Card key={r.id} className="p-4 hover:bg-muted/50 rounded-none cursor-pointer flex items-center justify-between border-none ring-1 ring-border/10 text-left" onClick={() => setSelectedReportForReview(r)}><div className="flex items-center gap-4 text-left"><div className="p-2 rounded-none bg-primary/10 text-primary"><Clock className="size-4" /></div><div className="text-left"><p className="font-bold text-sm">{formatIST(r.date)}</p><p className="text-[10px] font-black uppercase text-muted-foreground">{r.reportType} Report</p></div></div><ExternalLink className="size-4 opacity-30" /></Card>
        )) : (
            <div className="py-10 text-center text-muted-foreground italic text-xs uppercase font-black tracking-widest opacity-30">No reports found.</div>
        )}</div></ScrollArea></DialogContent></Dialog>

      <Dialog open={!!selectedReportForReview} onOpenChange={o => !o && setSelectedReportForReview(null)}>
          <DialogContent className="max-w-3xl rounded-none border-none shadow-3xl h-[85vh] flex flex-col p-0 overflow-hidden text-left">
              <DialogHeader className="p-8 border-b bg-white flex flex-row justify-between items-center shrink-0 text-left"><div><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Report Audit</DialogTitle><p className="text-xs font-bold text-muted-foreground">{formatIST(selectedReportForReview?.date)} • Shift: {selectedReportForReview?.logInTime || '--'} - {selectedReportForReview?.logOutTime || '--'}</p></div><div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-none h-8 text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border-none shadow-sm" onClick={() => handleDownloadPdf(selectedReportForReview)}><FileDown className="size-3 mr-1.5" /> Download PDF</Button>
                  {isPrivileged && (
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="rounded-none h-8 text-[9px] font-black uppercase tracking-widest"><Trash2 className="size-3 mr-1.5"/> Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-none border-none shadow-3xl">
                              <AlertDialogHeader className="text-left">
                                  <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Delete Report?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-sm font-medium">This will permanently remove this report from the mission archives.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-8 gap-3">
                                  <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteReport(selectedReportForReview)} className="rounded-none font-bold uppercase text-[10px] bg-red-600">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  )}
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-8 rounded-none border-primary/20 bg-primary/5 text-primary">{selectedReportForReview?.reportType}</Badge></div></DialogHeader>
              <ScrollArea className="flex-1 p-8 bg-muted/5 text-left"><div className="space-y-8 pb-10 text-left"><div className="grid grid-cols-2 gap-6 text-left"><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Personnel</p><p className="font-black text-lg uppercase tracking-tight">{selectedReportForReview?.employeeName}</p></div><div className="space-y-1"><p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Mission Sector</p><p className="font-black text-lg uppercase tracking-tight">{selectedReportForReview?.employeeDepartment}</p></div></div><Separator className="opacity-50" />
                      {selectedReportForReview?.reportType === 'HR' && <HRAuditDetailComp report={selectedReportForReview} />}
                      {(selectedReportForReview?.reportType === 'Business' || selectedReportForReview?.reportType === 'Digital Marketing') && <BusinessAuditDetailComp report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Digital Marketing' && <MarketingAuditDetailComp report={selectedReportForReview} />}
                      {selectedReportForReview?.reportType === 'Technical' && <TechnicalAuditDetailComp report={selectedReportForReview} />}
                      <Card className="bg-white border-none ring-1 ring-border/50 overflow-hidden shadow-sm rounded-none text-left"><CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Target className="size-4"/> Tomorrow's Plan (T+1)</CardTitle></CardHeader><CardContent className="pt-6 space-y-4 text-left"><div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-black uppercase text-muted-foreground">Meetings Tomorrow</p><p className="font-black text-sm">{selectedReportForReview?.meetingsTomorrow || 0}</p></div><div><p className="text-[9px] font-black uppercase text-muted-foreground">Support Status</p><p className={cn("font-black text-sm uppercase", selectedReportForReview?.interventionTrigger !== 'None' ? 'text-red-600' : 'text-emerald-600')}>{selectedReportForReview?.interventionTrigger || 'None'}</p></div></div><div><p className="text-[8px] font-black uppercase text-muted-foreground mb-1">Primary Objective</p><p className="text-sm font-medium italic text-slate-700">"{selectedReportForReview?.criticalPathTomorrow || 'NIL'}"</p></div></CardContent></Card>
                      <div className="pt-10 flex flex-col items-center text-center space-y-6"><div className="h-20 w-48 border-b-2 border-dashed border-primary/20 flex flex-col items-center justify-center">{selectedReportForReview?.signatureUrl ? (<img src={selectedReportForReview.signatureUrl} alt="E-Signature" className="h-16 object-contain" />) : (<span className="font-mono text-[10px] italic opacity-60 uppercase">Verified Digitally</span>)}</div><div className="space-y-1"><p className="text-sm font-black uppercase tracking-tighter">{selectedReportForReview?.employeeName}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedReportForReview?.employeeJobTitle} • {selectedReportForReview?.employeeDepartment}</p><Separator className="w-10 mx-auto my-2" /><p className="text-[8px] font-mono text-muted-foreground italic">Stamping Timestamp: {formatIST(selectedReportForReview?.date)}</p></div></div></div></ScrollArea></DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}><DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 rounded-none border-none shadow-3xl overflow-hidden text-left"><FormProvider {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 bg-muted/5 text-left">
                    <DialogHeader className="p-8 pb-6 border-b bg-white/80 backdrop-blur-md shrink-0 text-left"><div className="flex items-center gap-3 text-left"><div className="p-3 rounded-none bg-primary/10 text-primary shadow-sm"><Briefcase className="size-6" /></div><div className="text-left"><DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Daily Strategic Log</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">{currentTemplateId} Protocol • {formatIST(new Date())}</DialogDescription></div></div></DialogHeader>
                    <ScrollArea className="flex-1"><div className="p-8 space-y-10"><div className="space-y-6 text-left"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Mission Details</Label>
                        {currentTemplateId === 'HR' ? <HRReportFields /> : 
                         currentTemplateId === 'Technical' ? <TechnicalFields /> : 
                         currentTemplateId === 'Digital Marketing' ? <DigitalMarketingFields /> : <BusinessFields />}
                    </div><Separator className="opacity-50" /><div className="space-y-6 text-left"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">Confirmation Protocol</Label><FormField control={form.control} name="declaration" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-none border-2 border-dashed p-8 bg-primary/5 border-primary/20 text-left"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="size-5 rounded-none" /></FormControl><FormLabel className="text-sm font-black uppercase leading-tight">I certify that the mission data provided in this report is accurate and reflects today's operational output.</FormLabel></FormItem>)} /></div></div></ScrollArea>
                    <div className="p-8 border-t bg-white shrink-0"><DialogFooter className="gap-3 max-w-lg mx-auto flex sm:flex-row flex-col"><Button type="button" variant="outline" className="rounded-none h-14 flex-1 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50" onClick={() => setIsAddDialogOpen(false)}>Abort Submission</Button><Button type="submit" disabled={!form.watch("declaration")} className="rounded-none h-14 flex-1 font-black uppercase text-[10px] tracking-widest shadow-2xl">Finalize Report</Button></DialogFooter></div>
                </form></FormProvider></DialogContent></Dialog>
    </div>
  );
}

function MetricStat({ label, val, color }: any) {
    return <div className="text-center"><p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-tighter">{label}</p><p className={cn("text-sm font-black", color)}>{val}</p></div>;
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
                <Badge variant="outline" className="text-[10px] font-black uppercase bg-muted/20 border-none rounded-none px-3 h-6 tracking-widest">Active</Badge>
            </div>
            <div className="text-left">
                <div className="flex items-center justify-between mb-3.5 text-left"><p className="text-[12px] font-black uppercase text-muted-foreground/70 tracking-widest">{title}</p><span className={cn("text-xl font-black tracking-tighter", color)}>{ratio}</span></div>
                {progress !== undefined && <Progress value={progress} className="h-2 rounded-none bg-muted/30" />}
                {children}
            </div>
        </Card>
    );
}
