
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
import { LayoutTemplate, Info, Download, Upload, Clock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type UserData = {
  id: string;
  jobTitle: string;
};

type ReportMapping = {
  mappings: Record<string, string>;
  timings?: {
    shiftStart: string;
    shiftEnd: string;
    morningReportSlot: string;
    eveningReportSlot: string;
  };
};

export default function ReportTemplatesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const configDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: configData, isLoading: configLoading } = useDoc<ReportMapping>(configDocRef);

  const [timings, setTimings] = React.useState({
    shiftStart: '09:30',
    shiftEnd: '18:30',
    morningReportSlot: '09:50',
    eveningReportSlot: '18:50'
  });

  React.useEffect(() => {
    if (configData?.timings) {
        setTimings(configData.timings);
    }
  }, [configData]);

  const jobTitles = React.useMemo(() => {
    if (!users) return [];
    const titles = new Set<string>();
    users.forEach(u => { if (u.jobTitle) titles.add(u.jobTitle.trim()); });
    return Array.from(titles).sort();
  }, [users]);

  const handleUpdateMapping = (jobTitle: string, template: string) => {
    const currentMappings = configData?.mappings || {};
    const newMappings = { ...currentMappings, [jobTitle]: template };
    setDocumentNonBlocking(configDocRef, { mappings: newMappings }, { merge: true });
    toast({ title: 'Mapping Updated', description: `Template for "${jobTitle}" set to ${template}.` });
  };

  const handleSaveTimings = () => {
      setDocumentNonBlocking(configDocRef, { timings }, { merge: true });
      toast({ title: 'Timings Updated', description: 'System notification slots have been synchronized.' });
  };

  const handleExport = () => {
    const data = JSON.stringify(configData || { mappings: {}, timings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marshrm_report_config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Config Exported' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setDocumentNonBlocking(configDocRef, imported, { merge: true });
        toast({ title: 'Config Imported', description: 'Organizational matrix updated successfully.' });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Import Failed', description: 'Invalid JSON file format.' });
      }
    };
    reader.readAsText(file);
  };

  const getTemplateBadge = (template?: string) => {
    switch (template) {
      case 'Digital Marketing': return <Badge className="bg-purple-100 text-purple-700 border-none">Digital Marketing</Badge>;
      case 'Technical': return <Badge className="bg-blue-100 text-blue-700 border-none">Technical</Badge>;
      case 'Business': return <Badge className="bg-green-100 text-green-700 border-none">Business</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">Default Logic</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Report Template Assignment" 
        description="Globally assign shift templates and control organizational notification timings."
      >
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-full"><Download className="size-4 mr-2"/> Export Config</Button>
            <div className="relative">
                <Input type="file" className="hidden" id="import-config" accept=".json" onChange={handleImport} />
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => document.getElementById('import-config')?.click()}><Upload className="size-4 mr-2"/> Import Config</Button>
            </div>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <LayoutTemplate className="size-5 text-primary" />
              Organizational Matrix
            </CardTitle>
            <CardDescription>Assign specific tactical forms to unique job roles.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-[10px] uppercase py-4">Job Title</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase py-4">Tactical Template</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase py-4 text-right">Assignment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading || configLoading ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center animate-pulse text-muted-foreground font-medium">Scanning organizational fleet...</TableCell></TableRow>
                ) : jobTitles.map(title => (
                  <TableRow key={title} className="border-border/50">
                    <TableCell className="font-bold text-sm py-4">{title}</TableCell>
                    <TableCell className="py-4">{getTemplateBadge(configData?.mappings?.[title])}</TableCell>
                    <TableCell className="text-right py-4">
                      <Select 
                        value={configData?.mappings?.[title] || "default"} 
                        onValueChange={(val) => handleUpdateMapping(title, val)}
                      >
                        <SelectTrigger className="w-[180px] ml-auto h-9 text-xs font-bold rounded-full bg-white">
                          <SelectValue placeholder="Select Template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">System Default</SelectItem>
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
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Clock className="size-4" />
                Timing Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Shift Submission Window</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1"><Label className="text-[9px]">Start</Label><Input type="time" value={timings.shiftStart} onChange={e => setTimings({...timings, shiftStart: e.target.value})} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-[9px]">End</Label><Input type="time" value={timings.shiftEnd} onChange={e => setTimings({...timings, shiftEnd: e.target.value})} className="h-8 text-xs"/></div>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Automated Report Slots</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1"><Label className="text-[9px]">Morning</Label><Input type="time" value={timings.morningReportSlot} onChange={e => setTimings({...timings, morningReportSlot: e.target.value})} className="h-8 text-xs"/></div>
                            <div className="space-y-1"><Label className="text-[9px]">Evening</Label><Input type="time" value={timings.eveningReportSlot} onChange={e => setTimings({...timings, eveningReportSlot: e.target.value})} className="h-8 text-xs"/></div>
                        </div>
                    </div>
                </div>
                <Button className="w-full rounded-full h-10 font-bold uppercase text-[10px]" onClick={handleSaveTimings}><Save className="size-4 mr-2"/> Apply Changes</Button>
            </CardContent>
          </Card>

          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
            <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Info className="size-4" /> Assignment Rules</CardTitle></CardHeader>
            <CardContent className="text-[10px] space-y-4 text-muted-foreground leading-relaxed">
              <p>Mappings set here override system-default logic. You can use <strong>Export/Import</strong> to synchronize settings between different environments.</p>
              <div className="space-y-2 border-t pt-4">
                  <div className="flex gap-2"><strong>Business:</strong> Sales, Outreach, and Revenue focus.</div>
                  <div className="flex gap-2"><strong>Technical:</strong> Code logs and task functionality.</div>
                  <div className="flex gap-2"><strong>Marketing:</strong> Mixed Business + Production (Content/Reels/Shoots).</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
