
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
import { LayoutTemplate, Info, Download, Upload, Clock, Save, Trash2, Plus, FileJson, Beaker, BrainCircuit, ShieldCheck } from 'lucide-react';
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
    { 
        id: 'Business', 
        name: 'Business Intelligence', 
        description: 'Outreach metrics, Revenue realization, and T+1 Execution planning.',
        baseline: [
            { id: "coldEngagement", label: "Cold Engagement (Voice)", type: "number" },
            { id: "professionalNetworking", label: "Professional Networking (LinkedIn)", type: "number" },
            { id: "strategicCorrespondence", label: "Strategic Correspondence (Email)", type: "number" },
            { id: "leadPipeline", label: "Qualified Prospects identified", type: "number" },
            { id: "revenueRealized", label: "Gross Revenue Realized", type: "number" }
        ]
    },
    { 
        id: 'Technical', 
        name: 'Technical Sprint', 
        description: 'Development modules, implementation details, and codebase synchronization.',
        baseline: [
            { id: "moduleName", label: "Technical Module", type: "text" },
            { id: "implementationDetail", label: "Implementation Logic", type: "textarea" }
        ]
    },
    { 
        id: 'Digital Marketing', 
        name: 'Marketing Strategy', 
        description: 'Content production, reel/poster status, and campaign auditing.',
        baseline: [
            { id: "marketingProduction", label: "Production Matrix", type: "matrix" }
        ]
    }
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
    toast({ title: 'Strategic Mapping Applied', description: `Designation "${jobTitle}" synchronized with template "${templateId}".` });
  };

  const handleSaveTimings = () => {
      setDocumentNonBlocking(configDocRef, { timings }, { merge: true });
      toast({ title: 'Shift Timings Synchronized', description: 'Global notification slots updated.' });
  };

  const handleExportTemplate = (template: any, isSystem: boolean) => {
      const exportData = {
          templateName: template.name,
          platformID: template.id,
          description: template.description || '',
          type: isSystem ? 'system_baseline' : 'custom_definition',
          wordingBaseline: isSystem ? template.baseline : template.definition,
          aiOptimizationPrompt: `TACTICAL OPTIMIZATION PROTOCOL: Please review the following report template for "${template.name}". Your objective is to refine the "labels" and "descriptions" to be extremely professional, tactical, and executive-ready. Maintain the key IDs to ensure platform compatibility. Return the optimized JSON array.`,
          context: "MarsHRM High-Fidelity Strategic Suite"
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TACTICAL_BASELINE_${template.id.toUpperCase().replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'AI-Ready Template Exported', description: 'JSON structure with baseline wording ready for AI optimization.' });
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const imported = JSON.parse(event.target?.result as string);
              if (!imported.templateName) throw new Error('Invalid tactical format');

              const newTemplate = {
                  name: `${imported.templateName} (Custom)`,
                  description: imported.description || 'Externally optimized tactical definition',
                  definition: imported.wordingBaseline || imported.definition || {},
                  createdAt: serverTimestamp()
              };

              await addDocumentNonBlocking(collection(firestore, 'custom_report_definitions'), newTemplate);
              toast({ title: 'Tactical Import Success', description: 'The custom template is now live in the library.' });
          } catch (err) {
              toast({ variant: 'destructive', title: 'Import Denied', description: 'The JSON structure does not meet tactical requirements.' });
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const handleDeleteCustomTemplate = (id: string) => {
      deleteDocumentNonBlocking(doc(firestore, 'custom_report_definitions', id));
      toast({ title: 'Template Purged', description: 'The custom definition has been removed from the registry.' });
  };

  const getTemplateBadge = (templateId?: string) => {
      if (!templateId || templateId === 'default' || templateId === 'Business') return <Badge className="bg-primary/10 text-primary border-primary/20">Business Intelligence</Badge>;
      const system = SYSTEM_TEMPLATES.find(s => s.id === templateId);
      if (system) {
          return <Badge className="bg-primary/10 text-primary border-primary/20">{system.name}</Badge>;
      }
      const custom = customTemplates?.find(c => c.id === templateId);
      if (custom) {
          return <Badge className="bg-orange-100 text-orange-700 border-none uppercase font-black text-[8px]">Custom: {custom.name}</Badge>;
      }
      return <Badge variant="outline">Unknown Designation</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader 
        title="Tactical Report Control" 
        description="Manage organizational report mappings, shift timings, and AI-optimized template libraries."
      >
        <div className="flex gap-2">
            <div className="relative">
                <Input type="file" className="hidden" id="import-template" accept=".json" onChange={handleImportTemplate} />
                <Button size="sm" className="rounded-full shadow-lg h-11 px-6 bg-primary" onClick={() => document.getElementById('import-template')?.click()}>
                    <Plus className="size-4 mr-2"/> Import Strategic Template
                </Button>
            </div>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-headline flex items-center gap-2">
                        <ShieldCheck className="size-5 text-primary" />
                        Role Designation Matrix
                    </CardTitle>
                    <CardDescription>Map specific strategic forms to employee designations.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-bold text-[10px] uppercase py-4">Employee Designation</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4">Active Logic</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4 text-right">Strategic Mapping</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usersLoading || configLoading ? (
                                <TableRow><TableCell colSpan={3} className="h-32 text-center animate-pulse text-muted-foreground font-bold uppercase text-xs">Scanning Fleet Records...</TableCell></TableRow>
                            ) : jobTitles.map(title => (
                                <TableRow key={title} className="border-border/50">
                                    <TableCell className="font-bold text-sm py-4">{title}</TableCell>
                                    <TableCell className="py-4">{getTemplateBadge(configData?.mappings?.[title])}</TableCell>
                                    <TableCell className="text-right py-4">
                                        <Select 
                                            value={configData?.mappings?.[title] || "Business"} 
                                            onValueChange={(val) => handleUpdateMapping(title, val)}
                                        >
                                            <SelectTrigger className="w-[200px] ml-auto h-9 text-xs font-bold rounded-full bg-white shadow-sm ring-1 ring-border">
                                                <SelectValue placeholder="Select Template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>System Baselines</SelectLabel>
                                                    {SYSTEM_TEMPLATES.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectGroup>
                                                {customTemplates && customTemplates.length > 0 && (
                                                    <SelectGroup>
                                                        <SelectLabel>Custom Optimized Definitions</SelectLabel>
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
                        AI-Optimized Library
                    </CardTitle>
                    <CardDescription>Export baseline JSON definitions to optimize wording via AI and re-import.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-bold text-[10px] uppercase py-4">Template Title</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4">Classification</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase py-4 text-right">Action Suite</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {SYSTEM_TEMPLATES.map(s => (
                                <TableRow key={s.id} className="border-border/50">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{s.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{s.description}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4"><Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest bg-muted/20">System</Badge></TableCell>
                                    <TableCell className="text-right py-4">
                                        <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(s, true)} className="rounded-full font-bold uppercase text-[9px] hover:bg-primary/5">
                                            <Download className="size-3 mr-2" /> Download Baseline
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {customTemplates?.map(c => (
                                <TableRow key={c.id} className="border-border/50 bg-orange-50/10">
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{c.name}</span>
                                            <span className="text-[10px] text-muted-foreground italic">Optimized Tactical Definition</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4"><Badge className="bg-orange-100 text-orange-700 border-none text-[9px] uppercase font-black tracking-widest">Custom</Badge></TableCell>
                                    <TableCell className="text-right py-4">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(c, false)} className="rounded-full font-bold uppercase text-[9px]">
                                                <Download className="size-3 mr-2" /> Baseline
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="size-3 mr-2" /> Purge
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="font-black uppercase tracking-tighter">Purge Tactical Definition?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently remove this custom template. Mapped roles will revert to Business Intelligence defaults.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="rounded-full font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCustomTemplate(c.id)} className="rounded-full font-bold uppercase text-[10px] bg-red-600 shadow-lg shadow-red-600/20">Confirm Deletion</AlertDialogAction>
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
                Shift Intervals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Shift Completion Window</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1"><Label className="text-[9px] font-bold">START</Label><Input type="time" value={timings.shiftStart} onChange={e => setTimings({...timings, shiftStart: e.target.value})} className="h-9 text-xs rounded-xl"/></div>
                            <div className="space-y-1"><Label className="text-[9px] font-bold">END</Label><Input type="time" value={timings.shiftEnd} onChange={e => setTimings({...timings, shiftEnd: e.target.value})} className="h-9 text-xs rounded-xl"/></div>
                        </div>
                    </div>
                </div>
                <Button className="w-full rounded-full h-11 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/10" onClick={handleSaveTimings}><Save className="size-4 mr-2"/> Commit Interval Policy</Button>
            </CardContent>
          </Card>

          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50">
            <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Info className="size-4 text-primary" /> AI Optimization Protocol</CardTitle></CardHeader>
            <CardContent className="text-[10px] space-y-4 text-muted-foreground leading-relaxed">
              <p>1. Download the "Baseline" JSON definition for the desired report type.</p>
              <p>2. Upload the JSON to ChatGPT/Gemini with the prompt hint included in the file.</p>
              <p>3. Instruct the AI to "Optimize labels for elite tactical professionalism."</p>
              <p>4. Re-import the refined JSON to create a Custom Template.</p>
              <div className="space-y-2 border-t pt-4">
                  <p className="font-bold text-primary">Strategic Advantage:</p>
                  <p>Standardizing wording via AI eliminates human error and ensures a consistent high-fidelity audit trail for leadership.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
