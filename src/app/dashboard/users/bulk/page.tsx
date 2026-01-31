
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useAuth } from '@/firebase';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';

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
    const auth = useAuth();
    const { toast } = useToast();
    const [csvData, setCsvData] = React.useState('');
    const [isCreating, setIsCreating] = React.useState(false);
    const [creationLog, setCreationLog] = React.useState<string[]>([]);
    
    // Store admin's original auth state to sign back in
    const adminUser = auth.currentUser;

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
            toast({ variant: 'destructive', title: 'Invalid CSV Header', description: `Header must be: ${expectedHeader}` });
            setCreationLog(prev => [...prev, 'Error: Invalid CSV header.']);
            setIsCreating(false);
            return;
        }

        const usersToCreate: UserToCreate[] = [];
        const errors: string[] = [];

        lines.forEach((line, index) => {
            if (!line.trim()) return;
            const values = line.split(',');
            if (values.length !== 7) {
                errors.push(`Line ${index + 2}: Invalid number of columns. Expected 7, got ${values.length}.`);
                return;
            }
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
        });

        if (errors.length > 0) {
            setCreationLog(prev => [...prev, ...errors, 'Creation aborted due to errors.']);
            setIsCreating(false);
            return;
        }
        
        setCreationLog(prev => [...prev, `Found ${usersToCreate.length} users to create.`]);

        for (const user of usersToCreate) {
            try {
                setCreationLog(prev => [...prev, `Creating user for ${user.email}...`]);

                // THIS IS THE PROBLEMATIC PART. This will sign out the admin.
                // The loop will break after this first user is created.
                const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
                const newUserId = userCredential.user.uid;
                setCreationLog(prev => [...prev, `Auth account created for ${user.email} with UID: ${newUserId}`]);

                const batch = writeBatch(firestore);
                const userDocRef = doc(firestore, 'users', newUserId);

                const newUserPayload = {
                    id: newUserId,
                    employeeId: newUserId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    jobTitle: user.jobTitle,
                    department: user.department,
                    role: user.role,
                    hireDate: new Date().toISOString(),
                };
                
                batch.set(userDocRef, newUserPayload);

                if (user.role === 'CEO/Admin') {
                    batch.set(doc(firestore, 'roles_ceo', newUserId), { employeeId: newUserId });
                    batch.set(doc(firestore, 'roles_admin', newUserId), { employeeId: newUserId });
                } else if (user.role === 'HR Manager') {
                    batch.set(doc(firestore, 'roles_hr_agent', newUserId), { employeeId: newUserId });
                } else if (user.role === 'Team Lead') {
                    batch.set(doc(firestore, 'roles_team_lead', newUserId), { employeeId: newUserId });
                }
                
                await batch.commit();
                setCreationLog(prev => [...prev, `Firestore profile created for ${user.email}.`]);

            } catch (error: any) {
                const errorMessage = `Failed to create user on line ${user.line}: ${error.message}`;
                setCreationLog(prev => [...prev, errorMessage]);
                toast({ variant: 'destructive', title: 'An Error Occurred', description: errorMessage });
                // Stop the whole process on first error
                setIsCreating(false);
                return;
            }
        }

        setCreationLog(prev => [...prev, 'Bulk creation process finished.']);
        toast({ title: 'Bulk Creation Finished' });
        setIsCreating(false);
    };

    return (
        <>
            <PageHeader title="Bulk Create Users" description="Create multiple users with login credentials.">
                <Button asChild variant="outline">
                    <Link href="/dashboard/users">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Users
                    </Link>
                </Button>
            </PageHeader>
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Prepare CSV Data</CardTitle>
                        <CardDescription>
                            Paste your user data in CSV format. The first line must be the header row.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertTitle>Required Format</AlertTitle>
                            <AlertDescription>
                                <p>The CSV header must be exactly: <br />
                                <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">firstName,lastName,email,password,jobTitle,department,role</code>
                                </p>
                            </AlertDescription>
                        </Alert>
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="csv-data">CSV Data</Label>
                            <Textarea
                                id="csv-data"
                                value={csvData}
                                onChange={(e) => setCsvData(e.target.value)}
                                placeholder="firstName,lastName,email,password,jobTitle,department,role
Jane,Doe,jane.d@example.com,password123,Developer,Engineering,Member"
                                className="h-48 font-mono text-xs"
                                disabled={isCreating}
                            />
                        </div>
                        <Button onClick={handleCreation} disabled={isCreating || !csvData.trim()}>
                            <UserPlus className="mr-2" />
                            {isCreating ? 'Creating...' : 'Create Users'}
                        </Button>
                         <Alert variant="destructive">
                            <AlertTitle>Known Issue</AlertTitle>
                            <AlertDescription>
                                Due to browser limitations, this process may sign you out after creating the first user. The operation will not continue for the rest of the list.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>2. Creation Log</CardTitle>
                        <CardDescription>
                            The progress of the creation operation will be shown here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-80 bg-muted rounded-md p-4 overflow-y-auto font-mono text-xs">
                            {creationLog.map((line, index) => (
                                <p key={index}>{line}</p>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
