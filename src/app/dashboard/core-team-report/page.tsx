"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, getDocs, collectionGroup } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, User, Calendar, FileText, Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

const formatIST = (date: any) => {
  if (!date) return "N/A";
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
  }).format(d) + " IST";
};

export default function CoreTeamReportPage() {
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [allReports, setAllReports] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAllReports = async () => {
      setIsLoading(true);
      try {
        const reportsQuery = query(collectionGroup(firestore, "reports"), orderBy("date", "desc"));
        const snapshot = await getDocs(reportsQuery);
        const reports = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllReports(reports);
      } catch (err) {
        console.error("Error fetching global reports:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (firestore) {
      fetchAllReports();
    }
  }, [firestore]);

  const filteredReports = allReports.filter(report => 
    report.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.reportType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.employeeDepartment?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Core Team Oversight" 
        description="Centralized strategic review of all department submissions."
      />

      <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="Filter by name, type, or department..." 
                  className="pl-10 h-11 rounded-xl bg-white/50 border-none ring-1 ring-border/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
      </div>

      <Card className="border-none ring-1 ring-border/50 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <ClipboardList className="size-5 text-primary" />
                  Global Strategic Log
              </CardTitle>
              <CardDescription>Consolidated reporting from all active team members.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                  <Table>
                      <TableHeader className="bg-muted/20 sticky top-0 z-10">
                          <TableRow className="hover:bg-transparent border-border/50">
                              <TableHead className="font-bold text-[10px] uppercase tracking-wider py-4">Submission Date</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase tracking-wider py-4">Employee</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase tracking-wider py-4">Report Type</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase tracking-wider py-4">Department</TableHead>
                              <TableHead className="font-bold text-[10px] uppercase tracking-wider py-4">Verification</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {isLoading ? (
                              <TableRow>
                                  <TableCell colSpan={5} className="h-64 text-center">
                                      <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                                          <ClipboardList className="size-8 opacity-20" />
                                          <p className="font-bold uppercase tracking-widest text-[10px]">Syncing Global Database...</p>
                                      </div>
                                  </TableCell>
                              </TableRow>
                          ) : filteredReports.length === 0 ? (
                              <TableRow>
                                  <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                                      No matching reports found.
                                  </TableCell>
                              </TableRow>
                          ) : (
                              filteredReports.map((report) => (
                                  <TableRow key={report.id} className="border-border/50 hover:bg-primary/5 transition-colors">
                                      <TableCell className="py-4">
                                          <div className="flex flex-col">
                                              <span className="font-bold text-sm">{formatIST(report.date).split(' |')[0]}</span>
                                              <span className="text-[10px] text-muted-foreground">{formatIST(report.date).split(' |')[1]}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell className="py-4">
                                          <Link href={`/dashboard/users/${report.employeeId}`} className="flex items-center gap-2 group">
                                              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs group-hover:bg-primary group-hover:text-white transition-colors">
                                                  {report.employeeName?.[0]}
                                              </div>
                                              <span className="font-bold text-sm group-hover:text-primary transition-colors">{report.employeeName}</span>
                                          </Link>
                                      </TableCell>
                                      <TableCell className="py-4">
                                          <Badge variant="outline" className={cn(
                                              "font-black text-[10px] uppercase tracking-widest",
                                              report.reportType === 'Business' ? "text-blue-600 border-blue-600/20 bg-blue-50/50" : "text-purple-600 border-purple-600/20 bg-purple-50/50"
                                          )}>
                                              {report.reportType}
                                          </Badge>
                                      </TableCell>
                                      <TableCell className="py-4">
                                          <span className="text-xs font-medium text-muted-foreground uppercase">{report.employeeDepartment || "N/A"}</span>
                                      </TableCell>
                                      <TableCell className="py-4">
                                          <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase">
                                              <CheckCircle2 className="size-3.5" />
                                              E-Signed
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              ))
                          )}
                      </TableBody>
                  </Table>
              </ScrollArea>
          </CardContent>
      </Card>
    </div>
  );
}
