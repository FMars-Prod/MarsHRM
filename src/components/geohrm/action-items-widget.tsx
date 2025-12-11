
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { List, CalendarOff, ShieldCheck, MessageSquareWarning, ArrowRight } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import type { WithId } from '@/firebase/firestore/use-collection';

type ActionItem = {
    id: string;
    type: 'leave' | 'policy' | 'issue';
    title: string;
    description: string;
    href: string;
};

type LeaveRequest = {
    status: string;
    employeeName: string;
};

type Policy = {
    id: string;
    title: string;
};

type Issue = {
    employeeId: string;
    title: string;
    status: 'Open' | 'In Progress' | 'Resolved';
};

export function ActionItemsWidget() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();

    const currentUserDocRef = useMemoFirebase(() => currentUser ? collection(firestore, 'users').doc(currentUser.uid) : null, [currentUser, firestore]);
    const { data: currentUserData } = useDoc(currentUserDocRef);
    const userRole = (currentUserData as any)?.role;

    // Fetch pending leave requests for managers
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

    // Fetch unacknowledged policies
    const policiesQuery = useMemoFirebase(() => collection(firestore, 'policies'), [firestore]);
    const { data: allPolicies, isLoading: policiesLoading } = useCollection<Policy>(policiesQuery);

    const acknowledgmentsQuery = useMemoFirebase(() => currentUser ? collection(firestore, `users/${currentUser.uid}/policy_acknowledgments`) : null, [currentUser, firestore]);
    const { data: acknowledgedPolicies, isLoading: acksLoading } = useCollection<{id: string}>(acknowledgmentsQuery);

    const unacknowledgedPolicies = React.useMemo(() => {
        if (!allPolicies || !acknowledgedPolicies) return [];
        const ackIds = new Set(acknowledgedPolicies.map(a => a.id));
        return allPolicies.filter(p => !ackIds.has(p.id));
    }, [allPolicies, acknowledgedPolicies]);

    // Fetch open issues reported by the user
    const issuesQuery = useMemoFirebase(() => {
        if (!currentUser) return null;
        return query(
            collection(firestore, 'issue_reports'),
            where('employeeId', '==', currentUser.uid),
            where('status', 'in', ['Open', 'In Progress'])
        );
    }, [firestore, currentUser]);
    const { data: openIssues, isLoading: issuesLoading } = useCollection<Issue>(issuesQuery);

    const actionItems: ActionItem[] = React.useMemo(() => {
        const items: ActionItem[] = [];
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
                description: `Awaiting your acknowledgment`,
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
    }, [pendingLeaves, unacknowledgedPolicies, openIssues]);

    const isLoading = leavesLoading || policiesLoading || acksLoading || issuesLoading;
    
    const iconMap = {
        leave: <CalendarOff className="h-5 w-5 text-blue-500" />,
        policy: <ShieldCheck className="h-5 w-5 text-yellow-500" />,
        issue: <MessageSquareWarning className="h-5 w-5 text-red-500" />
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <List className="size-5" />
                    Action Items
                </CardTitle>
                <CardDescription>Tasks and notifications requiring your attention.</CardDescription>
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
                            <Link href={item.href} key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-lg">
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
                        <p>No pending action items. Great job!</p>
                    </div>
                )}
                 {actionItems.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-4">
                        + {actionItems.length - 5} more
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
