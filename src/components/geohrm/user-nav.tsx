
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { doc } from "firebase/firestore";

export function UserNav({ user }: { user: User | null }) {
  const userAvatar = PlaceHolderImages.find(
    (image) => image.id === "user-avatar-1"
  );
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [firestore, user]
  );
  const { data: employee } = useDoc(userDocRef);

  const handleLogout = () => {
    auth.signOut();
    router.push('/login');
  };

  const employeeName = employee ? `${(employee as any).firstName} ${(employee as any).lastName}` : user?.displayName || 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {user?.photoURL ? (
              <Image
                src={user.photoURL}
                alt={employeeName}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : userAvatar && (
              <Image
                src={userAvatar.imageUrl}
                alt={userAvatar.description}
                width={40}
                height={40}
                data-ai-hint={userAvatar.imageHint}
                className="object-cover"
              />
            )}
            <AvatarFallback>
                {employee ? `${(employee as any).firstName?.[0] || ''}${(employee as any).lastName?.[0] || ''}` : user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{employeeName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
