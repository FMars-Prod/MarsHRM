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
import { PlusCircle, Download, Trash2, MoreHorizontal, FileText, Banknote, ShieldCheck, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, query, where, orderBy, doc, serverTimestamp } from "firebase/firestore";
import type { WithId } from "@/firebase/firestore/use-collection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, getYear } from "date-fns";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import jsPDF from "jsPDF";
import autoTable from 'jspdf-autotable';

type Payslip = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  issueDate: any;
  basicStipend: number;
  mobileAllowance: number;
  deductions: number;
  netSalary: number;
  workedDays: string;
  modeOfPayment: string;
};

type UserData = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  jobTitle: string;
  department: string;
  hireDate?: string;
  signatureUrl?: string;
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Simple number to words converter for INR
function numberToWords(num: number): string {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + numberToWords(num % 100) : '');
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
    return num.toString(); // Fallback for very large numbers
}

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
    month: new Date().getMonth().toString(),
    year: new Date().getFullYear().toString(),
    basicStipend: '',
    mobileAllowance: '0',
    deductions: '0',
    workedDays: 'Performance Based',
    modeOfPayment: 'CASH',
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

    const { month, year, basicStipend, mobileAllowance, deductions, workedDays, modeOfPayment } = payslipData;
    if (!basicStipend) {
      toast({ variant: 'destructive', title: 'Missing required fields' });
      return;
    }

    const net = (parseFloat(basicStipend) || 0) + (parseFloat(mobileAllowance) || 0) - (parseFloat(deductions) || 0);

    const newPayslip = {
      employeeId: payslipUserId,
      month: Number(month) + 1,
      year: Number(year),
      basicStipend: parseFloat(basicStipend),
      mobileAllowance: parseFloat(mobileAllowance) || 0,
      deductions: parseFloat(deductions) || 0,
      netSalary: net,
      workedDays,
      modeOfPayment,
      issueDate: serverTimestamp(),
    };
    
    addDocumentNonBlocking(collection(firestore, `payslips`), newPayslip);
    toast({ title: 'Payslip Synchronized', description: `Record added for ${monthNames[Number(month)]} ${year}.` });
    setIsDialogOpen(false);
    setPayslipData({
        month: new Date().getMonth().toString(),
        year: new Date().getFullYear().toString(),
        basicStipend: '',
        mobileAllowance: '0',
        deductions: '0',
        workedDays: 'Performance Based',
        modeOfPayment: 'CASH',
    });
  };

  const handleDeletePayslip = (payslipId: string) => {
    deleteDocumentNonBlocking(doc(firestore, `payslips`, payslipId));
    toast({ title: 'Payslip Purged' });
  };

  const handleDownloadPdf = async (p: Payslip, emp: UserData | null) => {
    if (!emp) return;
    
    const pdfDoc = new jsPDF();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const margin = 14;

    // Header Branding
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(22);
    pdfDoc.text("FORTUMARS", margin, 20);
    
    pdfDoc.setFontSize(14);
    const monthShort = monthNames[p.month - 1].slice(0, 3).toUpperCase();
    pdfDoc.text(`PAY SLIP (${monthShort} ${p.year})`, margin, 35);
    
    pdfDoc.setLineWidth(0.5);
    pdfDoc.line(margin, 40, pageWidth - margin, 40);

    // Employee Info Section
    pdfDoc.setFontSize(10);
    pdfDoc.setFont('helvetica', 'normal');
    
    const leftColX = margin;
    const rightColX = pageWidth / 2 + 10;
    let infoY = 55;

    const labelVal = (label: string, val: string, x: number, y: number) => {
        pdfDoc.text(`${label}`, x, y);
        pdfDoc.text(`: ${val}`, x + 35, y);
    };

    labelVal(emp.role === 'Intern' ? "Intern Name" : "Employee Name", `${emp.firstName} ${emp.lastName}`.toUpperCase(), leftColX, infoY);
    labelVal(emp.role === 'Intern' ? "Intern ID" : "Employee ID", emp.id.slice(0, 10).toUpperCase(), rightColX, infoY);
    
    infoY += 6;
    labelVal("Date of Joining", emp.hireDate ? format(new Date(emp.hireDate), 'dd MMM yyyy').toUpperCase() : 'N/A', leftColX, infoY);
    labelVal("Designation", emp.jobTitle?.toUpperCase() || 'MEMBER', rightColX, infoY);
    
    infoY += 6;
    const lastDay = new Date(p.year, p.month, 0).getDate();
    labelVal("Pay Period", `01/${p.month}/${p.year.toString().slice(-2)} - ${lastDay}/${p.month}/${p.year.toString().slice(-2)}`, leftColX, infoY);
    labelVal("Department", emp.department?.toUpperCase() || 'HQ', rightColX, infoY);
    
    infoY += 6;
    labelVal("Worked Days", p.workedDays.toUpperCase(), leftColX, infoY);

    // Financial Table
    autoTable(pdfDoc, {
        startY: infoY + 15,
        head: [['Earnings', 'Amount in INR', 'Deductions', 'Amount in INR']],
        body: [
            ['Basic STIPEND', p.basicStipend.toLocaleString(), '', ''],
            ['Mobile Allowances', p.mobileAllowance === 0 ? 'NA' : p.mobileAllowance.toLocaleString(), '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['Total Earnings', (p.basicStipend + p.mobileAllowance).toLocaleString(), 'Total Deductions', p.deductions.toLocaleString()],
            ['', '', 'Net Pay', `${p.netSalary.toLocaleString()} INR`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 40 },
            2: { cellWidth: 50 },
            3: { cellWidth: 40 },
        },
        didParseCell: (data) => {
            if (data.row.index === 4 || data.row.index === 5) {
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // Summary Footer
    const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Amount in Words: ${numberToWords(p.netSalary)} INR only`, margin, finalY);
    pdfDoc.text(`Mode of Payment: ${p.modeOfPayment}`, margin, finalY + 6);
    pdfDoc.text(`Date of Issue: ${p.issueDate ? format(p.issueDate.toDate(), 'do MMM yyyy') : format(new Date(), 'do MMM yyyy')}`, margin, finalY + 12);

    // Signatures
    const sigY = finalY + 45;
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("For Accounts Department", margin, sigY);
    pdfDoc.text(emp.role === 'Intern' ? "Intern Signature" : "Employee Signature", pageWidth - margin - 40, sigY);

    // Accounts Seal placeholder
    pdfDoc.setDrawColor(200);
    pdfDoc.circle(margin + 20, sigY + 15, 12);
    pdfDoc.setFontSize(6);
    pdfDoc.text("FORTUMARS", margin + 11, sigY + 14);
    pdfDoc.text("VERIFIED", margin + 12, sigY + 17);

    // User Signature if available
    if (emp.signatureUrl) {
        try {
            pdfDoc.addImage(emp.signatureUrl, 'PNG', pageWidth - margin - 45, sigY + 5, 40, 15);
        } catch (e) {
            console.warn("Could not embed signature image", e);
        }
    }
    pdfDoc.line(pageWidth - margin - 50, sigY + 20, pageWidth - margin, sigY + 20);

    pdfDoc.save(`Payslip_${emp.firstName}_${monthNames[p.month - 1]}_${p.year}.pdf`);
  };

  const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

  return (
    <div className="space-y-8 animate-fade-in-up font-jakarta">
      <PageHeader
        title="Fleet Payroll Registry"
        description={isAdmin ? "Issue high-fidelity payslips and manage fleet compensation." : "Access and archive your professional mission compensation records."}
      >
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedUser} className="rounded-full h-11 px-6 shadow-lg"><PlusCircle className="mr-2 h-4 w-4" /> Dispatch Payslip</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] sm:max-w-2xl p-8 border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Financial Dispatch: {selectedUser?.firstName}</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Generate audited payroll documentation</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Mission Month</Label>
                        <Select value={payslipData.month} onValueChange={(val) => setPayslipData(p => ({...p, month: val}))}>
                            <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                            <SelectContent>{monthNames.map((name, i) => <SelectItem key={name} value={i.toString()}>{name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Year</Label>
                         <Select value={payslipData.year} onValueChange={(val) => setPayslipData(p => ({...p, year: val}))}>
                            <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Basic Stipend</Label>
                        <Input type="number" value={payslipData.basicStipend} onChange={e => setPayslipData({...payslipData, basicStipend: e.target.value})} className="rounded-xl h-12" placeholder="e.g. 10000" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Mobile Allowance</Label>
                        <Input type="number" value={payslipData.mobileAllowance} onChange={e => setPayslipData({...payslipData, mobileAllowance: e.target.value})} className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Deductions</Label>
                        <Input type="number" value={payslipData.deductions} onChange={e => setPayslipData({...payslipData, deductions: e.target.value})} className="rounded-xl h-12 text-red-600" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Worked Days Context</Label>
                        <Input value={payslipData.workedDays} onChange={e => setPayslipData({...payslipData, workedDays: e.target.value})} className="rounded-xl h-12" placeholder="e.g. Performance Based" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary">Mode of Payment</Label>
                        <Select value={payslipData.modeOfPayment} onValueChange={(val) => setPayslipData({...payslipData, modeOfPayment: val})}>
                            <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASH">CASH</SelectItem>
                                <SelectItem value="BANK TRANSFER">BANK TRANSFER</SelectItem>
                                <SelectItem value="UPI">UPI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddPayslip} className="w-full h-14 rounded-full font-black uppercase tracking-widest shadow-xl shadow-primary/20">Authorize & Synchronize</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
      
      {isAdmin && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Users className="size-5 text-primary" /> Target Selection
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Select a fleet official to manage their records</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-2">
            <Select onValueChange={(userId) => setSelectedUser(users?.find(u => u.id === userId) || null)}>
              <SelectTrigger className="w-full md:w-1/2 h-12 rounded-xl bg-muted/20 border-none ring-1 ring-border/50 shadow-inner">
                <SelectValue placeholder={usersLoading ? "Scanning Roster..." : "Select Fleet Official"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id} className="rounded-lg">{u.firstName} {u.lastName} ({u.jobTitle})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {payslipUserId && (
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-8 pb-4 bg-muted/5 border-b">
            <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Banknote className="size-7 text-primary" />
              {isAdmin && selectedUser ? `${selectedUser.firstName}'s Ledger` : 'My Financial Ledger'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6 px-10">Audit Period</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Net Compensation</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] py-6">Stamping Date</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[10px] py-6 px-10">Control</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslipsLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse uppercase font-black text-xs text-muted-foreground tracking-[0.3em]">Scanning Ledger...</TableCell></TableRow>
                  ) : payslips && payslips.length > 0 ? (
                    payslips.map(p => {
                        const employee = isAdmin ? selectedUser : (currentUserData as UserData);
                        return (
                            <TableRow key={p.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                <TableCell className="py-6 px-10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-primary/5 text-primary"><FileText className="size-4" /></div>
                                        <span className="font-black text-sm uppercase">{monthNames[p.month - 1]} {p.year}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-black text-sm text-green-600">INR {p.netSalary.toLocaleString()}</TableCell>
                                <TableCell className="text-[10px] font-black uppercase text-muted-foreground opacity-60">
                                    {p.issueDate ? format(p.issueDate.toDate(), "PP") : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right px-10">
                                <div className="flex justify-end gap-3">
                                    <Button variant="outline" size="sm" className="rounded-xl h-10 px-5 font-black uppercase text-[9px] tracking-widest bg-white shadow-sm border-none ring-1 ring-border/50 hover:shadow-md transition-all" onClick={() => handleDownloadPdf(p, employee)}>
                                        <Download className="mr-2 h-3.5 w-3.5" /> Download Audit
                                    </Button>
                                    {isAdmin && (
                                        <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-destructive hover:bg-red-50 hover:shadow-sm">
                                            <Trash2 className="size-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                            <AlertDialogHeader>
                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter">Purge financial record?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-sm font-medium">
                                                This will permanently remove the audited record for {monthNames[p.month - 1]} {p.year} from the vertical ledger.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="mt-6 gap-3">
                                            <AlertDialogCancel className="rounded-full font-black uppercase text-[10px]">Abort</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeletePayslip(p.id)} className="rounded-full font-black uppercase text-[10px] bg-red-600 hover:bg-red-700">Confirm Purge</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                                </TableCell>
                            </TableRow>
                        )
                    })
                  ) : (
                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground italic uppercase font-black text-[10px] tracking-widest opacity-30">No financial records found in this sector.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && !selectedUser && (
        <div className="py-20 text-center opacity-30 grayscale flex flex-col items-center justify-center gap-6">
            <div className="p-8 rounded-[3rem] bg-muted/20 ring-4 ring-muted/10">
                <ShieldCheck className="size-16 text-primary/40" />
            </div>
            <p className="font-black uppercase text-xs tracking-[0.4em]">Ledger Authorization Required</p>
            <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs leading-relaxed">Select a fleet official from the directory to access their vertical financial records.</p>
        </div>
      )}
    </div>
  );
}
