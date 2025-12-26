
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
import { User, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import Autoplay from "embla-carousel-autoplay"
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

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
  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);


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

  const handlePasswordReset = async () => {
    if (!resetEmail) {
        toast({ variant: 'destructive', title: 'Email required', description: 'Please enter your email address.' });
        return;
    }
    setIsLoading(true);
    try {
        await sendPasswordResetEmail(auth, resetEmail);
        toast({ title: 'Password Reset Email Sent', description: 'Check your inbox for instructions to reset your password.' });
        setIsResetDialogOpen(false);
        setResetEmail('');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
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
              Sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="grid gap-4 pt-4">
                <div className="grid gap-2">
                    <Label htmlFor="email-signin">Email</Label>
                    <Input id="email-signin" type="email" placeholder="m@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password-signin">Password</Label>
                      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                        <DialogTrigger asChild>
                           <Button variant="link" className="ml-auto p-0 h-auto text-xs">
                                Forgot password?
                           </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Forgot Password</DialogTitle>
                                <DialogDescription>
                                    Enter your email address and we'll send you a link to reset your password.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="reset-email">Email</Label>
                                    <Input id="reset-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="your.email@example.com" />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                                <Button onClick={handlePasswordReset} disabled={isLoading}>
                                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Input id="password-signin" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button onClick={handleSignIn} className="w-full mt-2" disabled={isLoading}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
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
