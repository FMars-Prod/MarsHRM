'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subWeeks, startOfWeek, endOfWeek, differenceInSeconds } from 'date-fns';
import { sendDailySummaryEmail, sendWeeklySummaryEmail } from '@/app/actions/email-actions';

export function AutomatedReportSender() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(userDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  const configDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: configData } = useDoc<any>(configDocRef);

  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const checkAndSendReport = React.useCallback(async () => {
    if (!isAdminOrHR || !firestore || !configData?.timings) return;

    const now = new Date();
    const currentTimeStr = format(now, 'HH:mm');
    const { morningReportSlot, eveningReportSlot } = configData.timings;

    let slot = '';
    if (currentTimeStr === morningReportSlot) slot = 'morning';
    if (currentTimeStr === eveningReportSlot) slot = 'evening';

    if (!slot) return;

    const todayStr = format(now, 'yyyy-MM-dd');
    const reportId = `${todayStr}-${slot}`;
    const reportLogRef = doc(firestore, 'automated_reports', reportId);

    try {
      const checkDocs = await getDocs(query(collection(firestore, 'automated_reports'), where('__name__', '==', reportId)));
      if (!checkDocs.empty) return;

      console.log(`[MarsHRM] Triggering daily automated report for ${slot}...`);

      const usersSnap = await getDocs(collection(firestore, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const selectedDayStart = startOfDay(now);
      const selectedDayEnd = endOfDay(now);

      const attendanceQuery = query(
        collectionGroup(firestore, 'attendances'),
        where('checkInTime', '>=', selectedDayStart),
        where('checkInTime', '<=', selectedDayEnd)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceMap = new Map();
      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        attendanceMap.set(data.employeeId, data);
      });

      const leavesQuery = query(collection(firestore, 'leave_requests'), where('status', '==', 'Approved'));
      const leavesSnapshot = await getDocs(leavesQuery);
      const allApprovedLeaves = leavesSnapshot.docs.map(doc => doc.data());
      
      const onLeaveTodayIds = new Set();
      allApprovedLeaves.forEach((leave: any) => {
        const leaveInterval = { start: leave.startDate.toDate(), end: leave.endDate.toDate() };
        if (isWithinInterval(now, leaveInterval)) {
          onLeaveTodayIds.add(leave.employeeId);
        }
      });

      const categories = { present: [] as string[], late: [] as string[], outOfRange: [] as string[], absent: [] as string[], onLeave: [] as string[] };

      users.forEach((u: any) => {
        const att = attendanceMap.get(u.id);
        const name = `${u.firstName} ${u.lastName} (${u.jobTitle})`;
        if (att) {
          const detailStr = `(In: ${att.checkInTime ? format(att.checkInTime.toDate(), 'p') : '--:--'} / Out: ${att.checkOutTime ? format(att.checkOutTime.toDate(), 'p') : '--:--'} - Break: ${att.totalBreakDuration ? formatDuration(att.totalBreakDuration) : '0m'})`;
          if (att.isOutOfRange) categories.outOfRange.push(`${name} - Out of Range ${detailStr}`);
          else if (att.status === 'late') categories.late.push(`${name} - Late ${detailStr}`);
          else categories.present.push(`${name} ${detailStr}`);
        } else if (onLeaveTodayIds.has(u.id)) {
          categories.onLeave.push(name);
        } else if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') {
          categories.absent.push(name);
        }
      });

      let summaryText = `FortuMars AI Technologies & Business Solutions\nDaily Attendance Summary - ${format(now, 'PPP')} @ ${format(now, 'p')}\n\n`;
      const addSection = (title: string, items: string[]) => items.length > 0 ? `${title} (${items.length}):\n` + items.map(i => `- ${i}`).join('\n') + '\n\n' : '';
      summaryText += addSection('Present', categories.present);
      summaryText += addSection('Late', categories.late);
      summaryText += addSection('Out of Range', categories.outOfRange);
      summaryText += addSection('Absent', categories.absent);
      summaryText += addSection('On Leave', categories.onLeave);

      const recipients = ['ceo@fortumars.com', 'hr@fortumars.com', 'ceo@cognithorz.com'];
      const result = await sendDailySummaryEmail({ date: format(now, 'PP'), summaryText, recipients });

      if (result.success) {
        await setDoc(reportLogRef, { id: reportId, sentAt: serverTimestamp(), slot, recipients, triggeredBy: currentUser?.uid });
      }
    } catch (err) {
      console.error("[MarsHRM] Automated report fail:", err);
    }
  }, [firestore, isAdminOrHR, currentUser, configData, formatDuration]);

  const checkAndSendWeeklyReport = React.useCallback(async () => {
    if (!isAdminOrHR || !firestore) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const currentTimeStr = format(now, 'HH:mm');

    // Weekly report triggers every Monday at 09:30 AM
    if (dayOfWeek !== 1 || currentTimeStr !== '09:30') return;

    const todayStr = format(now, 'yyyy-MM-dd');
    const reportId = `weekly-${todayStr}`;
    const reportLogRef = doc(firestore, 'automated_reports', reportId);

    try {
      const checkDocs = await getDocs(query(collection(firestore, 'automated_reports'), where('__name__', '==', reportId)));
      if (!checkDocs.empty) return;

      console.log(`[MarsHRM] Triggering automated weekly report...`);

      // Date range for previous week (Monday to Sunday)
      const lastWeekStart = startOfDay(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
      const lastWeekEnd = endOfDay(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
      const dateRangeStr = `${format(lastWeekStart, 'PP')} - ${format(lastWeekEnd, 'PP')}`;

      const usersSnap = await getDocs(collection(firestore, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const attendanceQuery = query(
        collectionGroup(firestore, 'attendances'),
        where('checkInTime', '>=', lastWeekStart),
        where('checkInTime', '<=', lastWeekEnd)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceData = attendanceSnapshot.docs.map(d => d.data());

      let summaryText = `FortuMars AI Technologies & Business Solutions\nWeekly Performance Summary\nPeriod: ${dateRangeStr}\n\n`;
      summaryText += `User Performance Matrix:\n`;
      summaryText += `--------------------------------------------------\n`;
      summaryText += `${'Employee'.padEnd(25)} | ${'Pres'.padEnd(4)} | ${'Late'.padEnd(4)} | ${'Hours'.padEnd(6)}\n`;
      summaryText += `--------------------------------------------------\n`;

      users.forEach((u: any) => {
        if (u.role === 'CEO/Admin' || u.role === 'HR Manager') return;

        const userAtts = attendanceData.filter(a => a.employeeId === u.id);
        const present = userAtts.filter(a => a.status === 'present').length;
        const late = userAtts.filter(a => a.status === 'late').length;
        
        let totalSeconds = 0;
        userAtts.forEach(a => {
            if (a.checkInTime && a.checkOutTime) {
                const diff = differenceInSeconds(a.checkOutTime.toDate(), a.checkInTime.toDate());
                totalSeconds += (diff - (a.totalBreakDuration || 0));
            }
        });
        const hours = (totalSeconds / 3600).toFixed(1);

        const name = `${u.firstName} ${u.lastName}`.slice(0, 25);
        summaryText += `${name.padEnd(25)} | ${present.toString().padEnd(4)} | ${late.toString().padEnd(4)} | ${hours.padEnd(6)}\n`;
      });

      summaryText += `\n--------------------------------------------------\n`;
      summaryText += `Report generated automatically by MarsHRM System Protocol.`;

      const recipients = ['ceo@fortumars.com', 'hr@fortumars.com', 'ceo@cognithorz.com'];
      const result = await sendWeeklySummaryEmail({ dateRange: dateRangeStr, summaryText, recipients });

      if (result.success) {
        await setDoc(reportLogRef, { id: reportId, sentAt: serverTimestamp(), type: 'weekly', recipients, triggeredBy: currentUser?.uid });
      }
    } catch (err) {
      console.error("[MarsHRM] Weekly report fail:", err);
    }
  }, [firestore, isAdminOrHR, currentUser]);

  React.useEffect(() => {
    if (!isAdminOrHR) return;
    const interval = setInterval(() => {
      checkAndSendReport();
      checkAndSendWeeklyReport();
    }, 60000);
    checkAndSendReport();
    checkAndSendWeeklyReport();
    return () => clearInterval(interval);
  }, [isAdminOrHR, checkAndSendReport, checkAndSendWeeklyReport]);

  return null;
}
