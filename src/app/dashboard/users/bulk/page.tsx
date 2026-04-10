'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';
interface UserToCreate {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    jobTitle: string;
    department: string;
    role: Role;
    line: number;
}

export default function BulkCreatePage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [csvData, setCsvData] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [creationLog, setCreationLog] = React.useState<string[]>([]);

    const handleCreation = async () => {
        if (!csvData.trim()) {
            toast({ variant: 'destructive', title: 'No data to create' });
            return;
        }

        setIsCreating(true);
        setCreationLog(['Starting bulk creation...']);

        const lines = csvData.trim().split('\n');
        const headers = lines.shift()?.trim().split(',').map(h => h.trim());
        
        const expectedHeader = 'firstName,lastName,email,password,jobTitle,department,role';
        if (!headers || headers.join(',') !== expectedHeader) {
            toast({ variant: 'destructive', title: 'Invalid CSV Header' });
            setIsCreating(false);
            return;
        }

        const usersToCreate: UserToCreate[] = [];
        lines.forEach((line, index) => {
            if (!line.trim()) return;
            const values = line.split(',');
            if (values.length === 7) {
                usersToCreate.push({
                    firstName: values[0].trim(),
                    lastName: values[1].trim(),
                    email: values[2].trim(),
                    password: values[3].trim(),
                    jobTitle: values[4].trim(),
                    department: values[5].trim(),
                    role: values[6].trim() as Role,
                    line: index + 2
                });
            }
        });

        for (const user of usersToCreate) {
            const tempAppName = `bulk-create-${user.line}`;
            let tempApp;
            try {
                tempApp = initializeApp(firebaseConfig, tempAppName);
                const tempAuth = getAuth(tempApp);
                const userCredential = await createUserWithEmailAndPassword(tempAuth, user.email, user.password);
                const newUserId = userCredential.user.uid;

                const batch = writeBatch(firestore);
                const userDocRef = doc(firestore, 'users', newUserId);

                batch.set(userDocRef, {
                    id: newUserId,
                    employeeId: newUserId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    jobTitle: user.jobTitle,
                    department: user.department,
                    role: user.role,
                    hireDate: new Date().toISOString(),
                });

                if (user.role === 'CEO/Admin') {
                    batch.set(doc(firestore, 'system_roles_admin', newUserId), { employeeId: newUserId });
                } else if (user.role === 'HR Manager') {
                    batch.set(doc(firestore, 'system_roles_hr', newUserId), { employeeId: newUserId });
                } else if (user.role === 'Team Lead') {
                    batch.set(doc(firestore, 'system_roles_teamlead', newUserId), { employeeId: newUserId });
                }
                
                await batch.commit();
                setCreationLog(prev => [...prev, `Success: ${user.email}`]);
            } catch (error: any) {
                setCreationLog(prev => [...prev, `Error on line ${user.line}: ${error.message}`]);
            } finally {
                if (tempApp) await deleteApp(tempApp);
            }
        }

        toast({ title: 'Process Finished' });
        setIsCreating(false);
    };

    return (
        <>
            <PageHeader title="Bulk Create Users" description="Create multiple users with login credentials.">
                <Button asChild variant="outline">
                    <Link href="/dashboard/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link>
                </Button>
            </PageHeader>
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>1. Prepare CSV Data</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Alert><FileText className="h-4 w-4" /><AlertDescription>Header: firstName,lastName,email,password,jobTitle,department,role</AlertDescription></Alert>
                        <Textarea value={csvData} onChange={(e) => setCsvData(e.target.value)} placeholder="Jane,Doe,jane@example.com,pass123,Dev,Tech,Member" className="h-48 font-mono text-xs" disabled={isCreating} />
                        <Button onClick={handleCreation} disabled={isCreating || !csvData.trim()}>{isCreating ? 'Creating...' : 'Create Users'}</Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>2. Creation Log</CardTitle></CardHeader>
                    <CardContent><div className="h-80 bg-muted rounded-md p-4 overflow-y-auto font-mono text-xs">{creationLog.map((line, i) => (<p key={i}>{line}</p>))}</div></CardContent>
                </Card>
            </div>
        </>
    );
}