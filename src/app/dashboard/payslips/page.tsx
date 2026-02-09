
"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, Download, Trash2, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, serverTimestamp } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, getYear } from "date-fns";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Payslip = {
  id: string;
  month: number;
  year: number;
  issueDate: any;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  downloadUrl: string;
};

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PayslipsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, "users", user.uid) : null), [user, firestore]);
  const { data: currentUserData } = useDoc(userDocRef);
  const userRole = (currentUserData as any)?.role;
  const isAdmin = userRole === 'HR Manager' || userRole === 'CEO/Admin';

  const [selectedUser, setSelectedUser] = React.useState<UserData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [payslipData, setPayslipData] = React.useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    grossSalary: '',
    deductions: '',
    netSalary: '',
    downloadUrl: '',
  });

  const usersQuery = useMemoFirebase(
    () => isAdmin ? query(collection(firestore, 'users'), where('role', '==', 'Member')) : null,
    [isAdmin, firestore]
  );
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const payslipUserId = isAdmin ? selectedUser?.id : user?.uid;
  
  const payslipsQuery = useMemoFirebase(
    () => payslipUserId ? query(
        collection(firestore, `payslips`), 
        where('employeeId', '==', payslipUserId)
    ) : null,
    [firestore, payslipUserId]
  );

  const { data: unsortedPayslips, isLoading: payslipsLoading } = useCollection<Payslip>(payslipsQuery);

  const payslips = React.useMemo(() => {
    if (!unsortedPayslips) return null;
    return [...unsortedPayslips].sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });
  }, [unsortedPayslips]);

  const handleAddPayslip = () => {
    if (!payslipUserId) return;

    const { month, year, grossSalary, deductions, netSalary, downloadUrl } = payslipData;
    if (!downloadUrl || !grossSalary || !netSalary) {
      toast({ variant: 'destructive', title: 'Missing required fields' });
      return;
    }

    const newPayslip = {
      employeeId: payslipUserId,
      month: Number(month) + 1,
      year: Number(year),
      grossSalary: parseFloat(grossSalary),
      deductions: parseFloat(deductions) || 0,
      netSalary: parseFloat(netSalary),
      downloadUrl,
      issueDate: serverTimestamp(),
    };
    
    addDocumentNonBlocking(collection(firestore, `payslips`), newPayslip);
    toast({ title: 'Payslip Added' });
    setIsDialogOpen(false);
    setPayslipData({
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
        grossSalary: '',
        deductions: '',
        netSalary: '',
        downloadUrl: '',
    });
  };

  const handleDeletePayslip = (payslipId: string) => {
    if (!payslipUserId) return;
    deleteDocumentNonBlocking(doc(firestore, `payslips`, payslipId));
    toast({ title: 'Payslip Deleted' });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPayslipData(prev => ({ ...prev, [name]: value }));
  };

  const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

  return (
    <>
      <PageHeader
        title="Payslips"
        description={isAdmin ? "Manage and issue payslips to employees." : "View and download your monthly payslips."}
      >
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedUser}><PlusCircle className="mr-2" /> Add Payslip</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payslip for {selectedUser?.firstName}</DialogTitle>
                <DialogDescription>Fill in the details for the new payslip record.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Month</Label>
                        <Select value={payslipData.month.toString()} onValueChange={(val) => setPayslipData(p => ({...p, month: parseInt(val)}))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {monthNames.map((name, i) => <SelectItem key={name} value={i.toString()}>{name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Year</Label>
                         <Select value={payslipData.year.toString()} onValueChange={(val) => setPayslipData(p => ({...p, year: parseInt(val)}))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="grossSalary">Gross Salary</Label>
                        <Input id="grossSalary" name="grossSalary" type="number" value={payslipData.grossSalary} onChange={handleInputChange} />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="deductions">Deductions</Label>
                        <Input id="deductions" name="deductions" type="number" value={payslipData.deductions} onChange={handleInputChange} />
                    </div>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="netSalary">Net Salary</Label>
                    <Input id="netSalary" name="netSalary" type="number" value={payslipData.netSalary} onChange={handleInputChange} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="downloadUrl">Download URL</Label>
                    <Input id="downloadUrl" name="downloadUrl" value={payslipData.downloadUrl} onChange={handleInputChange} placeholder="https://link.to/payslip.pdf" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAddPayslip}>Save Payslip</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
      
      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Employee</CardTitle>
            <CardDescription>Choose an employee to view or manage their payslips.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={(userId) => setSelectedUser(users?.find(u => u.id === userId) || null)}>
              <SelectTrigger className="w-full md:w-1/2">
                <SelectValue placeholder={usersLoading ? "Loading employees..." : "Select an employee"} />
              </SelectTrigger>
              <SelectContent>
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {payslipUserId && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin && selectedUser ? `${selectedUser.firstName}'s Payslips` : 'Your Payslips'}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Issued On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslipsLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading payslips...</TableCell></TableRow>
                  ) : payslips && payslips.length > 0 ? (
                    payslips.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{monthNames[p.month - 1]} {p.year}</TableCell>
                        <TableCell>${p.netSalary.toFixed(2)}</TableCell>
                        <TableCell>{p.issueDate ? format(p.issueDate.toDate(), "PP") : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                             <Button asChild variant="outline" size="sm">
                                <Link href={p.downloadUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4"/> Download
                                </Link>
                             </Button>
                             {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                      <Trash2 className="h-4 w-4"/>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the payslip for {monthNames[p.month - 1]} {p.year}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeletePayslip(p.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                             )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No payslips found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && !selectedUser && (
        <div className="text-center text-muted-foreground mt-10">
          <p>Please select an employee to get started.</p>
        </div>
      )}
    </>
  );
}
