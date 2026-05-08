
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { Edit, Smile, MapPin, Home, LocateFixed, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { InteractiveMap } from "@/components/geohrm/interactive-map";
import { Badge } from "@/components/ui/badge";

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

type LocationChangeRequest = {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    requestDate: any;
};

const emojiCategories = {
    "People": ["🧑", "👨", "👩", "👮", "👷", "🏠", "🕵️", "🧑‍💻", "👨‍💻", "👩‍💻", "🦸", "🦹", "🧙", "🧚"],
    "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "😊", "😇", "🙂", "😎", "🤩", "🥳", "🤔", "🤫"],
};

interface Location {
  latitude: number;
  longitude: number;
}

export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);
    const [isRequestChangeOpen, setIsRequestChangeOpen] = React.useState(false);
    const [isReasonDialogOpen, setIsReasonDialogOpen] = React.useState(false);
    const [changeReason, setChangeReason] = React.useState("");
    const [isSetHomeLocationDialogOpen, setIsSetHomeLocationDialogOpen] = React.useState(false);
    const [capturedLocation, setCapturedLocation] = React.useState<Location | null>(null);
    const [selectedAddress, setSelectedAddress] = React.useState<string>("Getting address...");
    const [isVerifyingLocation, setIsVerifyingLocation] = React.useState(false);

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, "users", user.uid) : null),
        [user, firestore]
    );
    const { data: employee, isLoading: isEmployeeLoading } = useDoc(userDocRef);
    
    const userRole = (employee as any)?.role;
    const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

    const pendingLocationRequestQuery = useMemoFirebase(
        () => user ? query(
            collection(firestore, "location_change_requests"),
            where("employeeId", "==", user.uid),
            where("status", "==", "pending")
        ) : null,
        [user, firestore]
    );
    const { data: pendingRequests } = useCollection<LocationChangeRequest>(pendingLocationRequestQuery);
    const hasPendingRequest = pendingRequests && pendingRequests.length > 0;

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            password: "",
            confirmPassword: "",
        },
    });

    React.useEffect(() => {
        if (employee) {
            form.reset({
                firstName: (employee as any).firstName || '',
                lastName: (employee as any).lastName || '',
                password: '',
                confirmPassword: '',
            });
        }
    }, [employee, form]);
    
    async function onSubmit(data: ProfileFormValues) {
        setIsSubmitting(true);
        if (!user || !auth.currentUser) {
            toast({ variant: "destructive", title: "Error", description: "Login required." });
            setIsSubmitting(false);
            return;
        }
        try {
            if (userDocRef) {
                updateDocumentNonBlocking(userDocRef, {
                    firstName: data.firstName,
                    lastName: data.lastName,
                });
            }
            await updateProfile(auth.currentUser, { displayName: `${data.firstName} ${data.lastName}` });
            if (data.password) await updatePassword(auth.currentUser, data.password);
            toast({ title: "Profile Updated" });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleAvatarUpdate = (emoji: string) => {
        if (!userDocRef) return;
        updateDocumentNonBlocking(userDocRef, { avatar: emoji });
        toast({ title: "Avatar updated!" });
        setIsAvatarDialogOpen(false);
    }
    
    const handleLocationAction = () => {
        setIsVerifyingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCapturedLocation({ latitude, longitude });
                setIsVerifyingLocation(false);
                setIsRequestChangeOpen(true);
            },
            (error) => {
                setIsVerifyingLocation(false);
                toast({ variant: 'destructive', title: 'Location Error' });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };
    
    const handleSubmitChangeRequest = () => {
        if (!user || !changeReason || !capturedLocation) return;
        const requestPayload = {
            employeeId: user.uid,
            employeeName: `${(employee as any).firstName} ${(employee as any).lastName}`,
            requestDate: serverTimestamp(),
            newLatitude: capturedLocation.latitude,
            newLongitude: capturedLocation.longitude,
            reason: changeReason,
            status: 'pending',
        };
        addDocumentNonBlocking(collection(firestore, 'location_change_requests'), requestPayload);
        toast({ title: 'Request Submitted' });
        setIsReasonDialogOpen(false);
        setChangeReason("");
    };

    if (isUserLoading || isEmployeeLoading) return <div className="p-10 text-center">Loading Profile...</div>;
    if (!employee) return <div className="p-10 text-center">No employee record found.</div>;

    return (
        <div className="space-y-6">
            <PageHeader title="My Profile" description="Manage personal WFH and security settings." />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="items-center text-center relative">
                            <Avatar className="h-24 w-24 relative group">
                               {(employee as any).avatar ? <span className="text-6xl">{(employee as any).avatar}</span> : <AvatarFallback>{(employee as any).firstName?.[0]}</AvatarFallback>}
                               <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Smile className="h-8 w-8 text-white" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>Choose Your Avatar</DialogTitle></DialogHeader>
                                        <div className="max-h-[50vh] overflow-y-auto">
                                            {Object.entries(emojiCategories).map(([category, emojis]) => (
                                                <div key={category}>
                                                    <h3 className="font-semibold text-lg py-2">{category}</h3>
                                                    <div className="grid grid-cols-6 gap-2">
                                                        {emojis.map(emoji => (
                                                            <button key={emoji} onClick={() => handleAvatarUpdate(emoji)} className="text-3xl p-2 rounded-lg hover:bg-accent">{emoji}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </DialogContent>
                               </Dialog>
                            </Avatar>
                             <div className="mt-4">
                                <CardTitle className="font-headline text-2xl">{(employee as any).firstName} {(employee as any).lastName}</CardTitle>
                                <CardDescription>{(employee as any).jobTitle}</CardDescription>
                             </div>
                        </CardHeader>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                        <CardHeader><CardTitle className="font-headline">WFH Precision Registry</CardTitle><CardDescription>Set or request residential geofence points.</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Current Home Base</p>
                                {(employee as any)?.homeLatitude ? (
                                    <Badge variant="outline" className="mt-1">
                                        <MapPin className="size-3 mr-1" />
                                        {(employee as any).homeLatitude.toFixed(4)}, {(employee as any).homeLongitude.toFixed(4)}
                                    </Badge>
                                ) : <p className="text-sm font-bold text-orange-600 mt-1">Not Set</p>}
                            </div>
                            <Button onClick={handleLocationAction} disabled={hasPendingRequest} className="rounded-full">
                                <LocateFixed className="mr-2 h-4 w-4" />
                                {hasPendingRequest ? 'Change Request Pending' : 'Update Home Location'}
                            </Button>
                             {hasPendingRequest && <p className="text-xs text-yellow-600 font-bold">🟡 Request is awaiting executive approval.</p>}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isRequestChangeOpen} onOpenChange={setIsRequestChangeOpen}>
                 <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Verify Point</DialogTitle></DialogHeader>
                    {capturedLocation && (
                        <div className="space-y-4">
                            <div className="aspect-video w-full rounded-md overflow-hidden border">
                                <InteractiveMap 
                                    initialCenter={{ lat: capturedLocation.latitude, lng: capturedLocation.longitude }} 
                                    onLocationSelect={({ lat, lng, address }) => { 
                                        setCapturedLocation({ latitude: lat, longitude: lng }); 
                                        setSelectedAddress(address); 
                                    }} 
                                />
                            </div>
                            <div className="bg-muted p-3 rounded-lg text-xs font-mono">{selectedAddress}</div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRequestChangeOpen(false)}>Cancel</Button>
                        <Button onClick={() => { setIsRequestChangeOpen(false); setIsReasonDialogOpen(true); }}>Next: Justification</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Residential Change Reason</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <Label>Reason for WFH Location Update</Label>
                        <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g., Moving to new residence..." />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReasonDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitChangeRequest}>Submit for Approval</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
