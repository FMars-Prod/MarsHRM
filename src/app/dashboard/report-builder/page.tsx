"use client";

import * as React from "react";
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, setDocumentNonBlocking } from "@/firebase";
import { doc, collection, query, serverTimestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  FileText, Briefcase, Code, Megaphone, Users, Plus, Trash2, Edit, Save, 
  CheckCircle2, Eye, ShieldCheck, Download, Upload, Copy, RefreshCw, Layers, Sparkles,
  MapPin, LocateFixed, Navigation, ExternalLink, Activity, DollarSign, PhoneCall, Clock
} from "lucide-react";

export type FieldDefinition = {
  id: string;
  name: string;
  type: "text" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select
  defaultValue?: any;
};

export type SectionDefinition = {
  id: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Business" | "Technical" | "Digital Marketing" | "HR" | "Custom";
  isActive: boolean;
  sections: SectionDefinition[];
  updatedAt?: any;
};

// Default starter templates matching MarsHRM's actual report structures
const INITIAL_SYSTEM_TEMPLATES: ReportTemplate[] = [
  {
    id: "business-report-template",
    name: "Business Intelligence Report",
    category: "Business",
    description: "Daily outreach, client potentials, deal pipelines, and revenue impact.",
    isActive: true,
    sections: [
      {
        id: "shift-timings",
        title: "Shift Timings & Geolocation",
        description: "Verified login time, logout time, and coordinates",
        fields: [
          { id: "logInTime", name: "Shift Start Time", type: "text", required: true, placeholder: "09:00" },
          { id: "logOutTime", name: "Shift End Time", type: "text", required: true, placeholder: "18:00" }
        ]
      },
      {
        id: "outreach-metrics",
        title: "Outreach & Engagements",
        description: "Cold calling and networking metrics",
        fields: [
          { id: "coldCalls", name: "Cold Calls Count", type: "number", required: true, defaultValue: 0 },
          { id: "linkedinOutreach", name: "LinkedIn Messages Sent", type: "number", defaultValue: 0 },
          { id: "emailsSent", name: "Emails Sent", type: "number", defaultValue: 0 },
          { id: "followUps", name: "Follow-Ups Completed", type: "number", defaultValue: 0 },
          { id: "potentialClients", name: "Potential Clients Identified", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "financial-impact",
        title: "Revenue & Collections",
        description: "Financial performance tracking for today",
        fields: [
          { id: "revenueCollected", name: "Revenue Collected (₹)", type: "number", defaultValue: 0 },
          { id: "committedRevenue", name: "Committed Pipeline (₹)", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "planning-tomorrow",
        title: "Tomorrow's Action Plan",
        description: "Goals and critical focus for the next shift",
        fields: [
          { id: "meetingsTomorrow", name: "Meetings Scheduled", type: "number", defaultValue: 0 },
          { id: "criticalPathTomorrow", name: "Main Goal / Objective", type: "textarea", placeholder: "Key deliverables for tomorrow..." },
          { id: "interventionTrigger", name: "Manager Support Needed", type: "select", options: ["None", "Manager Input Required", "Resource Blocked", "Client Risk Detected"] }
        ]
      }
    ]
  },
  {
    id: "technical-report-template",
    name: "Technical & Engineering Sprint",
    category: "Technical",
    description: "Daily technical sprint progress, modules built, and client service tickets.",
    isActive: true,
    sections: [
      {
        id: "shift-timings",
        title: "Shift Timings & Geolocation",
        description: "Verified login time, logout time, and coordinates",
        fields: [
          { id: "logInTime", name: "Shift Start Time", type: "text", required: true, placeholder: "09:00" },
          { id: "logOutTime", name: "Shift End Time", type: "text", required: true, placeholder: "18:00" }
        ]
      },
      {
        id: "tech-projects",
        title: "Projects & Modules Worked On",
        description: "Sprint tasks, features coded, and completion percentage",
        fields: [
          { id: "projectName", name: "Project Name", type: "text", required: true, placeholder: "e.g. MarsHRM" },
          { id: "type", name: "Module / Architecture Component", type: "text", placeholder: "e.g. Geofence Control" },
          { id: "description", name: "Tasks Executed", type: "textarea", placeholder: "Detailed engineering notes..." },
          { id: "statusPercent", name: "Module Completion %", type: "number", defaultValue: 100 }
        ]
      },
      {
        id: "tech-calls",
        title: "Client & Architecture Engagements",
        description: "Technical review calls and sprint alignment",
        fields: [
          { id: "clientName", name: "Client / Stakeholder", type: "text", placeholder: "Client or internal team" },
          { id: "productName", name: "System / Service Discussed", type: "text" },
          { id: "callStatus", name: "Status", type: "select", options: ["Pitching", "Closing", "Support", "Architecture Review"] }
        ]
      },
      {
        id: "planning-tomorrow",
        title: "Tomorrow's Technical Objectives",
        description: "Next sprint milestones and resource blockers",
        fields: [
          { id: "criticalPathTomorrow", name: "Tomorrow's Core Engineering Task", type: "textarea", placeholder: "Modules to deploy..." },
          { id: "interventionTrigger", name: "Blockers / Management Input", type: "select", options: ["None", "Resource Blocked", "Manager Input Required"] }
        ]
      }
    ]
  },
  {
    id: "marketing-report-template",
    name: "Digital Marketing Strategy",
    category: "Digital Marketing",
    description: "Marketing deliverables, content creation, ad spends, and lead performance.",
    isActive: true,
    sections: [
      {
        id: "shift-timings",
        title: "Shift Timings",
        fields: [
          { id: "logInTime", name: "Shift Start Time", type: "text", placeholder: "09:00" },
          { id: "logOutTime", name: "Shift End Time", type: "text", placeholder: "18:00" }
        ]
      },
      {
        id: "deliverables",
        title: "Creative Deliverables Matrix",
        fields: [
          { id: "dmContent", name: "Content Pieces Written", type: "number", defaultValue: 0 },
          { id: "dmPoster", name: "Posters / Creatives Designed", type: "number", defaultValue: 0 },
          { id: "dmReel", name: "Short Videos / Reels Edited", type: "number", defaultValue: 0 },
          { id: "dmShoot", name: "Shoots Completed", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "planning-tomorrow",
        title: "Tomorrow's Marketing Deliverables",
        fields: [
          { id: "criticalPathTomorrow", name: "Campaigns & Content Focus", type: "textarea" },
          { id: "interventionTrigger", name: "Ad Budget / Creative Blockers", type: "select", options: ["None", "Budget Approval Needed", "Resource Blocked"] }
        ]
      }
    ]
  },
  {
    id: "hr-report-template",
    name: "HR Talent & Operations",
    category: "HR",
    description: "Recruitment metrics, talent sourcing, interviews, and campus drives.",
    isActive: true,
    sections: [
      {
        id: "recruitment-pulse",
        title: "Recruitment Pulse",
        fields: [
          { id: "resumesSourced", name: "Resumes Sourced", type: "number", defaultValue: 0 },
          { id: "interviewsScheduled", name: "Interviews Conducted", type: "number", defaultValue: 0 },
          { id: "hiredToday", name: "Offers Released / Hired", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "hr-objectives",
        title: "Talent Operations & Campus Drives",
        fields: [
          { id: "campusDriveName", name: "Campus / Institution Engaged", type: "text" },
          { id: "criticalPathTomorrow", name: "Tomorrow's Sourcing Strategy", type: "textarea" }
        ]
      }
    ]
  }
];

export default function ReportBuilderPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const configRef = useMemoFirebase(() => doc(firestore, 'settings', 'report_templates'), [firestore]);
  const { data: reportConfig } = useDoc<any>(configRef);

  const templatesQuery = useMemoFirebase(() => query(collection(firestore, "settings", "config", "custom_report_templates")), [firestore]);
  const { data: remoteTemplates, isLoading } = useCollection<ReportTemplate>(templatesQuery);

  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = React.useState<ReportTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);

  const isFullSpecEnabled = !!reportConfig?.isFullSpecBusinessEnabled;

  const handleToggleFullSpec = async (checked: boolean) => {
    try {
      await setDocumentNonBlocking(configRef, { isFullSpecBusinessEnabled: checked }, { merge: true });
      toast({
        title: checked ? "Full Specification Mode Activated" : "Standard Mode Activated",
        description: checked 
          ? "Employees will now submit under the complete Performance, Revenue, and Client Leads format."
          : "Employees will submit under the standard clean reporting format."
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  // Editor Form State
  const [editingTemplate, setEditingTemplate] = React.useState<ReportTemplate>({
    id: "",
    name: "",
    description: "",
    category: "Business",
    isActive: true,
    sections: []
  });

  // Effective list of templates: Remote Firestore or fallback to initial defaults
  const templatesList: ReportTemplate[] = React.useMemo(() => {
    if (remoteTemplates && remoteTemplates.length > 0) {
      return remoteTemplates;
    }
    return INITIAL_SYSTEM_TEMPLATES;
  }, [remoteTemplates]);

  const handleOpenEditor = (template?: ReportTemplate) => {
    if (template) {
      setEditingTemplate(JSON.parse(JSON.stringify(template)));
    } else {
      setEditingTemplate({
        id: `template-${Date.now()}`,
        name: "New Custom Report Template",
        description: "Custom operational reporting structure.",
        category: "Custom",
        isActive: true,
        sections: [
          {
            id: `sec-${Date.now()}`,
            title: "General Section",
            description: "Section details",
            fields: [
              { id: "field_1", name: "Task Title", type: "text", required: true },
              { id: "field_2", name: "Summary / Notes", type: "textarea" }
            ]
          }
        ]
      });
    }
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Template Name is required." });
      return;
    }

    try {
      const templateRef = doc(firestore, "settings", "config", "custom_report_templates", editingTemplate.id);
      await setDocumentNonBlocking(templateRef, {
        ...editingTemplate,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "Template Saved", description: `"${editingTemplate.name}" has been updated.` });
      setIsEditorOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save Failed", description: e.message });
    }
  };

  // Section manipulation in editor
  const handleAddSection = () => {
    setEditingTemplate({
      ...editingTemplate,
      sections: [
        ...editingTemplate.sections,
        {
          id: `sec-${Date.now()}`,
          title: "New Section",
          description: "Section details",
          fields: [
            { id: `field_${Date.now()}`, name: "Field Name", type: "text", required: false }
          ]
        }
      ]
    });
  };

  const handleRemoveSection = (sectionIndex: number) => {
    const updated = [...editingTemplate.sections];
    updated.splice(sectionIndex, 1);
    setEditingTemplate({ ...editingTemplate, sections: updated });
  };

  const handleAddField = (sectionIndex: number) => {
    const updated = [...editingTemplate.sections];
    updated[sectionIndex].fields.push({
      id: `field_${Date.now()}`,
      name: "New Field",
      type: "text",
      required: false
    });
    setEditingTemplate({ ...editingTemplate, sections: updated });
  };

  const handleRemoveField = (sectionIndex: number, fieldIndex: number) => {
    const updated = [...editingTemplate.sections];
    updated[sectionIndex].fields.splice(fieldIndex, 1);
    setEditingTemplate({ ...editingTemplate, sections: updated });
  };

  const filteredTemplates = React.useMemo(() => {
    if (activeTab === "all") return templatesList;
    return templatesList.filter(t => t.category.toLowerCase() === activeTab.toLowerCase());
  }, [templatesList, activeTab]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20 font-jakarta text-left">
      <PageHeader
        title="Report Formats & Template Customizer"
        description="View, customize, and edit the exact reporting formats used for Business, Technical, Marketing, and HR reports."
      >
        <Button 
          onClick={() => handleOpenEditor()} 
          className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
        >
          <Plus className="size-4 mr-2" /> Create New Template
        </Button>
      </PageHeader>

      {/* Master Switch for Full Specification Mode */}
      <Card className="border-none ring-1 ring-primary/20 bg-gradient-to-r from-purple-50 via-white to-purple-50 rounded-none shadow-sm text-left">
        <CardHeader className="p-6 border-b border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-black uppercase text-purple-900 tracking-wider flex items-center gap-2">
                <Sparkles className="size-4 text-purple-600" /> Comprehensive Performance & Revenue Report Mode
              </CardTitle>
              <Badge className={isFullSpecEnabled ? "bg-emerald-600 text-white rounded-none text-[8px] font-black uppercase px-2" : "bg-slate-200 text-slate-700 rounded-none text-[8px] font-black uppercase px-2"}>
                {isFullSpecEnabled ? "FULL SPEC ACTIVE" : "STANDARD MODE"}
              </Badge>
            </div>
            <CardDescription className="text-xs font-medium text-slate-600">
              When enabled, Business team members submit under the full 4-tier specification (Fixed 90 calls/day target, Revenue Variance, Client Engagements, Blockers, and Potential Client Excel Upload). If disabled, the classic standard format is preserved without conflicts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {isFullSpecEnabled ? "Full Spec ON" : "Standard"}
            </span>
            <Switch checked={isFullSpecEnabled} onCheckedChange={handleToggleFullSpec} />
          </div>
        </CardHeader>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border rounded-none p-1 h-12 shadow-sm">
          <TabsTrigger value="all" className="rounded-none font-black uppercase text-[9px] tracking-wider px-5">All Formats</TabsTrigger>
          <TabsTrigger value="business" className="rounded-none font-black uppercase text-[9px] tracking-wider px-5">Business</TabsTrigger>
          <TabsTrigger value="technical" className="rounded-none font-black uppercase text-[9px] tracking-wider px-5">Technical</TabsTrigger>
          <TabsTrigger value="digital marketing" className="rounded-none font-black uppercase text-[9px] tracking-wider px-5">Marketing</TabsTrigger>
          <TabsTrigger value="hr" className="rounded-none font-black uppercase text-[9px] tracking-wider px-5">HR & Ops</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTemplates.map((template) => {
              const totalFields = template.sections.reduce((acc, s) => acc + s.fields.length, 0);

              return (
                <Card key={template.id} className="border-none ring-1 ring-border/50 shadow-sm rounded-none bg-white overflow-hidden text-left hover:shadow-md transition-all flex flex-col justify-between">
                  <CardHeader className="bg-muted/10 p-6 border-b text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <CardTitle className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                          {template.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-none border-primary/20 text-primary bg-primary/5 text-[8px] font-black uppercase px-2 py-0.5">
                            {template.category}
                          </Badge>
                        </div>
                      </div>

                      <Badge className={template.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200 rounded-none text-[8px] font-black uppercase px-2 h-6" : "bg-slate-100 text-slate-600 rounded-none text-[8px] font-black uppercase px-2 h-6"}>
                        {template.isActive ? "ACTIVE FORMAT" : "DRAFT"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4 text-left flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed opacity-75">
                        {template.description}
                      </p>

                      <div className="space-y-1.5 pt-2">
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest">Included Sections ({template.sections.length}):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {template.sections.map((sec) => (
                            <span key={sec.id} className="text-[8px] font-black uppercase px-2 py-1 bg-muted/30 border border-border/50 text-slate-700">
                              {sec.title} ({sec.fields.length} fields)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-dashed flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black uppercase text-slate-500 font-mono">
                        Total {totalFields} Fields
                      </span>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedTemplate(template); setIsPreviewOpen(true); }}
                          className="rounded-none h-8 font-black uppercase text-[9px] tracking-wider border-border hover:bg-primary/5"
                        >
                          <Eye className="size-3 mr-1" /> View Format
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenEditor(template)}
                          className="rounded-none h-8 font-black uppercase text-[9px] tracking-wider shadow-sm"
                        >
                          <Edit className="size-3 mr-1" /> Customize
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* PREVIEW MODAL (EXACT USER SIDE LAYOUT) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl rounded-none border-none shadow-3xl h-[90vh] flex flex-col p-0 overflow-hidden text-left font-jakarta">
          <DialogHeader className="p-6 border-b bg-white text-left shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-primary flex items-center gap-2">
                  <FileText className="size-5" /> DAILY REPORT PREVIEW: {selectedTemplate?.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Exact user-side layout rendered to employees • {selectedTemplate?.category}
                </DialogDescription>
              </div>
              <Badge className="bg-primary text-white text-[9px] font-black uppercase px-3 h-7 rounded-none">
                Live Layout
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-8 bg-muted/5 text-left">
            <div className="space-y-6 max-w-3xl mx-auto text-left">
              
              {/* DETAILS (SHIFT TIMINGS) */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">DETAILS</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">SHIFT START</Label>
                    <div className="h-11 border bg-white flex items-center px-4 font-mono text-sm text-slate-700">--:--</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">SHIFT END</Label>
                    <div className="h-11 border bg-white flex items-center px-4 font-mono text-sm text-slate-700">--:--</div>
                  </div>
                </div>
              </div>

              {/* Exact Report Sections as seen by employee */}
              {selectedTemplate?.category === "Business" ? (
                <div className="space-y-6">
                  {/* 1. OUTREACH CARD */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        <Activity className="size-4" /> 1️⃣ OUTREACH & METRICS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                        <div className="md:col-span-8 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">COLD CALLS</Label><div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">0</div></div>
                            <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">LINKEDIN</Label><div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">0</div></div>
                            <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">EMAILS</Label><div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">0</div></div>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex-1 p-5 bg-primary/5 ring-1 ring-primary/20 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">TOTAL OUTREACH</p>
                              <span className="text-3xl font-black text-primary">0</span>
                            </div>
                            <div className="w-1/3 p-5 bg-white ring-1 ring-border/50 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">FOLLOW-UPS</p>
                              <span className="text-2xl font-black text-slate-800">0</span>
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-4">
                          <Card className="bg-white border ring-2 ring-primary/20 rounded-none overflow-hidden">
                            <div className="p-3 bg-primary text-white text-center text-[10px] font-black uppercase tracking-widest">EFFICIENCY</div>
                            <CardContent className="p-4 space-y-4 text-center">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-muted-foreground">POTENTIALS</span>
                                <div className="text-2xl font-black text-slate-900 border py-2">0</div>
                              </div>
                              <div className="text-center pt-1 border-t">
                                <p className="text-[8px] font-black uppercase text-muted-foreground">SUCCESS RATE</p>
                                <p className="text-2xl font-black text-primary">0.0%</p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. REVENUE */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        <DollarSign className="size-4" /> 2️⃣ REVENUE
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">REVENUE COLLECTED (₹)</Label><div className="h-11 border bg-white flex items-center px-3 font-bold">₹0</div></div>
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">COMMITTED PIPELINE (₹)</Label><div className="h-11 border bg-white flex items-center px-3 font-bold">₹0</div></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. CALL RECORDINGS */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        <PhoneCall className="size-4" /> 3️⃣ DAILY CALL RECORDINGS & AUDIT ASSETS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground">GOOGLE DRIVE RECORDINGS FOLDER LINK</Label>
                        <div className="h-11 border bg-white flex items-center px-3 text-xs text-muted-foreground font-mono">https://drive.google.com/...</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">BEST CALL (AUDIO)</Label><div className="h-11 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">Audio File Selector</div></div>
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">WORST CALL (AUDIO)</Label><div className="h-11 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">Audio File Selector</div></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4. EXECUTION PLAN */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        🎯 TOMORROW'S PLAN & OBJECTIVES
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">MEETINGS SCHEDULED</Label><div className="h-11 border bg-white flex items-center px-3 font-bold">0</div></div>
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">SUPPORT NEEDED</Label><div className="h-11 border bg-white flex items-center px-3 font-bold text-xs uppercase text-slate-700">None</div></div>
                      </div>
                      <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">MAIN GOAL / DELIVERABLE</Label><div className="min-h-[70px] border bg-white p-3 text-xs text-muted-foreground font-bold">Key tasks planned for tomorrow...</div></div>
                    </CardContent>
                  </Card>
                </div>
              ) : selectedTemplate?.category === "Technical" ? (
                <div className="space-y-6">
                  {/* Calls */}
                  <Card className="border ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                        <PhoneCall className="size-4" /> CALLS & MEETINGS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                      <div className="p-3 bg-muted/5 border flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-slate-800">Tech Architecture Sync</p>
                          <p className="text-[9px] font-bold uppercase text-muted-foreground">Internal / Client Platform</p>
                        </div>
                        <Badge className="rounded-none bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase">Closing</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Projects */}
                  <Card className="border ring-1 ring-border/50 rounded-none shadow-sm bg-white overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                        <Briefcase className="size-4" /> PROJECTS & MODULES
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="p-4 bg-muted/5 border space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase text-slate-800">MarsHRM Engine</span>
                          <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-200">100% DONE</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-600 uppercase">Geofence Attendance Module & Admin Switches</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tomorrow's Plan */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                        🎯 TOMORROW'S PLAN & OBJECTIVES
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">MEETINGS</Label><div className="h-11 border bg-white flex items-center px-3 font-bold">0</div></div>
                        <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">SUPPORT NEEDED</Label><div className="h-11 border bg-white flex items-center px-3 font-bold text-xs uppercase text-slate-700">None</div></div>
                      </div>
                      <div className="space-y-1"><Label className="text-[9px] uppercase font-black text-muted-foreground">MAIN GOAL / DELIVERABLE</Label><div className="min-h-[70px] border bg-white p-3 text-xs text-muted-foreground font-bold">Core technical sprint tasks...</div></div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* Dynamic Custom / Other Formats */
                <div className="space-y-6">
                  {selectedTemplate?.sections.map((section, idx) => (
                    <Card key={section.id} className="border rounded-none shadow-sm bg-white overflow-hidden text-left">
                      <CardHeader className="bg-muted/10 p-4 border-b">
                        <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2">
                          <span className="size-5 rounded-none bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {section.title}
                        </CardTitle>
                        {section.description && (
                          <CardDescription className="text-[9px] font-bold uppercase text-muted-foreground">
                            {section.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="p-6 space-y-4 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                          {section.fields.map((field) => (
                            <div key={field.id} className={cn("space-y-1.5 text-left", field.type === "textarea" && "sm:col-span-2")}>
                              <Label className="text-[9px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                                {field.name}
                                {field.required && <span className="text-rose-500">*</span>}
                              </Label>
                              {field.type === "textarea" ? (
                                <Textarea placeholder={field.placeholder || "Enter description..."} disabled className="rounded-none bg-muted/10 text-xs font-bold" />
                              ) : field.type === "select" ? (
                                <div className="h-10 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">
                                  {field.options?.[0] || "Select Option"}
                                </div>
                              ) : (
                                <Input placeholder={field.placeholder || "Value..."} disabled className="h-10 rounded-none bg-muted/10 text-xs font-bold" />
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* NEW DEDICATED LOCATION COORDINATES SECTION */}
              <div className="mt-8 pt-6 border-t border-dashed">
                <Card className="border-none ring-1 ring-primary/20 bg-gradient-to-r from-primary/5 via-white to-primary/5 rounded-none shadow-sm text-left">
                  <CardHeader className="bg-muted/10 py-3 px-4 border-b border-border/40">
                    <CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MapPin className="size-3.5" /> 📍 NEW SECTION: VERIFIED GPS ATTENDANCE COORDINATES
                      </span>
                      <Badge className="bg-primary text-white text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">
                        SYSTEM ATTACHED
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">
                      Automatically recorded during clock-in and clock-out to verify employee coordinates:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                      {/* Check In Location Box */}
                      <div className="p-3 bg-white border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <LocateFixed className="size-3 text-emerald-600" /> Clock-In Location
                          </span>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">Office / Authorized</Badge>
                        </div>
                        <p className="text-xs font-black uppercase text-slate-800">
                          Office Geofence
                        </p>
                        <div className="space-y-0.5">
                          <p className="font-mono text-[9px] font-bold text-slate-600">
                            10.77091, 76.09277
                          </p>
                          <span className="text-[8px] font-black uppercase text-primary hover:underline flex items-center gap-1 pt-0.5 cursor-pointer">
                            <ExternalLink className="size-2.5" /> View On Map
                          </span>
                        </div>
                      </div>

                      {/* Check Out Location Box */}
                      <div className="p-3 bg-white border border-border/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Navigation className="size-3 text-rose-600" /> Clock-Out Location
                          </span>
                          <Badge className="bg-slate-100 text-slate-700 text-[7px] font-black uppercase rounded-none border-none px-1.5 h-4">Shift End</Badge>
                        </div>
                        <p className="text-xs font-black uppercase text-slate-800">
                          Current Device Coordinates
                        </p>
                        <p className="text-[9px] font-bold text-slate-500 italic uppercase">Will record coordinates automatically on submit</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-white">
            <Button onClick={() => setIsPreviewOpen(false)} className="rounded-none h-11 px-8 font-black uppercase text-[10px] tracking-widest">
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT / CUSTOMIZE TEMPLATE MODAL */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl rounded-none border-none shadow-3xl h-[90vh] flex flex-col p-0 overflow-hidden text-left">
          <DialogHeader className="p-8 border-b bg-white text-left shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-primary">
                  Customize Template: {editingTemplate.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Add, edit, or remove sections and fields to tailor this report format.
                </DialogDescription>
              </div>
              <Button onClick={handleAddSection} variant="outline" size="sm" className="rounded-none h-9 font-black uppercase text-[9px] tracking-widest border-primary/20 text-primary">
                <Plus className="size-3.5 mr-1.5" /> Add Section
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-8 bg-muted/5 text-left">
            <div className="space-y-8 max-w-3xl mx-auto text-left">
              {/* Basic Template Meta */}
              <div className="p-6 bg-white border border-border shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Template Name</Label>
                    <Input 
                      value={editingTemplate.name} 
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} 
                      className="rounded-none h-11 text-xs font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Category</Label>
                    <Input 
                      value={editingTemplate.category} 
                      onChange={(e: any) => setEditingTemplate({ ...editingTemplate, category: e.target.value })} 
                      className="rounded-none h-11 text-xs font-bold" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Description</Label>
                  <Input 
                    value={editingTemplate.description} 
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })} 
                    className="rounded-none h-11 text-xs font-bold" 
                  />
                </div>
              </div>

              {/* Sections & Fields Editor */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Layers className="size-4" /> Form Sections ({editingTemplate.sections.length})
                  </h3>
                </div>

                {editingTemplate.sections.map((section, sIdx) => (
                  <Card key={section.id} className="border rounded-none shadow-sm bg-white overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 p-4 border-b flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <span className="size-6 bg-primary text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {sIdx + 1}
                        </span>
                        <Input 
                          value={section.title} 
                          onChange={(e) => {
                            const updated = [...editingTemplate.sections];
                            updated[sIdx].title = e.target.value;
                            setEditingTemplate({ ...editingTemplate, sections: updated });
                          }} 
                          className="h-9 rounded-none font-black uppercase text-xs border-primary/20 bg-white" 
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => handleAddField(sIdx)} 
                          variant="outline" 
                          size="sm" 
                          className="rounded-none h-8 text-[9px] font-black uppercase tracking-wider border-border"
                        >
                          <Plus className="size-3 mr-1" /> Add Field
                        </Button>
                        <Button 
                          onClick={() => handleRemoveSection(sIdx)} 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-none h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 space-y-4 text-left">
                      {section.fields.map((field, fIdx) => (
                        <div key={field.id} className="p-4 bg-muted/5 border border-border/50 rounded-none space-y-3 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <Input 
                              value={field.name} 
                              onChange={(e) => {
                                const updated = [...editingTemplate.sections];
                                updated[sIdx].fields[fIdx].name = e.target.value;
                                setEditingTemplate({ ...editingTemplate, sections: updated });
                              }} 
                              placeholder="Field Label (e.g. Cold Calls)"
                              className="h-9 rounded-none font-bold text-xs bg-white flex-1" 
                            />
                            <Select 
                              value={field.type} 
                              onValueChange={(val: any) => {
                                const updated = [...editingTemplate.sections];
                                updated[sIdx].fields[fIdx].type = val;
                                setEditingTemplate({ ...editingTemplate, sections: updated });
                              }}
                            >
                              <SelectTrigger className="h-9 w-36 rounded-none text-xs font-bold uppercase bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-none">
                                <SelectItem value="text">Text Input</SelectItem>
                                <SelectItem value="number">Numeric Metric</SelectItem>
                                <SelectItem value="textarea">Paragraph / Area</SelectItem>
                                <SelectItem value="select">Dropdown Select</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button 
                              onClick={() => handleRemoveField(sIdx, fIdx)} 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-none h-9 w-9 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-white flex items-center justify-between">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)} className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest">
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} className="rounded-none h-11 px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
              <Save className="size-3.5 mr-2" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
