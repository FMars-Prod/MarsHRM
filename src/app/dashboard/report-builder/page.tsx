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
  MapPin, LocateFixed, Navigation, ExternalLink, Activity, DollarSign, PhoneCall, Clock, FileSpreadsheet, EyeOff, Share2
} from "lucide-react";
import { useBranding } from "@/context/branding-context";
import { ReportTemplateVisualPreview } from "./report-template-visual-preview";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

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
    id: "business-full-spec-template",
    name: "Performance & Revenue Report (Full Spec)",
    category: "Business",
    description: "Complete 4-tier protocol: 90 calls/day target, Revenue Variance, Client Engagements, Blockers, & Excel Leads upload.",
    isActive: true,
    sections: [
      {
        id: "shift-timings",
        title: "Shift Timings & Location",
        description: "Verified login, logout, and GPS check-in",
        fields: [
          { id: "logInTime", name: "Shift Start Time", type: "text", required: true, placeholder: "09:00" },
          { id: "logOutTime", name: "Shift End Time", type: "text", required: true, placeholder: "18:00" }
        ]
      },
      {
        id: "outreach-analytics",
        title: "1️⃣ Outreach & Conversion Analytics",
        description: "Fixed 90 calls/day target, conversion %, and client contact list",
        fields: [
          { id: "coldCalls", name: "Connected Calls", type: "number", required: true, defaultValue: 0 },
          { id: "linkedinOutreach", name: "LinkedIn Messages", type: "number", defaultValue: 0 },
          { id: "emailsSent", name: "Emails Sent", type: "number", defaultValue: 0 },
          { id: "potentialClients", name: "Active Potential Clients", type: "number", defaultValue: 0 },
          { id: "followUps", name: "Follow-ups Completed Count", type: "number", defaultValue: 0 },
          { id: "followUpClientsList", name: "List of Existing Clients Contacted", type: "textarea", placeholder: "Clients and progress notes..." }
        ]
      },
      {
        id: "revenue-impact",
        title: "2️⃣ Revenue & Financial Impact",
        description: "Collected, Committed, Pipeline Business Value, and Target Variance",
        fields: [
          { id: "revenueCollected", name: "Net Revenue Collected Today (₹)", type: "number", defaultValue: 0 },
          { id: "committedRevenue", name: "Committed Net Revenue (₹)", type: "number", defaultValue: 0 },
          { id: "pipelineBusinessValue", name: "Pipeline Business Value (₹)", type: "number", defaultValue: 0 },
          { id: "dailyRevenueTarget", name: "Daily Revenue Target (₹)", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "high-value-engagements",
        title: "3️⃣ High-Value Engagements",
        description: "Meetings/Demos, Quotations, Invoices, Client Wins, and Strategic Learnings",
        fields: [
          { id: "totalMeetingsConducted", name: "Total Meetings / Demos Conducted", type: "number", defaultValue: 0 },
          { id: "totalQuotationsShared", name: "Total Quotations Shared", type: "number", defaultValue: 0 },
          { id: "totalInvoicesShared", name: "Total Invoices Shared", type: "number", defaultValue: 0 },
          { id: "clientWinHighlight", name: "Client Win / Breakthrough of the Day", type: "textarea" },
          { id: "strategicLearning", name: "Strategic Learning & Market Insight", type: "textarea" }
        ]
      },
      {
        id: "pipeline-planning",
        title: "4️⃣ Pipeline Impact & T+1 Planning",
        description: "Meetings booked tomorrow (Online/Onsite), Critical Path, Blockers, and Intervention Trigger",
        fields: [
          { id: "criticalPathTomorrow", name: "T+1 Critical Path (Main Milestone)", type: "textarea", placeholder: "#1 most important deliverable..." },
          { id: "pendingDeliverables", name: "Pending Deliverables Carried Forward", type: "textarea" },
          { id: "interventionTrigger", name: "Intervention Trigger", type: "select", options: ["None", "Coaching", "Tech Support", "Client Meeting", "Manager Input Required", "Resource Blocked"] },
          { id: "interventionTriggerReason", name: "Reason for Trigger", type: "text" }
        ]
      },
      {
        id: "supporting-documentation",
        title: "📎 Supporting Docs & Excel Leads",
        description: "Potential Client Excel Sheet upload (.xlsx / .csv) & Google Drive link",
        fields: [
          { id: "totalCallRecordings", name: "Google Drive Call Recordings Link", type: "text" },
          { id: "potentialClientsFileUrl", name: "Potential Client Excel File (.xlsx/.csv)", type: "text" }
        ]
      }
    ]
  },
  {
    id: "business-report-template",
    name: "Business Intelligence Report (Standard)",
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
    id: "hr-full-spec-template",
    name: "HR Operations & BDE Governance (Full Spec)",
    category: "HR",
    description: "Complete 12-section operational protocol: Task Management, 12-Stage Recruitment, BDE Team Call Monitoring with Feedback PDF Upload, Training, HR Ops, Campus Outreach, Accountability, Pending Tasks & Escalations.",
    isActive: true,
    sections: [
      {
        id: "daily-tasks",
        title: "1️⃣ Daily Task Management & Execution",
        description: "Task tracking with status, priority, description, and pending/hold reasons",
        fields: [
          { id: "taskActivity", name: "Task / Activity", type: "text", required: true },
          { id: "taskAssignedBy", name: "Assigned By", type: "text" },
          { id: "taskPriority", name: "Priority", type: "select", options: ["High", "Medium", "Low"] },
          { id: "taskStatus", name: "Task Status", type: "select", options: ["Completed", "In Progress", "Pending", "On Hold", "Cancelled"] }
        ]
      },
      {
        id: "recruitment-candidate",
        title: "2️⃣ Recruitment & Candidate Funnel",
        description: "12-stage candidate lifecycle from sourcing to onboarding and joining",
        fields: [
          { id: "resumesSourced", name: "Candidate Resumes Sourced", type: "number", defaultValue: 0 },
          { id: "candidatesConnected", name: "Candidates Contacted (Connected Calls)", type: "number", defaultValue: 0 },
          { id: "followUpCallsConducted", name: "Follow-up Calls Conducted", type: "number", defaultValue: 0 },
          { id: "screeningsCompleted", name: "Screening Completed", type: "number", defaultValue: 0 },
          { id: "interviewsScheduled", name: "Interviews Scheduled (Round 1)", type: "number", defaultValue: 0 },
          { id: "candidatesSelectedR1", name: "Candidates Selected (Round 1)", type: "number", defaultValue: 0 },
          { id: "interviewsScheduledR2", name: "Interviews Scheduled (Final Round)", type: "number", defaultValue: 0 },
          { id: "candidatesSelectedFinal", name: "Candidates Selected (Final Round)", type: "number", defaultValue: 0 },
          { id: "documentationCompleted", name: "Completed Documentation", type: "number", defaultValue: 0 },
          { id: "candidatesOnboarded", name: "Candidates Onboarded", type: "number", defaultValue: 0 },
          { id: "hiredToday", name: "Successfully Joined", type: "number", defaultValue: 0 },
          { id: "candidatesAwaitingJoining", name: "Awaiting Joining", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "bde-governance",
        title: "3️⃣ BDE Team Management & Call Monitoring",
        description: "BDE supervision metrics + Individual employee call review records with mandatory Feedback PDF",
        fields: [
          { id: "totalBdeHandled", name: "Total BDE Executives Handling", type: "number", defaultValue: 0 },
          { id: "bdeLoginMeetings", name: "BDE Login Meetings Conducted", type: "number", defaultValue: 0 },
          { id: "bdeDayEndMeetings", name: "BDE Day-End Meetings Conducted", type: "number", defaultValue: 0 },
          { id: "bdeQueriesResolved", name: "BDE Queries Resolved", type: "number", defaultValue: 0 },
          { id: "bdeFeedbackPdfUrl", name: "Mandatory Individual BDE Feedback PDF", type: "text" }
        ]
      },
      {
        id: "training-development",
        title: "4️⃣ Training & Employee Development",
        description: "Training programs, sessions conducted, attendee counts, and activity status",
        fields: [
          { id: "trainingType", name: "Training Type", type: "select", options: ["Onboarding Training", "Employee Upskilling Training", "Product & Process Training", "Professional Development", "Compliance & Policy", "Client Handling Training", "Other"] },
          { id: "trainingConducted", name: "Sessions Conducted", type: "number", defaultValue: 0 },
          { id: "trainingAttendees", name: "Employees Attended", type: "number", defaultValue: 0 },
          { id: "trainingStatus", name: "Activity Status", type: "select", options: ["Completed", "In Progress", "Scheduled", "Pending", "Cancelled", "Nil"] }
        ]
      },
      {
        id: "hr-operations",
        title: "5️⃣ HR Operations & Documentation",
        description: "Verification of documentation, offer & appointment letters, and attendance records",
        fields: [
          { id: "docsCollected", name: "Employee Documents Collected", type: "number", defaultValue: 0 },
          { id: "recordsUpdated", name: "Employee Records Updated", type: "number", defaultValue: 0 },
          { id: "offerLettersIssued", name: "Offer Letters Issued", type: "number", defaultValue: 0 },
          { id: "appointmentLettersIssued", name: "Appointment Letters Issued", type: "number", defaultValue: 0 },
          { id: "attendanceVerified", name: "Attendance Records Verified", type: "number", defaultValue: 0 }
        ]
      },
      {
        id: "institutional-outreach",
        title: "6️⃣ Campus Recruitment & Institutional Outreach",
        description: "College partnerships, drives coordinated, and MoU status",
        fields: [
          { id: "collegesContacted", name: "Colleges Contacted", type: "number", defaultValue: 0 },
          { id: "collegesResponded", name: "Colleges Responded", type: "number", defaultValue: 0 },
          { id: "campusDrivesCoordinated", name: "Campus Drives Coordinated", type: "number", defaultValue: 0 },
          { id: "outreachStatus", name: "Outreach Status", type: "select", options: ["Initial Contact Completed", "Awaiting Response", "Follow-up Required", "Meeting Scheduled", "Collaboration in Progress", "Collaboration Confirmed", "Nil"] }
        ]
      },
      {
        id: "accountability-pending",
        title: "7️⃣ Daily Communication, Pending Tasks & Escalations",
        description: "Check-in accountability, pending responsibilities carried forward, and management escalations",
        fields: [
          { id: "loginMeeting905", name: "9:05 AM Login Meeting Attended", type: "select", options: ["Attended", "Not Attended"] },
          { id: "workUpdate1100", name: "11:00 AM Work Update Submitted", type: "select", options: ["Submitted", "Not Submitted"] },
          { id: "progressUpdate1255", name: "12:55 PM Pre-Lunch Progress", type: "select", options: ["Submitted", "Not Submitted"] },
          { id: "challengeCategory", name: "Challenge / Escalation Category", type: "select", options: ["No Challenges", "Recruitment / Candidate Response", "BDE Performance / Call Monitoring", "Attendance / HRM Issues", "Documentation", "Training / Development", "Institutional Coordination", "Technical / System", "Management Dependency", "Other"] },
          { id: "escalationStatus", name: "Escalation Status", type: "select", options: ["Not Required", "Resolved Independently", "Escalated to HR Manager", "Escalated to Management", "Awaiting Resolution"] }
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
  const { hideFortuMarsBranding, setHideFortuMarsBranding } = useBranding();

  const templatesQuery = useMemoFirebase(() => query(collection(firestore, "settings", "config", "custom_report_templates")), [firestore]);
  const { data: remoteTemplates, isLoading } = useCollection<ReportTemplate>(templatesQuery);

  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = React.useState<ReportTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const [downloadingCardId, setDownloadingCardId] = React.useState<string | null>(null);
  const previewContentRef = React.useRef<HTMLDivElement>(null);
  const hiddenCardRenderRef = React.useRef<HTMLDivElement>(null);
  const [templateToRenderOffscreen, setTemplateToRenderOffscreen] = React.useState<ReportTemplate | null>(null);

  const isFullSpecEnabled = !!reportConfig?.isFullSpecBusinessEnabled;
  const isFullSpecHREnabled = !!reportConfig?.isFullSpecHREnabled;

  const handleToggleFullSpecHR = async (checked: boolean) => {
    try {
      await setDocumentNonBlocking(configRef, { isFullSpecHREnabled: checked }, { merge: true });
      toast({
        title: checked ? "HR Full Spec Governance Mode Activated" : "Standard HR Mode Activated",
        description: checked 
          ? "HR team members will now submit under the 12-section protocol (BDE call barging, feedback PDFs, and candidate pipeline)."
          : "HR team members will submit under the classic lightweight format."
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

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

  // Trigger offscreen render and direct visual PDF download for external card button
  const handleDownloadCardVisualPdf = async (template: ReportTemplate) => {
    try {
      setDownloadingCardId(template.id);
      setTemplateToRenderOffscreen(template);

      toast({
        title: "Preparing Visual PDF...",
        description: `Rendering exact layout for "${template.name}"...`
      });

      // Allow DOM to mount offscreen container
      await new Promise(resolve => setTimeout(resolve, 300));

      if (hiddenCardRenderRef.current) {
        const element = hiddenCardRenderRef.current;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 1200
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth - 16;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 8;

        pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 16);

        while (heightLeft > 0) {
          pdf.addPage();
          position = heightLeft - imgHeight + 8;
          pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
          heightLeft -= (pageHeight - 16);
        }

        const totalPages = pdf.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(7);
          pdf.setTextColor(148, 163, 184);
          pdf.text(
            `MarsHRM Report Layout: ${template.name.toUpperCase()} • Page ${i} of ${totalPages} • Exact User Submission Protocol`,
            pageWidth / 2,
            pageHeight - 4,
            { align: "center" }
          );
        }

        const fileName = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_preview_layout.pdf`;
        pdf.save(fileName);

        toast({
          title: "Visual PDF Downloaded",
          description: `Successfully exported exact visual preview for "${template.name}".`
        });
      } else {
        handleDownloadTemplatePdf(template);
      }
    } catch (e: any) {
      console.error("Card PDF visual export failed, falling back to structured PDF:", e);
      handleDownloadTemplatePdf(template);
    } finally {
      setDownloadingCardId(null);
      setTemplateToRenderOffscreen(null);
    }
  };

  // Download Report Template EXACT Visual Layout as PDF
  const handleDownloadVisualPreviewPdf = async (template: ReportTemplate) => {
    if (!previewContentRef.current) {
      handleDownloadTemplatePdf(template);
      return;
    }

    try {
      setIsExportingPdf(true);
      toast({
        title: "Generating Visual PDF...",
        description: "Capturing exact preview layout with all styling, cards, and metrics."
      });

      const element = previewContentRef.current;

      // Capture with high pixel ratio for razor-sharp rendering
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth - 16; // 8mm margin on left and right
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 8; // Top margin

      // Header Banner on first page
      pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 16);

      // Subsequent pages if content overflows
      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight + 8;
        pdf.addImage(imgData, "PNG", 8, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 16);
      }

      // Add clean page numbers and MarsHRM footer on each page
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `MarsHRM Report Layout: ${template.name.toUpperCase()} • Page ${i} of ${totalPages} • Exact User Submission Protocol`,
          pageWidth / 2,
          pageHeight - 4,
          { align: "center" }
        );
      }

      const fileName = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_preview_layout.pdf`;
      pdf.save(fileName);

      toast({
        title: "Visual PDF Downloaded",
        description: `Successfully exported exact visual report layout for "${template.name}".`
      });
    } catch (e: any) {
      console.error("Visual PDF capture failed, falling back to structured PDF:", e);
      handleDownloadTemplatePdf(template);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadTemplatePdf = (template: ReportTemplate) => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Brand Header Banner
      pdf.setFillColor(124, 58, 237); // Primary purple
      pdf.rect(0, 0, pageWidth, 28, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("MARSHRM • OFFICIAL WORKFORCE REPORT SPECIFICATION", 14, 13);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`CATEGORY: ${template.category.toUpperCase()} | STATUS: ${template.isActive ? 'ACTIVE SPECIFICATION' : 'DRAFT'}`, 14, 21);

      // Template Title & Overview
      pdf.setTextColor(30, 41, 59);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(template.name.toUpperCase(), 14, 40);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const descLines = pdf.splitTextToSize(template.description || "Official standard operational report structure.", pageWidth - 28);
      pdf.text(descLines, 14, 48);

      let currentY = 48 + descLines.length * 5 + 4;

      // Summary Metric Box
      const totalFields = template.sections.reduce((acc, s) => acc + s.fields.length, 0);
      autoTable(pdf, {
        startY: currentY,
        head: [["Category", "Total Sections", "Total Input Fields", "GPS Location Stamp", "Generated Date"]],
        body: [[
          template.category,
          String(template.sections.length),
          String(totalFields),
          "System Attached (Check-in / Check-out Coordinates)",
          new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        ]],
        theme: "plain",
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { textColor: [15, 23, 42], fontSize: 8, fontStyle: "bold" },
        margin: { left: 14, right: 14 }
      });

      currentY = (pdf as any).lastAutoTable.finalY + 8;

      // Iterate through sections and output table of fields
      template.sections.forEach((sec, sIdx) => {
        // Check if page needs to break before section
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          currentY = 20;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(109, 40, 217);
        pdf.text(`SECTION ${sIdx + 1}: ${sec.title.toUpperCase()}`, 14, currentY);
        currentY += 4;

        if (sec.description) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(sec.description, 14, currentY);
          currentY += 4;
        }

        const tableBody = sec.fields.map((f, fIdx) => [
          String(fIdx + 1),
          f.name,
          f.type.toUpperCase(),
          f.required ? "REQUIRED" : "OPTIONAL",
          f.options && f.options.length > 0 ? f.options.join(", ") : (f.placeholder || "None specified")
        ]);

        autoTable(pdf, {
          startY: currentY,
          head: [["#", "Field Name", "Type", "Requirement", "Options / Allowed Values"]],
          body: tableBody,
          theme: "striped",
          headStyles: { fillColor: [237, 233, 254], textColor: [109, 40, 217], fontSize: 8, fontStyle: "bold" },
          bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 55, fontStyle: "bold" },
            2: { cellWidth: 25 },
            3: { cellWidth: 25 },
            4: { cellWidth: "auto" }
          },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 8;
      });

      // GPS Coordinates note
      if (currentY > pageHeight - 35) {
        pdf.addPage();
        currentY = 20;
      }
      autoTable(pdf, {
        startY: currentY,
        head: [["System Verified Attendance Coordinates (Automatic)"]],
        body: [[
          "Clock-In & Clock-Out Latitude and Longitude are automatically verified and bound to every submitted report. View-on-Map coordinates ensure compliance with assigned client/office locations."
        ]],
        theme: "plain",
        headStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { textColor: [15, 23, 42], fontSize: 8 },
        margin: { left: 14, right: 14 }
      });

      // Footer
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `MarsHRM Report Specification • Page ${i} of ${totalPages} • Confidential Internal Operational Protocol`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      const fileName = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_specification.pdf`;
      pdf.save(fileName);

      toast({
        title: "Report Template Downloaded",
        description: `Exported "${template.name}" as an official PDF specification.`
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "PDF Export Failed", description: e.message });
    }
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

      {/* Master Switch for HR Full Specification Mode */}
      <Card className="border-none ring-1 ring-primary/20 bg-gradient-to-r from-blue-50/70 via-white to-blue-50/70 rounded-none shadow-sm text-left">
        <CardHeader className="p-6 border-b border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-black uppercase text-blue-950 tracking-wider flex items-center gap-2">
                <Sparkles className="size-4 text-blue-600" /> Comprehensive HR Operations & BDE Governance Mode
              </CardTitle>
              <Badge className={isFullSpecHREnabled ? "bg-emerald-600 text-white rounded-none text-[8px] font-black uppercase px-2" : "bg-slate-200 text-slate-700 rounded-none text-[8px] font-black uppercase px-2"}>
                {isFullSpecHREnabled ? "HR FULL SPEC ACTIVE" : "STANDARD HR MODE"}
              </Badge>
            </div>
            <CardDescription className="text-xs font-medium text-slate-600">
              When enabled, HR team members submit under the full 12-section operational protocol (BDE supervision, call barging, mandatory Feedback PDFs, 12-stage candidate funnel, training, and pending task accountability). If disabled, the classic standard format is preserved without conflicts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {isFullSpecHREnabled ? "Full Spec ON" : "Standard"}
            </span>
            <Switch checked={isFullSpecHREnabled} onCheckedChange={handleToggleFullSpecHR} />
          </div>
        </CardHeader>
      </Card>

      {/* Master Switch for White-Label / Hide FortuMars Branding */}
      <Card className="border-none ring-1 ring-primary/20 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/70 rounded-none shadow-sm text-left">
        <CardHeader className="p-6 border-b border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-black uppercase text-amber-950 tracking-wider flex items-center gap-2">
                <EyeOff className="size-4 text-amber-600" /> System White-Label & Clean Branding Mode
              </CardTitle>
              <Badge className={hideFortuMarsBranding ? "bg-amber-600 text-white rounded-none text-[8px] font-black uppercase px-2" : "bg-slate-200 text-slate-700 rounded-none text-[8px] font-black uppercase px-2"}>
                {hideFortuMarsBranding ? "WHITE-LABEL ACTIVE" : "BRANDING VISIBLE"}
              </Badge>
            </div>
            <CardDescription className="text-xs font-medium text-slate-600">
              When enabled, "Developed by FortuMars" on Login / Forgot Password and the FortuMars watermark in loading screens, footer credits, and OS links are hidden from all user screens.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {hideFortuMarsBranding ? "Branding Hidden" : "Visible"}
            </span>
            <Switch 
              checked={hideFortuMarsBranding} 
              onCheckedChange={async (val) => {
                await setHideFortuMarsBranding(val);
                toast({
                  title: val ? "White-Label Mode Activated" : "FortuMars Branding Restored",
                  description: val 
                    ? "FortuMars credits and watermarks are now hidden across all pages and footers." 
                    : "FortuMars developer branding is now visible."
                });
              }} 
            />
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
                          disabled={downloadingCardId === template.id}
                          onClick={() => handleDownloadCardVisualPdf(template)}
                          className="rounded-none h-8 font-black uppercase text-[9px] tracking-wider border-border hover:bg-primary/5 text-slate-700"
                          title="Download exact visual PDF template preview"
                        >
                          <Download className="size-3 mr-1" /> 
                          {downloadingCardId === template.id ? "Exporting..." : "PDF Spec"}
                        </Button>
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
            {selectedTemplate && (
              <ReportTemplateVisualPreview ref={previewContentRef} template={selectedTemplate} />
            )}
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            {selectedTemplate && (
              <Button 
                variant="outline" 
                disabled={isExportingPdf}
                onClick={() => handleDownloadVisualPreviewPdf(selectedTemplate)}
                className="rounded-none h-11 px-6 font-black uppercase text-[10px] tracking-widest border-primary text-primary hover:bg-primary/5 w-full sm:w-auto shadow-sm"
              >
                <Download className="size-4 mr-2" /> 
                {isExportingPdf ? "Generating PDF..." : "Download Exact Preview (PDF)"}
              </Button>
            )}
            <Button onClick={() => setIsPreviewOpen(false)} className="rounded-none h-11 px-8 font-black uppercase text-[10px] tracking-widest w-full sm:w-auto">
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

      {/* OFFSCREEN CONTAINER FOR INSTANT VISUAL PDF GENERATION FROM CARDS */}
      {templateToRenderOffscreen && (
        <div className="fixed -left-[9999px] top-0 w-[1200px] pointer-events-none opacity-0 z-[-100]">
          <ReportTemplateVisualPreview ref={hiddenCardRenderRef} template={templateToRenderOffscreen} />
        </div>
      )}
    </div>
  );
}
