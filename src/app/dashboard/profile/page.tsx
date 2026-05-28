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
    Edit, MapPin, Camera, CheckCircle2, ShieldCheck, 
    ExternalLink, FileText, Lock, Users, CalendarDays, 
    FileBox, Loader2, Image as ImageIcon, Phone, 
    Mail, Briefcase, MoreHorizontal, Download, 
    Laptop, Activity, UserCheck, Clock, MessageSquareWarning,
    PieChart, Zap
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
import * as React from "react";
import { cn } from "@/lib/utils";
import { updateDocumentNonBlocking, useCollection } from "@/firebase";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, differenceInSeconds, isToday, differenceInDays } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

const profileFormSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phoneNumber: z.string().min(1, "Phone is required"),
    jobTitle: z.string().min(1, "Job title is required"),
    department: z.string().min(1, "Department is required"),
    branch: z.string().min(1, "Branch is required"),
    shiftType: z.string().min(1, "Shift Type is required"),
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
};

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

    const docsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/documents`) : null, [user, firestore]);
    const { data: documents } = useCollection(docsQuery);

    const assetsQuery = useMemoFirebase(() => user ? query(collection(firestore, "assets"), where("assignedToId", "==", user.uid)) : null, [user, firestore]);
    const { data: assignedAssets } = useCollection(assetsQuery);

    const ticketsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, "issue_reports"), where("employeeId", "==", user.uid));
    }, [user, firestore]);
    const { data: userTickets } = useCollection(ticketsQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<any>(teamsQuery);

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
        if (todaysAttendance.isAtHome) return "WFH (At Home)";
        if (todaysAttendance.isOutOfRange) return "Remote (Field)";
        return "In-Office";
    }, [todaysAttendance]);

    const monthlyStats = React.useMemo(() => {
        if (!attendanceData) return { hours: "0.0", percentage: "0", count: 0 };
        let totalSec = 0;
        const presentDays = attendanceData.length;
        const totalWorkDays = 22; 
        attendanceData.forEach(r => {
            if (r.checkInTime && r.checkOutTime) {
                totalSec += differenceInSeconds(r.checkOutTime.toDate(), r.checkInTime.toDate()) - (r.totalBreakDuration || 0);
            }
        });
        return { 
            hours: (totalSec / 3600).toFixed(1),
            percentage: Math.min(100, Math.round((presentDays / totalWorkDays) * 100)),
            count: presentDays
        };
    }, [attendanceData]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const now = new Date();
        const totalDays = differenceInDays(now, start);
        return `${totalDays} day`;
    }, [employee]);

    const teamChartData = React.useMemo(() => {
        if (!teams || !employee) return [];
        const isPrivileged = employee.role === 'HR Manager' || employee.role === 'CEO/Admin';
        
        const visibleTeams = isPrivileged 
            ? teams 
            : teams.filter((t: any) => t.id === employee.teamId);

        return visibleTeams.map((t: any, i: number) => ({
            name: t.name,
            value: t.memberIds?.length || 0,
            fill: `hsl(var(--chart-${(i % 5) + 1}))`
        })).sort((a, b) => b.value - a.value).slice(0, 5);
    }, [teams, employee]);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { 
            firstName: "", 
            lastName: "", 
            phoneNumber: "",
            jobTitle: "",
            department: "",
            branch: "Chennai HQ", 
            shiftType: "General Shift", 
            password: "", 
            confirmPassword: "" 
        },
    });

    React.useEffect(() => {
        if (employee) {
            form.reset({ 
                firstName: employee.firstName || '', 
                lastName: employee.lastName || '', 
                phoneNumber: employee.phoneNumber || '',
                jobTitle: employee.jobTitle || '',
                department: employee.department || '',
                branch: employee.branch || 'Chennai HQ',
                shiftType: employee.shiftType || 'General Shift',
                password: '', 
                confirmPassword: '' 
            });
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
                const { password, confirmPassword, ...updateData } = data;
                updateDocumentNonBlocking(userDocRef, updateData);
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
            toast({ title: "Identity Asset Saved" });
            setIsAvatarDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload Error", description: e.message });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleDownloadIdCard = async () => {
        if (!employee) return;
        const pdfDoc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [54, 86]
        });

        const loadImage = (url: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(e);
                img.src = url;
            });
        };

        try {
            let logo = null;
            try {
                logo = await loadImage("https://fortumars.com/fortumarslogo.png");
            } catch (e) {
                console.warn("ID Card: Failed to load corporate logo, proceeding with text branding.");
            }
            
            // Card Base
            pdfDoc.setFillColor(255, 255, 255);
            pdfDoc.rect(0, 0, 54, 86, 'F');

            // Header Section
            pdfDoc.setFillColor(107, 33, 168);
            pdfDoc.rect(0, 0, 54, 28, 'F');

            // Logo or Text Fallback
            if (logo) {
                const logoW = 38;
                const logoH = (logo.height * logoW) / logo.width;
                pdfDoc.addImage(logo, 'PNG', (54 - logoW) / 2, 6, logoW, logoH);
            } else {
                pdfDoc.setTextColor(255, 255, 255);
                pdfDoc.setFontSize(10);
                pdfDoc.setFont('helvetica', 'bold');
                pdfDoc.text("FORTUMARS", 27, 15, { align: 'center' });
            }

            // Picture Placeholder
            pdfDoc.setFillColor(245, 245, 245);
            pdfDoc.circle(27, 44, 12, 'F');
            pdfDoc.setDrawColor(107, 33, 168);
            pdfDoc.setLineWidth(0.5);
            pdfDoc.circle(27, 44, 12.5, 'S');

            // Initials
            pdfDoc.setTextColor(107, 33, 168);
            pdfDoc.setFontSize(14);
            pdfDoc.setFont('helvetica', 'bold');
            pdfDoc.text(`${employee.firstName[0]}${employee.lastName[0]}`, 27, 47, { align: 'center' });

            // Name
            pdfDoc.setTextColor(0, 0, 0);
            pdfDoc.setFontSize(10);
            pdfDoc.text(`${employee.firstName} ${employee.lastName}`, 27, 62, { align: 'center' });

            // Designation
            pdfDoc.setFontSize(6.5);
            pdfDoc.setFont('helvetica', 'bold');
            pdfDoc.setTextColor(107, 33, 168);
            pdfDoc.text(employee.jobTitle?.toUpperCase() || 'FLEET MEMBER', 27, 66, { align: 'center' });

            // Date of Join
            pdfDoc.setFontSize(5);
            pdfDoc.setFont('helvetica', 'normal');
            pdfDoc.setTextColor(140);
            const joinedDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A';
            pdfDoc.text(`JOINED: ${joinedDate}`, 27, 70, { align: 'center' });

            // Divider
            pdfDoc.setDrawColor(230, 230, 230);
            pdfDoc.line(10, 73, 44, 73);

            // Contact details
            pdfDoc.setTextColor(80);
            pdfDoc.setFontSize(4.5);
            pdfDoc.text(`EMPLOYMENT: ${employee.employmentType?.toUpperCase() || 'EMPLOYEE'}`, 10, 76.5);
            pdfDoc.text(`PHONE: ${employee.phoneNumber || 'N/A'}`, 10, 79);
            pdfDoc.text(`EMAIL: ${employee.email || 'N/A'}`, 10, 81.5);

            // Brand Footer
            pdfDoc.setFillColor(107, 33, 168);
            pdfDoc.rect(0, 83, 54, 3, 'F');
            pdfDoc.setTextColor(255, 255, 255);
            pdfDoc.setFontSize(3.2);
            pdfDoc.text("FORTUMARS AI TECHNOLOGIES & BUSINESS SOLUTIONS", 27, 85, { align: 'center' });

            pdfDoc.save(`ID_CARD_${employee.firstName}_${employee.lastName}.pdf`);
        } catch (err) {
            console.error("ID Card Generation Error:", err);
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate identity asset.' });
        }
    };

    const isUrl = (str: string) => str && str.startsWith('http');

    if (isEmployeeLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Synchronizing Identity Hub...</div>;
    if (!employee) return <div className="p-10 text-center">No identity record found.</div>;

    const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    })();

    return (
        <div className="max-w-[1400px] mx-auto animate-fade-in-up pb-20 space-y-8">
            <div className="flex flex-col gap-1 mb-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{format(new Date(), 'EEEE, MMMM dd')}</p>
                <h1 className="text-4xl font-black tracking-tighter">
                    {greeting}, {employee.firstName} ,
                </h1>
            </div>

            <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
                <CardContent className="p-8 md:p-12">
                    <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-start text-center lg:text-left">
                        <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarDialogOpen(true)}>
                            <div className="relative h-40 w-40 md:h-48 md:w-48">
                                <Avatar className="h-full w-full rounded-full ring-8 ring-primary/5 ring-offset-0 overflow-hidden bg-muted flex items-center justify-center transition-all duration-500 group-hover:ring-primary/10">
                                    {employee.avatar ? (
                                        isUrl(employee.avatar) ? (
                                            <AvatarImage src={employee.avatar} className="object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center w-full h-full bg-primary/5">
                                                <span className="text-7xl">{employee.avatar}</span>
                                            </div>
                                        )
                                    ) : (
                                        <AvatarFallback className="text-4xl font-light text-primary/40 bg-primary/5">
                                            {employee.firstName?.[0]}{employee.lastName?.[0]}
                                        </AvatarFallback>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="size-8 text-white" />
                                    </div>
                                </Avatar>
                                <div className={cn("absolute bottom-4 right-4 h-5 w-5 rounded-full border-4 border-white shadow-sm", operationalStatus === 'Away' ? 'bg-slate-300' : 'bg-green-500')} />
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 w-full">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-center lg:justify-start gap-3">
                                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{employee.firstName} {employee.lastName}</h1>
                                        <Badge className={cn("border-none rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", operationalStatus === 'Away' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700')}>
                                            <div className={cn("h-1.5 w-1.5 rounded-full", operationalStatus === 'Away' ? 'bg-slate-400' : 'bg-blue-600 animate-pulse')} />
                                            {operationalStatus}
                                        </Badge>
                                    </div>
                                    <p className="text-lg font-medium text-muted-foreground">{employee.jobTitle}</p>
                                    <p className="text-xs font-semibold text-primary/60 uppercase tracking-widest">{employee.department} Division</p>
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <Button onClick={() => setIsProfileDialogOpen(true)} className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 flex-1 md:flex-none">
                                        Edit Profile
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest bg-white/50 border-none ring-1 ring-border/50">
                                                More <MoreHorizontal className="size-4 ml-2 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl p-2 w-56">
                                            <DropdownMenuItem onClick={handleDownloadIdCard} className="rounded-lg gap-2 font-bold text-xs uppercase cursor-pointer">
                                                <Download className="size-3.5"/> Download ID Card
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12 pt-4">
                                <DetailItem icon={Mail} label="Email" value={employee.email} />
                                <DetailItem icon={Phone} label="Phone" value={employee.phoneNumber || "Not Provisioned"} />
                                <DetailItem icon={MapPin} label="Branch Location" value={employee.branch || "Chennai HQ"} />
                                <DetailItem icon={CalendarDays} label="Joined On" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} />
                                <DetailItem icon={Briefcase} label="Employment Type" value={employee.employmentType || "Full Time"} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-dashed pt-8 border-border/50">
                        <div className="flex -space-x-4">
                            <ExperienceBadge label="Authority" value={employee.role || 'Member'} icon={ShieldCheck} color="bg-indigo-600" />
                            <ExperienceBadge label="Commenced" value={employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A'} icon={CalendarDays} color="bg-emerald-600" />
                            <ExperienceBadge label="Fleet Tenure" value={experience} icon={Clock} color="bg-primary" />
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center sm:text-right">
                                <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Tactical Comms</p>
                                <div className="flex gap-2 mt-1">
                                    <a href={`mailto:${employee.email}`} className="p-2.5 rounded-xl bg-muted/50 hover:bg-primary hover:text-white transition-all duration-300">
                                        <Mail className="size-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard label="Account Authority" value={employee.role || 'Member'} sub="System Access Tier" icon={ShieldCheck} iconColor="text-purple-600" bgColor="bg-purple-50" />
                <MetricCard label="Attendance (MTD)" value={`${monthlyStats.percentage}%`} sub={`${monthlyStats.count} / 22 Days`} icon={UserCheck} iconColor="text-green-600" bgColor="bg-green-50" />
                <MetricCard label="Documents" value={`${documents?.length || 0} Assets`} sub="Secure Repository" icon={FileBox} iconColor="text-blue-600" bgColor="bg-blue-50" />
                <MetricCard label="Work Hours" value={`${monthlyStats.hours}h`} sub="MTD Net Volume" icon={Clock} iconColor="text-orange-600" bgColor="bg-orange-50" />
                <MetricCard label="Support Desk" value={`${userTickets?.length || 0} Tickets`} sub="Maintenance Logs" icon={MessageSquareWarning} iconColor="text-pink-600" bgColor="bg-pink-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
                <div className="lg:col-span-4 space-y-6">
                    <SectionHeader title="Shift Activity Log" />
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border/50">
                                {userReports.length > 0 ? userReports.map(report => (
                                    <TimelineItem 
                                        key={report.id}
                                        icon={FileText} 
                                        color="bg-primary/10 text-primary" 
                                        title={`${report.reportType} Submission`} 
                                        time={report.date ? format(report.date.toDate(), 'PPP p') : 'Pending'} 
                                        desc={`Shift implementation log for ${report.employeeDepartment} sector.`} 
                                    />
                                )) : (
                                    <div className="py-10 text-center text-muted-foreground italic text-xs uppercase font-black">No activity records found.</div>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-6">
                        <SectionHeader title="Intelligence Repository" href="/dashboard/documents" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-2">
                            {documents && documents.length > 0 ? documents.slice(0, 4).map(doc => (
                                <DocRow key={doc.id} title={doc.title} date={format(doc.uploadedAt.toDate(), 'dd MMM yyyy')} link={doc.link} />
                            )) : (
                                <div className="p-10 text-center text-muted-foreground text-[10px] font-black uppercase italic">No digital assets linked.</div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <SectionHeader title="Technical Assets" href="/dashboard/assets" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-6">
                            {assignedAssets && assignedAssets.length > 0 ? assignedAssets.map(asset => (
                                <AssetRow key={asset.id} image={asset.imageUrl} title={asset.name} category={asset.category} />
                            )) : (
                                <div className="text-center text-muted-foreground text-[10px] font-black uppercase italic">No assigned hardware.</div>
                            )}
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className="space-y-6">
                        <SectionHeader title="Fleet Composition" />
                        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius="30%" 
                                        outerRadius="100%" 
                                        barSize={12} 
                                        data={teamChartData}
                                        startAngle={180}
                                        endAngle={0}
                                    >
                                        <RadialBar
                                            label={{ position: 'insideStart', fill: '#fff', fontSize: '8px', fontWeight: 'bold' }}
                                            background
                                            dataKey="value"
                                            cornerRadius={10}
                                        />
                                        <PolarAngleAxis type="number" domain={[0, 20]} angleAxisId={0} tick={false} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-full space-y-2 mt-4">
                                {teamChartData.map((t: any) => (
                                    <div key={t.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="size-2 rounded-full" style={{ backgroundColor: t.fill }} />
                                            <span className="text-[10px] font-bold uppercase truncate max-w-[120px]">{t.name}</span>
                                        </div>
                                        <span className="text-[10px] font-black">{t.value} Units</span>
                                    </div>
                                ))}
                                {teamChartData.length === 0 && <p className="text-center text-xs text-muted-foreground italic">No tactical units identified.</p>}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4">
                        <DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Identity Asset Sync</DialogTitle>
                        <DialogDescription>Update your professional portrait or tactical emoji.</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                         <div className="flex flex-col items-center gap-6 py-4 text-center">
                            <div className="p-6 rounded-3xl bg-primary/5 border-2 border-dashed border-primary/20 w-full">
                                <ImageIcon className="size-10 text-primary opacity-30 mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Professional Portrait Selection</p>
                            </div>
                            <div className="relative w-full">
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleAvatarImageUpload(e.target.files[0])} disabled={isUploadingAvatar} />
                                <Button className="w-full rounded-2xl h-14 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={isUploadingAvatar}>
                                    {isUploadingAvatar ? <Loader2 className="size-4 animate-spin"/> : "Upload Image Registry"}
                                </Button>
                            </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-6 gap-3">
                            {emojiCategories.People.slice(0, 6).map(emoji => (
                                <button key={emoji} onClick={() => handleAvatarEmojiUpdate(emoji)} className="text-3xl p-2 rounded-xl hover:bg-primary/5 transition-all">{emoji}</button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">Phone Number</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase opacity-60">Employment Status</Label>
                                    <div className="p-3 bg-muted/30 rounded-xl border border-dashed text-[10px] font-bold uppercase text-muted-foreground flex items-center justify-between">
                                        {employee.employmentType || "Employee"}
                                        <Lock className="size-3 opacity-40" />
                                    </div>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest italic">Contact HR to re-classify status.</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">New Password (Optional)</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-60">Confirm New Password</FormLabel><FormControl><Input {...field} type="password" placeholder="••••••••" className="rounded-xl h-11" /></FormControl></FormItem>
                                )} />
                            </div>
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
            <div className="p-2 rounded-lg bg-primary/5 text-primary/60 mt-0.5"><Icon className="size-3.5" /></div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                <p className="text-xs font-bold text-foreground/80">{value}</p>
            </div>
        </div>
    )
}

function MetricCard({ label, value, sub, icon: Icon, iconColor, bgColor }: any) {
    return (
        <Card className="border-none shadow-sm rounded-3xl bg-white p-6 space-y-4 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
                <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110", bgColor, iconColor)}><Icon className="size-5" /></div>
            </div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                <p className="text-2xl font-black tracking-tight">{value}</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{sub}</p>
            </div>
        </Card>
    )
}

function SectionHeader({ title, href }: { title: string, href?: string }) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/80">{title}</h3>
            {href && <Link href={href} className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4">Browse Vault</Link>}
        </div>
    )
}

function TimelineItem({ icon: Icon, color, title, time, desc }: any) {
    return (
        <div className="flex gap-6 items-start">
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10", color)}><Icon className="size-3.5" /></div>
            <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-xs text-foreground">{title}</p>
                    <span className="text-[9px] font-medium text-muted-foreground">{time}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function DocRow({ title, date, link }: any) {
    return (
        <Link href={link} target="_blank" className="flex items-center gap-4 p-4 hover:bg-muted/30 rounded-2xl transition-colors group">
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 font-black text-[10px]">DOC</div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{title}</p>
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest">Provisioned on {date}</p>
            </div>
            <ExternalLink className="size-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </Link>
    )
}

function AssetRow({ image, title, category }: any) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="h-12 w-12 rounded-2xl overflow-hidden ring-1 ring-border/50 group-hover:ring-primary/20 transition-all shrink-0">
                {image ? <img src={image} className="h-full w-full object-cover" alt="Asset" /> : <div className="h-full w-full bg-muted flex items-center justify-center"><Laptop className="size-4 opacity-20"/></div>}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{title}</p>
                <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">{category}</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 border-none px-2.5">In Use</Badge>
        </div>
    )
}

function ExperienceBadge({ label, value, icon: Icon, color }: any) {
    return (
        <div className="group/badge relative flex items-center gap-3 bg-white ring-1 ring-border/50 shadow-sm rounded-2xl p-2 px-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className={cn("p-2 rounded-xl text-white shadow-sm", color)}>
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-0.5">{label}</p>
                <p className="text-xs font-black whitespace-nowrap">{value}</p>
            </div>
        </div>
    )
}
