'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { List, CalendarOff, ShieldCheck, MessageSquareWarning, ArrowRight, ShieldAlert } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, collectionGroup } from 'firebase/firestore';
import { subDays, endOfDay, format, startOfDay } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
                const issues: ActionItem[] = [];
                
                const usersSnap = await getDocs(collection(firestore, 'users'));
                const userMap = new Map();
                usersSnap.docs.forEach(d => userMap.set(d.id, `${d.data().firstName} ${d.data().lastName}`));

                snap.docs.forEach(doc => {
                    const data = doc.data() as AttendanceRecord;
                    if (data.checkInTime && !data.checkOutTime) {
                        const name = userMap.get(data.employeeId) || 'Unknown User';
                        issues.push({
                            id: `compliance-${data.employeeId}-${format(yesterday, 'yyyy-MM-dd')}`,
                            type: 'compliance',
                            title: `Compliance Alert: ${name}`,
                            description: `Failed to clock out on ${format(yesterday, 'MMM d')}.`,
                            href: `/dashboard/analytics?userId=${data.employeeId}`
                        });
                    }
                });
                setComplianceIssues(issues);
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
                title: `Leave Request: ${leave.employeeName}`,
                description: `Status: ${leave.status}`,
                href: '/dashboard/leave'
            });
        });
        unacknowledgedPolicies.forEach(policy => {
            items.push({
                id: `policy-${policy.id}`,
                type: 'policy',
                title: `New Policy: ${policy.title}`,
                description: `Awaiting acknowledgment`,
                href: '/dashboard/policies'
            });
        });
        (openIssues || []).forEach(issue => {
            items.push({
                id: `issue-${issue.id}`,
                type: 'issue',
                title: `Issue: ${issue.title}`,
                description: `Status: ${issue.status}`,
                href: '/dashboard/issues'
            });
        });
        return items;
    }, [pendingLeaves, unacknowledgedPolicies, openIssues, complianceIssues]);

    const isLoading = leavesLoading || policiesLoading || acksLoading || issuesLoading;
    
    const iconMap = {
        leave: <CalendarOff className="h-5 w-5 text-blue-500" />,
        policy: <ShieldCheck className="h-5 w-5 text-yellow-500" />,
        issue: <MessageSquareWarning className="h-5 w-5 text-red-500" />,
        compliance: <ShieldAlert className="h-5 w-5 text-orange-500" />
    };

    return (
        <Card className="animate-fade-in-up bg-gradient-to-br from-primary/5 to-transparent border-none ring-1 ring-border/50 shadow-sm" style={{ animationDelay: '200ms' }}>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <List className="size-5" />
                    Action Items
                </CardTitle>
                <CardDescription>Notifications requiring attention.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
                                    <div className="h-3 w-1/2 rounded-md bg-muted animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : actionItems.length > 0 ? (
                    <div className="space-y-3">
                        {actionItems.slice(0, 5).map(item => (
                            <Link href={item.href} key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-white/50 transition-all duration-300 group">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", item.type === 'compliance' ? 'bg-orange-100' : 'bg-muted')}>
                                        {iconMap[item.type]}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-6">
                        <p>No pending items.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
