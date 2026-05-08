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
import { LayoutTemplate, Info, Download, Upload, Clock, Save, Trash2, Plus, FileJson, Beaker, BrainCircuit, ShieldCheck, Eye, TrendingUp, Target, DollarSign, Brain, CheckCircle2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SelectGroup, SelectLabel } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
    definition: any;
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

  const [previewTemplate, setPreviewTemplate] = React.useState<any | null>(null);

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
      e.target.value = '';
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
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(s)} className="rounded-full font-bold uppercase text-[9px] hover:bg-primary/5">
                                                <Eye className="size-3 mr-2" /> Preview
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(s, true)} className="rounded-full font-bold uppercase text-[9px] hover:bg-primary/5">
                                                <Download className="size-3 mr-2" /> Download Baseline
                                            </Button>
                                        </div>
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
                                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(c)} className="rounded-full font-bold uppercase text-[9px]">
                                                <Eye className="size-3 mr-2" /> Preview
                                            </Button>
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

      <Dialog open={!!previewTemplate} onOpenChange={o => !o && setPreviewTemplate(null)}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl">
              <DialogHeader className="p-8 border-b bg-white">
                  <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-primary/10 text-primary"><LayoutTemplate className="size-6" /></div>
                      <div>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Tactical Layout Preview</DialogTitle>
                        <DialogDescription className="text-xs font-bold">{previewTemplate?.name} Configuration</DialogDescription>
                      </div>
                  </div>
              </DialogHeader>
              <div className="flex-1 min-h-0 bg-secondary/20">
                  <Tabs defaultValue="enter" className="h-full flex flex-col">
                      <div className="bg-white border-b px-8">
                          <TabsList className="bg-transparent h-12 gap-8">
                              <TabsTrigger value="enter" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black uppercase text-[10px] tracking-widest h-full">Submission UI (Enter Format)</TabsTrigger>
                              <TabsTrigger value="saved" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-black uppercase text-[10px] tracking-widest h-full">Audit Layout (Saved Preview)</TabsTrigger>
                          </TabsList>
                      </div>
                      <div className="flex-1 overflow-hidden">
                          <ScrollArea className="h-full">
                              <div className="p-8">
                                  <TabsContent value="enter" className="mt-0 space-y-8 animate-fade-in-up">
                                      <PreviewSubmissionUI template={previewTemplate} />
                                  </TabsContent>
                                  <TabsContent value="saved" className="mt-0 space-y-8 animate-fade-in-up">
                                      <PreviewAuditLayout template={previewTemplate} />
                                  </TabsContent>
                              </div>
                          </ScrollArea>
                      </div>
                  </Tabs>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewSubmissionUI({ template }: { template: any }) {
    const isBusiness = template.id === 'Business' || template.name?.includes('Business');
    const isTechnical = template.id === 'Technical' || template.name?.includes('Technical');
    const isMarketing = template.id === 'Digital Marketing' || template.name?.includes('Marketing');

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-10">
            {isBusiness && (
                <div className="space-y-6">
                    <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 1️⃣ Strategic Outreach Metrics</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Cold Engagement (Voice)</Label><Input type="number" placeholder="0" className="h-9 text-xs rounded-xl" /></div>
                                <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">LinkedIn Reach</Label><Input type="number" placeholder="0" className="h-9 text-xs rounded-xl" /></div>
                                <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Strategic Email</Label><Input type="number" placeholder="0" className="h-9 text-xs rounded-xl" /></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><DollarSign className="size-4" /> 2️⃣ Economic Value Capture</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Currency</Label><Select defaultValue="INR"><SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">INR (₹)</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Revenue Realized</Label><Input type="number" placeholder="0" className="h-9 text-xs rounded-xl" /></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {isTechnical && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Shift Log-In</Label><Input type="time" className="h-9 text-xs rounded-xl" /></div>
                         <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Shift Log-Out</Label><Input type="time" className="h-9 text-xs rounded-xl" /></div>
                    </div>
                    <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white p-6 space-y-4 rounded-2xl">
                        <div className="space-y-2">
                             <Label className="text-[9px] font-black text-muted-foreground uppercase">Module Identification</Label>
                             <Input placeholder="e.g., Auth Engine v2.1" className="h-9 text-xs rounded-xl" />
                             <Label className="text-[9px] font-black text-muted-foreground uppercase">Implementation Detail</Label>
                             <Input placeholder="Refactored Firebase hooks..." className="h-9 text-xs rounded-xl" />
                        </div>
                    </Card>
                </div>
            )}

            {isMarketing && (
                <div className="space-y-6">
                    <Card className="border-none ring-1 ring-purple-500/20 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-purple-500/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-purple-700 uppercase tracking-widest">Marketing Pipeline Intelligence</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <div className="border rounded-2xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow><TableHead className="text-[9px] font-black uppercase">Status</TableHead><TableHead className="text-[9px] font-black uppercase">Content</TableHead><TableHead className="text-[9px] font-black uppercase">Posters</TableHead><TableHead className="text-[9px] font-black uppercase">Reels</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow><TableCell className="text-[9px] font-bold uppercase">Approved</TableCell><TableCell><Input type="number" placeholder="0" className="h-8 w-12 mx-auto text-center" /></TableCell><TableCell><Input type="number" placeholder="0" className="h-8 w-12 mx-auto text-center" /></TableCell><TableCell><Input type="number" placeholder="0" className="h-8 w-12 mx-auto text-center" /></TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-xs font-bold flex items-center gap-2 text-primary uppercase tracking-widest"><TrendingUp className="size-4" /> 🚀 T+1 Execution Planning</CardTitle></CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Meetings Tomorrow</Label><Input type="number" className="h-9 text-xs rounded-xl" /></div>
                        <div className="space-y-1"><Label className="text-[9px] font-black text-muted-foreground uppercase">Critical Path</Label><Input className="h-9 text-xs rounded-xl" /></div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 pt-4">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Tactical Authentication</p>
                <div className="bg-white p-6 rounded-3xl ring-1 ring-border/50 border-2 border-dashed flex flex-col items-center gap-4 opacity-50">
                    <ShieldCheck className="size-8 text-muted-foreground" />
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Digital Handshake Slot</p>
                </div>
            </div>
        </div>
    );
}

function PreviewAuditLayout({ template }: { template: any }) {
    const isBusiness = template.id === 'Business' || template.name?.includes('Business');
    const isTechnical = template.id === 'Technical' || template.name?.includes('Technical');
    const isMarketing = template.id === 'Digital Marketing' || template.name?.includes('Marketing');

    return (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border p-8 space-y-8">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-primary">Strategic Audit Detail</h2>
                    <p className="text-[10px] font-bold text-muted-foreground">SUBMITTED ON: {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())} IST</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{template.name}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Reporting Official</p><p className="font-bold">Test Employee</p></div>
                <div className="space-y-1"><p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Designation</p><p className="font-bold">TACTICAL STRATEGIST</p></div>
            </div>

            <Separator />

            {isBusiness && (
                <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-muted/20 rounded-2xl text-center"><p className="text-[8px] font-black uppercase text-muted-foreground">Cold Engagement</p><p className="text-lg font-black">24</p></div>
                        <div className="p-4 bg-muted/20 rounded-2xl text-center"><p className="text-[8px] font-black uppercase text-muted-foreground">LinkedIn Reach</p><p className="text-lg font-black">12</p></div>
                        <div className="p-4 bg-muted/20 rounded-2xl text-center"><p className="text-[8px] font-black uppercase text-muted-foreground">Email Correspondence</p><p className="text-lg font-black">8</p></div>
                        <div className="p-4 bg-muted/20 rounded-2xl text-center"><p className="text-[8px] font-black uppercase text-muted-foreground">Prospects</p><p className="text-lg font-black">3</p></div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between">
                         <div className="flex items-center gap-3"><DollarSign className="size-5 text-green-600" /><div><p className="text-[9px] font-black uppercase text-green-700">Financial Recognition</p><p className="text-xl font-black text-green-900">INR 12,500</p></div></div>
                    </div>
                </div>
            )}

            {isTechnical && (
                <div className="space-y-4">
                    <div className="p-4 bg-white rounded-2xl border space-y-1">
                        <p className="text-[9px] font-black uppercase text-primary">Module: Auth Engine v2.1</p>
                        <p className="text-xs italic text-muted-foreground">"Synchronized digital identity assets with Firestore non-blocking write engine."</p>
                    </div>
                </div>
            )}

            {isMarketing && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-purple-50 p-4 rounded-2xl border border-purple-100">
                         <div className="flex items-center gap-3"><Zap className="size-5 text-purple-600" /><div><p className="text-[9px] font-black uppercase text-purple-700">Production Efficiency</p><p className="text-xl font-black text-purple-900">85.4% Approval Rate</p></div></div>
                    </div>
                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                        <Table>
                             <TableHeader className="bg-muted/10"><TableRow><TableHead className="text-[9px] font-black uppercase">Metric</TableHead><TableHead className="text-center text-[9px] font-black uppercase">Content</TableHead><TableHead className="text-center text-[9px] font-black uppercase">Posters</TableHead><TableHead className="text-center text-[9px] font-black uppercase">Reels</TableHead></TableRow></TableHeader>
                             <TableBody>
                                 <TableRow><TableCell className="text-[9px] font-bold uppercase py-3">Approved</TableCell><TableCell className="text-center font-bold">4</TableCell><TableCell className="text-center font-bold">2</TableCell><TableCell className="text-center font-bold">1</TableCell></TableRow>
                                 <TableRow className="bg-muted/5"><TableCell className="text-[9px] font-black uppercase py-3">Category Total</TableCell><TableCell className="text-center font-black">5</TableCell><TableCell className="text-center font-black">3</TableCell><TableCell className="text-center font-black">2</TableCell></TableRow>
                             </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            <Card className="border-none ring-1 ring-border/50 overflow-hidden shadow-sm bg-muted/5">
                <CardHeader className="bg-muted/10 py-3"><CardTitle className="text-[10px] font-bold uppercase text-primary flex items-center gap-2"><Target className="size-3.5"/> T+1 Objectives</CardTitle></CardHeader>
                <CardContent className="pt-4 space-y-3">
                    <div><p className="text-[8px] font-black uppercase text-orange-600 tracking-widest">Critical Path</p><p className="text-xs italic">"Finalize high-fidelity strategic dashboard for executive review."</p></div>
                    <div><p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Meetings Scheduled</p><p className="text-xs font-bold">2 confirmed briefings.</p></div>
                </CardContent>
            </Card>

            <div className="pt-10 flex flex-col items-center text-center space-y-6">
                <div className="h-16 w-48 border-b-2 border-dashed border-primary/20 flex items-center justify-center grayscale opacity-60">
                    <span className="font-mono text-xs text-muted-foreground italic">E-Signature Logic Rendered Here</span>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-black uppercase tracking-tighter">Test Employee</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">TACTICAL STRATEGIST • PRODUCT DESIGN</p>
                    <Separator className="w-10 mx-auto my-2" />
                    <p className="text-[8px] font-mono text-muted-foreground italic">Authenticated via MarsHRM Protocol</p>
                </div>
            </div>
        </div>
    );
}

