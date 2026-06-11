'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { List, CalendarOff, ShieldCheck, MessageSquareWarning, ArrowRight, ShieldAlert, MapPin } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, getDocs, collectionGroup } from 'firebase/firestore';
import { subDays, endOfDay, format, startOfDay } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

type ActionItem = {
    id: string;
    type: 'leave' | 'policy' | 'issue' | 'compliance' | 'range_approval';
    title: string;
    description: string;
    href: string;
};

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
    const { data: pendingLeaves, isLoading: leavesLoading } = useCollection<any>(leaveRequestsQuery);

    const rangeRequestsQuery = useMemoFirebase(() => {
        if (!isAdmin) return null;
        return query(collection(firestore, 'attendanceApprovalRequests'), where('status', '==', 'Pending'));
    }, [firestore, isAdmin]);
    const { data: pendingRangeRequests, isLoading: rangeLoading } = useCollection<any>(rangeRequestsQuery);

    const policiesQuery = useMemoFirebase(() => collection(firestore, 'policies'), [firestore]);
    const { data: allPolicies, isLoading: policiesLoading } = useCollection<any>(policiesQuery);

    const acknowledgmentsQuery = useMemoFirebase(() => currentUser ? collection(firestore, `users/${currentUser.uid}/policy_acknowledgments`) : null, [currentUser, firestore]);
    const { data: acknowledgedPolicies, isLoading: acksLoading } = useCollection<{id: string}>(acknowledgmentsQuery);

    const unacknowledgedPolicies = React.useMemo(() => {
        if (!allPolicies || !acknowledgedPolicies) return [];
        const ackIds = new Set(acknowledgedPolicies.map(a => a.id));
        return allPolicies.filter(p => !ackIds.has(p.id));
    }, [allPolicies, acknowledgedPolicies]);

    const issuesQuery = useMemoFirebase(() => {
        if (!currentUser) return null;
        return query(collection(firestore, 'issue_reports'), where('employeeId', '==', currentUser.uid), where('status', 'in', ['Open', 'In Progress']));
    }, [firestore, currentUser]);
    const { data: openIssues, isLoading: issuesLoading } = useCollection<any>(issuesQuery);

    React.useEffect(() => {
        const checkCompliance = async () => {
            if (!isAdmin || !firestore) return;
            const yesterday = subDays(new Date(), 1);
            const start = startOfDay(yesterday);
            const end = endOfDay(yesterday);
            const q = query(collectionGroup(firestore, 'attendances'), where('checkInTime', '>=', start), where('checkInTime', '<=', end));
            try {
                const snap = await getDocs(q);
                const items: ActionItem[] = [];
                const usersSnap = await getDocs(collection(firestore, 'users'));
                const userMap = new Map();
                usersSnap.docs.forEach(d => userMap.set(d.id, `${d.data().firstName} ${d.data().lastName}`));
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.checkInTime && !data.checkOutTime) {
                        const name = userMap.get(data.employeeId) || 'Unknown User';
                        items.push({
                            id: `compliance-${data.employeeId}-${doc.id}`,
                            type: 'compliance',
                            title: `Compliance: ${name}`,
                            description: `No Logout on ${format(yesterday, 'MMM d')}`,
                            href: `/dashboard/users/${data.employeeId}`
                        });
                    }
                });
                setComplianceIssues(items);
            } catch (err) {}
        };
        checkCompliance();
    }, [firestore, isAdmin]);

    const actionItems: ActionItem[] = React.useMemo(() => {
        const items: ActionItem[] = [...complianceIssues];
        (pendingRangeRequests || []).forEach(req => items.push({ id: `range-${req.id}`, type: 'range_approval', title: `Approval: ${req.employeeName}`, description: `Attendance request pending`, href: '/dashboard/attendance-requests' }));
        (pendingLeaves || []).forEach(leave => items.push({ id: `leave-${leave.id}`, type: 'leave', title: `Leave: ${leave.employeeName}`, description: `Request for approval`, href: '/dashboard/leave' }));
        unacknowledgedPolicies.forEach(policy => items.push({ id: `policy-${policy.id}`, type: 'policy', title: `Policy: ${policy.title}`, description: `Review required`, href: '/dashboard/policies' }));
        (openIssues || []).forEach(issue => items.push({ id: `issue-${issue.id}`, type: 'issue', title: `Support: ${issue.title}`, description: `Ticket in progress`, href: '/dashboard/issues' }));
        return items;
    }, [pendingLeaves, unacknowledgedPolicies, openIssues, complianceIssues, pendingRangeRequests]);

    const iconMap = {
        leave: <CalendarOff className="size-4" />,
        policy: <ShieldCheck className="size-4" />,
        issue: <MessageSquareWarning className="size-4" />,
        compliance: <ShieldAlert className="size-4" />,
        range_approval: <MapPin className="size-4" />
    };

    return (
        <Card className="animate-fade-in-up border-none shadow-sm rounded-none bg-white overflow-hidden h-full flex flex-col">
            <CardHeader className="p-6 pb-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
                            <List className="size-4" /> Action Items
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Items requiring attention</CardDescription>
                    </div>
                    {actionItems.length > 0 && <Badge className="bg-primary text-white font-black text-[9px] rounded-none">{actionItems.length}</Badge>}
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-2 flex-1">
                {leavesLoading || policiesLoading || acksLoading || issuesLoading || rangeLoading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => (<div key={i} className="h-14 rounded-none bg-muted animate-pulse" />))}</div>
                ) : actionItems.length > 0 ? (
                    <ScrollArea className="h-full pr-3 -mr-3">
                        <div className="space-y-2 pb-2">
                            {actionItems.map(item => (
                                <Link href={item.href} key={item.id} className="block group">
                                    <div className="flex items-center justify-between p-3 rounded-none bg-muted/20 border border-transparent hover:border-border/50 hover:bg-white hover:shadow-sm transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-none text-white", item.type === 'compliance' || item.type === 'issue' ? "bg-rose-500" : item.type === 'leave' || item.type === 'range_approval' ? "bg-sky-500" : "bg-amber-500")}>
                                                {iconMap[item.type]}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-xs truncate max-w-[150px]">{item.title}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.description}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 opacity-30">
                        <ShieldCheck className="size-10 mb-2" />
                        <p className="font-black uppercase text-[10px] tracking-widest">No pending items</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}