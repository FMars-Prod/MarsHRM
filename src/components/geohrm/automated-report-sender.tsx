
'use client';

import * as React from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, collectionGroup, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, differenceInSeconds } from 'date-fns';
import { sendDailySummaryEmail } from '@/app/actions/email-actions';

/**
 * A hidden component that runs logic to send automated reports at specific times.
 * Only triggers if an Admin or HR user is active on the dashboard.
 */
export function AutomatedReportSender() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(userDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdminOrHR = userRole === 'CEO/Admin' || userRole === 'HR Manager';

  const formatDuration = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const checkAndSendReport = React.useCallback(async () => {
    if (!isAdminOrHR || !firestore) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Morning Report: 9:50 AM | Evening Report: 6:50 PM (18:50)
    let slot = '';
    if (hours === 9 && minutes === 50) slot = '0950';
    if (hours === 18 && minutes === 50) slot = '1850';

    if (!slot) return;

    const reportId = `${todayStr}-${slot}`;
    const reportLogRef = doc(firestore, 'automated_reports', reportId);

    try {
      // Concurrency control: check if this specific slot has been sent already today
      const checkDocs = await getDocs(query(collection(firestore, 'automated_reports'), where('__name__', '==', reportId)));
      if (!checkDocs.empty) return;

      console.log(`[MarsHRM] Generating automated report for ${slot}...`);

      // 1. Gather Data
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

      const categories = {
        present: [] as string[],
        late: [] as string[],
        outOfRange: [] as string[],
        absent: [] as string[],
        onLeave: [] as string[],
      };

      users.forEach((u: any) => {
        const att = attendanceMap.get(u.id);
        const name = `${u.firstName} ${u.lastName} (${u.jobTitle})`;
        
        if (att) {
          const timeIn = att.checkInTime ? format(att.checkInTime.toDate(), 'p') : '--:--';
          const timeOut = att.checkOutTime ? format(att.checkOutTime.toDate(), 'p') : '--:--';
          const breakTime = att.totalBreakDuration ? formatDuration(att.totalBreakDuration) : '0m';
          
          const detailStr = `(In: ${timeIn} / Out: ${timeOut} - Break: ${breakTime})`;

          if (att.isOutOfRange) {
            categories.outOfRange.push(`${name} - Out of Range ${detailStr}`);
          } else if (att.status === 'late') {
            categories.late.push(`${name} - Late ${detailStr}`);
          } else {
            categories.present.push(`${name} ${detailStr}`);
          }
        } else if (onLeaveTodayIds.has(u.id)) {
          categories.onLeave.push(name);
        } else {
          if (u.role !== 'CEO/Admin' && u.role !== 'HR Manager') {
            categories.absent.push(name);
          }
        }
      });

      // 2. Format Summary Text
      let summaryText = `FortuMars AI Technologies & Business Solutions\n`;
      summaryText += `Daily Attendance Summary - ${format(now, 'PPP')} @ ${format(now, 'p')}\n\n`;

      const addSection = (title: string, items: string[]) => {
        if (items.length === 0) return '';
        return `${title} (${items.length}):\n` + items.map(i => `- ${i}`).join('\n') + '\n\n';
      };

      summaryText += addSection('Present', categories.present);
      summaryText += addSection('Late', categories.late);
      summaryText += addSection('Out of Range', categories.outOfRange);
      summaryText += addSection('Absent', categories.absent);
      summaryText += addSection('On Leave', categories.onLeave);

      // 3. Send Email via Server Action
      const recipients = ['ceo@fortumars.com', 'hr@fortumars.com', 'ceo@cognithorz.com'];
      const result = await sendDailySummaryEmail({
        date: format(now, 'PP'),
        summaryText,
        recipients
      });

      if (result.success) {
        // Mark as sent in Firestore
        await setDoc(reportLogRef, {
          id: reportId,
          sentAt: serverTimestamp(),
          slot,
          recipients,
          triggeredBy: currentUser?.uid
        });
        console.log(`[MarsHRM] Automated report sent successfully for slot ${slot}.`);
      }

    } catch (err) {
      console.error("[MarsHRM] Failed to trigger automated report:", err);
    }
  }, [firestore, isAdminOrHR, currentUser]);

  React.useEffect(() => {
    if (!isAdminOrHR) return;

    // Check every minute
    const interval = setInterval(checkAndSendReport, 60000);
    checkAndSendReport(); // Run on mount

    return () => clearInterval(interval);
  }, [isAdminOrHR, checkAndSendReport]);

  return null; // Invisible worker component
}
