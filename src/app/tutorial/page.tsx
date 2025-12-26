
'use client';

import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { ArrowLeft, LayoutDashboard, Clock, CalendarOff, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const tutorialSections = [
    {
        icon: LayoutDashboard,
        title: "Dashboard Overview",
        description: "Get a quick glance at your daily summary, including action items, announcements, and company events.",
        imageId: "tutorial-dashboard"
    },
    {
        icon: Clock,
        title: "Attendance Tracking",
        description: "Clock in and out with geolocation. Your location is verified to ensure you are within the designated office radius.",
        imageId: "tutorial-attendance"
    },
    {
        icon: CalendarOff,
        title: "Leave Management",
        description: "Request time off, track your leave status, and view your leave history. Managers can approve or reject requests.",
        imageId: "tutorial-leave"
    },
    {
        icon: Users,
        title: "Team & User Management",
        description: "Admins can create and manage teams, assign team leads, and manage all user accounts in the system.",
        imageId: "tutorial-teams"
    }
];

export default function TutorialPage() {
    return (
        <div className="min-h-screen bg-secondary/40 p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <PageHeader 
                    title="How GeoHRM Works"
                    description="A quick guide to the main features of the application."
                >
                    <Button asChild variant="outline">
                        <Link href="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </PageHeader>

                <div className="grid gap-6 md:grid-cols-2">
                    {tutorialSections.map(section => {
                        const Icon = section.icon;
                        const image = PlaceHolderImages.find(img => img.id === section.imageId);
                        return (
                            <Card key={section.title}>
                                <CardHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-primary/10 p-2 rounded-lg">
                                            <Icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <CardTitle>{section.title}</CardTitle>
                                    </div>
                                    <CardDescription>{section.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {image && (
                                        <div className="aspect-video relative overflow-hidden rounded-lg border">
                                            <Image 
                                                src={image.imageUrl} 
                                                alt={section.title}
                                                fill
                                                style={{objectFit: "cover"}}
                                                data-ai-hint={image.imageHint}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
