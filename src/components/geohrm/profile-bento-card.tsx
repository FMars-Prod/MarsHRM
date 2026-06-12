'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInMonths, differenceInDays, addMonths } from 'date-fns';
import { ShieldCheck, CalendarDays, Clock, MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileBentoCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: employee, isLoading } = useDoc<any>(userDocRef);

    const branchesQuery = useMemoFirebase(() => query(collection(firestore, 'branches')), [firestore]);
    const { data: branches } = useCollection<any>(branchesQuery);

    const branchName = React.useMemo(() => {
        if (!branches || !employee?.branchId) return "Office Hub";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "Office Hub";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const now = new Date();
        
        const totalMonths = differenceInMonths(now, start);
        const years = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        
        const dateAfterMonths = addMonths(start, totalMonths);
        const days = differenceInDays(now, dateAfterMonths);

        let parts = [];
        if (years > 0) parts.push(`${years} yr`);
        parts.push(`${remainingMonths} mo`);
        if (days > 0) parts.push(`${days} d`);
        
        return parts.join(' ');
    }, [employee]);

    if (isLoading || !employee) {
        return (
            <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden ring-1 ring-border/50 h-[180px]">
                <div className="w-full h-full bg-muted/20 animate-pulse" />
            </Card>
        );
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yy') : 'N/A';

    return (
        <Card className="border-none shadow-2xl rounded-none bg-white overflow-hidden font-jakarta ring-1 ring-border/50 group transition-all duration-500 hover:shadow-primary/5">
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-center min-h-[160px]">
                    {/* Primary Identity Section - Horizontal Strip */}
                    <div className="flex-1 p-6 lg:p-8 flex flex-row items-center gap-8 md:border-r border-dashed border-border/50 h-full">
                        <div className="relative shrink-0">
                            <Avatar className="size-24 lg:size-28 rounded-none ring-4 ring-white shadow-xl transition-transform duration-500 group-hover:scale-105">
                                {employee.avatar ? (
                                    isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-3xl font-black">{employee.avatar}</div>
                                ) : <AvatarFallback className="text-2xl font-black bg-primary/10 text-primary rounded-none">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                            </Avatar>
                            <Badge className="absolute -bottom-1 -right-1 h-5 px-2 bg-green-500 text-white border-2 border-white shadow-lg rounded-none font-black text-[7px] uppercase tracking-widest flex items-center gap-1">
                                <div className="size-1 rounded-full bg-white animate-pulse" /> Active
                            </Badge>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="space-y-1">
                                <h2 className="text-2xl lg:text-3xl font-black tracking-tighter truncate leading-none text-foreground">
                                    {employee.firstName} {employee.lastName}
                                </h2>
                                <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-wide">{employee.jobTitle}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 mt-3">
                                <Badge variant="outline" className="text-[9px] font-black text-primary/70 uppercase tracking-widest bg-primary/5 border-primary/20 rounded-none px-2.5 py-0.5 flex gap-1.5 items-center">
                                    <MapPin className="size-2.5" /> {branchName}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-widest bg-muted/20 border-none rounded-none px-2.5 py-0.5 flex gap-1.5 items-center">
                                    <Building2 className="size-2.5" /> {employee.department}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Meta Stats Section - Distributed Linear Layout */}
                    <div className="w-full md:w-auto p-6 lg:p-8 bg-muted/5 flex flex-row items-center justify-around md:gap-12 lg:gap-16 h-full">
                        <StatusInfo icon={ShieldCheck} label="Account Tier" value={roleName === 'CEO/Admin' ? 'CEO' : roleName} color="text-indigo-600" />
                        <StatusInfo icon={CalendarDays} label="Joining Date" value={joinDate} color="text-emerald-600" />
                        <StatusInfo icon={Clock} label="Operational Tenure" value={experience} color="text-primary" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatusInfo({ icon: Icon, label, value, color }: any) {
    return (
        <div className="flex flex-col items-center md:items-start group/item">
            <div className="flex items-center gap-1.5 mb-1 opacity-40 group-hover/item:opacity-100 transition-opacity">
                <Icon className="size-3" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em]">{label}</span>
            </div>
            <span className={cn("text-base lg:text-lg font-black tracking-tighter leading-none whitespace-nowrap", color)}>{value}</span>
        </div>
    );
}
