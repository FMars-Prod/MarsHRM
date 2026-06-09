'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, orderBy } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Network, Settings2, ShieldCheck, Check, ChevronDown, UserCircle, Search, X, Users } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

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
        "border-none shadow-md relative group transition-all w-full max-w-[320px] mx-auto rounded-none",
        highlight ? "ring-2 ring-primary scale-105 z-10" : "opacity-95 hover:opacity-100 hover:shadow-xl",
        isRoot ? "bg-primary text-white" : "bg-white ring-1 ring-border/50"
    )}>
        <CardContent className="p-5 flex items-center gap-4">
            <Avatar className="size-14 ring-2 ring-white/20 shrink-0 rounded-none shadow-sm">
                {user.avatar ? (
                    isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover rounded-none" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 font-black text-xl">{user.avatar}</div>
                ) : <AvatarFallback className="text-sm rounded-none bg-muted font-black text-muted-foreground">{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className={cn("font-black text-base uppercase tracking-tight truncate leading-none", isRoot ? "text-white" : "text-foreground")}>{user.firstName} {user.lastName}</p>
                <p className={cn("text-[10px] font-black uppercase tracking-widest truncate mt-2 opacity-80", isRoot ? "text-white/70" : "text-muted-foreground")}>{user.jobTitle}</p>
            </div>
            <Badge variant="outline" className={cn(
                "rounded-none text-[8px] font-black uppercase tracking-widest border-none shrink-0 px-2.5 py-1", 
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
            <div className="flex flex-wrap justify-center gap-16 w-full">
                {users.map((user, idx) => {
                    const children = allUsers.filter(u => u.reportingHeadIds?.includes(user.id));
                    return (
                        <div key={`${user.id}-${depth}-${idx}`} className="flex flex-col items-center relative flex-1 min-w-[340px]">
                            <UserNode 
                                user={user} 
                                highlight={currentUserData?.id === user.id} 
                                isRoot={depth === 0} 
                            />
                            {children.length > 0 && (
                                <>
                                    <div className="w-px h-16 bg-border mt-4" />
                                    <div className="w-full h-px bg-border max-w-[85%]" />
                                    <div className="pt-10 w-full">
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
    const [searchQuery, setSearchQuery] = React.useState("");

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
                <Network className="size-16 animate-pulse text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-fade-in-up max-w-full mx-auto pb-40 font-jakarta">
            <PageHeader title="Organization Structure" description="Manually configured tactical matrix mapping vertical and horizontal reporting heads.">
                {isLeadership && (
                    <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-none h-12 shadow-xl bg-primary text-white font-black uppercase text-[11px] tracking-[0.2em] px-8 active:scale-[0.98] transition-transform">
                                <Settings2 className="mr-3 size-4" /> Configure Structure
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none sm:max-w-4xl p-0 border-none shadow-2xl overflow-hidden flex flex-col h-[85vh] z-[60]">
                            <DialogHeader className="p-10 border-b bg-white shrink-0">
                                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Command Mapping Matrix</DialogTitle>
                                <DialogDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60 mt-1">
                                    Assign reporting heads to establish the vertical organization matrix
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 bg-muted/5">
                                <div className="p-10 space-y-4">
                                    {users?.map(u => (
                                        <div key={u.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white border border-dashed border-border group hover:border-primary/40 transition-all shadow-sm gap-6">
                                            <div className="flex items-center gap-5 shrink-0">
                                                <Avatar className="size-14 rounded-none border ring-1 ring-border/50 shadow-sm">
                                                    <AvatarImage src={u.avatar} className="object-cover rounded-none" />
                                                    <AvatarFallback className="rounded-none text-sm font-black">{u.firstName[0]}{u.lastName[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-1">
                                                    <p className="font-black text-base uppercase tracking-tight">{u.firstName} {u.lastName}</p>
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{u.jobTitle}</p>
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="w-full cursor-pointer p-4 bg-muted/20 hover:bg-muted/30 transition-all ring-1 ring-border/50 flex flex-wrap items-center gap-2 min-h-[56px]">
                                                            {(u.reportingHeadIds?.length || 0) === 0 ? (
                                                                <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Unassigned - Tap to add managers</span>
                                                            ) : (
                                                                u.reportingHeadIds?.map(headId => {
                                                                    const head = users.find(h => h.id === headId);
                                                                    return head ? (
                                                                        <Badge key={headId} variant="secondary" className="bg-primary text-white font-black text-[9px] uppercase tracking-widest rounded-none h-6 px-3 border-none gap-2">
                                                                            {head.firstName} {head.lastName}
                                                                            <X className="size-3 cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleToggleHead(u.id, headId, u.reportingHeadIds || []); }} />
                                                                        </Badge>
                                                                    ) : null;
                                                                })
                                                            )}
                                                            <div className="ml-auto flex items-center gap-2 text-primary">
                                                                <Users className="size-4" />
                                                                <ChevronDown className="size-4" />
                                                            </div>
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[400px] p-0 rounded-none border-none shadow-2xl z-[100]" align="end">
                                                        <div className="p-4 border-b bg-muted/10 space-y-4">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Fleet Command Directory</p>
                                                            <div className="relative">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50" />
                                                                <Input 
                                                                    placeholder="Search for Reporting Heads..." 
                                                                    className="h-10 pl-10 rounded-none border-none ring-1 ring-border/50 text-xs font-bold uppercase tracking-tight focus-visible:ring-primary"
                                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <ScrollArea className="h-72">
                                                            <div className="p-2 space-y-1">
                                                                {users.filter(manager => {
                                                                    const matchesSearch = `${manager.firstName} ${manager.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || manager.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
                                                                    return manager.id !== u.id && matchesSearch;
                                                                }).map(manager => {
                                                                    const isSelected = !!u.reportingHeadIds?.includes(manager.id);
                                                                    return (
                                                                        <div 
                                                                            key={manager.id} 
                                                                            className={cn(
                                                                                "flex items-center gap-4 p-4 rounded-none transition-all cursor-pointer group",
                                                                                isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                e.preventDefault();
                                                                                handleToggleHead(u.id, manager.id, u.reportingHeadIds || []);
                                                                            }}
                                                                        >
                                                                            <Checkbox checked={isSelected} className="rounded-none pointer-events-none data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                                                            <Avatar className="size-10 rounded-none border ring-1 ring-border/50 shrink-0">
                                                                                <AvatarImage src={manager.avatar} className="object-cover rounded-none" />
                                                                                <AvatarFallback className="rounded-none text-xs font-black">{manager.firstName[0]}{manager.lastName[0]}</AvatarFallback>
                                                                            </Avatar>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="text-sm font-black uppercase truncate group-hover:text-primary transition-colors">{manager.firstName} {manager.lastName}</p>
                                                                                <p className="text-[10px] font-bold text-muted-foreground truncate uppercase">{manager.jobTitle}</p>
                                                                            </div>
                                                                            {isSelected && <Check className="size-4 text-primary" />}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {users.filter(m => m.id !== u.id && `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                                                    <div className="py-10 text-center opacity-20 grayscale flex flex-col items-center">
                                                                        <Users className="size-10 mb-2" />
                                                                        <p className="text-[10px] font-black uppercase tracking-widest">No matching command found</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-10 border-t bg-white shrink-0">
                                <Button className="w-full h-14 rounded-none font-black uppercase text-[12px] tracking-[0.3em] shadow-xl shadow-primary/20" onClick={() => {
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
                <Alert className="bg-primary/5 border-primary/20 shadow-md rounded-none p-8 mx-6">
                    <ShieldCheck className="size-6 text-primary" />
                    <AlertTitle className="text-primary font-black uppercase text-sm tracking-[0.2em] mb-2">Matrix Oversight Directive</AlertTitle>
                    <AlertDescription className="text-base font-medium leading-relaxed opacity-80">
                        Tactical matrix active: Employees may be displayed under multiple command lines representing cross-functional reporting assignments.
                    </AlertDescription>
                </Alert>
            )}

            <div className="p-6 overflow-x-auto min-h-[700px] flex flex-col items-center">
                {roots.length > 0 ? (
                    <div className="inline-flex flex-col items-center min-w-full">
                        <TreeLevel 
                            users={roots} 
                            allUsers={users || []} 
                            depth={0} 
                            currentUserData={userData} 
                        />
                    </div>
                ) : (
                    <div className="py-48 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-8">
                        <div className="p-10 rounded-none bg-muted/20 ring-8 ring-muted/10 shadow-inner">
                            <Network className="size-24 text-primary/40" />
                        </div>
                        <div className="space-y-2">
                            <p className="font-black uppercase text-sm tracking-[0.5em]">Matrix Not Initiated</p>
                            <p className="text-[11px] font-bold uppercase tracking-widest max-w-sm leading-relaxed mx-auto">
                                No vertical command lines detected. Start by manually assigning reporting lines in the Configuration portal.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}