'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInMonths } from 'date-fns';
import { MapPin, ShieldCheck, CalendarDays, Clock } from 'lucide-react';
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

        if (years > 0) {
            return `${years} yr${remainingMonths > 0 ? ` ${remainingMonths} mo` : ''}`;
        }
        return `${totalMonths} mo`;
    }, [employee]);

    if (isLoading || !employee) {
        return (
            <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden ring-1 ring-border/50 h-[220px]">
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
                <div className="flex flex-col md:flex-row items-stretch">
                    {/* Primary Identity Section - Linear Layout */}
                    <div className="flex-1 p-6 lg:p-10 flex flex-col sm:flex-row items-start gap-6 lg:gap-10 border-b md:border-b-0 md:border-r border-dashed border-border/50">
                        <div className="relative shrink-0">
                            <Avatar className="h-24 w-24 lg:h-32 lg:w-32 rounded-none ring-4 ring-white shadow-2xl transition-transform duration-500 group-hover:scale-105">
                                {employee.avatar ? (
                                    isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-4xl lg:text-5xl font-black">{employee.avatar}</div>
                                ) : <AvatarFallback className="text-3xl lg:text-4xl font-black bg-primary/10 text-primary rounded-none">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                            </Avatar>
                            <Badge className="absolute -bottom-2 -right-2 h-6 px-3 bg-green-500 text-white border-2 border-white shadow-lg rounded-none font-black text-[8px] uppercase tracking-widest flex items-center gap-1">
                                Active
                            </Badge>
                        </div>

                        <div className="flex-1 text-left space-y-4 pt-1 min-w-0">
                            <div className="space-y-1">
                                <h2 className="text-3xl lg:text-5xl font-black tracking-tighter truncate leading-none text-foreground">
                                    {employee.firstName} {employee.lastName}
                                </h2>
                                <p className="text-base lg:text-xl font-bold text-muted-foreground/80">{employee.jobTitle}</p>
                            </div>
                            <div className="flex items-center gap-2.5 text-[10px] lg:text-xs font-black text-primary/60 uppercase tracking-[0.2em]">
                                <MapPin className="size-3.5" /> {branchName} • {employee.department}
                            </div>
                        </div>
                    </div>

                    {/* Meta Stats Section */}
                    <div className="w-full md:w-[220px] p-6 lg:p-10 bg-muted/5 flex flex-row md:flex-col justify-around md:justify-center gap-6">
                        <StatusInfo icon={ShieldCheck} label="Tier" value={roleName === 'CEO/Admin' ? 'CEO' : roleName} color="text-indigo-600" />
                        <StatusInfo icon={CalendarDays} label="Joined" value={joinDate} color="text-emerald-600" />
                        <StatusInfo icon={Clock} label="Exp" value={experience} color="text-primary" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatusInfo({ icon: Icon, label, value, color }: any) {
    return (
        <div className="flex flex-col text-center md:text-left group/item">
            <div className="flex items-center gap-2 mb-1 justify-center md:justify-start opacity-40 group-hover/item:opacity-100 transition-opacity">
                <Icon className="size-3" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
            </div>
            <span className={cn("text-lg lg:text-2xl font-black tracking-tighter leading-none whitespace-nowrap", color)}>{value}</span>
        </div>
    );
}
