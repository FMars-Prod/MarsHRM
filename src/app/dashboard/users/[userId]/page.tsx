
'use client';

import * as React from 'react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/geohrm/page-header';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltipContent } from '@/components/ui/chart';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { format, subDays, differenceInSeconds } from 'date-fns';
import { Clock, Briefcase, CalendarOff, AlertTriangle, Hourglass, Coffee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WithId } from '@/firebase/firestore/use-collection';

type AttendanceRecord = {
  checkInTime?: any;
  checkOutTime?: any;
  totalBreakDuration?: number;
  status: 'present' | 'late' | 'absent' | 'on_leave';
};

const UserAnalyticsPage = ({ params }: { params: { userId: string } }) => {
  const firestore = useFirestore();
  const { userId } = params;

  const userDocRef = useMemoFirebase(
    () => doc(firestore, 'users', userId),
    [firestore, userId]
  );
  const { data: user, isLoading: isUserLoading } = useDoc(userDocRef);

  const thirtyDaysAgo = subDays(new Date(), 30);
  const attendanceQuery = useMemoFirebase(
    () => query(
      collection(firestore, `users/${userId}/attendances`),
      where('checkInTime', '>=', thirtyDaysAgo),
      orderBy('checkInTime', 'desc')
    ),
    [firestore, userId]
  );
  const { data: attendanceData, isLoading: isAttendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  const weeklyAttendanceQuery = useMemoFirebase(
      () => query(
        collection(firestore, `users/${userId}/attendances`),
        where('checkInTime', '>=', subDays(new Date(), 7)),
        orderBy('checkInTime', 'asc')
      ),
      [firestore, userId]
  );
  const { data: weeklyAttendanceData } = useCollection<AttendanceRecord>(weeklyAttendanceQuery);

  const userAvatar = PlaceHolderImages.find((image) => image.id === 'user-avatar-1');

  const stats = React.useMemo(() => {
    if (!attendanceData) return { totalHours: 0, totalBreakHours: 0, totalLeaves: 0, lateDays: 0 };

    let totalWorkSeconds = 0;
    let totalBreakSeconds = 0;
    let lateDays = 0;
    let onLeaveDays = 0;

    attendanceData.forEach(rec => {
      if (rec.checkInTime && rec.checkOutTime) {
        const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
        const breakDuration = rec.totalBreakDuration || 0;
        totalWorkSeconds += workSeconds - breakDuration;
        totalBreakSeconds += breakDuration;
      }
      if (rec.status === 'late') lateDays++;
      if (rec.status === 'on_leave') onLeaveDays++;
    });

    const totalHours = totalWorkSeconds / 3600;
    const totalBreakHours = totalBreakSeconds / 3600;

    return {
      totalHours: totalHours.toFixed(1),
      totalBreakHours: totalBreakHours.toFixed(1),
      totalLeaves: onLeaveDays,
      lateDays,
    };
  }, [attendanceData]);

  const chartData = React.useMemo(() => {
      if (!weeklyAttendanceData) return [];
      return weeklyAttendanceData.map(rec => {
          let workHours = 0;
          if (rec.checkInTime && rec.checkOutTime) {
              const workSeconds = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate());
              workHours = (workSeconds - (rec.totalBreakDuration || 0)) / 3600;
          }
          const breakHours = (rec.totalBreakDuration || 0) / 3600;

          return {
              date: format(rec.checkInTime.toDate(), 'EEE, MMM d'),
              work: parseFloat(workHours.toFixed(2)),
              break: parseFloat(breakHours.toFixed(2)),
          }
      });
  }, [weeklyAttendanceData]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (isUserLoading) return <p>Loading user profile...</p>;
  if (!isUserLoading && !user) {
    notFound();
  }

  return (
    <>
      <PageHeader title={`${(user as any).firstName} ${(user as any).lastName}'s Analytics`} description="An overview of the user's activity and performance." />

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <Avatar className="h-20 w-20">
              {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={(user as any).firstName} />}
              <AvatarFallback>{(user as any).firstName?.[0]}{(user as any).lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{(user as any).firstName} ${(user as any).lastName}</CardTitle>
              <CardDescription>{(user as any).jobTitle} - {(user as any).department}</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Work Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalHours} hrs</div>
                    <p className="text-xs text-muted-foreground">in the last 30 days</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Break Time</CardTitle>
                    <Coffee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalBreakHours} hrs</div>
                    <p className="text-xs text-muted-foreground">in the last 30 days</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Days on Leave</CardTitle>
                    <CalendarOff className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalLeaves}</div>
                    <p className="text-xs text-muted-foreground">in the last 30 days</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Late Days</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lateDays}</div>
                    <p className="text-xs text-muted-foreground">in the last 30 days</p>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Weekly Work Hours</CardTitle>
                    <CardDescription>Work vs. Break hours over the last 7 days.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis unit="h" />
                             <Tooltip 
                                cursor={{ fill: 'hsl(var(--muted))' }}
                                content={<ChartTooltipContent
                                    formatter={(value, name) => `${value}h`}
                                    indicator="dot"
                                    />}
                            />
                            <Bar dataKey="work" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Work" />
                            <Bar dataKey="break" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Break" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Attendance</CardTitle>
                    <CardDescription>A log of the user's recent clock-in and clock-out activity.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Clock In/Out</TableHead>
                                <TableHead>Work</TableHead>
                                <TableHead>Break</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isAttendanceLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">Loading attendance...</TableCell>
                                </TableRow>
                            ) : (attendanceData || []).slice(0, 7).map((rec, i) => {
                                let workDuration = 0;
                                if (rec.checkInTime && rec.checkOutTime) {
                                    workDuration = differenceInSeconds(rec.checkOutTime.toDate(), rec.checkInTime.toDate()) - (rec.totalBreakDuration || 0);
                                }
                                return (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{rec.checkInTime ? format(rec.checkInTime.toDate(), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                    <TableCell>
                                      {rec.checkInTime ? format(rec.checkInTime.toDate(), 'p') : '--:--'}
                                      {' / '}
                                      {rec.checkOutTime ? format(rec.checkOutTime.toDate(), 'p') : '--:--'}
                                    </TableCell>
                                    <TableCell>{formatDuration(workDuration)}</TableCell>
                                    <TableCell>{formatDuration(rec.totalBreakDuration || 0)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                rec.status === 'present' && 'text-green-600 border-green-600/50',
                                                rec.status === 'late' && 'text-yellow-600 border-yellow-600/50',
                                                rec.status === 'absent' && 'text-red-600 border-red-600/50',
                                                rec.status === 'on_leave' && 'text-blue-600 border-blue-600/50',
                                            )}
                                        >{rec.status}</Badge>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
};

export default UserAnalyticsPage;
