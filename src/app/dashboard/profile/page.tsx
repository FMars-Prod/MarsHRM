
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { Edit, Smile, MapPin, Home } from "lucide-react";
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
import { mapsApiKey } from "@/firebase/config";
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
    "People": ["🧑", "👨", "👩", "🧓", "👴", "👵", "👮", "👷", "💂", "🏠", "🕵️", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️", "🧑‍🌾", "👨‍🌾", "👩‍🌾", "🧑‍🍳", "👨‍🍳", "👩‍🍳", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧑‍🎤", "👨‍🎤", "👩‍🎤", "🧑‍🏫", "👨‍🏫", "👩‍🏫", "🧑‍🏭", "👨‍🏭", "👩‍🏭", "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔧", "👨‍🔧", "👩‍🔧", "🧑‍🔬", "👨‍🔬", "👩‍🔬", "🧑‍🎨", "👨‍🎨", "👩‍🎨", "🧑‍🚒", "👨‍🚒", "👩‍🚒", "🧑‍✈️", "👨‍✈️", "👩‍✈️", "🧑‍🚀", "👨‍🚀", "👩‍🚀", "🧑‍⚖️", "👨‍⚖️", "👩‍⚖️", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟"],
    "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"],
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

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, "users", user.uid) : null),
        [user, firestore]
    );
    const { data: employee, isLoading: isEmployeeLoading } = useDoc(userDocRef);
    
    const officeLocationDocRef = useMemoFirebase(
        () => doc(firestore, "settings", "location"),
        [firestore]
    );
    const { data: officeLocation } = useDoc<Location>(officeLocationDocRef);

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
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to update your profile." });
            setIsSubmitting(false);
            return;
        }

        try {
            // Update Firestore document
            if (userDocRef) {
                updateDocumentNonBlocking(userDocRef, {
                    firstName: data.firstName,
                    lastName: data.lastName,
                });
            }

            // Update Auth display name
            await updateProfile(auth.currentUser, {
                displayName: `${data.firstName} ${data.lastName}`,
            });

            // Update password if provided
            if (data.password) {
                await updatePassword(auth.currentUser, data.password);
            }

            toast({ title: "Success", description: "Profile updated successfully." });
            setIsProfileDialogOpen(false);
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
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
        if (!userDocRef) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCapturedLocation({ latitude, longitude });

                const hasHomeLocation = (employee as any)?.homeLatitude && (employee as any)?.homeLongitude;
                if (hasHomeLocation) {
                    setIsRequestChangeOpen(true);
                } else {
                    setIsSetHomeLocationDialogOpen(true);
                }
            },
            (error) => {
                toast({
                    variant: 'destructive',
                    title: 'Location Error',
                    description: `Could not get your location: ${error.message}. Please enable location services in your browser.`
                });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };
    
    const handleConfirmSetHomeLocation = () => {
        if (!userDocRef || !capturedLocation) return;
        updateDocumentNonBlocking(userDocRef, {
            homeLatitude: capturedLocation.latitude,
            homeLongitude: capturedLocation.longitude,
        });
        toast({
            title: "Home Location Saved",
            description: selectedAddress,
        });
        setCapturedLocation(null);
        setIsSetHomeLocationDialogOpen(false);
    };

    const handleLocationConfirmed = () => {
        setIsRequestChangeOpen(false);
        setIsReasonDialogOpen(true);
    };

    const handleSubmitChangeRequest = () => {
        if (!user || !userDocRef || !changeReason || !capturedLocation) {
            toast({ variant: 'destructive', title: 'Reason Required', description: 'Please explain why you need to change your location.'});
            return;
        }

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

        toast({ title: 'Request Submitted', description: `New location: ${selectedAddress}` });
        setIsReasonDialogOpen(false);
        setChangeReason("");
        setCapturedLocation(null);
    };


    if (isUserLoading || isEmployeeLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative h-16 w-48 animate-pulse">
                        <Image
                          src="https://fortumars.com/fortumarslogo.png"
                          alt="FortuMars Logo"
                          fill
                          style={{ objectFit: 'contain' }}
                          priority
                        />
                    </div>
                    <p className="text-muted-foreground">Loading Profile...</p>
                </div>
            </div>
        );
    }

    if (!employee) {
        return <p>No employee data found.</p>;
    }

    const employeeAvatar = (employee as any)?.avatar;
    const isWfh = (employee as any)?.isWfhAllowed;
    const employmentType = (employee as any)?.employmentType || "Intern";

    return (
        <>
            <PageHeader
                title="My Profile"
                description="View and manage your personal information."
            />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="items-center text-center relative">
                            <Avatar className={cn("h-24 w-24 relative group", employeeAvatar && "bg-transparent")}>
                               {employeeAvatar ? (
                                   <span className="text-6xl">{employeeAvatar}</span>
                               ) : (
                                <AvatarFallback className="text-3xl">
                                    {(employee as any).firstName?.charAt(0)}{(employee as any).lastName?.charAt(0)}
                                </AvatarFallback>
                               )}
                               <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Smile className="h-8 w-8 text-white" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Choose Your Avatar</DialogTitle>
                                        </DialogHeader>
                                        <div className="max-h-[50vh] overflow-y-auto">
                                            {Object.entries(emojiCategories).map(([category, emojis]) => (
                                                <div key={category}>
                                                    <h3 className="font-semibold text-lg sticky top-0 bg-background py-2">{category}</h3>
                                                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                                                        {emojis.map(emoji => (
                                                            <button 
                                                                key={emoji} 
                                                                onClick={() => handleAvatarUpdate(emoji)}
                                                                className="text-3xl p-2 rounded-lg hover:bg-accent"
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
                            </Avatar>
                             <div className="mt-4 space-y-2">
                                <CardTitle className="font-headline text-2xl">{(employee as any).firstName} {(employee as any).lastName}</CardTitle>
                                <CardDescription>{(employee as any).jobTitle}</CardDescription>
                                <div className="flex flex-wrap justify-center gap-2 mt-2">
                                    <Badge variant="outline" className="font-semibold">{employmentType}</Badge>
                                    {isWfh && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-semibold px-3 py-1 gap-1">
                                            <Home className="h-3 w-3" />
                                            Work From Home
                                        </Badge>
                                    )}
                                </div>
                             </div>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full rounded-full">
                                        <Edit className="mr-2 h-4 w-4"/> Edit Profile
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Edit Profile</DialogTitle>
                                        <DialogDescription>
                                            Make changes to your profile here. Click save when you're done.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>First Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="John" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Last Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Doe" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                             <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="john.doe@example.com" value={(employee as any)?.email || ''} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>New Password (optional)</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="confirmPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Confirm New Password</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="••••••••" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <DialogFooter>
                                                <DialogClose asChild>
                                                    <Button type="button" variant="outline">Cancel</Button>
                                                </DialogClose>
                                                <Button type="submit" disabled={isSubmitting}>
                                                    {isSubmitting ? "Saving..." : "Save Changes"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="font-headline">Personal Information</CardTitle>
                            <CardDescription>Details about your employment.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">First Name</p>
                                    <p className="font-semibold">{(employee as any).firstName}</p>
                                </div>
                                 <div>
                                    <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                                    <p className="font-semibold">{(employee as any).lastName}</p>
                                </div>
                            </div>
                             <div>
                                <p className="text-sm font-medium text-muted-foreground">Email</p>
                                <p className="font-semibold">{(employee as any).email}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                                    <p className="font-semibold">{(employee as any).department}</p>
                                </div>
                                 <div>
                                    <p className="text-sm font-medium text-muted-foreground">Job Title</p>
                                    <p className="font-semibold">{(employee as any).jobTitle}</p>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Hire Date</p>
                                    <p className="font-semibold">{new Date((employee as any).hireDate).toLocaleDateString()}</p>
                                </div>
                                 <div>
                                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                                    <p className="font-semibold">{(employee as any).role}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Employment Type</p>
                                <p className="font-semibold">{employmentType}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="font-headline">Work From Home</CardTitle>
                            <CardDescription>Manage your home location for remote work clock-ins.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Saved Home Location</p>
                                {(employee as any)?.homeLatitude && (employee as any)?.homeLongitude ? (
                                    <p className="font-semibold">{`Lat: ${(employee as any).homeLatitude.toFixed(4)}, Lon: ${(employee as any).homeLongitude.toFixed(4)}`}</p>
                                ) : (
                                    <p className="font-semibold text-muted-foreground">Not set</p>
                                )}
                            </div>
                            <Button onClick={handleLocationAction} disabled={hasPendingRequest || !(employee as any)?.isWfhAllowed} className="rounded-full">
                                <MapPin className="mr-2 h-4 w-4" />
                                {(employee as any)?.homeLatitude ? 'Request Location Change' : 'Set Home Location'}
                            </Button>
                             {hasPendingRequest && (
                                <p className="text-sm text-yellow-600 mt-2">
                                    You have a pending location change request.
                                </p>
                            )}
                             {!(employee as any)?.isWfhAllowed && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    Work From Home is not enabled for your account. Please contact an administrator.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isSetHomeLocationDialogOpen} onOpenChange={setIsSetHomeLocationDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Set Home Location</DialogTitle>
                        <DialogDescription>
                            Your current location is pinned below. Drag the pin, click the map, or use search to adjust it.
                        </DialogDescription>
                    </DialogHeader>
                    {capturedLocation && (
                        <div className="space-y-2">
                            <div className="aspect-video w-full rounded-md overflow-hidden border">
                                <InteractiveMap
                                    initialCenter={{ lat: capturedLocation.latitude, lng: capturedLocation.longitude }}
                                    onLocationSelect={({ lat, lng, address }) => {
                                        setCapturedLocation({ latitude: lat, longitude: lng });
                                        setSelectedAddress(address);
                                    }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">{selectedAddress}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsSetHomeLocationDialogOpen(false); setCapturedLocation(null); }}>Cancel</Button>
                        <Button onClick={handleConfirmSetHomeLocation}>Save and Set Location</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={isRequestChangeOpen} onOpenChange={setIsRequestChangeOpen}>
                 <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Step 1: Select New Location</DialogTitle>
                        <DialogDescription>
                            Use the map to pinpoint your new home location for approval.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1">
                       <div className="p-6">
                            {capturedLocation && (
                                <div className="space-y-2">
                                    <div className="aspect-video w-full rounded-md overflow-hidden border">
                                        <InteractiveMap
                                            initialCenter={{ lat: capturedLocation.latitude, lng: capturedLocation.longitude }}
                                            onLocationSelect={({ lat, lng, address }) => {
                                                setCapturedLocation({ latitude: lat, longitude: lng });
                                                setSelectedAddress(address);
                                            }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground p-2 bg-muted rounded-md">{selectedAddress}</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="p-6 pt-4 border-t">
                        <Button variant="outline" onClick={() => { setIsRequestChangeOpen(false); setCapturedLocation(null); }}>Cancel</Button>
                        <Button onClick={handleLocationConfirmed}>Confirm & Continue</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Step 2: Reason for Change</DialogTitle>
                        <DialogDescription>
                            Please provide a brief reason for this location change request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea 
                            id="reason" 
                            value={changeReason}
                            onChange={(e) => setChangeReason(e.target.value)}
                            placeholder="e.g., I have moved to a new address." 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsReasonDialogOpen(false); setChangeReason(""); }}>Cancel</Button>
                        <Button onClick={handleSubmitChangeRequest}>Submit Request</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
