
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight, Users, ShieldCheck, UserCircle, Network, ArrowDown, ShieldAlert, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    role: string;
    avatar?: string;
    teamId?: string;
};

type Team = {
    id: string;
    name: string;
    teamLeadId: string;
    memberIds: string[];
};

export default function OrgStructurePage() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();

    const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
    const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<Team>(teamsQuery);

    const userTeam = React.useMemo(() => {
        if (!userData || !teams) return null;
        return teams.find(t => t.id === userData.teamId || t.memberIds?.includes(userData.id));
    }, [userData, teams]);

    const teamLead = React.useMemo(() => {
        if (!userTeam || !users) return null;
        return users.find(u => u.id === userTeam.teamLeadId);
    }, [userTeam, users]);

    const admins = React.useMemo(() => users?.filter(u => u.role === 'CEO/Admin' || u.role === 'HR Manager') || [], [users]);

    const teammates = React.useMemo(() => {
        if (!userTeam || !users) return [];
        return users.filter(u => userTeam.memberIds?.includes(u.id) && u.id !== userTeam.teamLeadId);
    }, [userTeam, users]);

    const isUrl = (str?: string) => str && str.startsWith('http');

    const UserNode = ({ user, level, highlight }: { user: UserData, level: 'executive' | 'lead' | 'fleet', highlight?: boolean }) => (
        <Card className={cn(
            "border-none shadow-sm relative group transition-all",
            highlight ? "ring-2 ring-primary scale-105 z-10" : "opacity-90 grayscale-[20%] hover:grayscale-0",
            level === 'executive' ? "bg-primary text-white" : 
            level === 'lead' ? "bg-white ring-1 ring-border/50" : 
            "bg-white/50 ring-1 ring-border/50"
        )}>
            <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="size-12 ring-2 ring-white/20">
                    {user.avatar ? (
                        isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover" /> : <span className="text-2xl">{user.avatar}</span>
                    ) : <AvatarFallback>{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
                </Avatar>
                <div className="flex-1">
                    <p className={cn("font-bold text-sm", level === 'executive' ? "text-white" : "text-foreground")}>{user.firstName} {user.lastName}</p>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest", level === 'executive' ? "text-white/70" : "text-muted-foreground")}>{user.jobTitle}</p>
                </div>
                <Badge variant="outline" className={cn("rounded-full text-[8px] font-black uppercase tracking-widest border-none", level === 'executive' ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {user.role === 'CEO/Admin' ? 'CEO' : user.role === 'HR Manager' ? 'HR' : 'Personnel'}
                </Badge>
            </CardContent>
        </Card>
    );

    const isLoading = isUserLoading || usersLoading;

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Network className="size-12 animate-pulse text-muted-foreground opacity-20" /></div>;

    return (
        <div className="space-y-8 animate-fade-in-up max-w-5xl mx-auto">
            <PageHeader title="Reporting Hierarchy" description="Personalized tactical command structure mapping your professional reporting line." />

            {userData && (
                <Alert className="bg-primary/5 border-primary/20 shadow-sm rounded-3xl p-6">
                    <Target className="size-5 text-primary" />
                    <AlertTitle className="text-primary font-black uppercase text-xs tracking-widest mb-1">Strategic Reporting Directive</AlertTitle>
                    <AlertDescription className="text-sm font-medium">
                        {userData.role === 'Member' ? (
                            <>Operational Status: You report directly to <span className="text-primary font-bold">{teamLead ? `${teamLead.firstName} ${teamLead.lastName}` : 'Assigned Team Lead'}</span>.</>
                        ) : userData.role === 'Team Lead' ? (
                            <>Operational Status: You report directly to <span className="text-primary font-bold">Executive Oversight (CEO/Admin)</span>.</>
                        ) : (
                            <>Authority Confirmation: You represent the <span className="text-primary font-bold">Top-Tier Command Level</span>.</>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-12 pb-20 relative">
                {/* Vertical Connector Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-border/50 to-transparent -translate-x-1/2 hidden md:block" />

                {/* Executive Command */}
                <div className="space-y-6">
                    <div className="flex flex-col items-center gap-2">
                        <Badge className="bg-primary text-white font-black uppercase text-[8px] tracking-[0.3em]">Command Level</Badge>
                    </div>
                    <div className={cn("grid gap-4 max-w-2xl mx-auto", admins.length > 1 ? "md:grid-cols-2" : "grid-cols-1")}>
                        {admins.map(admin => (
                            <UserNode key={admin.id} user={admin} level="executive" highlight={userData?.id === admin.id} />
                        ))}
                    </div>
                </div>

                {/* Team Lead Level */}
                {teamLead && (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2">
                            <ArrowDown className="size-4 text-muted-foreground opacity-30" />
                            <Badge className="bg-blue-600 text-white font-black uppercase text-[8px] tracking-[0.3em]">Operational Lead</Badge>
                        </div>
                        <div className="max-w-md mx-auto">
                            <UserNode user={teamLead} level="lead" highlight={userData?.id === teamLead.id} />
                        </div>
                    </div>
                )}

                {/* Fleet / Peers Level */}
                {teammates.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2">
                            <ArrowDown className="size-4 text-muted-foreground opacity-30" />
                            <Badge className="bg-muted text-muted-foreground font-black uppercase text-[8px] tracking-[0.3em]">
                                {userTeam?.name || 'Tactical Fleet'}
                            </Badge>
                        </div>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                            {teammates.map(member => (
                                <UserNode key={member.id} user={member} level="fleet" highlight={userData?.id === member.id} />
                            ))}
                        </div>
                    </div>
                )}

                {/* If Admin viewing the page, show all others as a summary list if no specific team is found */}
                {!teamLead && userData?.role !== 'Member' && userData?.role !== 'Team Lead' && (
                    <div className="text-center py-20 opacity-40 italic text-sm">
                        Executive View: Global fleet oversight is managed via the Staff Registry module.
                    </div>
                )}
            </div>
        </div>
    );
}
