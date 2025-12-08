
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Autoplay from "embla-carousel-autoplay"
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

const employeeData: Record<Role, any> = {
    'CEO/Admin': {
        firstName: 'CEO',
        lastName: 'Admin',
        jobTitle: 'CEO',
        department: 'Executive',
        hireDate: '2015-08-01',
        email: 'ceo@geohrm.com'
    },
    'HR Manager': {
        firstName: 'Patricia',
        lastName: 'Williams',
        jobTitle: 'HR Manager',
        department: 'Human Resources',
        hireDate: '2018-03-15',
        email: 'hr@geohrm.com'
    },
    'Team Lead': {
        firstName: 'Robert',
        lastName: 'Brown',
        jobTitle: 'Engineering Lead',
        department: 'Technology',
        hireDate: '2019-11-01',
        email: 'lead@geohrm.com'
    },
    'Member': {
        firstName: 'John',
        lastName: 'Smith',
        jobTitle: 'Software Engineer',
        department: 'Technology',
        hireDate: '2021-07-22',
        email: 'member@geohrm.com'
    }
};

const carouselItems = [
  { 
    id: 1, 
    src: "https://picsum.photos/seed/1/1200/800", 
    alt: "Modern office interior", 
    hint: "office interior",
    quote: "The only way to do great work is to love what you do." 
  },
  { 
    id: 2, 
    src: "https://picsum.photos/seed/2/1200/800", 
    alt: "Team collaborating", 
    hint: "team collaboration",
    quote: "Talent wins games, but teamwork and intelligence win championships."
  },
  { 
    id: 3, 
    src: "https://picsum.photos/seed/3/1200/800", 
    alt: "Person working on a laptop", 
    hint: "person working",
    quote: "Success is not the key to happiness. Happiness is the key to success."
  },
  { 
    id: 4, 
    src: "https://picsum.photos/seed/4/1200/800", 
    alt: "City skyline", 
    hint: "city skyline",
    quote: "The future belongs to those who believe in the beauty of their dreams."
  }
];


export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<Role | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const plugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  
  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap())
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])


  const handleLogin = async (role: Role) => {
    setIsLoading(role);
    if (!auth || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Firebase not initialized.',
          });
        setIsLoading(null);
        return;
    }

    const { email } = employeeData[role];
    const password = 'password'; // Use a consistent, simple password for all demo accounts

    try {
      if (auth.currentUser && auth.currentUser.email !== email) {
        await auth.signOut();
      }
      
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw error;
        }
      }
      
      const user = userCredential.user;

      // Check if user data already exists in Firestore to avoid overwriting
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const batch = writeBatch(firestore);
        const roleSpecificData = employeeData[role];
        const userData = {
          id: user.uid,
          employeeId: user.uid,
          role: role,
          ...roleSpecificData,
        };
        batch.set(userDocRef, userData, { merge: true });

        // Set the role document for security rules
        if (role === 'CEO/Admin') {
          batch.set(doc(firestore, 'roles_ceo', user.uid), { employeeId: user.uid });
          batch.set(doc(firestore, 'roles_admin', user.uid), { employeeId: user.uid });
        } else if (role === 'HR Manager') {
          batch.set(doc(firestore, 'roles_hr_agent', user.uid), { employeeId: user.uid });
        } else if (role === 'Team Lead') {
          batch.set(doc(firestore, 'roles_team_lead', user.uid), { employeeId: user.uid });
        }

        await batch.commit().catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                path: `batch write for user ${user.uid}`,
                operation: 'write',
                requestResourceData: userData,
              });
              errorEmitter.emit('permission-error', permissionError);
        });
      }


      toast({
        title: 'Success',
        description: `Logged in as ${role}.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
        setIsLoading(null);
    }
  };


  return (
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2">
       <div className="hidden lg:block relative">
        <Carousel
          setApi={setApi}
          opts={{ loop: true }}
          className="w-full h-full"
          plugins={[plugin.current]}
          onMouseEnter={plugin.current.stop}
          onMouseLeave={plugin.current.reset}
        >
          <CarouselContent className="h-full">
            {carouselItems.map((item, index) => (
              <CarouselItem key={item.id} className="h-full relative">
                <Image 
                  src={item.src} 
                  alt={item.alt}
                  data-ai-hint={item.hint}
                  fill
                  style={{ objectFit: 'cover' }}
                  className={cn("transition-opacity duration-1000", current === index ? "opacity-100" : "opacity-0")}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute bottom-10 left-10 right-10 text-white p-4 bg-black/30 rounded-lg backdrop-blur-sm">
           <p className="text-lg italic text-center">"{carouselItems[current]?.quote}"</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm mx-auto flex flex-col">
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
          <CardContent className="flex-grow">
            <div className="grid gap-4">
              <Button
                onClick={() => handleLogin('CEO/Admin')}
                className="w-full"
                disabled={!!isLoading}
              >
                {isLoading === 'CEO/Admin' ? 'Logging in...' : 'Login as CEO/Admin'}
              </Button>
               <Button
                onClick={() => handleLogin('HR Manager')}
                className="w-full"
                disabled={!!isLoading}
              >
                {isLoading === 'HR Manager' ? 'Logging in...' : 'Login as HR Manager'}
              </Button>
               <Button
                onClick={() => handleLogin('Team Lead')}
                className="w-full"
                disabled={!!isLoading}
              >
                {isLoading === 'Team Lead' ? 'Logging in...' : 'Login as Team Lead'}
              </Button>
               <Button
                onClick={() => handleLogin('Member')}
                className="w-full"
                disabled={!!isLoading}
              >
                {isLoading === 'Member' ? 'Logging in...' : 'Login as Member'}
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="w-full text-center text-xs text-muted-foreground">
              Developed by FortuMars
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
