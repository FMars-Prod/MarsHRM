'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';

export function ResetClockIn() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [canReset, setCanReset] = React.useState(false);

  const todaysAttendanceRef = useMemoFirebase(() => {
    if (!user) return null;
    const todayId = format(new Date(), 'yyyy-MM-dd');
    return doc(firestore, `users/${user.uid}/attendances`, todayId);
  }, [user, firestore]);

  const { data: todaysAttendance, isLoading } = useDoc(todaysAttendanceRef);

  React.useEffect(() => {
    if (todaysAttendance) {
        // Can reset if there's a record for today (either checked in or checked out)
        setCanReset(true);
    } else {
        setCanReset(false);
    }
  }, [todaysAttendance]);


  const handleReset = () => {
    if (todaysAttendanceRef) {
      deleteDocumentNonBlocking(todaysAttendanceRef);
      toast({
        title: 'Attendance Reset',
        description: "Today's attendance record has been cleared.",
      });
    }
  };

  if (isLoading || !canReset) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Clock In
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete today's entire attendance record, including
            clock-in, clock-out, and break times. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset}>Confirm Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
