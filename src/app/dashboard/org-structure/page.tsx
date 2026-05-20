
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight, Users, ShieldCheck, UserCircle, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
};

export default function OrgStructurePage() {
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading } = useCollection<UserData>(usersQuery);

    const teamsQuery = useMemoFirebase(() => query(collection(firestore, 'teams')), [firestore]);
    const { data: teams } = useCollection<Team>(teamsQuery);

    const admins = users?.filter(u => u.role === 'CEO/Admin' || u.role === 'HR Manager') || [];
    const teamLeads = users?.filter(u => u.role === 'Team Lead') || [];
    const members = users?.filter(u => u.role === 'Member') || [];

    const isUrl = (str?: string) => str && str.startsWith('http');

    const UserNode = ({ user, level }: { user: UserData, level: 'executive' | 'lead' | 'fleet' }) => (
        <Card className={cn(
            "border-none shadow-sm relative group hover:ring-2 transition-all",
            level === 'executive' ? "bg-primary text-white ring-primary/20" : 
            level === 'lead' ? "bg-white ring-1 ring-border/50 ring-blue-500/20" : 
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

    return (
        <div className="space-y-8 animate-fade-in-up">
            <PageHeader title="Organizational Hierarchy" description="Visual command structure mapping executive oversight and tactical fleet distribution." />

            {isLoading ? (
                <div className="flex h-64 items-center justify-center"><Network className="size-12 animate-pulse text-muted-foreground opacity-20" /></div>
            ) : (
                <div className="space-y-12 pb-20 relative">
                    {/* Vertical Connector Line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-border/50 to-transparent -translate-x-1/2 hidden md:block" />

                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2"><Badge className="bg-primary text-white font-black uppercase text-[8px] tracking-[0.3em]">Command Level</Badge></div>
                        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
                            {admins.map(admin => <UserNode key={admin.id} user={admin} level="executive" />)}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2"><Badge className="bg-blue-600 text-white font-black uppercase text-[8px] tracking-[0.3em]">Operational Leads</Badge></div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
                            {teamLeads.map(lead => <UserNode key={lead.id} user={lead} level="lead" />)}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-2"><Badge className="bg-muted text-muted-foreground font-black uppercase text-[8px] tracking-[0.3em]">Tactical Fleet</Badge></div>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {members.map(member => <UserNode key={member.id} user={member} level="fleet" />)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
