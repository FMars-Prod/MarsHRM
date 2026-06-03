'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { ShieldCheck, Mail, Phone, CalendarDays, MapPin, Target, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileBentoCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: employee, isLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "HQ Office";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "HQ Office";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const now = new Date();
        const totalDays = differenceInDays(now, start);
        return `${totalDays} d`;
    }, [employee]);

    if (isLoading || !employee) {
        return <div className="h-40 bg-white/50 animate-pulse rounded-2xl border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A';

    return (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group transition-all duration-500 h-full font-open-sans ring-1 ring-border/50">
            <div className="relative h-full">
                <CardContent className="relative p-4 h-full flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <div className="relative shrink-0">
                            <Avatar className="h-16 w-16 rounded-xl ring-2 ring-primary/5 shadow-sm overflow-hidden">
                                {employee.avatar ? (
                                    isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-3xl">{employee.avatar}</div>
                                ) : <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                            </Avatar>
                        </div>

                        <div className="flex-1 space-y-1 text-center sm:text-left">
                            <div className="flex items-center justify-center sm:justify-start gap-2">
                                <h1 className="text-lg font-black tracking-tighter">
                                    {employee.firstName} {employee.lastName}
                                </h1>
                                <Badge className="bg-green-100 text-green-700 border-none rounded-full px-1.5 h-4 text-[7px] font-black uppercase">Active</Badge>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">{employee.jobTitle}</p>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                                <Badge variant="secondary" className="bg-muted/30 text-[7px] font-bold uppercase py-0 px-2 h-4 border-none">{branchName}</Badge>
                                <Badge variant="secondary" className="bg-muted/30 text-[7px] font-bold uppercase py-0 px-2 h-4 border-none">{employee.department}</Badge>
                            </div>
                        </div>

                        <div className="hidden md:flex flex-col items-end gap-0.5 text-right shrink-0">
                            <p className="text-[7px] font-black uppercase text-muted-foreground/40">{format(new Date(), 'EEEE')}</p>
                            <p className="text-xs font-black text-primary/80">{format(new Date(), 'dd MMM yy')}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-between gap-3 border-t border-dashed pt-3 border-border/50">
                        <div className="flex gap-2">
                            <SmallBadge label="Tier" value={roleName} color="bg-indigo-600" />
                            <SmallBadge label="Joined" value={joinDate} color="bg-emerald-600" />
                            <SmallBadge label="Days" value={experience} color="bg-primary" />
                        </div>
                        
                        <div className="flex gap-1.5">
                            <a href={`mailto:${employee.email}`} className="p-1.5 rounded-lg bg-muted/50 hover:bg-primary hover:text-white transition-all">
                                <Mail className="size-3" />
                            </a>
                        </div>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}

function SmallBadge({ label, value, color }: any) {
    return (
        <div className="flex items-center gap-1.5 bg-white ring-1 ring-border/50 shadow-sm rounded-lg p-1 px-2">
            <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
            <div className="leading-none">
                <p className="text-[6px] font-black uppercase text-muted-foreground/60">{label}</p>
                <p className="text-[8px] font-black">{value}</p>
            </div>
        </div>
    )
}
