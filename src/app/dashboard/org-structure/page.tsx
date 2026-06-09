
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Network, ArrowDown, Target, LayoutGrid, ShieldCheck, UserCircle, Briefcase, ChevronDown, Settings2, UserPlus, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    role: string;
    avatar?: string;
    teamId?: string;
    reportsToId?: string | null;
};

const isUrl = (str?: string) => str && str.startsWith('http');

const UserNode = ({ user, highlight, isRoot }: { user: UserData, highlight?: boolean, isRoot?: boolean }) => (
    <Card className={cn(
        "border-none shadow-sm relative group transition-all w-full max-w-[300px] mx-auto rounded-none",
        highlight ? "ring-2 ring-primary scale-105 z-10" : "opacity-95 hover:opacity-100 hover:shadow-md",
        isRoot ? "bg-primary text-white" : "bg-white ring-1 ring-border/50"
    )}>
        <CardContent className="p-4 flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-white/20 shrink-0 rounded-none">
                {user.avatar ? (
                    isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover rounded-none" /> : <span className="text-xl">{user.avatar}</span>
                ) : <AvatarFallback className="text-xs rounded-none">{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className={cn("font-black text-sm truncate", isRoot ? "text-white" : "text-foreground")}>{user.firstName} {user.lastName}</p>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-0.5", isRoot ? "text-white/70" : "text-muted-foreground")}>{user.jobTitle}</p>
            </div>
            <Badge variant="outline" className={cn(
                "rounded-none text-[8px] font-black uppercase tracking-widest border-none shrink-0 px-2 py-0.5", 
                isRoot ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            )}>
                {user.role === 'CEO/Admin' ? 'CEO' : user.role === 'HR Manager' ? 'Admin' : user.role === 'Team Lead' ? 'Lead' : 'Fleet'}
            </Badge>
        </CardContent>
    </Card>
);

const TreeLevel = ({ users, allUsers, depth = 0, currentUserData }: { users: UserData[], allUsers: UserData[], depth?: number, currentUserData?: UserData | null }) => {
    if (users.length === 0) return null;

    return (
        <div className="flex flex-col items-center w-full">
            <div className="flex flex-wrap justify-center gap-12 w-full">
                {users.map(user => {
                    const children = allUsers.filter(u => u.reportsToId === user.id);
                    return (
                        <div key={user.id} className="flex flex-col items-center relative flex-1 min-w-[320px]">
                            <UserNode 
                                user={user} 
                                highlight={currentUserData?.id === user.id} 
                                isRoot={depth === 0} 
                            />
                            {children.length > 0 && (
                                <>
                                    <div className="w-px h-12 bg-border mt-4" />
                                    <div className="w-full h-px bg-border max-w-[80%]" />
                                    <div className="pt-8 w-full">
                                        <TreeLevel 
                                            users={children} 
                                            allUsers={allUsers} 
                                            depth={depth + 1} 
                                            currentUserData={currentUserData} 
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function OrgStructurePage() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isConfigOpen, setIsConfigOpen] = React.useState(false);

    const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
    const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users'), orderBy('firstName', 'asc')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    const isLeadership = userData?.role === 'CEO/Admin' || userData?.role === 'HR Manager';

    const roots = React.useMemo(() => {
        if (!users) return [];
        // Root users are those who don't report to anyone or whose reporting officer doesn't exist
        return users.filter(u => !u.reportsToId || !users.some(manager => manager.id === u.reportsToId));
    }, [users]);

    const handleUpdateReportsTo = (targetUserId: string, managerId: string) => {
        const userRef = doc(firestore, 'users', targetUserId);
        const finalManagerId = managerId === 'none' ? null : managerId;
        
        updateDocumentNonBlocking(userRef, { reportsToId: finalManagerId });
        toast({ 
            title: "Command Updated", 
            description: "Reporting line has been synchronized manually." 
        });
    };

    if (isUserLoading || usersLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Network className="size-12 animate-pulse text-muted-foreground opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in-up max-w-full mx-auto pb-32 font-jakarta">
            <PageHeader title="Organization Structure" description="Manually configured tactical tree mapping vertical reporting lines.">
                {isLeadership && (
                    <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-none h-11 shadow-lg bg-primary text-white font-black uppercase text-[10px] tracking-widest px-6">
                                <Settings2 className="mr-2 size-4" /> Configure Structure
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-2xl p-0 border-none shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                            <DialogHeader className="p-8 border-b bg-white shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Command Mapping</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                    Manually define reporting protocols for every unit
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1">
                                <div className="p-8 space-y-4">
                                    {users?.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-4 bg-muted/20 border border-dashed border-border/50 group hover:bg-white hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-10 rounded-none border ring-1 ring-border/50">
                                                    <AvatarImage src={u.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="rounded-none text-xs">{u.firstName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-xs uppercase">{u.firstName} {u.lastName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{u.jobTitle}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Reports To</p>
                                                <Select 
                                                    value={u.reportsToId || "none"} 
                                                    onValueChange={(val) => handleUpdateReportsTo(u.id, val)}
                                                >
                                                    <SelectTrigger className="w-[180px] h-9 rounded-none bg-white text-[10px] font-bold uppercase border-none ring-1 ring-border/50">
                                                        <SelectValue placeholder="Pick Manager" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-none border-none shadow-2xl">
                                                        <SelectItem value="none" className="text-[10px] font-bold uppercase">No Manager (Root)</SelectItem>
                                                        {users.filter(manager => manager.id !== u.id).map(manager => (
                                                            <SelectItem key={manager.id} value={manager.id} className="text-[10px] font-bold uppercase">
                                                                {manager.firstName} {manager.lastName}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-muted/5 shrink-0">
                                <Button className="w-full h-12 rounded-none font-black uppercase tracking-widest" onClick={() => setIsConfigOpen(false)}>
                                    Finalize Configuration
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            {userData && (
                <Alert className="bg-primary/5 border-primary/20 shadow-sm rounded-none p-6 mx-4">
                    <ShieldCheck className="size-5 text-primary" />
                    <AlertTitle className="text-primary font-black uppercase text-xs tracking-widest mb-1">Command Oversight Confirmation</AlertTitle>
                    <AlertDescription className="text-sm font-medium">
                        Manual Mode Active: This structure is currently defined by executive designation rather than automatic roles.
                    </AlertDescription>
                </Alert>
            )}

            <div className="p-4 overflow-x-auto min-h-[600px] flex flex-col items-center">
                {roots.length > 0 ? (
                    <div className="inline-flex flex-col items-center min-w-full">
                        <TreeLevel 
                            users={roots} 
                            allUsers={users || []} 
                            currentUserData={userData} 
                        />
                    </div>
                ) : (
                    <div className="py-40 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-6">
                        <div className="p-8 rounded-none bg-muted/20 ring-4 ring-muted/10">
                            <Network className="size-20 text-primary/40" />
                        </div>
                        <p className="font-black uppercase text-xs tracking-[0.4em]">Structure Not Initiated</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs leading-relaxed">
                            Start by manually assigning reporting lines in the Configuration portal.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

