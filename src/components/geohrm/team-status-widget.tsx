'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, UserRoundX } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '../ui/avatar';
import type { WithId } from '@/firebase/firestore/use-collection';

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    role: string;
    avatar?: string;
};

type AttendanceRecord = {
    employeeId: string;
    status: 'present' | 'late';
};

export function TeamStatusWidget() {
    const firestore = useFirestore();
    const [totalUsers, setTotalUsers] = React.useState(0);
    const [presentCount, setPresentCount] = React.useState(0);
    const [lateCount, setLateCount] = React.useState(0);
    const [notLoggedIn, setNotLoggedIn] = React.useState<UserData[]>([]);
    const [lateUsers, setLateUsers] = React.useState<UserData[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[] } | null>(null);

    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

    React.useEffect(() => {
        const fetchAttendanceSummary = async () => {
            if (!users || !firestore) return;

            setIsLoading(true);
            
            try {
                const todayStart = startOfDay(new Date());
                const todayEnd = endOfDay(new Date());

                const attendanceQuery = query(
                    collectionGroup(firestore, 'attendances'),
                    where('checkInTime', '>=', todayStart),
                    where('checkInTime', '<=', todayEnd)
                );
                
                const attendanceSnapshot = await getDocs(attendanceQuery);
                const todaysAttendance = attendanceSnapshot.docs.map(doc => doc.data() as AttendanceRecord);

                const presentIds = new Set<string>();
                const lateIds = new Set<string>();
                todaysAttendance.forEach(rec => {
                    if (rec.status === 'late') {
                        lateIds.add(rec.employeeId);
                    } else {
                        presentIds.add(rec.employeeId);
                    }
                });
                
                const notLoggedInUsers: UserData[] = [];
                const lateUsersList: UserData[] = [];
                
                users.forEach(user => {
                    const isAdmin = user.role === 'CEO/Admin' || user.role === 'HR Manager';
                    if (isAdmin) return;

                    if (!presentIds.has(user.id) && !lateIds.has(user.id)) {
                        notLoggedInUsers.push(user);
                    }
                    if (lateIds.has(user.id)) {
                        lateUsersList.push(user);
                    }
                });

                const nonAdminUsers = users.filter(u => u.role !== 'CEO/Admin' && u.role !== 'HR Manager').length;

                setTotalUsers(nonAdminUsers);
                setPresentCount(presentIds.size);
                setLateCount(lateIds.size);
                setNotLoggedIn(notLoggedInUsers);
                setLateUsers(lateUsersList);
            } catch (error: any) {
                console.error("Team status error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAttendanceSummary();
    }, [users, firestore]);

    const handleOpenSheet = (title: string, users: UserData[]) => {
        setSheetContent({ title, users });
    };

    return (
        <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <Users className="size-5" />
                        Team Status
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-24">Loading...</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg">
                                <span className="text-3xl font-bold text-green-700">{presentCount}</span>
                                <span className="text-sm text-green-600">Present</span>
                            </div>

                            <SheetTrigger asChild>
                                <button
                                    onClick={() => handleOpenSheet('Late Today', lateUsers)}
                                    className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg text-yellow-700 hover:bg-yellow-100 transition-colors"
                                >
                                    <span className="text-3xl font-bold">{lateCount}</span>
                                    <span className="text-sm text-yellow-600">Late</span>
                                </button>
                            </SheetTrigger>
                            
                            <SheetTrigger asChild>
                                 <button
                                    onClick={() => handleOpenSheet('Not Logged In', notLoggedIn)}
                                    className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                                >
                                    <span className="text-3xl font-bold">{notLoggedIn.length}</span>
                                    <span className="text-sm text-red-600">Not Logged In</span>
                                </button>
                            </SheetTrigger>
                            
                            <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
                                <span className="text-3xl font-bold text-blue-700">{totalUsers}</span>
                                <span className="text-sm text-blue-600">Total Users</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {sheetContent && (
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{sheetContent.title} ({sheetContent.users.length})</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-3">
                         {sheetContent.users.length > 0 ? (
                            sheetContent.users.map(user => (
                                <Link href={`/dashboard/users/${user.id}`} key={user.id} className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted transition-colors">
                                    <Avatar className="h-9 w-9">
                                    {user.avatar && <span className="text-xl">{user.avatar}</span>}
                                    <AvatarFallback>{user.firstName?.[0]}{user.lastName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                    <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-muted-foreground">{user.jobTitle}</p>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No employees in this category.</p>
                        )}
                    </div>
                </SheetContent>
            )}
        </Sheet>
    );
}
