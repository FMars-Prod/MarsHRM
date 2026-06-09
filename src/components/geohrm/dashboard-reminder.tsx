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

    const configDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
    const { data: configData } = useDoc<any>(configDocRef);

    useEffect(() => {
        const checkTime = () => {
            if (!configData?.timings?.shiftEnd) {
                const hour = new Date().getHours();
                if (hour >= 16 && hour < 17) setShowReminder(true);
                else setShowReminder(false);
                return;
            }

            const now = new Date();
            const [endH, endM] = configData.timings.shiftEnd.split(':').map(Number);
            
            const reminderStart = new Date(now);
            reminderStart.setHours(endH - 2, endM, 0, 0); // Reminder starts 2 hours before shift end

            const reminderEnd = new Date(now);
            reminderEnd.setHours(endH, endM, 0, 0);

            if (now >= reminderStart && now <= reminderEnd) setShowReminder(true);
            else setShowReminder(false);
        };

        const interval = setInterval(checkTime, 60000);
        checkTime();
        return () => clearInterval(interval);
    }, [configData]);

    if (!showReminder || !userRole || userRole === 'HR Manager' || userRole === 'CEO/Admin') {
        return null;
    }

    return (
        <Alert className="mb-6 animate-fade-in-up bg-primary/5 border-primary/20 rounded-none">
            <Megaphone className="h-4 w-4 text-primary" />
            <AlertTitle className="font-bold text-primary">Strategic Submission Window</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="text-sm font-medium">Shift completion protocols are active. Please finalize your Daily Strategic Log before signing out.</p>
                <Button asChild size="sm" className="rounded-none font-bold uppercase text-[10px]">
                    <Link href="/dashboard/reports">Submit Strategic Log</Link>
                </Button>
            </AlertDescription>
        </Alert>
    );
}
