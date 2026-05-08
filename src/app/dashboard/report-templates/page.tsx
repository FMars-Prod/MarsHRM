'use client';

import * as React from 'react';
import { PageHeader } from '@/components/geohrm/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, serverTimestamp } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate, Info, Download, Upload, Clock, Save, Trash2, Plus, FileJson, Beaker, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SelectGroup, SelectLabel } from '@/components/ui/select';

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

type CustomTemplate = {
    id: string;
    name: string;
    description: string;
    createdAt: any;
    definition: any; // The JSON structure of the fields
};

const SYSTEM_TEMPLATES = [
    { id: 'Business', name: 'Business Template', description: 'Sales, Outreach, and Revenue focus.' },
    { id: 'Technical', name: 'Technical Template', description: 'Code logs, tasks, and functionality focus.' },
    { id: 'Digital Marketing', name: 'Digital Marketing Template', description: 'Content, Production, and Social focus.' }
];

export default function ReportTemplatesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const configDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: configData, isLoading: configLoading } = useDoc<ReportMapping>(configDocRef);

  const customTemplatesQuery = useMemoFirebase(() => query(collection(firestore, 'custom_report_definitions')), [firestore]);
  const { data: customTemplates } = useCollection<CustomTemplate>(customTemplatesQuery);

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

  const handleUpdateMapping = (jobTitle: string, templateId: string) => {
    const currentMappings = configData?.mappings || {};
    const newMappings = { ...currentMappings, [jobTitle]: templateId };
    setDocumentNonBlocking(configDocRef, { mappings: newMappings }, { merge: true });
    toast({ title: 'Mapping Updated', description: `Assigned template ID "${templateId}" to "${jobTitle}".` });
  };

  const handleSaveTimings = () => {
      setDocumentNonBlocking(configDocRef, { timings }, { merge: true });
      toast({ title: 'Timings Updated', description: 'Global notification slots synchronized.' });
  };

  const handleExportTemplate = (template: any, isSystem: boolean) => {
      const exportData = {
          name: template.name,
          description: template.description || '',
          type: isSystem ? 'system' : 'custom',
          definition: isSystem ? {} : template.definition,
          promptHint: `AI OPTIMIZATION PROTOCOL: Please review the following report template for "${template.name}". Improve the 'wording' and 'labels' to be more tactically professional while ensuring the keys remain compatible with a web form. Output the optimized JSON definition array.`,
          platformContext: "MarsHRM Tactical Reporting Suite"
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_READY_template_${template.name.toLowerCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AI-Ready Template Exported', description: 'JSON structure with wording hints exported.' });
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const imported = JSON.parse(event.target?.result as string);
              if (!imported.name) throw new Error('Invalid template format');

              const newTemplate = {
                  name: `${imported.name} (Optimized)`,
                  description: imported.description || 'AI optimized custom template',
                  definition: imported.definition || {},
                  createdAt: serverTimestamp()
              };

              await addDocumentNonBlocking(collection(firestore, 'custom_report_definitions'), newTemplate);
              toast({ title: 'Template Imported', description: 'Optimized custom template created successfully.' });
          } catch (err) {
              toast({ variant: 'destructive', title: 'Import Failed', description: 'Invalid JSON template definition.' });
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const handleDeleteCustomTemplate = (id: string) => {
      deleteDocumentNonBlocking(doc(firestore, 'custom_report_definitions', id));
      toast({ title: 'Template Deleted', description: 'The custom template has been removed.' });
  };

  const getTemplateBadge = (templateId?: string) => {
      if (!templateId || templateId === 'default') return <Badge variant="outline" className="text-muted-foreground">Default Logic</Badge>;
      const system = SYSTEM_TEMPLATES.find(s => s.id === templateId);
      if (system) {
          return <Badge className="bg-primary/10 text-primary border-primary/20">{system.name}</Badge>;
      }
      const custom = customTemplates?.find(c => c.id === templateId);
      if (custom) {
          return <Badge className="bg-orange-100 text-orange-700 border-none">Custom: {custom.name}</Badge>;
      }
      return <Badge variant="outline">Unknown ID</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader 
        title="Report System Control" 
        description="Manage organizational mappings, timings, and dynamic template libraries."
      >
        <div className="flex gap-2">
            <div className="relative">
                <Input type="file" className="hidden" id="import-template" accept=".json" onChange={handleImportTemplate} />
                <Button size="sm" className="rounded-full shadow-lg" onClick={() => document.getElementById('import-template')?.click()}>
                    <Plus className="size-4 mr-2"/> Import Optimized Template
                </Button>
            </div>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
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
                                <TableHead className="font-bold text-[10px] uppercase py-4">Current Template</TableHead>
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
                                            <SelectTrigger className="w-[200px] ml-auto h-9 text-xs font-bold rounded-full bg-white">
                                                <SelectValue placeholder="Select Template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="default">System Default</SelectItem>
                                                <SelectGroup>
                                                    <SelectLabel>System Templates</SelectLabel>
                                                    {SYSTEM_TEMPLATES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectGroup>
                                                {customTemplates && customTemplates.length > 0 && (
                                                    <SelectGroup>
                                                        <SelectLabel>Custom Templates</SelectLabel>
                                                        {customTemplates.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                    </SelectGroup>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                        <BrainCircuit className="size-5 text-primary" />
                        AI-Ready Template Library
                    </CardTitle>
                    <CardDescription>Download templates with full instructional wording for ChatGPT/Gemini optimization.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-bold text-[10px] uppercase py-4">Template Name</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4">Type</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* System Templates */}
                            {SYSTEM_TEMPLATES.map(s => (
                                <TableRow key={s.id} className="border-border/50">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{s.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{s.description}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4"><Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest">System</Badge></TableCell>
                                    <TableCell className="text-right py-4">
                                        <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(s, true)} className="rounded-full">
                                            <Download className="size-3 mr-2" /> Download Full
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {/* Custom Templates */}
                            {customTemplates?.map(c => (
                                <TableRow key={c.id} className="border-border/50 bg-orange-50/10">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{c.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{c.description}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4"><Badge className="bg-orange-100 text-orange-700 border-none text-[9px] uppercase font-black tracking-widest">Custom</Badge></TableCell>
                                    <TableCell className="text-right py-4">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(c, false)} className="rounded-full">
                                                <Download className="size-3 mr-2" /> Download Full
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="size-3 mr-2" /> Delete
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="font-black uppercase tracking-tighter">Delete Template?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently remove the template definition. Mapped job titles will revert to system defaults.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCustomTemplate(c.id)} className="rounded-full font-bold uppercase text-[10px] bg-red-600">Confirm Deletion</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

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
                </div>
                <Button className="w-full rounded-full h-10 font-bold uppercase text-[10px]" onClick={handleSaveTimings}><Save className="size-4 mr-2"/> Apply Timing Policy</Button>
            </CardContent>
          </Card>

          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
            <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Info className="size-4" /> AI Integration Help</CardTitle></CardHeader>
            <CardContent className="text-[10px] space-y-4 text-muted-foreground leading-relaxed">
              <p>Download the "Full" JSON template, provide it to an AI with instructions to "Fix and optimize the tactical wording", and then import the result.</p>
              <div className="space-y-2 border-t pt-4">
                  <div className="flex gap-2"><strong>Strategy:</strong> Standardizing definitions allows AI to generate error-free tactical forms.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
