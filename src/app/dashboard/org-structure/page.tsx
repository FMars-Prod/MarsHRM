
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Network, ArrowDown, Target, LayoutGrid, ShieldCheck, UserCircle, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
    supervisorId?: string;
    memberIds: string[];
};

const roleLevels: Record<string, number> = {
    'CEO/Admin': 1,
    'HR Manager': 2,
    'Team Lead': 3,
    'Member': 4
};

const isUrl = (str?: string) => str && str.startsWith('http');

const UserNode = ({ user, level, highlight }: { user: UserData, level: 'executive' | 'admin' | 'lead' | 'fleet', highlight?: boolean }) => (
    <Card className={cn(
        "border-none shadow-sm relative group transition-all w-full",
        highlight ? "ring-2 ring-primary scale-105 z-10" : "opacity-95 hover:opacity-100",
        level === 'executive' ? "bg-primary text-white" : 
        level === 'admin' ? "bg-indigo-50 ring-1 ring-indigo-200" :
        level === 'lead' ? "bg-white ring-1 ring-border/50 shadow-md" : 
        "bg-white/50 ring-1 ring-border/50"
    )}>
        <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="size-12 ring-2 ring-white/20 shrink-0">
                {user.avatar ? (
                    isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover" /> : <span className="text-2xl">{user.avatar}</span>
                ) : <AvatarFallback>{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className={cn("font-bold text-sm truncate", level === 'executive' ? "text-white" : "text-foreground")}>{user.firstName} {user.lastName}</p>
                <p className={cn("text-[9px] font-black uppercase tracking-widest truncate", level === 'executive' ? "text-white/70" : "text-muted-foreground")}>{user.jobTitle}</p>
            </div>
            <Badge variant="outline" className={cn(
                "rounded-full text-[8px] font-black uppercase tracking-widest border-none shrink-0", 
                level === 'executive' ? "bg-white/20 text-white" : 
                level === 'admin' ? "bg-indigo-600 text-white" :
                level === 'lead' ? "bg-blue-600 text-white" :
                "bg-muted text-muted-foreground"
            )}>
                {user.role === 'CEO/Admin' ? 'CEO' : user.role === 'HR Manager' ? 'Admin' : user.role === 'Team Lead' ? 'Lead' : 'Fleet'}
            </Badge>
        </CardContent>
    </Card>
);

export default function OrgStructurePage() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();

    const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
    const { data: userData, isLoading: isUserLoading } = useDoc<UserData>(currentUserDocRef);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<Team>(teamsQuery);

    const userLevel = userData ? roleLevels[userData.role] || 4 : 4;
    const isLeadership = userLevel <= 2;

    const visibleTeams = React.useMemo(() => {
        if (!teams || !users) return [];
        if (isLeadership) return teams;
        
        const userTeamId = userData?.teamId;
        if (!userTeamId) return [];
        return teams.filter(t => t.id === userTeamId);
    }, [teams, userData, isLeadership, users]);

    const getTeamsForSupervisor = (sId: string) => {
        return visibleTeams.filter(t => t.supervisorId === sId);
    };

    const unassignedTeams = visibleTeams.filter(t => !t.supervisorId || !users?.some(u => u.id === t.supervisorId));

    if (isUserLoading || usersLoading) return <div className="flex h-screen items-center justify-center"><Network className="size-12 animate-pulse text-muted-foreground opacity-20" /></div>;

    const ceoLevel = users?.filter(u => u.role === 'CEO/Admin') || [];
    const adminLevel = users?.filter(u => u.role === 'HR Manager') || [];

    return (
        <div className="space-y-8 animate-fade-in-up max-w-6xl mx-auto pb-20">
            <PageHeader title="Organizational Hierarchy" description="Strategic command structure mapping direct reporting lines and vertical unit distribution." />

            {userData && (
                <Alert className="bg-primary/5 border-primary/20 shadow-sm rounded-3xl p-6">
                    <Target className="size-5 text-primary" />
                    <AlertTitle className="text-primary font-black uppercase text-xs tracking-widest mb-1">Operational Command Directive</AlertTitle>
                    <AlertDescription className="text-sm font-medium">
                        {userLevel === 4 ? (
                            <>Reporting Protocol: You are assigned to the tactical fleet. Direct reports must be submitted to your <span className="text-primary font-bold">Operational Lead</span>.</>
                        ) : userLevel === 3 ? (
                            <>Reporting Protocol: You direct a tactical unit. Shift intelligence and approvals must be escalated to <span className="text-primary font-bold">Executive Oversight</span>.</>
                        ) : (
                            <>Authority Confirmation: You represent <span className="text-primary font-bold">Command Oversight</span>. All tactical units and administrative branches report directly to your level.</>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-16 relative pt-4">
                {/* Executive Tier (Level 1) */}
                <div className="space-y-10">
                    <div className="flex flex-col items-center gap-2 relative">
                        <Badge className="bg-primary text-white font-black uppercase text-[8px] tracking-[0.3em] px-4 py-1.5 shadow-lg shadow-primary/20">Level 1: Executive Command</Badge>
                    </div>
                    {ceoLevel.map(u => (
                        <div key={u.id} className="space-y-8">
                            <div className="max-w-sm mx-auto">
                                <UserNode user={u} level="executive" highlight={userData?.id === u.id} />
                            </div>
                            <SupervisorUnitTeams supervisorId={u.id} teams={visibleTeams} users={users || []} currentUserData={userData} />
                        </div>
                    ))}
                </div>

                {/* Administrative Tier (Level 2) */}
                {adminLevel.length > 0 && (
                    <div className="space-y-10">
                        <div className="flex flex-col items-center gap-2 relative">
                            <ArrowDown className="size-4 text-muted-foreground opacity-30 animate-bounce" />
                            <Badge className="bg-indigo-600 text-white font-black uppercase text-[8px] tracking-[0.3em] px-4 py-1.5 shadow-lg shadow-indigo-600/20">Level 2: Administrative Oversight</Badge>
                        </div>
                        <div className="grid gap-16">
                            {adminLevel.map(u => (
                                <div key={u.id} className="space-y-10">
                                    <div className="max-w-sm mx-auto">
                                        <UserNode user={u} level="admin" highlight={userData?.id === u.id} />
                                    </div>
                                    <SupervisorUnitTeams supervisorId={u.id} teams={visibleTeams} users={users || []} currentUserData={userData} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* General Fleet Tier */}
                {unassignedTeams.length > 0 && isLeadership && (
                    <div className="space-y-10">
                        <div className="flex flex-col items-center gap-2 relative">
                            <ArrowDown className="size-4 text-muted-foreground opacity-30 animate-bounce" />
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.3em] px-4 py-1.5">Unassigned Operational Fleet</Badge>
                        </div>
                        <div className="grid gap-12">
                            {unassignedTeams.map(team => (
                                <TeamUnitBlock key={team.id} team={team} users={users || []} currentUserData={userData} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SupervisorUnitTeams({ supervisorId, teams, users, currentUserData }: { supervisorId: string, teams: Team[], users: UserData[], currentUserData?: UserData }) {
    const supervisedTeams = teams.filter(t => t.supervisorId === supervisorId);
    if (supervisedTeams.length === 0) return null;

    return (
        <div className="space-y-12 pt-4 relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2 hidden md:block" />
            <div className="grid gap-12">
                {supervisedTeams.map(team => (
                    <TeamUnitBlock key={team.id} team={team} users={users} currentUserData={currentUserData} />
                ))}
            </div>
        </div>
    );
}

function TeamUnitBlock({ team, users, currentUserData }: { team: Team, users: UserData[], currentUserData?: UserData }) {
    const lead = users.find(u => u.id === team.teamLeadId);
    const members = users.filter(u => team.memberIds?.includes(u.id) && u.id !== team.teamLeadId);

    return (
        <div className="max-w-4xl mx-auto w-full relative">
            <div className="flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-primary border-primary/20 bg-primary/5 px-3 py-1">
                        <LayoutGrid className="size-3 mr-1.5" /> {team.name} Unit
                    </Badge>
                </div>

                {/* Level 3: Lead Strategist Node */}
                {lead && (
                    <div className="w-full max-w-sm relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-px h-6 bg-border hidden md:block" />
                        <UserNode user={lead} level="lead" highlight={currentUserData?.id === lead.id} />
                    </div>
                )}

                {/* Level 4: Fleet Members Branch */}
                {members.length > 0 && (
                    <div className="w-full space-y-4 pt-2">
                        <div className="flex flex-col items-center">
                            <div className="w-px h-6 bg-border hidden md:block" />
                            <div className="h-px bg-border w-2/3 hidden md:block" />
                        </div>
                        <div className="grid gap-4 w-full sm:grid-cols-2 md:grid-cols-3">
                            {members.map(member => (
                                <div key={member.id} className="relative flex flex-col items-center">
                                    <div className="w-px h-4 bg-border mb-2 hidden md:block" />
                                    <UserNode user={member} level="fleet" highlight={currentUserData?.id === member.id} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
