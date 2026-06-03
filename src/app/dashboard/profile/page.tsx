'use client';

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth, useUser, useStorage, useFirestore, useMemoFirebase, useCollection, updateDocumentNonBlocking } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, collection, query, where, serverTimestamp, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
    Edit, MapPin, Camera, CheckCircle2, ShieldCheck, 
    ExternalLink, FileText, Lock, CalendarDays, 
    FileBox, Loader2, Image as ImageIcon, Phone, 
    Mail, Briefcase, MoreHorizontal, Download, 
    Clock, Activity, UserCheck, Zap, ChevronRight,
    Settings, FileDown, Target
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { updateProfile, updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, differenceInSeconds, isToday, differenceInDays } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileFormSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(1, "Phone is required"),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
}).refine(data => {
    if (data.password && data.password.length > 0 && data.password.length < 6) return false;
    return true;
}, {
    message: "Password must be at least 6 characters.",
    path: ["password"],
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const emojiCategories = ["🧑", "👨", "👩", "🕵️", "🧑‍💻", "👨‍💻", "👩‍💻", "🦸", "🦹"];

export default function ProfilePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
    const [userReports, setUserReports] = React.useState<any[]>([]);

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
    const { data: employee, isLoading: isEmployeeLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const docsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/documents`) : null, [user, firestore]);
    const { data: documents } = useCollection(docsQuery);

    const assetsQuery = useMemoFirebase(() => user ? query(collection(firestore, "assets"), where("assignedToId", "==", user.uid)) : null, [user, firestore]);
    const { data: assignedAssets } = useCollection(assetsQuery);

    const ticketsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid));
    }, [user, firestore]);
    const { data: userTickets } = useCollection(ticketsQuery);

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const attendanceQuery = useMemoFirebase(() => user ? query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', Timestamp.fromDate(monthStart)),
        where('checkInTime', '<=', Timestamp.fromDate(monthEnd))
    ) : null, [user, firestore]);
    const { data: attendanceData } = useCollection<any>(attendanceQuery);

    const todaysAttendance = React.useMemo(() => {
        if (!attendanceData) return null;
        return attendanceData.find(a => isToday(a.checkInTime.toDate()));
    }, [attendanceData]);

    const operationalStatus = React.useMemo(() => {
        if (!todaysAttendance) return "Away";
        if (todaysAttendance.checkOutTime) return "Off-Duty";
        if (todaysAttendance.status === 'out_of_range') return "Pending Verification";
        return "Active";
    }, [todaysAttendance]);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Unassigned Sector";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Unassigned Sector";
    }, [branches, employee?.branchId]);

    const monthlyStats = React.useMemo(() => {
        if (!attendanceData) return { hours: "0.0", percentage: "0", count: 0 };
        let totalSec = 0;
        const presentDays = attendanceData.length;
        attendanceData.forEach(r => {
            if (r.checkInTime && r.checkOutTime) {
                totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
            }
        });
        return { 
            hours: (totalSec / 3600).toFixed(1),
            percentage: Math.min(100, Math.round((presentDays / 22) * 100)),
            count: presentDays
        };
    }, [attendanceData]);

    const tenure = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const totalDays = differenceInDays(new Date(), new Date(employee.hireDate));
        return `${totalDays} day`;
    }, [employee]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { firstName: "", lastName: "", phoneNumber: "", password: "", confirmPassword: "" },
    });

    React.useEffect(() => {
        if (employee) {
            form.reset({ 
                firstName: employee.firstName || '', 
                lastName: employee.lastName || '', 
                phoneNumber: employee.phoneNumber || '',
                password: '', 
                confirmPassword: '' 
            });
        }
    }, [employee, form]);

    React.useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(5));
            const snap = await getDocs(q);
            setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchReports();
    }, [user, firestore]);
    
    async function onSubmit(data: ProfileFormValues) {
        setIsSubmitting(true);
        if (!user || !auth.currentUser) return;
        try {
            const { password, confirmPassword, ...updateData } = data;
            if (userDocRef) updateDocumentNonBlocking(userDocRef, updateData);
            await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
            if (data.password) await updatePassword(auth.currentUser, data.password);
            toast({ title: "Profile Synchronized" });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally { setIsSubmitting(false); }
    }
    
    const handleAvatarEmojiUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Identity Icon Updated" });
        setIsAvatarDialogOpen(false);
    }

    const handleAvatarImageUpload = async (file: File) => {
        if (!user || !userDocRef || !storage) return;
        setIsUploadingAvatar(true);
        try {
            const avatarRef = ref(storage, `avatars/${user.uid}/${Date.now()}-${file.name}`);
            const snap = await uploadBytes(avatarRef, file);
            const url = await getDownloadURL(snap.ref);
            updateDocumentNonBlocking(userDocRef, { avatar: url });
            toast({ title: "Profile Portrait Saved" });
            setIsAvatarDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload Error" });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDownloadIdCard = async () => {
        if (!employee) return;
        const pdfDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: [54, 86] });
        pdfDoc.setFillColor(255, 255, 255);
        pdfDoc.rect(0, 0, 54, 86, 'F');
        pdfDoc.setFillColor(107, 33, 168);
        pdfDoc.rect(0, 0, 54, 28, 'F');
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFontSize(10);
        pdfDoc.text("FORTUMARS", 27, 15, { align: 'center' });
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFontSize(12);
        pdfDoc.text(`${employee.firstName} ${employee.lastName}`, 27, 62, { align: 'center' });
        pdfDoc.setFontSize(7);
        pdfDoc.setTextColor(107, 33, 168);
        pdfDoc.text(employee.jobTitle?.toUpperCase() || 'FLEET MEMBER', 27, 66, { align: 'center' });
        pdfDoc.save(`ID_CARD_${employee.firstName}.pdf`);
    };

    if (isEmployeeLoading || !employee) return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Syncing Identity Hub...</div>;

    return (
        <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8 font-open-sans">
            {/* Command Greeting */}
            <div className="flex flex-col gap-1 mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{format(new Date(), 'EEEE, MMMM dd')}</p>
                <h1 className="text-4xl font-black tracking-tighter">
                    Good {new Date().getHours() < 12 ? "Morning" : "Afternoon"}, {employee.firstName} ,
                </h1>
            </div>

            {/* Profile Bento Header */}
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden ring-1 ring-border/50">
                <CardContent className="p-8 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start">
                        <div className="relative group cursor-pointer" onClick={() => setIsAvatarDialogOpen(true)}>
                            <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white shadow-xl ring-1 ring-border">
                                {employee.avatar?.startsWith('http') ? (
                                    <AvatarImage src={employee.avatar} className="object-cover" />
                                ) : (
                                    <AvatarFallback className="text-6xl bg-primary/5 text-primary/40">{employee.avatar || employee.firstName?.[0]}</AvatarFallback>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="size-8 text-white" />
                                </div>
                            </Avatar>
                            <div className={cn("absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-white shadow-md", operationalStatus === 'Active' ? 'bg-green-500' : 'bg-slate-300')} />
                        </div>

                        <div className="flex-1 text-center lg:text-left space-y-6 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 justify-center lg:justify-start">
                                        <h2 className="text-3xl font-black tracking-tighter">{employee.firstName} {employee.lastName}</h2>
                                        <Badge className="bg-blue-100 text-blue-700 border-none rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest">{operationalStatus}</Badge>
                                    </div>
                                    <p className="text-lg font-medium text-muted-foreground">{employee.jobTitle}</p>
                                    <p className="text-xs font-black uppercase text-primary/60 tracking-widest">{employee.department} Division</p>
                                </div>
                                <div className="flex gap-3">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg">Edit Profile</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="rounded-xl h-10 px-5 font-black uppercase text-[10px] bg-white border-none ring-1 ring-border/50">More Actions <MoreHorizontal className="size-4 ml-2" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl p-2 w-56">
                                            <DropdownMenuItem onClick={handleDownloadIdCard} className="font-bold text-xs uppercase cursor-pointer gap-2"><Download className="size-3.5"/> Download ID Card</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {}} className="font-bold text-xs uppercase cursor-pointer gap-2"><FileDown className="size-3.5"/> Generate Report</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-dashed border-border/50">
                                <DetailItem icon={ShieldCheck} label="Employee ID" value={`MR-${employee.id.slice(0, 5).toUpperCase()}`} />
                                <DetailItem icon={Mail} label="Email" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone" value={employee.phoneNumber || "N/A"} />
                                <DetailItem icon={MapPin} label="Location" value={branchName} />
                                <DetailItem icon={CalendarDays} label="Joined On" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Full Time"} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <MetricCard label="Attendance (MTD)" value={`${monthlyStats.percentage}%`} sub={`${monthlyStats.count}/22 Days`} icon={UserCheck} color="text-green-600" bg="bg-green-50" />
                <MetricCard label="Documents" value={documents?.length || 0} sub="Files Updated" icon={FileBox} color="text-blue-600" bg="bg-blue-50" />
                <MetricCard label="Performance" value="Excellent" sub="Last Review: Q4" icon={Zap} color="text-orange-600" bg="bg-orange-50" />
                <MetricCard label="Tactical Hours" value={`${monthlyStats.hours}h`} sub="MTD Net Volume" icon={Clock} color="text-purple-600" bg="bg-purple-50" />
                <MetricCard label="Support Desk" value={userTickets?.length || 0} sub="Logged Issues" icon={ShieldCheck} color="text-pink-600" bg="bg-pink-50" />
            </div>

            {/* Detailed Tabs Interface */}
            <Tabs defaultValue="overview" className="space-y-8">
                <TabsList className="w-full justify-start bg-transparent border-none p-0 h-auto gap-8">
                    {["Overview", "Attendance", "Documents", "Assets"].map(tab => (
                        <TabsTrigger key={tab} value={tab.toLowerCase().replace(' ', '-')} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary p-0 pb-4 bg-transparent font-black uppercase text-[10px] tracking-widest">
                            {tab}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Timeline */}
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Activity Timeline</h3>
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase text-primary">View All</Button>
                                </div>
                                <div className="space-y-8 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                                    {userReports.length > 0 ? userReports.map(r => (
                                        <TimelineItem key={r.id} icon={FileText} title={`${r.reportType} Submission`} time={format(r.date.toDate(), 'PPP')} desc={`Implementation log for ${r.employeeDepartment} sector.`} color="bg-primary/10 text-primary" />
                                    )) : (
                                        <div className="py-20 text-center opacity-30 italic text-xs uppercase font-black">No activity records found.</div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Recent Documents & Assets */}
                        <div className="lg:col-span-4 space-y-8">
                            <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Recent Documents</h3>
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase text-primary">View All</Button>
                                </div>
                                <div className="space-y-4">
                                    {documents?.slice(0, 3).map(doc => (
                                        <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-2xl transition-colors border border-transparent hover:border-border/50">
                                            <div className="h-10 w-10 bg-red-50 text-red-600 flex items-center justify-center rounded-xl font-black text-[10px]">PDF</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-xs truncate">{doc.title}</p>
                                                <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60">Uploaded on {format(doc.uploadedAt.toDate(), 'dd MMM yyyy')}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </Card>

                            <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Assigned Assets</h3>
                                <div className="space-y-4">
                                    {assignedAssets?.map(asset => (
                                        <div key={asset.id} className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-muted rounded-2xl flex items-center justify-center overflow-hidden">
                                                {asset.imageUrl ? <img src={asset.imageUrl} className="object-cover w-full h-full" /> : <Briefcase className="size-5 opacity-20" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-xs truncate">{asset.name}</p>
                                                <p className="text-[8px] font-black uppercase text-muted-foreground opacity-60">{asset.category}</p>
                                            </div>
                                            <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[8px] font-black">IN USE</Badge>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* Quick Info & Command Chain */}
                        <div className="lg:col-span-4 space-y-8">
                             <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-foreground/80">Quick Info</h3>
                                <div className="space-y-4">
                                    <InfoRow label="Department" value={employee.department} />
                                    <InfoRow label="Work Location" value={branchName} />
                                    <InfoRow label="Shift" value={employee.shiftType || 'General Shift'} />
                                    <InfoRow label="Experience" value={tenure} />
                                </div>
                            </Card>

                            <Card className="border-none shadow-sm rounded-3xl bg-primary/5 p-8 text-center space-y-6">
                                <ShieldCheck className="size-10 text-primary mx-auto opacity-30" />
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary leading-tight">Operational Security Stamped</p>
                                    <p className="text-[9px] font-bold text-primary/60 mt-1 uppercase">Fleet tenure verified</p>
                                </div>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                
                <TabsContent value="attendance">
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                        <div className="text-center py-20 opacity-30 uppercase font-black text-xs">Monthly detailed log synchronized.</div>
                    </Card>
                </TabsContent>
                
                <TabsContent value="documents">
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {documents?.map(doc => (
                                <Link href={doc.link} target="_blank" key={doc.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 hover:bg-white border border-transparent hover:border-border/50 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <FileBox className="size-5 text-blue-600" />
                                        <div>
                                            <p className="font-bold text-xs">{doc.title}</p>
                                            <p className="text-[8px] font-black uppercase text-muted-foreground">Linked on {format(doc.uploadedAt.toDate(), 'dd MMM yyyy')}</p>
                                        </div>
                                    </div>
                                    <ExternalLink className="size-3.5 opacity-0 group-hover:opacity-100" />
                                </Link>
                            ))}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Dialogs */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-xl">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Profile Config</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">First Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">Last Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">Phone Number</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                            )} />
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">New Password</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">Confirm Password</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-full font-black uppercase tracking-widest shadow-lg" disabled={isSubmitting}>{isSubmitting ? "Syncing..." : "Finalize Config"}</Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-[2.5rem] sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Identity Asset Sync</DialogTitle></DialogHeader>
                    <div className="py-6 space-y-8">
                        <div className="relative group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                            <Button className="w-full h-20 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 text-primary flex-col gap-1 font-black uppercase text-[10px]" disabled={isUploadingAvatar}>
                                {isUploadingAvatar ? <Loader2 className="animate-spin size-5"/> : <ImageIcon className="size-6" />}
                                {isUploadingAvatar ? "Transmitting..." : "Upload New Portrait"}
                            </Button>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-5 gap-3">
                            {emojiCategories.map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-3xl p-3 rounded-xl hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20">{emoji}</button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DetailItem({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/5 text-primary/60"><Icon className="size-3.5" /></div>
            <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-bold truncate max-w-[150px]">{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 ring-1 ring-border/50 hover:shadow-md transition-all group">
            <div className={cn("p-2.5 rounded-xl w-fit group-hover:scale-110 transition-transform", bg, color)}><Icon className="size-4" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                <p className="text-2xl font-black tracking-tighter">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{sub}</p>
            </div>
        </Card>
    );
}

function TimelineItem({ icon: Icon, title, time, desc, color }: any) {
    return (
        <div className="flex gap-4 items-start relative">
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10", color)}><Icon className="size-3.5" /></div>
            <div className="space-y-0.5 pt-0.5">
                <p className="font-bold text-xs">{title}</p>
                <p className="text-[9px] font-black uppercase text-muted-foreground/40">{time}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{desc}</p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-dashed border-border last:border-none">
            <span className="text-[10px] font-black uppercase text-muted-foreground/60">{label}</span>
            <span className="text-xs font-bold">{value}</span>
        </div>
    );
}
