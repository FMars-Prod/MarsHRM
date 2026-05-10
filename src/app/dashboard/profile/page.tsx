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
import { Edit, Smile, MapPin, LocateFixed, Clock, Camera, CheckCircle2, ShieldCheck, Save, History, ExternalLink, FileText, Zap, Lock } from "lucide-react";
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
                canUpdateSignature: false // LOCK after upload
            });
            toast({ title: "Identity Asset Saved", description: "Your digital signature has been provisioned." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Bucket Error", description: "Use 'Manual URL' tab if Storage bucket initialization is pending." });
        } finally {
            setIsUploadingSignature(false);
        }
    };

    const handleManualSignatureSave = () => {
        if (!userDocRef || !manualSignatureUrl) return;
        updateDocumentNonBlocking(userDocRef, { 
            signatureUrl: manualSignatureUrl, 
            signatureStatus: 'approved',
            canUpdateSignature: false // LOCK after sync
        });
        toast({ title: "Identity URL Saved", description: "Digital asset synchronized." });
    };

    if (isUserLoading || isEmployeeLoading) return <div className="p-10 text-center animate-pulse uppercase font-black text-xs">Synchronizing Identity Hub...</div>;
    if (!employee) return <div className="p-10 text-center">No identity record found.</div>;

    const isSignatureLocked = employee.signatureUrl && !employee.canUpdateSignature;

    return (
        <div className="space-y-6">
            <PageHeader title="Identity Control" description="Manage personal geofencing and digital signature assets." />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="items-center text-center relative pt-10">
                            <Avatar className="h-24 w-24 relative group ring-2 ring-primary ring-offset-4">
                               {employee.avatar ? <span className="text-6xl">{employee.avatar}</span> : <AvatarFallback className="text-2xl">{employee.firstName?.[0]}{employee.lastName?.[0]}</AvatarFallback>}
                               <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Smile className="h-8 w-8 text-white" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-3xl">
                                        <DialogHeader><DialogTitle>Choose Your Avatar</DialogTitle></DialogHeader>
                                        <div className="max-h-[50vh] overflow-y-auto pr-2">
                                            {Object.entries(emojiCategories).map(([category, emojis]) => (
                                                <div key={category} className="mb-6">
                                                    <h3 className="font-black text-[10px] uppercase tracking-widest mb-3 text-muted-foreground">{category}</h3>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {emojis.map(emoji => (
                                                            <button key={emoji} onClick={() => handleAvatarUpdate(emoji)} className="text-3xl p-3 rounded-2xl hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20">{emoji}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </DialogContent>
                               </Dialog>
                            </Avatar>
                             <div className="mt-6">
                                <CardTitle className="font-headline text-2xl tracking-tight">{employee.firstName} {employee.lastName}</CardTitle>
                                <CardDescription className="uppercase text-[10px] font-black tracking-[0.2em] text-primary">{employee.jobTitle}</CardDescription>
                             </div>
                        </CardHeader>
                        <CardContent className="flex justify-center pb-8">
                             <Button variant="outline" size="sm" className="rounded-full font-bold uppercase text-[9px] tracking-widest px-6" onClick={() => setIsProfileDialogOpen(true)}><Edit className="size-3 mr-2"/> Edit Profile</Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
                        <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/> Digital Signature</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {employee.signatureUrl && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-muted/20 rounded-xl border border-dashed border-primary/20 flex items-center justify-center">
                                        <img src={employee.signatureUrl} alt="E-Signature" className="h-12 object-contain opacity-60" />
                                    </div>
                                    <div className="flex justify-center">
                                        <Badge className="bg-green-100 text-green-700 border-none rounded-full text-[9px] uppercase font-black"><CheckCircle2 className="size-3 mr-1.5"/> Identity Active</Badge>
                                    </div>
                                </div>
                            )}
                            
                            {isSignatureLocked ? (
                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col items-center text-center gap-2">
                                    <Lock className="size-4 text-primary opacity-40" />
                                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Protocol Locked</p>
                                    <p className="text-[8px] text-muted-foreground leading-relaxed">Identity asset verified. Reach out to Executive Oversight (Admin) to initiate a secure re-upload session.</p>
                                </div>
                            ) : (
                                <Tabs defaultValue="upload" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 rounded-lg bg-muted/50 h-10">
                                        <TabsTrigger value="upload" className="text-[10px] font-black uppercase">File Upload</TabsTrigger>
                                        <TabsTrigger value="url" className="text-[10px] font-black uppercase">Manual URL</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="upload" className="pt-4">
                                        <div className="relative">
                                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleSignatureUpload(e.target.files[0])} disabled={isUploadingSignature} />
                                            <Button className="w-full rounded-full h-10 text-[10px] font-black uppercase tracking-widest" disabled={isUploadingSignature}>
                                                {isUploadingSignature ? "Transmitting..." : "Upload Identity Asset"}
                                            </Button>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="url" className="pt-4 space-y-3">
                                        <div className="flex gap-2">
                                            <Input value={manualSignatureUrl} onChange={e => setManualSignatureUrl(e.target.value)} placeholder="Paste image URL..." className="h-10 text-xs rounded-xl" />
                                            <Button size="icon" className="h-10 w-10 rounded-xl" onClick={handleManualSignatureSave}><Save className="size-4" /></Button>
                                        </div>
                                        <p className="text-[8px] text-muted-foreground italic text-center">Bypass Storage bucket issues with a direct URL.</p>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm">
                        <CardHeader className="bg-muted/10 border-b">
                            <CardTitle className="text-lg font-headline flex items-center gap-2">
                                <History className="size-5 text-primary" />
                                Strategic Shift Intelligence
                            </CardTitle>
                            <CardDescription>Comprehensive history of your tactical shift submissions.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[450px]">
                                <div className="divide-y divide-border/50">
                                    {userReports.length > 0 ? userReports.map(r => (
                                        <div key={r.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                    <FileText className="size-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">{formatIST(r.date)}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge variant="outline" className="text-[8px] uppercase font-black tracking-widest">{r.reportType} LOG</Badge>
                                                        {r.criticalPathTomorrow && <span className="text-[9px] text-orange-600 font-bold flex items-center gap-1"><Zap className="size-2.5"/> T+1 Plan Set</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="rounded-full font-bold uppercase text-[10px] gap-2" asChild>
                                                <Link href="/dashboard/reports">
                                                    Review <ExternalLink className="size-3" />
                                                </Link>
                                            </Button>
                                        </div>
                                    )) : (
                                        <div className="py-20 text-center text-muted-foreground">
                                            <FileText className="size-10 mx-auto opacity-20 mb-3" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No Shift Intelligence Logs Found</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                        <CardHeader><CardTitle className="font-headline text-lg flex items-center gap-2"><LocateFixed className="size-5 text-primary"/> Geofenced Home Base</CardTitle><CardDescription>Approved residential geofence point for WFH logs.</CardDescription></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 bg-muted/20 rounded-2xl border flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registered Point</p>
                                    {employee?.homeLatitude ? (
                                        <Badge variant="outline" className="mt-2 h-8 px-4 rounded-full border-primary/20 bg-white shadow-sm">
                                            <MapPin className="size-3 mr-2 text-primary" />
                                            {employee.homeLatitude.toFixed(4)}, {employee.homeLongitude.toFixed(4)}
                                        </Badge>
                                    ) : <p className="text-sm font-bold text-orange-600 mt-2">Satellite Coordinate Not Set</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Edit Strategic Profile</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="firstName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase">First Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="lastName" render={({ field }) => (
                                    <FormItem><FormLabel className="text-[10px] font-black uppercase">Last Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-11" /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <Separator />
                            <DialogFooter className="pt-4">
                                <Button type="submit" className="w-full rounded-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20" disabled={isSubmitting}>{isSubmitting ? "Transmitting..." : "Update Identity"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
