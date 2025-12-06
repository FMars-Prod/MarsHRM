
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/firebase";
import { useDoc } from "@/firebase/firestore/use-doc";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirestore, useMemoFirebase } from "@/firebase/provider";
import { doc } from "firebase/firestore";
import { Camera, Edit, Building2 } from "lucide-react";
import Image from "next/image";

export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, "users", user.uid) : null),
        [user, firestore]
    );
    const { data: employee, isLoading: isEmployeeLoading } = useDoc(userDocRef);
    

    const userAvatar = PlaceHolderImages.find(
        (image) => image.id === "user-avatar-1"
    );

    if (isUserLoading || isEmployeeLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                <Building2 className="h-12 w-12 animate-pulse" />
                <p className="text-muted-foreground">Loading Profile...</p>
                </div>
            </div>
        );
    }

    if (!employee) {
        return <p>No employee data found.</p>;
    }

    return (
        <>
            <PageHeader
                title="My Profile"
                description="View and manage your personal information."
            />
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader className="items-center text-center">
                        <div className="relative">
                            <Avatar className="h-24 w-24">
                                {user?.photoURL ? (
                                <Image
                                    src={user.photoURL}
                                    alt={user.displayName || 'User avatar'}
                                    width={96}
                                    height={96}
                                    className="object-cover"
                                />
                                ) : userAvatar && (
                                <Image
                                    src={userAvatar.imageUrl}
                                    alt={userAvatar.description}
                                    width={96}
                                    height={96}
                                    data-ai-hint={userAvatar.imageHint}
                                    className="object-cover"
                                />
                                )}
                                <AvatarFallback className="text-3xl">
                                    {(employee as any).firstName?.charAt(0)}{(employee as any).lastName?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <Button variant="outline" size="icon" className="absolute bottom-0 right-0 rounded-full">
                                <Camera className="h-4 w-4" />
                                <span className="sr-only">Change Photo</span>
                            </Button>
                        </div>
                         <CardTitle className="font-headline text-2xl mt-4">{(employee as any).firstName} {(employee as any).lastName}</CardTitle>
                         <CardDescription>{(employee as any).jobTitle}</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button className="w-full">
                            <Edit className="mr-2 h-4 w-4"/> Edit Profile
                         </Button>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="font-headline">Personal Information</CardTitle>
                        <CardDescription>Details about your employment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Department</p>
                                <p className="font-semibold">{(employee as any).department}</p>
                            </div>
                             <div>
                                <p className="text-sm font-medium text-muted-foreground">Job Title</p>
                                <p className="font-semibold">{(employee as any).jobTitle}</p>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
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
            </div>
        </>
    )
}
