
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, CalendarOff, ArrowRight } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Avatar, AvatarFallback } from '../ui/avatar';
import Link from 'next/link';

type UserData = { id: string; firstName: string; lastName: string; };
type AttendanceRecord = { id: string, employeeId: string };
type LeaveRequest = { id: string, employeeId: string, status: string };
type Team = { memberIds: string[] };

export function TeamOverviewWidget() {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();

    const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [currentUser, firestore]);
    const { data: currentUserData } = useDoc(currentUserDocRef);
    const userRole = (currentUserData as any)?.role;

    const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([]);
    
    // Fetch all users for HR/CEO, or specific team members for Team Lead
    React.useEffect(() => {
        const fetchTeamMembers = async () => {
            if (!firestore || !currentUser || !userRole) return;
            
            if (userRole === 'Team Lead') {
                const teamQuery = query(collection(firestore, 'teams'), where('teamLeadId', '==', currentUser.uid));
                const teamSnapshot = await getDoc(teamQuery as any); // Simplified for single team lead assumption
                if (!teamSnapshot.empty) {
                    const teamData = teamSnapshot.docs[0].data() as Team;
                    setTeamMemberIds(teamData.memberIds);
                }
            } else if (userRole === 'HR Manager' || userRole === 'CEO/Admin') {
                const usersSnapshot = await getDoc(collection(firestore, 'users') as any);
                setTeamMemberIds(usersSnapshot.docs.map(d => d.id));
            }
        };
        fetchTeamMembers();
    }, [firestore, currentUser, userRole]);


    const membersQuery = useMemoFirebase(() => {
        if (teamMemberIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('id', 'in', teamMemberIds));
    }, [firestore, teamMemberIds]);
    const { data: teamMembers, isLoading: membersLoading } = useCollection<UserData>(membersQuery);
    
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const attendanceQuery = useMemoFirebase(() => {
        if (teamMemberIds.length === 0) return null;
        return query(
            collection(firestore, 'attendances'), // Assuming attendances are in a root collection
            where('employeeId', 'in', teamMemberIds),
            where('checkInTime', '>=', todayStart),
            where('checkInTime', '<=', todayEnd)
        );
    }, [firestore, teamMemberIds, todayStart, todayEnd]);
    const { data: todaysAttendance, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    const leaveQuery = useMemoFirebase(() => {
        if (teamMemberIds.length === 0) return null;
        return query(
            collection(firestore, 'leave_requests'),
            where('employeeId', 'in', teamMemberIds),
            where('status', '==', 'Approved'),
            where('startDate', '<=', todayEnd),
            where('endDate', '>=', todayStart)
        );
    }, [firestore, teamMemberIds, todayStart, todayEnd]);
    const { data: onLeaveMembers, isLoading: leaveLoading } = useCollection<LeaveRequest>(leaveQuery);
    
    if (!userRole || userRole === 'Member') {
        return null; // Don't show this widget for members
    }

    const isLoading = membersLoading || attendanceLoading || leaveLoading;
    const totalMembers = teamMembers?.length || 0;
    const clockedInCount = todaysAttendance?.length || 0;
    const onLeaveCount = onLeaveMembers?.length || 0;
    const absentCount = totalMembers - clockedInCount - onLeaveCount;

    const notClockedInMembers = teamMembers?.filter(
        member => !(todaysAttendance?.some(a => a.employeeId === member.id) || onLeaveMembers?.some(l => l.employeeId === member.id))
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Users className="size-5" />
                    Team Overview
                </CardTitle>
                <CardDescription>A quick look at your team's status today.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p>Loading team data...</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="flex flex-col items-center">
                                <UserCheck className="size-6 text-green-600 mb-1" />
                                <p className="text-2xl font-bold">{clockedInCount}</p>
                                <p className="text-xs text-muted-foreground">Clocked In</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <CalendarOff className="size-6 text-blue-600 mb-1" />
                                <p className="text-2xl font-bold">{onLeaveCount}</p>
                                <p className="text-xs text-muted-foreground">On Leave</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <UserX className="size-6 text-red-600 mb-1" />
                                <p className="text-2xl font-bold">{absentCount > 0 ? absentCount : 0}</p>
                                <p className="text-xs text-muted-foreground">Absent</p>
                            </div>
                        </div>

                        {notClockedInMembers && notClockedInMembers.length > 0 && (
                             <div>
                                <h4 className="text-sm font-medium mb-2">Yet to Clock In</h4>
                                <div className="space-y-2">
                                    {notClockedInMembers.slice(0, 3).map(member => (
                                        <Link href={`/dashboard/users/${member.id}`} key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{member.firstName[0]}{member.lastName[0]}</AvatarFallback>
                                                </Avatar>
                                                <p className="text-sm font-medium">{member.firstName} {member.lastName}</p>
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        </Link>
                                    ))}
                                    {notClockedInMembers.length > 3 && (
                                        <p className="text-xs text-center text-muted-foreground pt-1">
                                            + {notClockedInMembers.length - 3} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

