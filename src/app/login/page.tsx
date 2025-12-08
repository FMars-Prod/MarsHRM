
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
import { doc, writeBatch, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Autoplay from "embla-carousel-autoplay"
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'Member' | 'Team Lead' | 'HR Manager' | 'CEO/Admin';

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Member');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const plugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  
  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => api.off("select", onSelect);
  }, [api]);

  const handleSignIn = async () => {
      setIsLoading(true);
      if (!auth) {
          toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
          setIsLoading(false);
          return;
      }
      try {
          await signInWithEmailAndPassword(auth, email, password);
          toast({ title: 'Success', description: 'Logged in successfully.' });
          router.push('/dashboard');
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      } finally {
          setIsLoading(false);
      }
  }

  const handleCreateAccount = async () => {
    setIsLoading(true);
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.' });
        setIsLoading(false);
        return;
    }

    if (role === 'CEO/Admin') {
        const ceoQuery = query(collection(firestore, 'users'), where('role', '==', 'CEO/Admin'));
        const ceoSnapshot = await getDocs(ceoQuery);
        if (!ceoSnapshot.empty) {
            toast({ variant: 'destructive', title: 'Creation Failed', description: 'A CEO/Admin account already exists.' });
            setIsLoading(false);
            return;
        }
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', user.uid);
        
        const userData = {
            id: user.uid,
            employeeId: user.uid,
            role: role,
            email: email,
            firstName: firstName || role,
            lastName: lastName || 'User',
            jobTitle: `${role}`,
            department: 'General',
            hireDate: new Date().toISOString(),
        };
        batch.set(userDocRef, userData);

        if (role === 'CEO/Admin') {
          batch.set(doc(firestore, 'roles_ceo', user.uid), { employeeId: user.uid });
          batch.set(doc(firestore, 'roles_admin', user.uid), { employeeId: user.uid });
        } else if (role === 'HR Manager') {
          batch.set(doc(firestore, 'roles_hr_agent', user.uid), { employeeId: user.uid });
        } else if (role === 'Team Lead') {
          batch.set(doc(firestore, 'roles_team_lead', user.uid), { employeeId: user.uid });
        }
        
        await batch.commit();

        toast({ title: 'Account Created', description: `Successfully created ${role} account.` });
        router.push('/dashboard');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
    } finally {
        setIsLoading(false);
    }
  }

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
            <CardTitle className="font-headline text-2xl">GeoHRM</CardTitle>
            <CardDescription>
              Sign in or create an account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Create Account</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                    <div className="grid gap-4 pt-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email-signin">Email</Label>
                            <Input id="email-signin" type="email" placeholder="m@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password-signin">Password</Label>
                            <Input id="password-signin" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <Button onClick={handleSignIn} className="w-full mt-2" disabled={isLoading}>
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </div>
                </TabsContent>
                <TabsContent value="signup">
                    <div className="grid gap-4 pt-4">
                        <div className='grid grid-cols-2 gap-4'>
                             <div className="grid gap-2">
                                <Label htmlFor="firstName-signup">First Name</Label>
                                <Input id="firstName-signup" placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="lastName-signup">Last Name</Label>
                                <Input id="lastName-signup" placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email-signup">Email</Label>
                            <Input id="email-signup" type="email" placeholder="m@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password-signup">Password</Label>
                            <Input id="password-signup" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="role-signup">Role</Label>
                          <Select onValueChange={(value: Role) => setRole(value)} defaultValue={role}>
                            <SelectTrigger id="role-signup">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Member">Member</SelectItem>
                                <SelectItem value="Team Lead">Team Lead</SelectItem>
                                <SelectItem value="HR Manager">HR Manager</SelectItem>
                                <SelectItem value="CEO/Admin">CEO/Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateAccount} className="w-full mt-2" disabled={isLoading}>
                             {isLoading ? 'Creating Account...' : 'Create Account'}
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
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
