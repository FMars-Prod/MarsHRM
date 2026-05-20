
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Network, ArrowDown, Target, LayoutGrid, ShieldCheck, UserCircle, Briefcase, ChevronDown } from 'lucide-react';
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
        "border-none shadow-sm relative group transition-all w-full max-w-[280px] mx-auto",
        highlight ? "ring-2 ring-primary scale-105 z-10" : "opacity-95 hover:opacity-100 hover:shadow-md",
        level === 'executive' ? "bg-primary text-white" : 
        level === 'admin' ? "bg-indigo-50 ring-1 ring-indigo-200" :
        level === 'lead' ? "bg-white ring-1 ring-border/50 shadow-sm" : 
        "bg-white/50 ring-1 ring-border/50"
    )}>
        <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="size-10 ring-2 ring-white/20 shrink-0">
                {user.avatar ? (
                    isUrl(user.avatar) ? <AvatarImage src={user.avatar} className="object-cover" /> : <span className="text-xl">{user.avatar}</span>
                ) : <AvatarFallback className="text-xs">{user.firstName[0]}{user.lastName[0]}</AvatarFallback>}
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className={cn("font-bold text-xs truncate", level === 'executive' ? "text-white" : "text-foreground")}>{user.firstName} {user.lastName}</p>
                <p className={cn("text-[8px] font-black uppercase tracking-widest truncate", level === 'executive' ? "text-white/70" : "text-muted-foreground")}>{user.jobTitle}</p>
            </div>
            <Badge variant="outline" className={cn(
                "rounded-full text-[7px] font-black uppercase tracking-widest border-none shrink-0 px-1.5 py-0", 
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

    if (isUserLoading || usersLoading) return <div className="flex h-screen items-center justify-center"><Network className="size-12 animate-pulse text-muted-foreground opacity-20" /></div>;

    const ceoLevel = users?.filter(u => u.role === 'CEO/Admin') || [];
    const adminLevel = users?.filter(u => u.role === 'HR Manager') || [];
    const unassignedTeams = visibleTeams.filter(t => !t.supervisorId || !users?.some(u => u.id === t.supervisorId));

    return (
        <div className="space-y-12 animate-fade-in-up max-w-6xl mx-auto pb-32">
            <PageHeader title="Command Hierarchy" description="High-fidelity tactical tree mapping vertical reporting lines and unit distribution." />

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

            <div className="flex flex-col items-center">
                {/* Level 1: Executive Command */}
                <div className="space-y-12 w-full">
                    <div className="flex flex-col items-center">
                        <Badge className="bg-primary text-white font-black uppercase text-[8px] tracking-[0.3em] px-4 py-1.5 shadow-lg shadow-primary/20 mb-6">Level 1: Executive Command</Badge>
                        <div className="grid gap-6 w-full">
                            {ceoLevel.map(u => (
                                <div key={u.id} className="relative">
                                    <UserNode user={u} level="executive" highlight={userData?.id === u.id} />
                                    <div className="flex flex-col items-center mt-6">
                                        <div className="w-px h-12 bg-border" />
                                        <div className="w-full max-w-5xl h-px bg-border" />
                                        <div className="flex flex-wrap justify-center gap-12 pt-12">
                                            {/* Level 2: Admin Oversight (HR) branched from specific CEO if applicable, but for MVP we branch all Level 2s */}
                                            {adminLevel.map(admin => (
                                                <AdminBranch key={admin.id} admin={admin} teams={visibleTeams} users={users || []} currentUserData={userData} />
                                            ))}
                                            
                                            {/* Teams reporting directly to Level 1 */}
                                            {visibleTeams.filter(t => t.supervisorId === u.id).map(team => (
                                                <div key={team.id} className="relative">
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-border" />
                                                    <TeamUnitBlock team={team} users={users || []} currentUserData={userData} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Unassigned Teams */}
                {unassignedTeams.length > 0 && isLeadership && (
                    <div className="mt-24 space-y-12 w-full pt-12 border-t border-dashed">
                        <div className="flex flex-col items-center">
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.3em] px-4 py-1.5 mb-8">Unassigned Operational Fleet</Badge>
                            <div className="flex flex-wrap justify-center gap-12">
                                {unassignedTeams.map(team => (
                                    <TeamUnitBlock key={team.id} team={team} users={users || []} currentUserData={userData} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AdminBranch({ admin, teams, users, currentUserData }: { admin: UserData, teams: Team[], users: UserData[], currentUserData?: UserData }) {
    const supervisedTeams = teams.filter(t => t.supervisorId === admin.id);

    return (
        <div className="relative flex flex-col items-center">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-border" />
            <UserNode user={admin} level="admin" highlight={currentUserData?.id === admin.id} />
            
            {supervisedTeams.length > 0 && (
                <>
                    <div className="w-px h-12 bg-border mt-6" />
                    <div className="w-[120%] h-px bg-border" />
                    <div className="flex flex-wrap justify-center gap-12 pt-12">
                        {supervisedTeams.map(team => (
                            <TeamUnitBlock key={team.id} team={team} users={users} currentUserData={currentUserData} hasParent />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function TeamUnitBlock({ team, users, currentUserData, hasParent }: { team: Team, users: UserData[], currentUserData?: UserData, hasParent?: boolean }) {
    const lead = users.find(u => u.id === team.teamLeadId);
    const members = users.filter(u => team.memberIds?.includes(u.id) && u.id !== team.teamLeadId);

    return (
        <div className="flex flex-col items-center relative min-w-[280px]">
            {hasParent && <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-border" />}
            
            <div className="flex flex-col items-center gap-4 bg-white/40 p-4 rounded-3xl border border-dashed border-border/50">
                <Badge variant="outline" className="text-[7px] font-black uppercase tracking-[0.2em] text-primary border-primary/20 bg-primary/5 px-2 py-0.5">
                    <LayoutGrid className="size-2 mr-1" /> {team.name}
                </Badge>

                {/* Level 3: Lead Strategist Node */}
                {lead && (
                    <div className="w-full relative">
                        <UserNode user={lead} level="lead" highlight={currentUserData?.id === lead.id} />
                    </div>
                )}

                {/* Level 4: Fleet Members Branch */}
                {members.length > 0 && (
                    <div className="w-full space-y-3 pt-2">
                        <div className="flex flex-col items-center">
                            <div className="w-px h-4 bg-border" />
                            <div className="w-full h-px bg-border" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 w-full">
                            {members.map(member => (
                                <div key={member.id} className="relative flex flex-col items-center">
                                    <div className="w-px h-2 bg-border mb-2" />
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
