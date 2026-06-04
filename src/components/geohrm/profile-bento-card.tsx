'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { Mail, ShieldCheck, MapPin, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileBentoCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: employee, isLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Main Office";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Main Office";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "0 days";
        const start = new Date(employee.hireDate);
        const totalDays = differenceInDays(new Date(), start);
        return `${totalDays} days`;
    }, [employee]);

    if (isLoading || !employee) {
        return <div className="h-28 bg-white/50 animate-pulse rounded-2xl border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A';

    return (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group transition-all duration-500 h-full font-jakarta ring-1 ring-border/50">
            <CardContent className="p-4 h-full flex flex-col justify-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <Avatar className="h-14 w-14 rounded-xl ring-2 ring-primary/5 shadow-sm overflow-hidden">
                            {employee.avatar ? (
                                isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-2xl">{employee.avatar}</div>
                            ) : <AvatarFallback className="text-xl font-black bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 shadow-sm" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h2 className="text-lg font-black tracking-tighter truncate">
                                {employee.firstName} {employee.lastName}
                            </h2>
                            <Badge className="bg-primary/10 text-primary border-none rounded-full px-1.5 h-3.5 text-[8px] font-black uppercase tracking-widest">Active</Badge>
                        </div>
                        <p className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-tight">{employee.jobTitle} • {employee.department}</p>
                        
                        <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                <MapPin className="size-2.5" /> {branchName}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                <Mail className="size-2.5" /> {employee.email}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <StatusStrip label="Role" value={roleName} icon={ShieldCheck} color="text-indigo-600" />
                    <StatusStrip label="Joined" value={joinDate} icon={CalendarDays} color="text-emerald-600" />
                    <StatusStrip label="Tenure" value={experience} icon={Clock} color="text-primary" />
                </div>
            </CardContent>
        </Card>
    );
}

function StatusStrip({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-muted/20 rounded-xl p-2 flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
                <Icon className={cn("size-2.5", color)} />
                <span className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-widest">{label}</span>
            </div>
            <p className="text-[10px] font-black tracking-tight">{value}</p>
        </div>
    );
}
