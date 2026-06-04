'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { ShieldCheck, MapPin, CalendarDays, Clock } from 'lucide-react';
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
        return <div className="h-20 bg-white/50 animate-pulse rounded-xl border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A';

    return (
        <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden font-jakarta ring-1 ring-border/50">
            <CardContent className="p-3 h-full flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border shadow-sm">
                            {employee.avatar ? (
                                isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-lg">{employee.avatar}</div>
                            ) : <AvatarFallback className="text-sm font-black bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                        </Avatar>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-black tracking-tight truncate leading-none">
                                    {employee.firstName} {employee.lastName}
                                </h2>
                                <Badge className="bg-green-500 text-white border-none rounded-full px-1.5 h-3.5 text-[7px] font-black uppercase">Active</Badge>
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{employee.jobTitle}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                <MapPin className="size-2" /> {branchName} • {employee.department}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pr-2">
                        <StatusInfo label="Tier" value={roleName === 'CEO/Admin' ? 'CEO' : roleName} color="text-indigo-600" />
                        <StatusInfo label="Joined" value={joinDate} color="text-emerald-600" />
                        <StatusInfo label="Days" value={experience} color="text-primary" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatusInfo({ label, value, color }: any) {
    return (
        <div className="flex flex-col text-right">
            <span className="text-[7px] font-black uppercase text-muted-foreground/40 tracking-widest">{label}</span>
            <span className={cn("text-[10px] font-black tracking-tight", color)}>{value}</span>
        </div>
    );
}
