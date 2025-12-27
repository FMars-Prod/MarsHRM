
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export function UserNav({ user }: { user: User | null }) {
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
  const employeeAvatar = (employee as any)?.avatar;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className={cn("h-10 w-10", employeeAvatar && "bg-transparent")}>
            {employeeAvatar ? (
                <span className="text-2xl">{employeeAvatar}</span>
            ) : (
            <AvatarFallback>
                {employee ? `${(employee as any).firstName?.[0] || ''}${(employee as any).lastName?.[0] || ''}` : user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
            )}
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
