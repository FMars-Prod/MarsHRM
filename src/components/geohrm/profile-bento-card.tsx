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
        if (!branches || !employee?.branchId) return "HQ Sector";
        const b = branches.find((b: any) => b.id === employee.branchId);
        return b ? b.name : "HQ Sector";
    }, [branches, employee?.branchId]);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "N/A";
        const start = new Date(employee.hireDate);
        const now = new Date();
        const totalDays = differenceInDays(now, start);
        return `${totalDays} day`;
    }, [employee]);

    if (isLoading || !employee) {
        return <div className="h-48 bg-white/50 animate-pulse rounded-[1.5rem] border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A';

    return (
        <Card className="border-none shadow-md rounded-[1.5rem] bg-white overflow-hidden group transition-all duration-500 hover:shadow-lg h-full font-open-sans">
            <div className="relative h-full">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-10 -mt-10 blur-3xl transition-all duration-700 group-hover:bg-primary/10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full -ml-10 -mb-10 blur-3xl" />
                
                <CardContent className="relative p-6 h-full flex flex-col justify-between">
                    <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                        <div className="relative shrink-0">
                            <Avatar className="h-24 w-24 rounded-2xl ring-4 ring-primary/5 ring-offset-0 overflow-hidden transition-all duration-500 group-hover:scale-105">
                                {employee.avatar ? (
                                    isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-4xl">{employee.avatar}</div>
                                ) : <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white h-6 w-6 rounded-lg shadow-md flex items-center justify-center">
                                <Zap className="size-3 text-white fill-white" />
                            </div>
                        </div>

                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                                    <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground">
                                        {employee.firstName} {employee.lastName}
                                    </h1>
                                    <Badge className="bg-primary/10 text-primary border-none rounded-full px-2 py-0 h-5 text-[8px] font-black uppercase tracking-widest">Active</Badge>
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">{employee.jobTitle}</p>
                            </div>

                            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
                                <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-lg border border-border/50">
                                    <MapPin className="size-3 text-primary" />
                                    <span className="text-[9px] font-bold uppercase tracking-tight">{branchName}</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-lg border border-border/50">
                                    <Target className="size-3 text-accent" />
                                    <span className="text-[9px] font-bold uppercase tracking-tight">{employee.department}</span>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col items-end gap-1 text-right shrink-0">
                            <p className="text-[8px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Operational Date</p>
                            <p className="text-lg font-black text-primary/80 tracking-tighter">{format(new Date(), 'EEEE')}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{format(new Date(), 'dd MMM yyyy')}</p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-dashed pt-4 border-border/50">
                        <div className="flex -space-x-3">
                            <ExperienceBadge label="Tier" value={roleName} icon={ShieldCheck} color="bg-indigo-600" />
                            <ExperienceBadge label="Join" value={joinDate} icon={CalendarDays} color="bg-emerald-600" />
                            <ExperienceBadge label="Tenure" value={experience} icon={Clock} color="bg-primary" />
                        </div>
                        
                        <div className="flex gap-2">
                            <a href={`mailto:${employee.email}`} className="p-2 rounded-lg bg-muted/50 hover:bg-primary hover:text-white transition-all duration-300">
                                <Mail className="size-3.5" />
                            </a>
                            {employee.phoneNumber && (
                                <a href={`tel:${employee.phoneNumber}`} className="p-2 rounded-lg bg-muted/50 hover:bg-accent hover:text-white transition-all duration-300">
                                    <Phone className="size-3.5" />
                                </a>
                            )}
                        </div>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}

function ExperienceBadge({ label, value, icon: Icon, color }: any) {
    return (
        <div className="group/badge relative flex items-center gap-2 bg-white ring-1 ring-border/50 shadow-sm rounded-xl p-1.5 px-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className={cn("p-1.5 rounded-lg text-white shadow-sm", color)}>
                <Icon className="size-3" />
            </div>
            <div className="min-w-0">
                <p className="text-[6px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-0.5">{label}</p>
                <p className="text-[9px] font-black whitespace-nowrap">{value}</p>
            </div>
        </div>
    )
}
