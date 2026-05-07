
'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate, ShieldCheck, Briefcase, Megaphone, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type UserData = {
  id: string;
  jobTitle: string;
};

type ReportMapping = {
  mappings: Record<string, string>;
};

export default function ReportTemplatesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const mappingDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: mappingData, isLoading: mappingLoading } = useDoc<ReportMapping>(mappingDocRef);

  const jobTitles = React.useMemo(() => {
    if (!users) return [];
    const titles = new Set<string>();
    users.forEach(u => {
      if (u.jobTitle) titles.add(u.jobTitle.trim());
    });
    return Array.from(titles).sort();
  }, [users]);

  const handleUpdateMapping = (jobTitle: string, template: string) => {
    const currentMappings = mappingData?.mappings || {};
    const newMappings = { ...currentMappings, [jobTitle]: template };
    
    setDocumentNonBlocking(mappingDocRef, { mappings: newMappings }, { merge: true });
    toast({ title: 'Mapping Updated', description: `Template for "${jobTitle}" set to ${template}.` });
  };

  const getTemplateBadge = (template?: string) => {
    switch (template) {
      case 'Digital Marketing': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">Digital Marketing</Badge>;
      case 'Technical': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Technical</Badge>;
      case 'Business': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Business</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">Default Logic</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Report Template Assignment" 
        description="Globally assign shift reporting templates based on employee job titles."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <LayoutTemplate className="size-5 text-primary" />
              Organizational Mapping
            </CardTitle>
            <CardDescription>All detected job titles and their active templates.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-[10px] uppercase py-4">Job Title</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase py-4">Current Template</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase py-4 text-right">Change Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading || mappingLoading ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center animate-pulse text-muted-foreground font-medium">Scanning organizational matrix...</TableCell></TableRow>
                ) : jobTitles.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic">No job titles detected in employee database.</TableCell></TableRow>
                ) : jobTitles.map(title => (
                  <TableRow key={title} className="border-border/50">
                    <TableCell className="font-bold text-sm py-4">{title}</TableCell>
                    <TableCell className="py-4">{getTemplateBadge(mappingData?.mappings?.[title])}</TableCell>
                    <TableCell className="text-right py-4">
                      <Select 
                        value={mappingData?.mappings?.[title] || "default"} 
                        onValueChange={(val) => handleUpdateMapping(title, val)}
                      >
                        <SelectTrigger className="w-[180px] ml-auto h-9 text-xs font-bold rounded-full bg-white">
                          <SelectValue placeholder="Select Template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default System Logic</SelectItem>
                          <SelectItem value="Business">Business Template</SelectItem>
                          <SelectItem value="Technical">Technical Template</SelectItem>
                          <SelectItem value="Digital Marketing">Digital Marketing Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Info className="size-4" />
                Assignment Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
              <p>Templates assigned here take <strong>immediate precedence</strong> over system-default logic for all staff members matching the specific job title.</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="size-1.5 rounded-full bg-primary shrink-0 mt-1" />
                  <p><strong>Digital Marketing:</strong> Business Outreach + Content Production metrics.</p>
                </div>
                <div className="flex gap-2">
                  <div className="size-1.5 rounded-full bg-primary shrink-0 mt-1" />
                  <p><strong>Business:</strong> Sales Outreach, Lead Generation, and Revenue metrics.</p>
                </div>
                <div className="flex gap-2">
                  <div className="size-1.5 rounded-full bg-primary shrink-0 mt-1" />
                  <p><strong>Technical:</strong> Task logs, Module completion, and Repo links.</p>
                </div>
              </div>
              <p className="pt-2 border-t border-dashed">Assigning a template ensures your team only sees the metrics relevant to their tactical operations.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
