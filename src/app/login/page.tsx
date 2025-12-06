
'use client';
import { useState, useRef } from 'react';
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
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Autoplay from "embla-carousel-autoplay"
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';

type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

const employeeData: Record<Role, any> = {
    'Member': {
        firstName: 'John',
        lastName: 'Doe',
        jobTitle: 'Software Engineer',
        department: 'Technology',
        hireDate: '2022-01-15',
        email: 'john.doe@geohrm.com'
    },
    'Team Lead': {
        firstName: 'Jane',
        lastName: 'Smith',
        jobTitle: 'Team Lead',
        department: 'Technology',
        hireDate: '2020-05-20',
        email: 'jane.smith@geohrm.com'
    },
    'HR Manager': {
        firstName: 'Peter',
        lastName: 'Jones',
        jobTitle: 'HR Manager',
        department: 'Human Resources',
        hireDate: '2019-03-10',
        email: 'peter.jones@geohrm.com'
    },
    'CEO/Admin': {
        firstName: 'Mary',
        lastName: 'Johnson',
        jobTitle: 'CEO',
        department: 'Executive',
        hireDate: '2015-08-01',
        email: 'mary.johnson@geohrm.com'
    }
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<Role | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const plugin = useRef(
    Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true })
  )

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
      // It's better to sign out previous user
      if (auth.currentUser) {
        await auth.signOut();
      }
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      const batch = writeBatch(firestore);

      // 1. Set the user's main document
      const userDocRef = doc(firestore, 'users', user.uid);
      const roleSpecificData = employeeData[role];
      const userData = {
        id: user.uid,
        employeeId: user.uid, // Using uid as employeeId for dummy user
        role: role,
        ...roleSpecificData,
        email: user.uid + '@geohrm.com' // Make email unique for anonymous users
      };
      batch.set(userDocRef, userData, { merge: true });

      // 2. Set the role document for security rules
      if (role === 'CEO/Admin') {
        const ceoRoleRef = doc(firestore, 'roles_ceo', user.uid);
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        batch.set(ceoRoleRef, { employeeId: user.uid });
        batch.set(adminRoleRef, { employeeId: user.uid });
      } else if (role === 'HR Manager') {
        const hrRoleRef = doc(firestore, 'roles_hr_agent', user.uid);
        batch.set(hrRoleRef, { employeeId: user.uid });
      } else if (role === 'Team Lead') {
        const tlRoleRef = doc(firestore, 'roles_team_lead', user.uid);
        batch.set(tlRoleRef, { employeeId: user.uid });
      }

      await batch.commit().catch((serverError) => {
            const permissionError = new FirestorePermissionError({
              path: `batch write for user ${user.uid}`,
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

  const carouselImages = [
    { id: 1, src: "https://picsum.photos/seed/1/1200/800", alt: "Modern office interior", hint: "office interior" },
    { id: 2, src: "https://picsum.photos/seed/2/1200/800", alt: "Team collaborating", hint: "team collaboration" },
    { id: 3, src: "https://picsum.photos/seed/3/1200/800", alt: "Person working on a laptop", hint: "person working" },
    { id: 4, src: "https://picsum.photos/seed/4/1200/800", alt: "City skyline", hint: "city skyline" }
  ];

  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2">
       <div className="hidden lg:block relative">
        <Carousel
          className="w-full h-full"
          plugins={[plugin.current]}
          onMouseEnter={plugin.current.stop}
          onMouseLeave={plugin.current.reset}
        >
          <CarouselContent className="h-full">
            {carouselImages.map(image => (
              <CarouselItem key={image.id} className="h-full">
                <Image 
                  src={image.src} 
                  alt={image.alt}
                  data-ai-hint={image.hint}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
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
                onClick={() => handleLogin('Team Lead')}
                className="w-full"
                disabled={!!isLoading}
              >
                {isLoading === 'Team Lead' ? 'Logging in...' : 'Login as Team Lead'}
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
    </div>
  );
}
