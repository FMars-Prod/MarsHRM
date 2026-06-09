
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Network, Settings2, ShieldCheck, Check, ChevronDown, UserCircle, Search, X } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    role: string;
    avatar?: string;
    teamId?: string;
    reportingHeadIds?: string[];
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
                    isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover rounded-none" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 font-black text-lg">{user.avatar}</div>
                ) : <AvatarFallback className="text-xs rounded-none bg-muted font-bold text-muted-foreground">{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
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
                {users.map((user, idx) => {
                    const children = allUsers.filter(u => u.reportingHeadIds?.includes(user.id));
                    return (
                        <div key={`${user.id}-${depth}-${idx}`} className="flex flex-col items-center relative flex-1 min-w-[320px]">
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
        return users.filter(u => {
            const hasHeads = (u.reportingHeadIds?.length || 0) > 0;
            if (!hasHeads) return true;
            // Also a root if none of the reporting heads actually exist in the registry
            return !u.reportingHeadIds?.some(headId => users.some(existing => existing.id === headId));
        });
    }, [users]);

    const handleToggleHead = (targetUserId: string, headId: string, currentHeads: string[]) => {
        const userRef = doc(firestore, 'users', targetUserId);
        let updatedHeads = [...currentHeads];
        
        if (updatedHeads.includes(headId)) {
            updatedHeads = updatedHeads.filter(h => h !== headId);
        } else {
            updatedHeads.push(headId);
        }
        
        updateDocumentNonBlocking(userRef, { reportingHeadIds: updatedHeads });
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
            <PageHeader title="Organization Structure" description="Manually configured tactical matrix mapping vertical and horizontal reporting heads.">
                {isLeadership && (
                    <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-none h-11 shadow-lg bg-primary text-white font-black uppercase text-[10px] tracking-widest px-6">
                                <Settings2 className="mr-2 size-4" /> Configure Structure
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-3xl p-0 border-none shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                            <DialogHeader className="p-8 border-b bg-white shrink-0">
                                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Command Mapping Matrix</DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                    Assign one or multiple reporting heads to establish the organizational matrix
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1">
                                <div className="p-8 space-y-4">
                                    {users?.map(u => (
                                        <div key={u.id} className="flex items-center justify-between p-4 bg-muted/20 border border-dashed border-border/50 group hover:bg-white hover:border-primary/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-10 rounded-none border ring-1 ring-border/50">
                                                    <AvatarImage src={u.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="rounded-none text-xs font-bold">{u.firstName[0]}{u.lastName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-0.5">
                                                    <p className="font-black text-xs uppercase">{u.firstName} {u.lastName}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{u.jobTitle}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Reporting Heads</p>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="h-9 rounded-none bg-white text-[10px] font-black uppercase border-none ring-1 ring-border/50 min-w-[160px] justify-between">
                                                            <span>{u.reportingHeadIds?.length || 0} Managers Assigned</span>
                                                            <ChevronDown className="size-3 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[280px] p-0 rounded-none border-none shadow-2xl" align="end">
                                                        <div className="p-3 bg-muted/5 border-b">
                                                            <p className="text-[9px] font-black uppercase text-primary tracking-widest">Select Command Tiers</p>
                                                        </div>
                                                        <ScrollArea className="h-64">
                                                            <div className="p-2 space-y-1">
                                                                {users.filter(manager => manager.id !== u.id).map(manager => {
                                                                    const isSelected = !!u.reportingHeadIds?.includes(manager.id);
                                                                    return (
                                                                        <div 
                                                                            key={manager.id} 
                                                                            className={cn(
                                                                                "flex items-center gap-3 p-2 rounded-none transition-colors cursor-pointer",
                                                                                isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                handleToggleHead(u.id, manager.id, u.reportingHeadIds || []);
                                                                            }}
                                                                        >
                                                                            <Checkbox checked={isSelected} className="rounded-none pointer-events-none" />
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-xs font-black uppercase truncate">{manager.firstName} {manager.lastName}</p>
                                                                                <p className="text-[9px] font-bold text-muted-foreground truncate">{manager.jobTitle}</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </ScrollArea>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t bg-muted/5 shrink-0">
                                <Button className="w-full h-12 rounded-none font-black uppercase tracking-widest" onClick={() => {
                                    setIsConfigOpen(false);
                                    toast({ title: "Command Matrix Refreshed", description: "The organizational structure has been synchronized." });
                                }}>
                                    Finalize Matrix Configuration
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </PageHeader>

            {userData && (
                <Alert className="bg-primary/5 border-primary/20 shadow-sm rounded-none p-6 mx-4">
                    <ShieldCheck className="size-5 text-primary" />
                    <AlertTitle className="text-primary font-black uppercase text-xs tracking-widest mb-1">Matrix Oversight Directive</AlertTitle>
                    <AlertDescription className="text-sm font-medium">
                        Tactical matrix active: Employees may be displayed under multiple command lines representing cross-functional reporting.
                    </AlertDescription>
                </Alert>
            )}

            <div className="p-4 overflow-x-auto min-h-[600px] flex flex-col items-center">
                {roots.length > 0 ? (
                    <div className="inline-flex flex-col items-center min-w-full">
                        <TreeLevel 
                            users={roots} 
                            allUsers={users || []} 
                            depth={depth + 1} 
                            currentUserData={userData} 
                        />
                    </div>
                ) : (
                    <div className="py-40 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-6">
                        <div className="p-8 rounded-none bg-muted/20 ring-4 ring-muted/10">
                            <Network className="size-20 text-primary/40" />
                        </div>
                        <p className="font-black uppercase text-xs tracking-[0.4em]">Matrix Not Initiated</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs leading-relaxed">
                            Start by manually assigning reporting lines in the Configuration portal.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

