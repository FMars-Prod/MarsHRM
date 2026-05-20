
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
import { LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { doc, collection, query, where, getDocs } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useToast } from "@/hooks/use-toast";

export function UserNav({ user }: { user: User | null }) {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [firestore, user]
  );
  const { data: employee } = useDoc(userDocRef);

  const handleLogout = async () => {
    if (!user) return;
    setIsLoggingOut(true);

    try {
        const userRole = (employee as any)?.role || 'Member';
        const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin';

        // Check if report for today exists (only for members/leads)
        if (!isPrivileged) {
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());
            
            const q = query(
                collection(firestore, `users/${user.uid}/reports`),
                where('date', '>=', todayStart),
                where('date', '<=', todayEnd)
            );

            const snap = await getDocs(q);
            if (snap.empty) {
                toast({
                    variant: 'destructive',
                    title: "Report Required",
                    description: "Protocol violation: Please submit your daily tactical report before logging out."
                });
                router.push('/dashboard/reports');
                setIsLoggingOut(false);
                return;
            }
        }

        await auth.signOut();
        router.push('/login');
    } catch (err: any) {
        console.error("Logout error:", err);
        toast({ variant: 'destructive', title: 'Logout Interrupted', description: err.message });
        setIsLoggingOut(false);
    }
  };

  const employeeName = employee ? `${(employee as any).firstName} ${(employee as any).lastName}` : user?.displayName || 'User';
  const employeeAvatar = (employee as any)?.avatar;
  const isUrl = employeeAvatar && employeeAvatar.startsWith('http');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled={isLoggingOut}>
          <Avatar className={cn("h-10 w-10", employeeAvatar && !isUrl && "bg-transparent")}>
            {employeeAvatar ? (
                isUrl ? (
                    <AvatarImage src={employeeAvatar} className="object-cover" />
                ) : (
                    <span className="text-2xl">{employeeAvatar}</span>
                )
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
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          <span>{isLoggingOut ? "Verifying Protocols..." : "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
