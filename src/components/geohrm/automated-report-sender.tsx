
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { sendDailySummaryEmail } from '@/app/actions/email-actions';

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

      console.log(`[MarsHRM] Triggering dynamic automated report for ${slot}...`);

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
  }, [firestore, isAdminOrHR, currentUser, configData]);

  React.useEffect(() => {
    if (!isAdminOrHR) return;
    const interval = setInterval(checkAndSendReport, 60000);
    checkAndSendReport();
    return () => clearInterval(interval);
  }, [isAdminOrHR, checkAndSendReport]);

  return null;
}
