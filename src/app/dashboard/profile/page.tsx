
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser, useStorage } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc, collection, query, where, serverTimestamp, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Edit, Smile, MapPin, LocateFixed, Clock, Camera, CheckCircle2, ShieldCheck, Save, History, ExternalLink, FileText, Zap, Lock, Users, CalendarDays, Grid, ShieldAlert, FileBox } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { updateDocumentNonBlocking, addDocumentNonBlocking, useCollection } from "@/firebase";
import Image from 'next/image';
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { format } from "date-fns";

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
    const [manualSignatureUrl, setManualSignatureUrl] = React.useState("");
    const [userReports, setUserReports] = React.useState<any[]>([]);

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
    const { data: employee, isLoading: isEmployeeLoading } = useDoc<any>(userDocRef);

    const teamDocRef = useMemoFirebase(() => employee?.teamId ? doc(firestore, "teams", employee.teamId) : null, [employee, firestore]);
    const { data: teamData } = useDoc<any>(teamDocRef);

    const docsQuery = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/documents`) : null, [user, firestore]);
    const { data: documents } = useCollection(docsQuery);

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
                const q = query(collection(firestore, `users/${user.uid}/reports`), orderBy('date', 'desc'), limit(20));
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
    
    const handleAvatarUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Avatar updated!" });
        setIsAvatarDialogOpen(false);
    }

    const handleSignatureUpload = async (file: File) => {
        if (!user || !userDocRef) return;
        setIsUploadingSignature(true);
        try {
            const sigRef = ref(storage, `signatures/${user.uid}/${Date.now()}-${file.name}`);
            const snap = await uploadBytes(sigRef, file);
            const url = await getDownloadURL(snap.ref);
            updateDocumentNonBlocking(userDocRef, { 
                signatureUrl: url, 
                signatureStatus: 'approved',
                canUpdateSignature: false 
            });
            toast({ title: "Identity Asset Saved" });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Upload Error" });
        } finally {
            setIsUploadingSignature(false);
        }
    };

    const handleManualSignatureSave = () => {
        if (!userDocRef || !manualSignatureUrl) return;
        updateDocumentNonBlocking(userDocRef, { 
            signatureUrl: manualSignatureUrl, 
            signatureStatus: 'approved',
            canUpdateSignature: false 
        });
        toast({ title: "Identity URL Saved" });
    };

    if (isUserLoading || isEmployeeLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Synchronizing Identity Hub...</div>;
    if (!employee) return <div className="p-10 text-center">No identity record found.</div>;

    const isSignatureLocked = employee.signatureUrl && !employee.canUpdateSignature;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up pb-20">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-20 px-6 py-10">
                <div className="relative group cursor-pointer" onClick={() => setIsAvatarDialogOpen(true)}>
                    <Avatar className="size-24 md:size-36 rounded-full ring-4 ring-primary/20 ring-offset-4 overflow-hidden bg-muted flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-105">
                        {employee.avatar ? (
                            <div className="flex items-center justify-center w-full h-full">
                                <span className="text-6xl md:text-8xl">{employee.avatar}</span>
                            </div>
                        ) : (
                            <AvatarFallback className="text-4xl">
                                {employee.firstName?.[0]}{employee.lastName?.[0]}
                            </AvatarFallback>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <Smile className="size-10 text-white" />
                        </div>
                    </Avatar>
                </div>

                <div className="flex-1 space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <h2 className="text-2xl font-light tracking-tight text-foreground/90">{employee.firstName} {employee.lastName}</h2>
                        <div className="flex gap-2">
                            <Button onClick={() => setIsProfileDialogOpen(true)} size="sm" variant="outline" className="h-8 rounded-lg font-bold text-[11px] px-6 bg-white/50 backdrop-blur-sm">
                                Edit Profile
                            </Button>
                            {teamData && (
                                <Badge variant="secondary" className="rounded-lg px-3 text-[10px] uppercase font-black tracking-widest bg-muted/50 border-none">
                                    <Users className="size-3 mr-1.5 opacity-50" /> {teamData.name}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-8 md:gap-12 py-1">
                        <div className="text-center md:text-left">
                            <p className="font-black text-lg">{userReports.length}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Reports</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="font-black text-lg">{documents?.length || 0}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Documents</p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="font-black text-lg">{(employee.totalHours || 0).toFixed(1)}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Hours</p>
                        </div>
                    </div>

                    <div className="text-center md:text-left space-y-1">
                        <p className="font-bold text-sm">{employee.jobTitle}</p>
                        <p className="text-sm text-muted-foreground">{employee.department} Division</p>
                        {employee.hireDate && (
                            <p className="text-xs text-muted-foreground flex items-center justify-center md:justify-start gap-1 pt-2">
                                <CalendarDays className="size-3" /> Joined {format(new Date(employee.hireDate), 'MMMM yyyy')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <Separator className="opacity-50" />

            <Tabs defaultValue="feed" className="w-full">
                <TabsList className="w-full justify-center bg-transparent border-none rounded-none h-14 space-x-12">
                    <TabsTrigger value="feed" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                        <Grid className="size-4"/> Tactical Feed
                    </TabsTrigger>
                    <TabsTrigger value="docs" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                        <FileBox className="size-4"/> Vault
                    </TabsTrigger>
                    <TabsTrigger value="identity" className="rounded-none h-full data-[state=active]:border-t-2 data-[state=active]:border-foreground px-0 bg-transparent flex gap-2 font-black uppercase text-[10px] tracking-widest transition-none">
                        <ShieldCheck className="size-4"/> Digital Asset
                    </TabsTrigger>
                </TabsList>

                <div className="pt-4 px-4 md:px-0">
                    <TabsContent value="feed" className="mt-0">
                        <Card className="border-none rounded-3xl shadow-sm bg-white/30 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-[10px] font-black uppercase opacity-60">Strategic Shift Intelligence</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[450px]">
                                    <div className="divide-y divide-border/30">
                                        {userReports.length > 0 ? userReports.map(r => (
                                            <div key={r.id} className="p-5 hover:bg-muted/20 transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                        <FileText className="size-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{formatIST(r.date)}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <Badge variant="outline" className="text-[8px] uppercase font-black tracking-widest">{r.reportType} LOG</Badge>
                                                            {r.criticalPathTomorrow && <span className="text-[9px] text-orange-600 font-bold flex items-center gap-1"><Zap className="size-2.5"/> Plan Set</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" className="rounded-full font-bold uppercase text-[10px] gap-2 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                    <Link href="/dashboard/reports">
                                                        Review <ExternalLink className="size-3" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        )) : (
                                            <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                                                <FileText className="size-12" />
                                                <p className="text-[10px] font-black uppercase">No Shift Logs Found</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="docs" className="mt-0">
                         <Card className="border-none rounded-3xl shadow-sm bg-white/30 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-[10px] font-black uppercase opacity-60">Digital Asset Registry</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[450px]">
                                    <div className="divide-y divide-border/30">
                                        {documents && documents.length > 0 ? documents.map(d => (
                                            <div key={d.id} className="p-5 hover:bg-muted/20 transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2.5 rounded-xl bg-blue-500/5 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                        <FileBox className="size-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{d.title}</p>
                                                        <p className="text-[8px] uppercase font-black tracking-widest text-muted-foreground">Linked {formatIST(d.uploadedAt)}</p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" className="rounded-full font-bold uppercase text-[10px] gap-2" asChild>
                                                    <Link href={d.link} target="_blank">
                                                        Access <ExternalLink className="size-3" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        )) : (
                                            <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                                                <FileBox className="size-12" />
                                                <p className="text-[10px] font-black uppercase">No Digital Assets</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="identity" className="mt-0">
                        <Card className="border-none rounded-3xl shadow-sm bg-white/30 backdrop-blur-sm overflow-hidden">
                            <CardHeader className="bg-muted/10 border-b">
                                <CardTitle className="text-[10px] font-black uppercase opacity-60">Identity Certification Asset</CardTitle>
                            </CardHeader>
                            <CardContent className="p-10 flex flex-col items-center text-center space-y-8">
                                {employee.signatureUrl ? (
                                    <div className="space-y-6 w-full max-w-sm">
                                        <div className="p-8 bg-white/80 rounded-3xl border-2 border-dashed border-primary/20 flex items-center justify-center shadow-sm relative group">
                                            <img src={employee.signatureUrl} alt="E-Signature" className="h-20 object-contain opacity-60 grayscale transition-all group-hover:grayscale-0" />
                                        </div>
                                        <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[10px] uppercase font-black px-4 py-1.5"><CheckCircle2 className="size-3 mr-1.5"/> Identity Verified</Badge>
                                    </div>
                                ) : (
                                    <div className="aspect-video bg-white/40 rounded-3xl border-2 border-dashed border-muted/50 flex flex-col items-center justify-center opacity-40 w-full max-w-sm">
                                        <Camera className="size-8 mb-2" />
                                        <p className="text-[10px] font-black uppercase">Identity asset missing</p>
                                    </div>
                                )}
                                
                                {isSignatureLocked ? (
                                    <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col items-center text-center gap-2 max-w-xs">
                                        <Lock className="size-5 text-primary opacity-40" />
                                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Protocol Locked</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">Identity asset verified. Reach out to Executive Oversight (Admin) to initiate a secure re-upload session.</p>
                                    </div>
                                ) : (
                                    <div className="w-full max-w-sm space-y-6">
                                        <Tabs defaultValue="upload" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/30 h-11 p-1">
                                                <TabsTrigger value="upload" className="text-[10px] font-black uppercase rounded-lg">File Upload</TabsTrigger>
                                                <TabsTrigger value="url" className="text-[10px] font-black uppercase rounded-lg">Manual URL</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="upload" className="pt-6">
                                                <div className="relative group">
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploadingSignature} />
                                                    <Button className="w-full rounded-2xl h-14 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20" disabled={isUploadingSignature}>
                                                        {isUploadingSignature ? "Transmitting..." : "Upload Identity Asset"}
                                                    </Button>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="url" className="pt-6 space-y-4">
                                                <div className="flex gap-2 p-1 bg-white rounded-2xl ring-1 ring-border shadow-sm">
                                                    <Input value={manualSignatureUrl} onChange={e => setManualSignatureUrl(e.target.value)} placeholder="Sync direct image URL..." className="h-12 border-none focus-visible:ring-0 shadow-none text-xs" />
                                                    <Button size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleManualSignatureSave}><Save className="size-5" /></Button>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>

            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Identity Avatar</DialogTitle></DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(emojiCategories).map(([category, emojis]) => (
                            <div key={category} className="mb-8">
                                <h3 className="font-black text-[10px] uppercase tracking-[0.3em] mb-4 text-muted-foreground/60">{category}</h3>
                                <div className="grid grid-cols-4 gap-3">
                                    {emojis.map(emoji => (
                                        <button 
                                            key={emoji} 
                                            onClick={() => handleAvatarUpdate(emoji)} 
                                            className="text-4xl p-4 rounded-2xl hover:bg-primary/5 transition-all border border-transparent hover:border-primary/20 transform hover:scale-110"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Profile</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-60">First Name</FormLabel>
                                        <FormControl><Input {...field} className="rounded-xl h-11 bg-muted/30 border-none ring-1 ring-border/50" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-60">Last Name</FormLabel>
                                        <FormControl><Input {...field} className="rounded-xl h-11 bg-muted/30 border-none ring-1 ring-border/50" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <Separator />
                            <DialogFooter className="pt-2">
                                <Button type="submit" className="w-full rounded-2xl h-14 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>
                                    {isSubmitting ? "Transmitting..." : "Update Fleet Identity"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
