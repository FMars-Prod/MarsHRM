'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { List, CalendarOff, ShieldCheck, MessageSquareWarning, ArrowRight, ShieldAlert } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, collectionGroup } from 'firebase/firestore';
import { subDays, endOfDay, format, startOfDay } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ActionItem = {
    id: string;
    type: 'leave' | 'policy' | 'issue' | 'compliance';
    title: string;
    description: string;
    href: string;
};

type LeaveRequest = {
    status: string;
    employeeName: string;
    id: string;
};

type Policy = {
    id: string;
    title: string;
};

type Issue = {
    id: string;
    employeeId: string;
    title: string;
    status: 'Open' | 'In Progress' | 'Resolved';
};

type AttendanceRecord = {
    employeeId: string;
    checkInTime: any;
    checkOutTime: any;
}

export function ActionItemsWidget() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const [complianceIssues, setComplianceIssues] = React.useState<ActionItem[]>([]);

    const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
    const { data: currentUserData } = useDoc(currentUserDocRef);
    const userRole = (currentUserData as any)?.role;
    const isAdmin = userRole === 'CEO/Admin' || userRole === 'HR Manager';

    const leaveRequestsQuery = useMemoFirebase(() => {
        if (!currentUser || !userRole || userRole === 'Member') return null;
        
        let statuses: string[] = [];
        if (userRole === 'Team Lead') statuses = ['Pending'];
        if (userRole === 'HR Manager') statuses = ['Pending HR Approval'];
        if (userRole === 'CEO/Admin') statuses = ['Pending', 'Pending HR Approval'];
        
        if (statuses.length === 0) return null;
        
        return query(collection(firestore, 'leave_requests'), where('status', 'in', statuses));
    }, [firestore, currentUser, userRole]);
    const { data: pendingLeaves, isLoading: leavesLoading } = useCollection<LeaveRequest>(leaveRequestsQuery);

    const policiesQuery = useMemoFirebase(() => collection(firestore, 'policies'), [firestore]);
    const { data: allPolicies, isLoading: policiesLoading } = useCollection<Policy>(policiesQuery);

    const acknowledgmentsQuery = useMemoFirebase(() => currentUser ? collection(firestore, `users/${currentUser.uid}/policy_acknowledgments`) : null, [currentUser, firestore]);
    const { data: acknowledgedPolicies, isLoading: acksLoading } = useCollection<{id: string}>(acknowledgmentsQuery);

    const unacknowledgedPolicies = React.useMemo(() => {
        if (!allPolicies || !acknowledgedPolicies) return [];
        const ackIds = new Set(acknowledgedPolicies.map(a => a.id));
        return allPolicies.filter(p => !ackIds.has(p.id));
    }, [allPolicies, acknowledgedPolicies]);

    const issuesQuery = useMemoFirebase(() => {
        if (!currentUser) return null;
        return query(
            collection(firestore, 'issue_reports'),
            where('employeeId', '==', currentUser.uid),
            where('status', 'in', ['Open', 'In Progress'])
        );
    }, [firestore, currentUser]);
    const { data: openIssues, isLoading: issuesLoading } = useCollection<Issue>(issuesQuery);

    React.useEffect(() => {
        const checkCompliance = async () => {
            if (!isAdmin || !firestore) return;
            
            const yesterday = subDays(new Date(), 1);
            const start = startOfDay(yesterday);
            const end = endOfDay(yesterday);

            const q = query(
                collectionGroup(firestore, 'attendances'),
                where('checkInTime', '>=', start),
                where('checkInTime', '<=', end)
            );

            try {
                const snap = await getDocs(q);
                const items: ActionItem[] = [];
                
                const usersSnap = await getDocs(collection(firestore, 'users'));
                const userMap = new Map();
                usersSnap.docs.forEach(d => userMap.set(d.id, `${d.data().firstName} ${d.data().lastName}`));

                snap.docs.forEach(doc => {
                    const data = doc.data() as AttendanceRecord;
                    if (data.checkInTime && !data.checkOutTime) {
                        const name = userMap.get(data.employeeId) || 'Unknown User';
                        items.push({
                            id: `compliance-${data.employeeId}-${doc.id}`,
                            type: 'compliance',
                            title: `Compliance: ${name}`,
                            description: `No Log-Out on ${format(yesterday, 'MMM d')}`,
                            href: `/dashboard/analytics?userId=${data.employeeId}`
                        });
                    }
                });
                setComplianceIssues(items);
            } catch (err) {
                console.error("Compliance check failed:", err);
            }
        };

        checkCompliance();
    }, [firestore, isAdmin]);

    const actionItems: ActionItem[] = React.useMemo(() => {
        const items: ActionItem[] = [...complianceIssues];
        (pendingLeaves || []).forEach(leave => {
            items.push({
                id: `leave-${leave.id}`,
                type: 'leave',
                title: `Leave: ${leave.employeeName}`,
                description: `Status: ${leave.status}`,
                href: '/dashboard/leave'
            });
        });
        unacknowledgedPolicies.forEach(policy => {
            items.push({
                id: `policy-${policy.id}`,
                type: 'policy',
                title: `Policy: ${policy.title}`,
                description: `Pending Acknowledgment`,
                href: '/dashboard/policies'
            });
        });
        (openIssues || []).forEach(issue => {
            items.push({
                id: `issue-${issue.id}`,
                type: 'issue',
                title: `Ticket: ${issue.title}`,
                description: `Status: ${issue.status}`,
                href: '/dashboard/issues'
            });
        });
        return items;
    }, [pendingLeaves, unacknowledgedPolicies, openIssues, complianceIssues]);

    const isLoading = leavesLoading || policiesLoading || acksLoading || issuesLoading;
    
    const iconMap = {
        leave: <CalendarOff className="size-4" />,
        policy: <ShieldCheck className="size-4" />,
        issue: <MessageSquareWarning className="size-4" />,
        compliance: <ShieldAlert className="size-4" />
    };

    return (
        <Card className="animate-fade-in-up border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-full flex flex-col font-open-sans">
            <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <List className="size-5" /> Tactical Queue
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Pending fleet operations</CardDescription>
                    </div>
                    {actionItems.length > 0 && (
                        <Badge className="bg-primary text-white font-black text-[10px] rounded-full px-3 py-1">
                            {actionItems.length} ACTIVE
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 flex-1">
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : actionItems.length > 0 ? (
                    <ScrollArea className="h-full pr-4 -mr-4">
                        <div className="space-y-3 pb-4">
                            {actionItems.map(item => (
                                <Link href={item.href} key={item.id} className="block group">
                                    <div className={cn(
                                        "flex items-center justify-between p-4 rounded-[1.5rem] border-2 transition-all duration-300 hover:shadow-md",
                                        item.type === 'compliance' ? "bg-orange-50/50 border-orange-100/50 hover:border-orange-200" :
                                        item.type === 'leave' ? "bg-blue-50/50 border-blue-100/50 hover:border-blue-200" :
                                        item.type === 'policy' ? "bg-yellow-50/50 border-yellow-100/50 hover:border-yellow-200" :
                                        "bg-red-50/50 border-red-100/50 hover:border-red-200"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "p-2.5 rounded-xl shadow-sm",
                                                item.type === 'compliance' ? "bg-orange-500 text-white" :
                                                item.type === 'leave' ? "bg-blue-500 text-white" :
                                                item.type === 'policy' ? "bg-yellow-500 text-white" :
                                                "bg-red-500 text-white"
                                            )}>
                                                {iconMap[item.type]}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-black text-xs uppercase tracking-tight text-foreground/80">{item.title}</p>
                                                <p className="text-[9px] font-bold opacity-60 uppercase tracking-[0.15em]">{item.description}</p>
                                            </div>
                                        </div>
                                        <div className="p-1.5 rounded-full bg-white shadow-sm border border-border/50 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all">
                                            <ArrowRight className="size-3" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-20 opacity-30 grayscale">
                        <ShieldCheck className="size-12 mb-4" />
                        <p className="font-black uppercase text-[10px] tracking-[0.3em]">Operational Grid Clear</p>
                        <p className="text-[10px] font-bold uppercase mt-1">No pending actions found</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}