'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileBentoCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: employee, isLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Office";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Office";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "0 d";
        const start = new Date(employee.hireDate);
        const totalDays = differenceInDays(new Date(), start);
        return `${totalDays} d`;
    }, [employee]);

    if (isLoading || !employee) {
        return <div className="h-24 bg-white/50 animate-pulse rounded-xl border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A';

    return (
        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden font-jakarta ring-1 ring-border/50">
            <CardContent className="p-4 lg:p-8 h-full flex flex-col md:flex-row items-center justify-between gap-6 lg:gap-12">
                <div className="flex items-center gap-4 lg:gap-8">
                    <Avatar className="h-16 w-16 lg:h-24 lg:w-24 rounded-2xl ring-2 ring-border shadow-sm">
                        {employee.avatar ? (
                            isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-3xl lg:text-5xl font-black">{employee.avatar}</div>
                        ) : <AvatarFallback className="text-2xl lg:text-4xl font-black bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                    </Avatar>
                    <div className="min-w-0 text-center md:text-left">
                        <div className="flex items-center gap-3 mb-1.5 justify-center md:justify-start">
                            <h2 className="text-xl lg:text-3xl font-black tracking-tighter truncate leading-none">
                                {employee.firstName} {employee.lastName}
                            </h2>
                            <Badge className="bg-green-500 text-white border-none rounded-full px-2.5 h-4 lg:h-6 text-[10px] lg:text-xs font-black uppercase tracking-widest">Active</Badge>
                        </div>
                        <p className="text-xs lg:text-lg font-bold text-muted-foreground">{employee.jobTitle}</p>
                        <div className="flex items-center gap-2 mt-3 text-[10px] lg:text-sm font-black text-muted-foreground/50 uppercase tracking-widest">
                            <MapPin className="size-3 lg:size-4" /> {branchName} • {employee.department}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-10 lg:gap-20 pr-2">
                    <StatusInfo label="Tier" value={roleName === 'CEO/Admin' ? 'CEO' : roleName} color="text-indigo-600" />
                    <StatusInfo label="Joined" value={joinDate} color="text-emerald-600" />
                    <StatusInfo label="Days" value={experience} color="text-primary" />
                </div>
            </CardContent>
        </Card>
    );
}

function StatusInfo({ label, value, color }: any) {
    return (
        <div className="flex flex-col text-center md:text-right">
            <span className="text-[9px] lg:text-xs font-black uppercase text-muted-foreground/40 tracking-widest mb-1.5">{label}</span>
            <span className={cn("text-sm lg:text-2xl font-black tracking-tighter", color)}>{value}</span>
        </div>
    );
}
