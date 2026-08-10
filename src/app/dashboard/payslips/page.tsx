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
import jsPDF from "jspdf";
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

function numberToWords(num: number): string {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + numberToWords(num % 100) : '');
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
    return num.toString();
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
    modeOfPayment: 'BANK TRANSFER',
  });

  const usersQuery = useMemoFirebase(
    () => isAdmin ? query(collection(firestore, 'users')) : null,
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
      toast({ variant: 'destructive', title: 'Amount required' });
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
    toast({ title: 'Payslip Added' });
    setIsDialogOpen(false);
    setPayslipData({
        month: new Date().getMonth().toString(),
        year: new Date().getFullYear().toString(),
        basicStipend: '',
        mobileAllowance: '0',
        deductions: '0',
        workedDays: 'Performance Based',
        modeOfPayment: 'BANK TRANSFER',
    });
  };

  const handleDeletePayslip = (payslipId: string) => {
    deleteDocumentNonBlocking(doc(firestore, `payslips`, payslipId));
    toast({ title: 'Payslip Deleted' });
  };

  const handleDownloadPdf = async (p: Payslip, emp: UserData | null) => {
    if (!emp) return;
    
    const pdfDoc = new jsPDF();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const margin = 14;

    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(22);
    pdfDoc.text("FORTUMARS", margin, 20);
    
    pdfDoc.setFontSize(14);
    const monthShort = monthNames[p.month - 1].slice(0, 3).toUpperCase();
    pdfDoc.text(`PAY SLIP (${monthShort} ${p.year})`, margin, 35);
    
    pdfDoc.setLineWidth(0.5);
    pdfDoc.line(margin, 40, pageWidth - margin, 40);

    pdfDoc.setFontSize(10);
    pdfDoc.setFont('helvetica', 'normal');
    
    const leftColX = margin;
    const rightColX = pageWidth / 2 + 10;
    let infoY = 55;

    const labelVal = (label: string, val: string, x: number, y: number) => {
        pdfDoc.text(`${label}`, x, y);
        pdfDoc.text(`: ${val}`, x + 35, y);
    };

    labelVal("Name", `${emp.firstName} ${emp.lastName}`.toUpperCase(), leftColX, infoY);
    labelVal("ID", emp.id.slice(0, 10).toUpperCase(), rightColX, infoY);
    
    infoY += 6;
    labelVal("Date Joined", emp.hireDate ? format(new Date(emp.hireDate), 'dd MMM yyyy').toUpperCase() : 'N/A', leftColX, infoY);
    labelVal("Designation", emp.jobTitle?.toUpperCase() || 'MEMBER', rightColX, infoY);
    
    infoY += 6;
    const lastDay = new Date(p.year, p.month, 0).getDate();
    labelVal("Period", `01/${p.month}/${p.year.toString().slice(-2)} - ${lastDay}/${p.month}/${p.year.toString().slice(-2)}`, leftColX, infoY);
    labelVal("Department", emp.department?.toUpperCase() || 'HQ', rightColX, infoY);
    
    infoY += 6;
    labelVal("Worked Days", p.workedDays.toUpperCase(), leftColX, infoY);

    autoTable(pdfDoc, {
        startY: infoY + 15,
        head: [['Earnings', 'Amount (INR)', 'Deductions', 'Amount (INR)']],
        body: [
            ['Basic Salary', p.basicStipend.toLocaleString(), '', ''],
            ['Allowances', p.mobileAllowance === 0 ? 'NA' : p.mobileAllowance.toLocaleString(), '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['Total Earnings', (p.basicStipend + p.mobileAllowance).toLocaleString(), 'Total Deductions', p.deductions.toLocaleString()],
            ['', '', 'Net Pay', `${p.netSalary.toLocaleString()} INR`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40 }, 2: { cellWidth: 50 }, 3: { cellWidth: 40 } },
        didParseCell: (data) => { if (data.row.index === 4 || data.row.index === 5) data.cell.styles.fontStyle = 'bold'; }
    });

    const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
    pdfDoc.setFontSize(10);
    pdfDoc.text(`In Words: ${numberToWords(p.netSalary)} INR only`, margin, finalY);
    pdfDoc.text(`Payment: ${p.modeOfPayment}`, margin, finalY + 6);
    pdfDoc.text(`Date Issued: ${p.issueDate ? format(p.issueDate.toDate(), 'do MMM yyyy') : format(new Date(), 'do MMM yyyy')}`, margin, finalY + 12);

    const sigY = finalY + 45;
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text("Accounts Dept", margin, sigY);
    pdfDoc.text("Employee Signature", pageWidth - margin - 40, sigY);

    if (emp.signatureUrl) {
        try { pdfDoc.addImage(emp.signatureUrl, 'PNG', pageWidth - margin - 45, sigY + 5, 40, 15); } catch (e) {}
    }
    pdfDoc.line(pageWidth - margin - 50, sigY + 20, pageWidth - margin, sigY + 20);

    pdfDoc.save(`Payslip_${emp.firstName}_${monthNames[p.month - 1]}_${p.year}.pdf`);
  };

  const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

  return (
    <div className="space-y-6 animate-fade-in-up font-jakarta">
      <PageHeader title="Payroll" description={isAdmin ? "Manage and issue monthly payslips." : "View and download your payslips."}>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedUser} className="rounded-none h-11 px-6 shadow-lg shadow-primary/20 font-black uppercase text-[10px] tracking-widest"><PlusCircle className="mr-2 h-4 w-4" /> Add Payslip</Button>
            </DialogTrigger>
            <DialogContent className="rounded-none sm:max-w-2xl p-8 border-none shadow-2xl">
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">New Payslip: {selectedUser?.firstName}</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Generate a monthly payroll record</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6 text-left">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Month</Label>
                        <Select value={payslipData.month} onValueChange={(val) => setPayslipData(p => ({...p, month: val}))}>
                            <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-none">{monthNames.map((name, i) => <SelectItem key={name} value={i.toString()}>{name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Year</Label>
                         <Select value={payslipData.year} onValueChange={(val) => setPayslipData(p => ({...p, year: val}))}>
                            <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-none">{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Basic Amount</Label>
                        <Input type="number" value={payslipData.basicStipend} onChange={e => setPayslipData({...payslipData, basicStipend: e.target.value})} className="rounded-none h-12 font-bold" placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Allowances</Label>
                        <Input type="number" value={payslipData.mobileAllowance} onChange={e => setPayslipData({...payslipData, mobileAllowance: e.target.value})} className="rounded-none h-12 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Deductions</Label>
                        <Input type="number" value={payslipData.deductions} onChange={e => setPayslipData({...payslipData, deductions: e.target.value})} className="rounded-none h-12 font-bold" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Days Worked</Label>
                        <Input value={payslipData.workedDays} onChange={e => setPayslipData({...payslipData, workedDays: e.target.value})} className="rounded-none h-12 font-bold" placeholder="e.g. 22" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Payment Mode</Label>
                        <Select value={payslipData.modeOfPayment} onValueChange={(val) => setPayslipData({...payslipData, modeOfPayment: val})}>
                            <SelectTrigger className="rounded-none h-12 font-bold bg-muted/20 border-none ring-1 ring-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-none">
                                <SelectItem value="CASH">CASH</SelectItem>
                                <SelectItem value="BANK TRANSFER">BANK TRANSFER</SelectItem>
                                <SelectItem value="UPI">UPI</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddPayslip} className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-2xl shadow-primary/20">Save Payslip</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>
      
      {isAdmin && (
        <Card className="border-none shadow-sm rounded-none bg-white ring-1 ring-border/50">
          <CardHeader className="p-6 pb-2 text-left">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="size-3.5" /> Select Personnel
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            <Select onValueChange={(userId) => setSelectedUser(users?.find(u => u.id === userId) || null)}>
              <SelectTrigger className="w-full md:w-1/2 h-11 rounded-none bg-muted/10 border-none ring-1 ring-border/50 font-bold uppercase text-xs">
                <SelectValue placeholder={usersLoading ? "Scanning..." : "Search member name..."} />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {users?.map(u => (
                  <SelectItem key={u.id} value={u.id} className="uppercase font-bold text-xs">{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {payslipUserId && (
        <Card className="border-none shadow-xl rounded-none bg-white ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="p-6 bg-muted/5 border-b text-left">
            <CardTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-3 text-primary">
              <Banknote className="size-5" />
              {isAdmin && selectedUser ? `${selectedUser.firstName}'s History` : 'My History'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Mission Period</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">Net Salary</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px] py-4">Status Date</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[9px] py-4 px-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslipsLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-48 text-center animate-pulse uppercase font-black text-xs opacity-20">Scanning...</TableCell></TableRow>
                  ) : payslips && payslips.length > 0 ? (
                    payslips.map(p => {
                        const employee = isAdmin ? selectedUser : (currentUserData as UserData);
                        return (
                            <TableRow key={p.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                <TableCell className="py-4 px-6 text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-none bg-primary/5 text-primary"><FileText className="size-4" /></div>
                                        <span className="font-black text-xs uppercase tracking-tight">{monthNames[p.month - 1]} {p.year}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-black text-sm text-emerald-600">₹{p.netSalary.toLocaleString()}</TableCell>
                                <TableCell className="text-[10px] font-black uppercase text-muted-foreground opacity-60">
                                    {p.issueDate ? format(p.issueDate.toDate(), "PP") : '—'}
                                </TableCell>
                                <TableCell className="text-right px-6">
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" className="rounded-none h-8 px-4 font-black uppercase text-[9px] tracking-widest bg-white border-none ring-1 ring-border/50" onClick={() => handleDownloadPdf(p, employee)}>
                                        <Download className="mr-1.5 h-3 w-3" /> Download
                                    </Button>
                                    {isAdmin && (
                                        <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="rounded-none h-8 w-8 text-rose-500 hover:bg-rose-50 transition-colors">
                                            <Trash2 className="size-3.5"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-none border-none shadow-3xl">
                                            <AlertDialogHeader className="text-left">
                                            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-primary">Delete Entry?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                                                This will remove the payslip record for {monthNames[p.month - 1]} {p.year} from the registry.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="mt-8 gap-3">
                                            <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px] h-11 px-6">Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeletePayslip(p.id)} className="rounded-none font-bold uppercase text-[10px] h-11 px-6 bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
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
                    <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground opacity-30 italic uppercase font-black text-[10px] tracking-widest">No records found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
