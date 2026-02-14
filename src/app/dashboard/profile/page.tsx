
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc } from "firebase/firestore";
import { Edit, Smile, MapPin } from "lucide-react";
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
import { updateDocumentNonBlocking } from "@/firebase";
import Image from 'next/image';

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
    "People": ["🧑", "👨", "👩", "🧓", "👴", "👵", "👮", "👷", "💂", "🕵️", "🧑‍⚕️", "👨‍⚕️", "👩‍⚕️", "🧑‍🌾", "👨‍🌾", "👩‍🌾", "🧑‍🍳", "👨‍🍳", "👩‍🍳", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧑‍🎤", "👨‍🎤", "👩‍🎤", "🧑‍🏫", "👨‍🏫", "👩‍🏫", "🧑‍🏭", "👨‍🏭", "👩‍🏭", "🧑‍💻", "👨‍💻", "👩‍💻", "🧑‍💼", "👨‍💼", "👩‍💼", "🧑‍🔧", "👨‍🔧", "👩‍🔧", "🧑‍🔬", "👨‍🔬", "👩‍🔬", "🧑‍🎨", "👨‍🎨", "👩‍🎨", "🧑‍🚒", "👨‍🚒", "👩‍🚒", "🧑‍✈️", "👨‍✈️", "👩‍✈️", "🧑‍🚀", "👨‍🚀", "👩‍🚀", "🧑‍⚖️", "👨‍⚖️", "👩‍⚖️", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟"],
    "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠"],
};


export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = React.useState(false);


    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, "users", user.uid) : null),
        [user, firestore]
    );
    const { data: employee, isLoading: isEmployeeLoading } = useDoc(userDocRef);

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
    
    const handleSetHomeLocation = () => {
        if (!userDocRef) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                updateDocumentNonBlocking(userDocRef, {
                    homeLatitude: latitude,
                    homeLongitude: longitude,
                });
                toast({
                    title: "Home Location Saved",
                    description: `Your home location has been updated.`,
                });
            },
            () => {
                toast({
                    variant: "destructive",
                    title: "Location Error",
                    description: "Could not get your location. Please enable location services.",
                });
            },
            { enableHighAccuracy: true }
        );
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

    return (
        <>
            <PageHeader
                title="My Profile"
                description="View and manage your personal information."
            />
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="items-center text-center">
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
                             <CardTitle className="font-headline text-2xl mt-4">{(employee as any).firstName} {(employee as any).lastName}</CardTitle>
                             <CardDescription>{(employee as any).jobTitle}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full">
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
                <div className="lg:col-span-2 space-y-6">
                    <Card>
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
                        </CardContent>
                    </Card>
                    <Card>
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
                            <Button onClick={handleSetHomeLocation}>
                                <MapPin className="mr-2 h-4 w-4" />
                                Set/Update Home Location
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}
