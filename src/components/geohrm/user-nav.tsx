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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { LogOut, Loader2, ShieldAlert } from "lucide-react";
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
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [firestore, user]
  );
  const { data: employee } = useDoc(userDocRef);

  const handleLogout = async () => {
    if (!user) return;
    setIsLoggingOut(true);
    setIsLogoutDialogOpen(false);

    try {
        const userRole = (employee as any)?.role || 'Member';
        const isPrivileged = userRole === 'HR Manager' || userRole === 'CEO/Admin' || userRole === 'CEO/MD';

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
    <>
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
          <DropdownMenuContent className="w-56 rounded-none border-none shadow-2xl" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-4">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-black uppercase tracking-tight leading-none">{employeeName}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsLogoutDialogOpen(true); }} className="rounded-none font-black text-xs uppercase cursor-pointer gap-3 p-4 hover:bg-red-50 text-destructive">
              <LogOut className="size-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
            <AlertDialogContent className="rounded-none border-none shadow-2xl">
                <AlertDialogHeader className="text-left">
                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary flex items-center gap-2">
                        <ShieldAlert className="size-5" /> Log Out?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                        Are you sure you want to log out? Please ensure your daily reports are submitted.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="rounded-none font-bold uppercase text-[10px] h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                        Log Out
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
