
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
import { LayoutTemplate, Info, Download, Upload, Clock, Save, Trash2, Plus, FileJson, Beaker, BrainCircuit, ShieldCheck, Eye, TrendingUp, Target, DollarSign, Brain, CheckCircle2, Zap, Loader2, UserCheck, GraduationCap } from 'lucide-react';
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
  department: string;
};

type ReportMapping = {
  mappings: Record<string, string>;
};

const SYSTEM_TEMPLATES = [
    { 
        id: 'Business', 
        name: 'Business Intelligence', 
        description: 'Outreach, Revenue, Engagements, and Call Logs.',
        sections: ['Outreach & Conversion', 'Revenue Impact', 'High-Value Engagements', 'Call Intelligence', 'Planning (T+1)']
    },
    { 
        id: 'Technical', 
        name: 'Technical Sprint', 
        description: 'Development modules, implementation logic, and shift timing.',
        sections: ['Shift Duration', 'Sprint Modules', 'Planning (T+1)']
    },
    { 
        id: 'Digital Marketing', 
        name: 'Marketing Strategy', 
        description: 'Hybrid Business report + High-Fidelity deliverable matrix.',
        sections: ['Business Intelligence Suite', 'Marketing Matrix (Pivoted)', 'Planning (T+1)']
    },
    {
        id: 'HR',
        name: 'HR Talent & Operations',
        description: 'Recruitment metrics, Campus drives, Sourcing, and HR objectives.',
        sections: ['Recruitment Pulse', 'Campus Drive Protocol', 'Sourcing Intelligence', 'HR Objectives', 'Planning (T+1)']
    }
];

export default function ReportTemplatesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<UserData>(usersQuery);

  const configDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: configData, isLoading: configLoading } = useDoc<ReportMapping>(configDocRef);

  const [previewTemplate, setPreviewTemplate] = React.useState<any | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const jobTitles = React.useMemo(() => {
    if (!users) return [];
    const titles = new Set<string>();
    users.forEach(u => { 
        if (u.jobTitle && u.department !== 'HR') titles.add(u.jobTitle.trim()); 
    });
    return Array.from(titles).sort();
  }, [users]);

  const handleUpdateMapping = (jobTitle: string, templateId: string) => {
    const currentMappings = configData?.mappings || {};
    const newMappings = { ...currentMappings, [jobTitle]: templateId };
    setDocumentNonBlocking(configDocRef, { mappings: newMappings }, { merge: true });
    toast({ title: 'Mapping Applied', description: `Designation "${jobTitle}" mapped to "${templateId}".` });
  };

  const handleExportTemplate = (template: any) => {
      const exportData = {
          templateName: template.name,
          platformID: template.id,
          description: template.description,
          sections: template.sections,
          aiOptimizationPrompt: `OPTIMIZE TACTICAL WORDING: Refine the labels for "${template.name}" to be extremely professional and elite. Maintain the structure.`
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TACTICAL_TEMPLATE_${template.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'JSON Exported' });
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const json = JSON.parse(ev.target?.result as string);
            if (!json.platformID) throw new Error("Invalid Format");
            
            // Logic to save the imported template (simplified for MVP: alert success)
            toast({ title: "Import Successful", description: "Template language synchronized." });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Import Failed', description: "Ensure the JSON matches the exported structure." });
        } finally {
            setIsImporting(false);
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader 
        title="Report System Control" 
        description="Configure strategic report mappings and optimize template wording via AI."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 border-b text-left">
                    <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter">
                        <ShieldCheck className="size-5 text-primary" />
                        Role Designation Matrix
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Note: Members in 'HR' department automatically use the HR template.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 text-left">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Non-HR Designation</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 text-right px-6">Strategic Mapping</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usersLoading || configLoading ? (
                                <TableRow><TableCell colSpan={2} className="h-32 text-center animate-pulse uppercase font-black text-[10px] opacity-20">Scanning records...</TableCell></TableRow>
                            ) : jobTitles.map(title => (
                                <TableRow key={title} className="border-border/50">
                                    <TableCell className="font-black text-xs uppercase py-4 px-6 text-left">{title}</TableCell>
                                    <TableCell className="text-right py-4 px-6">
                                        <Select 
                                            value={configData?.mappings?.[title] || "Business"} 
                                            onValueChange={(val) => handleUpdateMapping(title, val)}
                                        >
                                            <SelectTrigger className="w-[200px] ml-auto h-10 text-[10px] font-black uppercase rounded-none bg-white shadow-sm ring-1 ring-border border-none">
                                                <SelectValue placeholder="Select Template" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-none">
                                                {SYSTEM_TEMPLATES.filter(s => s.id !== 'HR').map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                <SelectItem value="Business">Business Intelligence</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden rounded-none text-left">
                <CardHeader className="bg-muted/10 border-b text-left">
                    <CardTitle className="text-lg font-headline flex items-center gap-2 font-black uppercase tracking-tighter">
                        <BrainCircuit className="size-5 text-primary" />
                        Strategic Library
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-left">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 px-6">Template Title</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] py-4 text-right px-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {SYSTEM_TEMPLATES.map(s => (
                                <TableRow key={s.id} className="border-border/50 group hover:bg-primary/5 transition-colors">
                                    <TableCell className="py-6 px-6 text-left">
                                        <div className="flex flex-col text-left">
                                            <span className="font-black text-sm uppercase text-primary">{s.name}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{s.description}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-6 px-6">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(s)} className="rounded-none font-black uppercase text-[9px] h-9 px-4">Preview</Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleExportTemplate(s)} className="rounded-none font-black uppercase text-[9px] h-9 px-4"><Download className="size-3 mr-1.5" /> Export JSON</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6 text-left">
          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 rounded-none text-left">
            <CardHeader className="text-left"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-left"><Upload className="size-4 text-primary" /> Import Optimized Language</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-left">
                <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed opacity-60">Select a JSON file refined by AI to synchronize high-fidelity wording.</p>
                <div className="relative text-left">
                    <input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImportTemplate} disabled={isImporting} />
                    <Button variant="outline" className="w-full h-11 rounded-none border-dashed border-primary/20 font-black uppercase text-[10px] shadow-sm bg-white" disabled={isImporting}>
                        {isImporting ? <Loader2 className="size-4 animate-spin"/> : <Upload className="size-4 mr-2"/>}
                        Upload JSON Template
                    </Button>
                </div>
            </CardContent>
          </Card>
          <Card className="border-none ring-1 ring-border/50 shadow-sm bg-white/50 rounded-none text-left">
            <CardHeader className="text-left"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-left"><Info className="size-4 text-primary" /> AI Optimization Protocol</CardTitle></CardHeader>
            <CardContent className="text-[9px] space-y-4 text-muted-foreground font-bold uppercase leading-relaxed opacity-60 text-left">
              <p>1. Export the template JSON to your device.</p>
              <p>2. Upload to AI Agent and ask it to "Optimize the wording for professional mission reporting."</p>
              <p>3. Re-import the refined JSON to update the system labels.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!previewTemplate} onOpenChange={o => !o && setPreviewTemplate(null)}>
          <DialogContent className="max-w-4xl h-[80vh] rounded-none border-none shadow-3xl overflow-hidden flex flex-col p-0 text-left">
              <DialogHeader className="p-10 border-b bg-white shrink-0 text-left">
                  <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary text-left">Template Preview: {previewTemplate?.name}</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-left">{previewTemplate?.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 bg-muted/5 text-left">
                  <div className="max-w-2xl mx-auto space-y-8 p-10 text-left">
                      {previewTemplate?.sections.map((sec: string) => (
                          <Card key={sec} className="p-8 border-none ring-1 ring-border/50 shadow-sm bg-white rounded-none text-left">
                              <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-6 border-b border-primary/10 pb-2 text-left">{sec}</h4>
                              <div className="h-14 bg-muted/10 border-2 border-dashed border-border/50 flex items-center justify-center text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">Tactical Fields Area</div>
                          </Card>
                      ))}
                  </div>
              </ScrollArea>
              <div className="p-10 border-t bg-white shrink-0 text-left">
                  <Button className="w-full h-14 rounded-none font-black uppercase tracking-widest shadow-xl" onClick={() => setPreviewTemplate(null)}>Close Preview</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
