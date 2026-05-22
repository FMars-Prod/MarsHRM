
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser, useStorage } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc, collection, query, where, serverTimestamp, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
    Edit, MapPin, Clock, Camera, CheckCircle2, ShieldCheck, Save, History, 
    ExternalLink, FileText, Zap, Lock, Users, CalendarDays, Grid, 
    ShieldAlert, FileBox, Loader2, Image as ImageIcon, Phone, 
    Mail, Briefcase, ChevronRight, MoreHorizontal, Download, 
    LayoutDashboard, Laptop, CreditCard, Activity, TrendingUp, UserCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { updateProfile, updatePassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import * as React from "react";
import { cn } from "@/lib/utils";
import { updateDocumentNonBlocking, useCollection } from "@/firebase";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, differenceInSeconds, isToday } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const profileFormSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
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

const emojiCategories = {
    "People": ["🧑", "👨", "👩", "👮", "👷", "🏠", "🕵️", "🧑‍💻", "👨‍💻", "👩‍💻", "🦸", "🦹", "🧙", "🧚"],
    "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "😊", "😇", "🙂", "😎", "🤩", "🥳", "🤔", "🤫"],
};

export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
    const [isUploadingSignature, setIsUploadingSignature] = React.useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
    const [manualSignatureUrl, setManualSignatureUrl] = React.useState("");
    const [userReports, setUserReports] = React.useState<any[]>([]);

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
    const { data: employee, isLoading: isEmployeeLoading } = useDoc<any>(userDocRef);

    const teamDocRef = useMemoFirebase(() => employee?.teamId ? doc(firestore, "teams", employee.teamId) : null, [employee, firestore]);
    const { data: teamData } = useDoc<any>(teamDocRef);

    const managerDocRef = useMemoFirebase(() => employee?.reportsToId ? doc(firestore, "users", employee.reportsToId) : null, [employee, firestore]);
    const { data: managerData } = useDoc<any>(managerDocRef);

    const docsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/documents`) : null, [user, firestore]);
    const { data: documents } = useCollection(docsQuery);

    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const attendanceQuery = useMemoFirebase(() => user ? query(
        collection(firestore, `users/${user.uid}/attendances`),
        where('checkInTime', '>=', Timestamp.fromDate(monthStart)),
        where('checkInTime', '<=', Timestamp.fromDate(monthEnd))
    ) : null, [user, firestore]);
    const { data: attendanceData } = useCollection<any>(attendanceQuery);

    const monthlyStats = React.useMemo(() => {
        if (!attendanceData) return { hours: "0.0", percentage: "0" };
        let totalSec = 0;
        const presentDays = attendanceData.length;
        const totalWorkDays = 22; // Assumption for MTD
        attendanceData.forEach(r => {
            if (r.checkInTime && r.checkOutTime) {
                totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
            }
        });
        return { 
            hours: (totalSec / 3600).toFixed(1),
            percentage: Math.min(100, Math.round((presentDays / totalWorkDays) * 100))
        };
    }, [attendanceData]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { firstName: "", lastName: "", password: "", confirmPassword: "" },
    });

    React.useEffect(() => {
        if (employee) {
            form.reset({ firstName: employee.firstName || '', lastName: employee.lastName || '', password: '', confirmPassword: '' });
            if (employee.signatureUrl) setManualSignatureUrl(employee.signatureUrl);
        }
    }, [employee, form]);

    React.useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;
            try {
                const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(10));
                const snap = await getDocs(q);
                setUserReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Profile report fetch error:", err);
            }
        };
        if (user) fetchReports();
    }, [user, firestore]);
    
    async function onSubmit(data: ProfileFormValues) {
        setIsSubmitting(true);
        if (!user || !auth.currentUser) return;
        try {
            if (userDocRef) {
                updateDocumentNonBlocking(userDocRef, { firstName: data.firstName, lastName: data.lastName });
            }
            await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
            if (data.password) await updatePassword(auth.currentUser, data.password);
            toast({ title: "Profile Updated" });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed", description: error.message });
        } finally { setIsSubmitting(false); }
    }
    
    const handleAvatarEmojiUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Emoji Avatar synchronized!" });
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
            toast({ title: "Identity Asset Saved", description: "Profile photo synchronized." });
            setIsAvatarDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload Error", description: e.message });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const isUrl = (str: string) => str && str.startsWith('http');

    if (isUserLoading || isEmployeeLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Synchronizing Identity Hub...</div>;
    if (!employee) return <div className="p-10 text-center">No identity record found.</div>;

    return (
        <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8">
            {/* Top Profile Card */}
            <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardContent className="p-8 md:p-12">
                    <div className="flex flex-col lg:flex-row gap-12 items-start">
                        {/* Avatar Column */}
                        <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                            <div className="relative h-40 w-40 md:h-52 md:w-52">
                                <Avatar className="h-full w-full rounded-full ring-8 ring-primary/5 ring-offset-0 overflow-hidden bg-muted flex items-center justify-center transition-all duration-500 group-hover:ring-primary/10">
                                    {employee.avatar ? (
                                        isUrl(employee.avatar) ? (
                                            <AvatarImage src={employee.avatar} className="object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full bg-primary/5">
                                                <span className="text-8xl">{employee.avatar}</span>
                                            </div>
                                        )
                                    ) : (
                                        <AvatarFallback className="text-5xl font-light text-primary/40 bg-primary/5">
                                            {employee.firstName?.[0]}{employee.lastName?.[0]}
                                        </AvatarFallback>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="size-10 text-white" />
                                    </div>
                                </Avatar>
                                <div className="absolute bottom-4 right-4 h-6 w-6 bg-green-500 rounded-full border-4 border-white shadow-sm" title="Active Status" />
                            </div>
                        </div>

                        {/* Details Column */}
                        <div className="flex-1 space-y-8 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-4xl font-bold tracking-tight text-foreground">{employee.firstName} {employee.lastName}</h1>
                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                            Active
                                        </Badge>
                                    </div>
                                    <p className="text-xl font-medium text-muted-foreground">{employee.jobTitle}</p>
                                    <p className="text-sm font-semibold text-primary/60 uppercase tracking-widest">{employee.department} Department Division</p>
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} className="rounded-xl h-11 px-8 font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20 flex-1 md:flex-none">
                                        Edit Profile
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest bg-white/50 border-none ring-1 ring-border/50">
                                                More Actions <MoreHorizontal className="size-4 ml-2 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl p-2 w-56">
                                            <DropdownMenuItem className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><Download className="size-3.5"/> Download ID Card</DropdownMenuItem>
                                            <DropdownMenuItem className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer"><FileText className="size-3.5"/> Generate Report</DropdownMenuItem>
                                            <DropdownMenuItem className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer text-primary"><ShieldCheck className="size-3.5"/> View Permissions</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-12 pt-4">
                                <DetailItem icon={Users} label="Employee ID" value={employee.employeeId || `MR-${employee.id.slice(0,6).toUpperCase()}`} />
                                <DetailItem icon={Mail} label="Email" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone" value={employee.phoneNumber || "Not Provisioned"} />
                                <DetailItem icon={MapPin} label="Location" value="Chennai, India" />
                                <DetailItem icon={CalendarDays} label="Joined On" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Full Time"} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard 
                    label="Leave Balance" 
                    value="14 Days" 
                    sub="of 24 days" 
                    icon={CalendarDays} 
                    iconColor="text-purple-600" 
                    bgColor="bg-purple-50" 
                    progress={14 / 24 * 100}
                    progressColor="bg-purple-600"
                />
                <MetricCard 
                    label="Attendance (MTD)" 
                    value={`${monthlyStats.percentage}%`} 
                    sub={`${attendanceData?.length || 0} / 22 Days`} 
                    icon={UserCheck} 
                    iconColor="text-green-600" 
                    bgColor="bg-green-50"
                    progress={Number(monthlyStats.percentage)}
                    progressColor="bg-green-600"
                />
                <MetricCard 
                    label="Documents" 
                    value={`${documents?.length || 0} Files`} 
                    sub="Updated recently" 
                    icon={FileBox} 
                    iconColor="text-blue-600" 
                    bgColor="bg-blue-50" 
                />
                <MetricCard 
                    label="Performance" 
                    value="Excellent" 
                    sub="Last Review: May 2025" 
                    icon={TrendingUp} 
                    iconColor="text-orange-600" 
                    bgColor="bg-orange-50" 
                />
                <MetricCard 
                    label="Payroll Status" 
                    value="Paid" 
                    sub={`Next: ${format(addMonths(new Date(), 1), 'MMM yyyy')}`} 
                    icon={CreditCard} 
                    iconColor="text-pink-600" 
                    bgColor="bg-pink-50" 
                    status="active"
                />
            </div>

            {/* Tactical Navigation Tabs */}
            <div className="border-b border-border/50">
                <div className="flex gap-10 overflow-x-auto no-scrollbar pb-px">
                    <TabLink label="Overview" active />
                    <TabLink label="Attendance" />
                    <TabLink label="Leave" />
                    <TabLink label="Documents" />
                    <TabLink label="Payroll" />
                    <TabLink label="Performance" />
                    <TabLink label="Assets" />
                    <TabLink label="Projects" />
                    <TabLink label="Reporting Structure" />
                    <TabLink label="Activity Logs" />
                </div>
            </div>

            {/* Main Content Intelligence Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Timeline */}
                <div className="lg:col-span-4 space-y-6">
                    <SectionHeader title="Activity Timeline" href="/dashboard/activity" />
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
                        <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                            <TimelineItem icon={Edit} color="bg-purple-100 text-purple-600" title="Profile updated" time="2 hours ago" desc="You updated your profile information." />
                            <TimelineItem icon={FileBox} color="bg-blue-100 text-blue-600" title="Document uploaded" time="1 day ago" desc='Uploaded "Offer Letter.pdf" in Documents' />
                            <TimelineItem icon={CalendarDays} color="bg-pink-100 text-pink-600" title="Leave applied" time="2 days ago" desc="Applied for Casual Leave on 24 May 2025" />
                            <TimelineItem icon={Laptop} color="bg-indigo-100 text-indigo-600" title="Asset assigned" time="5 days ago" desc='MacBook Pro 16" assigned to you' />
                            <TimelineItem icon={TrendingUp} color="bg-orange-100 text-orange-600" title="Performance review completed" time="1 week ago" desc="Quarterly review for Q1 2025" />
                        </div>
                    </Card>
                </div>

                {/* Center Column: Assets & Docs */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="space-y-6">
                        <SectionHeader title="Recent Documents" href="/dashboard/documents" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-2">
                            <DocRow title="Offer Letter.pdf" date="18 May 2025" size="2.4 MB" />
                            <DocRow title="ID Proof.pdf" date="15 May 2025" size="1.1 MB" />
                            <DocRow title="Address Proof.pdf" date="10 May 2025" size="1.3 MB" />
                            <DocRow title="Education Certificate.pdf" date="08 May 2025" size="2.1 MB" />
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <SectionHeader title="Assigned Assets" href="/dashboard/assets" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-6">
                            <AssetRow image="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=200" title='MacBook Pro 16" (Apple)' date="Assigned on 12 Dec 2025" />
                            <AssetRow image="https://images.unsplash.com/photo-1592890678914-710186771991?auto=format&fit=crop&q=80&w=200" title='iPhone 15 Pro' date="Assigned on 12 Dec 2025" />
                        </Card>
                    </div>
                </div>

                {/* Right Column: Reporting & Quick Info */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-6">
                        <SectionHeader title="Reporting To" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 rounded-xl">
                                    {managerData?.avatar ? (
                                        isUrl(managerData.avatar) ? <AvatarImage src={managerData.avatar} /> : <div className="h-full w-full bg-primary/5 flex items-center justify-center text-xl">{managerData.avatar}</div>
                                    ) : <AvatarFallback>{managerData?.firstName?.[0] || 'M'}</AvatarFallback>}
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-foreground">{managerData ? `${managerData.firstName} ${managerData.lastName}` : "Rohit Sharma"}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{managerData?.jobTitle || "Chief Technology Officer"}</p>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-lg font-bold text-[10px] uppercase h-8 px-3">View Profile</Button>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <SectionHeader title="Reporting Structure" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center gap-6">
                            <div className="relative flex flex-col items-center">
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">RS</AvatarFallback>
                                </Avatar>
                                <div className="w-px h-6 bg-border/50 my-2" />
                                <div className="flex gap-8 relative before:absolute before:top-[-12px] before:left-[20px] before:right-[20px] before:h-px before:bg-border/50">
                                    <div className="flex flex-col items-center relative before:absolute before:top-[-12px] before:left-1/2 before:-translate-x-1/2 before:w-px before:h-3 before:bg-border/50">
                                        <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                                            {employee.avatar ? (isUrl(employee.avatar) ? <AvatarImage src={employee.avatar} /> : <div className="bg-primary/5 flex items-center justify-center h-full w-full">{employee.avatar}</div>) : <AvatarFallback>NP</AvatarFallback>}
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col items-center relative before:absolute before:top-[-12px] before:left-1/2 before:-translate-x-1/2 before:w-px before:h-3 before:bg-border/50">
                                        <Avatar className="h-8 w-8 ring-2 ring-border/50">
                                            <AvatarFallback className="text-[10px] font-bold">AK</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col items-center relative before:absolute before:top-[-12px] before:left-1/2 before:-translate-x-1/2 before:w-px before:h-3 before:bg-border/50">
                                        <Avatar className="h-8 w-8 ring-2 ring-border/50">
                                            <AvatarFallback className="text-[10px] font-bold">PN</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full rounded-xl font-bold uppercase text-[9px] tracking-widest h-9 bg-muted/30">View Full Structure</Button>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <SectionHeader title="Quick Info" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4">
                            <InfoRow label="Department" value={employee.department || "Admin Operations"} />
                            <InfoRow label="Work Location" value="Chennai, India" />
                            <InfoRow label="Shift" value="General Shift (9:30 AM - 6:30 PM)" />
                            <InfoRow label="Employee Status" value="Active" isStatus />
                        </Card>
                    </div>
                </div>
            </div>

            {/* Avatar Sync Dialog */}
            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Identity Profile Avatar</DialogTitle>
                        <DialogDescription>Choose a tactical emoji or upload a high-fidelity photo.</DialogDescription>
                    </DialogHeader>
                    <div className="p-8">
                         <div className="flex flex-col items-center gap-6 py-4 text-center">
                            <div className="p-6 rounded-3xl bg-primary/5 border-2 border-dashed border-primary/20">
                                <ImageIcon className="size-12 text-primary opacity-40 mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Select Strategic Portrait</p>
                            </div>
                            <div className="relative w-full group">
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                                <Button className="w-full rounded-2xl h-14 text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={isUploadingAvatar}>
                                    {isUploadingAvatar ? <Loader2 className="size-4 mr-2 animate-spin"/> : "Upload Profile Photo"}
                                </Button>
                            </div>
                        </div>
                        <Separator className="my-6" />
                        <div className="grid grid-cols-6 gap-3">
                            {emojiCategories.People.slice(0, 6).map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-3xl p-2 rounded-xl hover:bg-primary/5 transition-all">{emoji}</button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Profile Logic Dialogs */}
            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Profile Configuration</DialogTitle></DialogHeader>
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
                            <Separator />
                            <DialogFooter><Button type="submit" className="w-full rounded-2xl h-14 font-black uppercase tracking-widest" disabled={isSubmitting}>{isSubmitting ? "Transmitting..." : "Update Fleet Identity"}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function DetailItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/5 text-primary/60 mt-0.5">
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-sm font-bold text-foreground/80">{value}</p>
            </div>
        </div>
    )
}

function MetricCard({ label, value, sub, icon: Icon, iconColor, bgColor, progress, progressColor, status }: any) {
    return (
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
                <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110", bgColor, iconColor)}>
                    <Icon className="size-5" />
                </div>
                {status === 'active' && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                <p className="text-2xl font-black tracking-tight">{value}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{sub}</p>
            </div>
            {progress !== undefined && (
                <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-1000", progressColor)} style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}
        </Card>
    )
}

function TabLink({ label, active = false }: { label: string, active?: boolean }) {
    return (
        <button className={cn(
            "text-[13px] font-bold uppercase tracking-widest pb-4 px-2 whitespace-nowrap transition-all border-b-2",
            active ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
        )}>
            {label}
        </button>
    )
}

function SectionHeader({ title, href }: { title: string, href?: string }) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-foreground/80">{title}</h3>
            {href && (
                <Link href={href} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4">
                    View All
                </Link>
            )}
        </div>
    )
}

function TimelineItem({ icon: Icon, color, title, time, desc }: any) {
    return (
        <div className="flex gap-6 items-start">
            <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 z-10", color)}>
                <Icon className="size-4" />
            </div>
            <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-sm text-foreground">{title}</p>
                    <span className="text-[10px] font-medium text-muted-foreground">{time}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

function DocRow({ title, date, size }: any) {
    return (
        <div className="flex items-center gap-4 p-4 hover:bg-muted/30 rounded-2xl transition-colors cursor-pointer group">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 font-black text-[10px]">PDF</div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{title}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Uploaded on {date}</p>
            </div>
            <span className="text-[10px] font-black text-muted-foreground/60">{size}</span>
        </div>
    )
}

function AssetRow({ image, title, date }: any) {
    return (
        <div className="flex items-center gap-4 group cursor-pointer">
            <div className="h-14 w-14 rounded-2xl overflow-hidden ring-1 ring-border/50 group-hover:ring-primary/20 transition-all shrink-0">
                <img src={image} className="h-full w-full object-cover" alt="Asset" />
            </div>
            <div className="flex-1">
                <p className="font-bold text-sm group-hover:text-primary transition-colors">{title}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{date}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 border-none px-2.5">In Use</Badge>
        </div>
    )
}

function InfoRow({ label, value, isStatus }: any) {
    return (
        <div className="flex items-center justify-between text-xs py-1">
            <span className="font-medium text-muted-foreground">{label}</span>
            {isStatus ? (
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-bold text-foreground">{value}</span>
                </div>
            ) : (
                <span className="font-bold text-foreground text-right">{value}</span>
            )}
        </div>
    )
}

function addMonths(date: Date, months: number) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
