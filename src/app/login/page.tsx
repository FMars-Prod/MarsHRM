'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { signInAnonymously, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Role = 'Member' | 'HR Manager' | 'CEO/Admin';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<Role | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleLogin = async (role: Role) => {
    setIsLoading(role);
    if (!auth || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Firebase not initialized.',
          });
        setIsLoading(null);
        return
    }

    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      // Set the user's role in Firestore
      const userDocRef = doc(firestore, 'users', user.uid);
      const userData = {
        id: user.uid,
        employeeId: user.uid, // Using uid as employeeId for dummy user
        role: role,
      };

      setDoc(userDocRef, userData, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'write',
              requestResourceData: userData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });


      toast({
        title: 'Success',
        description: `Logged in as ${role}.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message,
      });
      setIsLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="bg-primary text-primary-foreground p-3 rounded-lg">
              <Building2 className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="font-headline text-2xl">GeoHRM Login</CardTitle>
          <CardDescription>
            Select a role to log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button
              onClick={() => handleLogin('Member')}
              className="w-full"
              disabled={!!isLoading}
            >
              {isLoading === 'Member' ? 'Logging in...' : 'Login as Employee'}
            </Button>
            <Button
              onClick={() => handleLogin('HR Manager')}
              className="w-full"
              disabled={!!isLoading}
            >
              {isLoading === 'HR Manager' ? 'Logging in...' : 'Login as Admin'}
            </Button>
            <Button
              onClick={() => handleLogin('CEO/Admin')}
              className="w-full"
              disabled={!!isLoading}
            >
              {isLoading === 'CEO/Admin' ? 'Logging in...' : 'Login as CEO'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
