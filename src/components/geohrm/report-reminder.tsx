
'use client';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Megaphone } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function ReportReminder() {
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
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm animate-fade-in-up">
            <Alert>
                <Megaphone className="h-4 w-4" />
                <AlertTitle>Daily Report Reminder</AlertTitle>
                <AlertDescription>
                    It's that time! Please don't forget to submit your daily work report before signing out.
                </AlertDescription>
            </Alert>
        </div>
    );
}

    