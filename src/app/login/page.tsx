
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
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Autoplay from "embla-carousel-autoplay"
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const carouselImageIds = ["tutorial-dashboard", "tutorial-attendance", "tutorial-leave", "tutorial-teams"];
const carouselItems = PlaceHolderImages.filter(img => carouselImageIds.includes(img.id));


export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const plugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })
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

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
       <div className="relative h-64 lg:h-full">
        <Carousel
          setApi={setApi}
          opts={{ loop: true }}
          className="w-full h-full"
          plugins={[plugin.current]}
        >
          <CarouselContent className="h-full">
            {carouselItems.map((item, index) => (
              <CarouselItem key={item.id} className="h-full relative">
                <Image 
                  src={item.imageUrl} 
                  alt={item.description}
                  data-ai-hint={item.imageHint}
                  fill
                  priority={index === 0}
                  style={{ objectFit: 'cover' }}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm mx-auto flex flex-col -mt-32 lg:mt-0 shadow-2xl lg:shadow-none border-none lg:border">
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
                      <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                        Forgot password?
                      </Link>
                    </div>
                    <Input id="password-signin" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button onClick={handleSignIn} className="w-full mt-2" disabled={isLoading}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
                <Link href="/tutorial" passHref>
                  <Button variant="outline" className="w-full">
                    View Tutorial
                  </Button>
                </Link>
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
