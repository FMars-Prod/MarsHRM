'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { ShieldCheck, Mail, Phone, CalendarDays, MapPin, Target, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProfileBentoCard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: employee, isLoading } = useDoc<any>(userDocRef);

    const experience = React.useMemo(() => {
        if (!employee?.hireDate) return "New Recruit";
        const start = new Date(employee.hireDate);
        const now = new Date();
        const years = differenceInYears(now, start);
        const months = differenceInMonths(now, start) % 12;
        
        if (years > 0) return `${years} Year ${months > 0 ? `${months}m` : ''} Veteran`;
        if (months > 0) return `${months} Month Specialist`;
        return `${differenceInDays(now, start)} Day Trainee`;
    }, [employee]);

    if (isLoading || !employee) {
        return <div className="h-64 bg-white/50 animate-pulse rounded-[2.5rem] border-none ring-1 ring-border/50" />;
    }

    const isUrl = employee.avatar && employee.avatar.startsWith('http');
    const roleName = employee.role || 'Member';
    const joinDate = employee.hireDate ? format(new Date(employee.hireDate), 'dd MMM yyyy') : 'N/A';

    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group transition-all duration-500 hover:shadow-2xl h-full font-open-sans">
            <div className="relative h-full">
                {/* Visual Background Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl transition-all duration-700 group-hover:bg-primary/10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full -ml-20 -mb-20 blur-3xl" />
                
                <CardContent className="relative p-8 md:p-10 h-full flex flex-col justify-between">
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                        <div className="relative shrink-0">
                            <Avatar className="h-32 w-32 md:h-40 md:w-40 rounded-[2rem] ring-8 ring-primary/5 ring-offset-0 overflow-hidden transition-all duration-500 group-hover:scale-105 group-hover:rotate-1">
                                {employee.avatar ? (
                                    isUrl ? <AvatarImage src={employee.avatar} className="object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-primary/10 text-6xl">{employee.avatar}</div>
                                ) : <AvatarFallback className="text-4xl font-bold bg-primary/10 text-primary">{employee.firstName[0]}{employee.lastName[0]}</AvatarFallback>}
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white h-8 w-8 rounded-2xl shadow-lg flex items-center justify-center">
                                <Zap className="size-4 text-white fill-white" />
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div className="space-y-1">
                                <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                                    <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">
                                        {employee.firstName} {employee.lastName}
                                    </h1>
                                    <Badge className="bg-primary/10 text-primary border-none rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest">Active Duty</Badge>
                                </div>
                                <p className="text-xl font-medium text-muted-foreground">{employee.jobTitle}</p>
                            </div>

                            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                                <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                    <MapPin className="size-3.5 text-primary" />
                                    <span className="text-[11px] font-bold uppercase tracking-tight">{employee.branch || 'HQ Sector'}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                    <Target className="size-3.5 text-accent" />
                                    <span className="text-[11px] font-bold uppercase tracking-tight">{employee.department} Unit</span>
                                </div>
                                {employee.shiftType && (
                                    <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/50">
                                        <Clock className="size-3.5 text-indigo-500" />
                                        <span className="text-[11px] font-bold uppercase tracking-tight">{employee.shiftType}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col items-end gap-2 text-right shrink-0">
                            <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Operational Date</p>
                            <p className="text-2xl font-black text-primary/80 tracking-tighter">{format(new Date(), 'EEEE')}</p>
                            <p className="text-sm font-bold text-muted-foreground">{format(new Date(), 'dd MMMM yyyy')}</p>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-dashed pt-8 border-border/50">
                        <div className="flex -space-x-4">
                            <ExperienceBadge label="Authority" value={roleName} icon={ShieldCheck} color="bg-indigo-600" />
                            <ExperienceBadge label="Commenced" value={joinDate} icon={CalendarDays} color="bg-emerald-600" />
                            <ExperienceBadge label="Fleet Tenure" value={experience} icon={Clock} color="bg-primary" />
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="text-center sm:text-right">
                                <p className="text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest">Tactical Comms</p>
                                <div className="flex gap-2 mt-1">
                                    <a href={`mailto:${employee.email}`} className="p-2.5 rounded-xl bg-muted/50 hover:bg-primary hover:text-white transition-all duration-300">
                                        <Mail className="size-4" />
                                    </a>
                                    {employee.phoneNumber && (
                                        <a href={`tel:${employee.phoneNumber}`} className="p-2.5 rounded-xl bg-muted/50 hover:bg-accent hover:text-white transition-all duration-300">
                                            <Phone className="size-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}

function ExperienceBadge({ label, value, icon: Icon, color }: any) {
    return (
        <div className="group/badge relative flex items-center gap-3 bg-white ring-1 ring-border/50 shadow-sm rounded-2xl p-2 px-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <div className={cn("p-2 rounded-xl text-white shadow-sm", color)}>
                <Icon className="size-4" />
            </div>
            <div>
                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-0.5">{label}</p>
                <p className="text-xs font-black whitespace-nowrap">{value}</p>
            </div>
        </div>
    )
}
