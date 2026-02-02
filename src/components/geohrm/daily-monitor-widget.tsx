'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Building2, User, UserCheck, UserX, UserRoundX, Download } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  avatar?: string;
  role?: string;
};

type AttendanceRecord = {
  employeeId: string;
  status: 'present' | 'late';
};

type LeaveRequest = {
  employeeId: string;
  status: 'Approved';
  startDate: Timestamp;
  endDate: Timestamp;
};

export const DailyMonitorWidget = () => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    isLoading: true,
  });
  const [sheetContent, setSheetContent] = React.useState<{title: string, users: UserData[] } | null>(null);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  React.useEffect(() => {
    const fetchMonitorData = async () => {
      if (!users || users.length === 0) {
        if (!usersLoading) {
            setSummary(prev => ({ ...prev, isLoading: false }));
        }
        return;
      };

      setSummary(prev => ({ ...prev, isLoading: true }));

      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      const attendanceQuery = query(
        collectionGroup(firestore, 'attendances'),
        where('checkInTime', '>=', todayStart),
        where('checkInTime', '<=', todayEnd)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const todaysAttendance = attendanceSnapshot.docs.map(doc => doc.data() as AttendanceRecord);

      const leavesQuery = query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved'));
      const leavesSnapshot = await getDocs(leavesQuery);
      const allApprovedLeaves = leavesSnapshot.docs.map(doc => doc.data() as LeaveRequest);
      
      const onLeaveTodayIds = new Set<string>();
      allApprovedLeaves.forEach(leave => {
        const leaveInterval = { start: leave.startDate.toDate(), end: leave.endDate.toDate() };
        if (isWithinInterval(today, leaveInterval)) {
          onLeaveTodayIds.add(leave.employeeId);
        }
      });
      
      const presentUserIds = new Set<string>();
      const lateUserIds = new Set<string>();
      
      todaysAttendance.forEach(att => {
        if (att.status === 'late') {
          lateUserIds.add(att.employeeId);
        } else if (att.status === 'present') {
          presentUserIds.add(att.employeeId);
        }
      });

      const lateUsers: UserData[] = [];
      const onLeaveUsers: UserData[] = [];
      const presentUsers: UserData[] = [];
      const absentUsers: UserData[] = [];

      users.forEach(u => {
        if (lateUserIds.has(u.id)) {
          lateUsers.push(u);
        } else if (presentUserIds.has(u.id)) {
          presentUsers.push(u);
        } else if (onLeaveTodayIds.has(u.id)) {
          onLeaveUsers.push(u);
        } else {
          if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') {
             absentUsers.push(u);
          }
        }
      });
      
      setSummary({
        late: lateUsers,
        absent: absentUsers,
        onLeave: onLeaveUsers,
        present: presentUsers,
        isLoading: false,
      });
    };

    fetchMonitorData();
  }, [users, usersLoading, firestore]);

  const handleExport = () => {
    const { present, late, absent, onLeave, isLoading } = summary;
    if (isLoading || (!present.length && !late.length && !absent.length && !onLeave.length)) {
      toast({
        variant: "destructive",
        title: "No data to export",
        description: "There is no status information for today.",
      });
      return;
    }

    const allUsersWithStatus = [
      ...present.map(u => ({ ...u, status: 'Present' })),
      ...late.map(u => ({ ...u, status: 'Late' })),
      ...absent.map(u => ({ ...u, status: 'Absent' })),
      ...onLeave.map(u => ({ ...u, status: 'On Leave' })),
    ];

    const headers = ['Status', 'First Name', 'Last Name', 'Job Title'];
    const csvRows = [
      headers.join(','),
      ...allUsersWithStatus.map(u => {
        const row = [
          `"${u.status}"`,
          `"${u.firstName}"`,
          `"${u.lastName}"`,
          `"${u.jobTitle}"`,
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `daily_monitor_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const UserListCard = ({ title, users, Icon, iconColor, onClick }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; onClick: () => void; }) => (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={onClick}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <span>{title}</span>
            <span className="ml-auto text-lg font-semibold">{users.length}</span>
        </CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <Sheet onOpenChange={(isOpen) => !isOpen && setSheetContent(null)}>
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <CardTitle className="font-headline">Daily Team Monitor</CardTitle>
                        <CardDescription>A real-time overview of your team's status for today, {format(new Date(), 'MMMM d')}.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={summary.isLoading}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
            {summary.isLoading ? (
                <div className="flex h-48 items-center justify-center">
                    <Building2 className="h-12 w-12 animate-pulse text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <SheetTrigger asChild>
                    <UserListCard title="Present" users={summary.present} Icon={UserCheck} iconColor="text-green-500" onClick={() => setSheetContent({title: "Present Today", users: summary.present})} />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard title="Late" users={summary.late} Icon={UserX} iconColor="text-yellow-500" onClick={() => setSheetContent({title: "Arrived Late", users: summary.late})} />
                  </SheetTrigger>
                  <SheetTrigger asChild>
                    <UserListCard title="Absent" users={summary.absent} Icon={UserRoundX} iconColor="text-red-500" onClick={() => setSheetContent({title: "Absent Today", users: summary.absent})} />
                  </SheetTrigger>
                   <SheetTrigger asChild>
                    <UserListCard title="On Leave" users={summary.onLeave} Icon={User} iconColor="text-blue-500" onClick={() => setSheetContent({title: "On Leave", users: summary.onLeave})} />
                   </SheetTrigger>
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
};
