
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, eachDayOfInterval } from 'date-fns';
import { Building2, User, UserCheck, UserX, UserRoundX } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  avatar?: string;
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

const MonitorPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const [summary, setSummary] = React.useState({
    late: [] as UserData[],
    absent: [] as UserData[],
    onLeave: [] as UserData[],
    present: [] as UserData[],
    isLoading: true,
  });

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

      // 1. Fetch today's attendance records
      const attendanceQuery = query(
        collection(firestore, 'attendances'),
        where('checkInTime', '>=', todayStart),
        where('checkInTime', '<=', todayEnd)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const todaysAttendance = attendanceSnapshot.docs.map(doc => doc.data() as AttendanceRecord);

      // 2. Fetch approved leaves that cover today
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
          // Exclude admins/CEOs from being marked as absent
          if ((u as any).role !== 'CEO/Admin' && (u as any).role !== 'HR Manager') {
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

  const UserListCard = ({ title, users, Icon, iconColor }: { title: string; users: UserData[]; Icon: React.ElementType, iconColor: string; }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${iconColor}`} />
            <span>{title}</span>
            <span className="ml-auto text-lg font-semibold">{users.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length > 0 ? (
          <div className="space-y-3">
            {users.map(user => (
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
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No employees in this category today.</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader title="Daily Monitor" description={`An overview of employee status for ${format(new Date(), 'MMMM d, yyyy')}.`} />
      
      {summary.isLoading ? (
        <div className="flex h-64 items-center justify-center">
            <Building2 className="h-12 w-12 animate-pulse text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <UserListCard title="Present" users={summary.present} Icon={UserCheck} iconColor="text-green-500" />
          <UserListCard title="Late Today" users={summary.late} Icon={UserX} iconColor="text-yellow-500" />
          <UserListCard title="Absent" users={summary.absent} Icon={UserRoundX} iconColor="text-red-500" />
          <UserListCard title="On Leave" users={summary.onLeave} Icon={User} iconColor="text-blue-500" />
        </div>
      )}
    </>
  );
};

export default MonitorPage;
