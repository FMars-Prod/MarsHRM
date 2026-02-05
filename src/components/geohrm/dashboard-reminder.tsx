'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Megaphone } from 'lucide-react';
import Link from 'next/link';

export function DashboardReminder() {
    const [showReminder, setShowReminder] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: currentUserData } = useDoc(userDocRef);
    const userRole = (currentUserData as any)?.role;

    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const hour = now.getHours();
            // Show between 4 PM (16) and 5 PM (17)
            if (hour >= 16 && hour < 17) {
                setShowReminder(true);
            } else {
                setShowReminder(false);
            }
        };

        const interval = setInterval(checkTime, 60000); // Check every minute
        checkTime(); // Initial check

        return () => clearInterval(interval);
    }, []);

    if (!showReminder || !userRole || userRole === 'HR Manager' || userRole === 'CEO/Admin') {
        return null;
    }

    return (
        <Alert className="mb-6 animate-fade-in-up">
            <Megaphone className="h-4 w-4" />
            <AlertTitle>Daily Report Reminder</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
                <p>It's that time! Please don't forget to submit your daily work report before signing out.</p>
                <Button asChild size="sm">
                    <Link href="/dashboard/reports">Submit Report</Link>
                </Button>
            </AlertDescription>
        </Alert>
    );
}
