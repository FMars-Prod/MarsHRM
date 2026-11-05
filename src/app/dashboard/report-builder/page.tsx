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
  const previewContentRef = React.useRef<HTMLDivElement>(null);

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
                          onClick={() => handleDownloadTemplatePdf(template)}
                          className="rounded-none h-8 font-black uppercase text-[9px] tracking-wider border-border hover:bg-primary/5 text-slate-700"
                          title="Download official PDF template specification to share"
                        >
                          <Download className="size-3 mr-1" /> PDF Spec
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
            <div ref={previewContentRef} className="space-y-6 max-w-3xl mx-auto text-left p-6 bg-white rounded-none border border-slate-200/80 shadow-sm">
              
              {/* BRAND HEADER FOR VISUAL EXPORT */}
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    <h2 className="text-base font-black uppercase tracking-tight text-primary">
                      DAILY REPORT: {selectedTemplate?.name}
                    </h2>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                    EXACT USER-SIDE SUBMISSION LAYOUT • {selectedTemplate?.category}
                  </p>
                </div>
                <Badge className="bg-primary text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-none border-none">
                  OFFICIAL PROTOCOL
                </Badge>
              </div>

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
              {selectedTemplate?.id === "business-full-spec-template" ? (
                <div className="space-y-6">
                  {/* 1. OUTREACH & CONVERSION */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Activity className="size-4" /> 1️⃣ OUTREACH & CONVERSION ANALYTICS
                        </span>
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Daily Target: 90 Cold Calls
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
                        <div className="md:col-span-8 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[9px] uppercase font-black text-muted-foreground">COLD CALLS (TARGET: 90)</Label>
                              <div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">90</div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] uppercase font-black text-muted-foreground">LINKEDIN OUTREACH</Label>
                              <div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">15</div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] uppercase font-black text-muted-foreground">EMAILS SENT</Label>
                              <div className="h-11 border bg-white flex items-center px-3 font-bold text-sm">20</div>
                            </div>
                          </div>

                          {/* Target Gauge Indicator */}
                          <div className="p-4 bg-purple-50/60 border border-purple-200 flex items-center justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase text-purple-900 tracking-wider">Fixed Minimum Target Protocol</p>
                              <p className="text-xs font-black text-purple-950 uppercase mt-0.5">Target Met: 90 / 90 Calls Achieved</p>
                            </div>
                            <Badge className="bg-emerald-600 text-white font-mono text-[9px] font-black uppercase rounded-none px-2 py-0.5">
                              0 Calls Pending
                            </Badge>
                          </div>

                          <div className="flex gap-4">
                            <div className="flex-1 p-5 bg-primary/5 ring-1 ring-primary/20 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">TOTAL OUTREACH</p>
                              <span className="text-3xl font-black text-primary">125</span>
                            </div>
                            <div className="w-1/3 p-5 bg-white ring-1 ring-border/50 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">FOLLOW-UPS TODAY</p>
                              <span className="text-2xl font-black text-slate-800">12</span>
                            </div>
                          </div>

                          {/* Follow-up clients breakdown */}
                          <div className="space-y-1.5 pt-2">
                            <Label className="text-[9px] uppercase font-black text-muted-foreground">FOLLOW-UP CLIENTS BREAKDOWN</Label>
                            <div className="p-3 border bg-white text-xs font-mono text-slate-700 space-y-1">
                              <p className="font-bold">• Apex Engineering College - Final Quotation review (Rs. 1,20,000)</p>
                              <p className="font-bold">• Zenith Institute of Tech - Demo scheduled tomorrow 11:30 AM</p>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-4">
                          <Card className="bg-white border ring-2 ring-primary/20 rounded-none overflow-hidden h-full flex flex-col justify-between">
                            <div className="p-3 bg-primary text-white text-center text-[10px] font-black uppercase tracking-widest">
                              CONVERSION EFFICIENCY
                            </div>
                            <CardContent className="p-5 space-y-4 text-center">
                              <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase text-muted-foreground">POTENTIAL CLIENTS IDENTIFIED</span>
                                <div className="text-3xl font-black text-slate-900 border py-2">8</div>
                              </div>
                              <div className="text-center pt-2 border-t">
                                <p className="text-[8px] font-black uppercase text-muted-foreground">EFFICIENCY RATE</p>
                                <p className="text-3xl font-black text-primary">8.9%</p>
                                <p className="text-[8px] text-muted-foreground font-bold uppercase mt-1">(Potentials / Calls)</p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. REVENUE & FINANCIAL IMPACT */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <DollarSign className="size-4" /> 2️⃣ REVENUE & FINANCIAL IMPACT
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[8px] font-black uppercase rounded-none">
                          Target Variance Tracked
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 border bg-white space-y-1">
                          <Label className="text-[8px] uppercase font-black text-muted-foreground">REVENUE COLLECTED TODAY (₹)</Label>
                          <div className="text-lg font-black text-emerald-600">₹45,000</div>
                        </div>
                        <div className="p-3 border bg-white space-y-1">
                          <Label className="text-[8px] uppercase font-black text-muted-foreground">COMMITTED PIPELINE (₹)</Label>
                          <div className="text-lg font-black text-primary">₹1,50,000</div>
                        </div>
                        <div className="p-3 border bg-white space-y-1">
                          <Label className="text-[8px] uppercase font-black text-muted-foreground">PIPELINE BUSINESS VALUE (₹)</Label>
                          <div className="text-lg font-black text-slate-900">₹3,80,000</div>
                        </div>
                        <div className="p-3 border bg-emerald-50/50 border-emerald-200 space-y-1">
                          <Label className="text-[8px] uppercase font-black text-emerald-900">REVENUE TARGET VARIANCE (₹)</Label>
                          <div className="text-lg font-black text-emerald-700">+₹5,000 (Met)</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. HIGH-VALUE CLIENT ENGAGEMENTS */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Briefcase className="size-4" /> 3️⃣ HIGH-VALUE ENGAGEMENTS & CLIENT LOG
                        </span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Detailed Prospect Matrix
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5 text-left">
                      {/* Counter strip */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 border bg-white text-center">
                          <p className="text-[8px] uppercase font-black text-muted-foreground">MEETINGS CONDUCTED</p>
                          <p className="text-xl font-black text-primary mt-0.5">3</p>
                        </div>
                        <div className="p-3 border bg-white text-center">
                          <p className="text-[8px] uppercase font-black text-muted-foreground">QUOTATIONS SHARED</p>
                          <p className="text-xl font-black text-primary mt-0.5">2</p>
                        </div>
                        <div className="p-3 border bg-white text-center">
                          <p className="text-[8px] uppercase font-black text-muted-foreground">INVOICES SHARED</p>
                          <p className="text-xl font-black text-primary mt-0.5">1</p>
                        </div>
                      </div>

                      {/* Client repeater demo */}
                      <div className="p-4 border bg-white space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-black uppercase text-slate-900">Principal - ABC Polytechnic College</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-900 border">Deal: ₹75,000 • Quotation Sent</span>
                        </div>
                        <p className="text-xs text-slate-700 font-bold">Contact: Dr. Ramanathan (+91 98401 23456) • Stage: Commercial Evaluation</p>
                        <p className="text-[10px] text-primary font-black uppercase">Next Action: Follow up on MoU approval this Thursday 2:00 PM</p>
                      </div>

                      {/* Win & Learning */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 border bg-emerald-50/40 border-emerald-200 space-y-1">
                          <Label className="text-[8px] uppercase font-black text-emerald-900">🏆 CLIENT WIN / HIGH CONVERSION HIGHLIGHT</Label>
                          <p className="text-xs font-bold text-emerald-950">Closed ₹45,000 annual training package with 60 students upfront batch enrollment.</p>
                        </div>
                        <div className="p-3 border bg-blue-50/40 border-blue-200 space-y-1">
                          <Label className="text-[8px] uppercase font-black text-blue-900">💡 STRATEGIC LEARNING & OBJECTION RESOLVED</Label>
                          <p className="text-xs font-bold text-blue-950">Clients respond 40% faster when WhatsApp brochure link is sent during call.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4. PIPELINE IMPACT & T+1 PLANNING */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4" /> 4️⃣ PIPELINE IMPACT & T+1 ACTION PLAN
                        </span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Next-Day Readiness
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-black text-muted-foreground">TOMORROW'S CONFIRMED MEETINGS</Label>
                          <div className="p-3 border bg-white text-xs font-mono text-slate-700 space-y-1">
                            <p className="font-bold">1. 10:30 AM - St. Xavier Tech [ONLINE - Google Meet]</p>
                            <p className="font-bold">2. 02:30 PM - TechPark Corp HR [ONSITE Visit]</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-black text-muted-foreground">CRITICAL PATH & DELIVERABLES</Label>
                          <div className="p-3 border bg-white text-xs font-bold text-slate-700 min-h-[72px] flex items-center">
                            Dispatch revised commercial proposals to 3 pipeline clients by 12:00 PM.
                          </div>
                        </div>
                      </div>

                      {/* Blockers & Intervention */}
                      <div className="p-4 border bg-rose-50/30 border-rose-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[9px] uppercase font-black text-rose-900">PIPELINE BLOCKERS & RESOLUTION</Label>
                          <Badge className="bg-rose-100 text-rose-800 text-[7px] font-black uppercase rounded-none border-rose-300">Revenue Blocked: ₹1,20,000</Badge>
                        </div>
                        <p className="text-xs font-bold text-rose-950">Awaiting custom syllabus PDF from Academic TL before Dean signs agreement.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 5. SUPPORTING DOCUMENTATION & EXCEL SHEET */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <PhoneCall className="size-4" /> 5️⃣ AUDIT AUDIO & PROSPECT EXCEL UPLOAD
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[8px] font-black uppercase rounded-none">
                          Client Data Ingest
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5 text-left">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground">GOOGLE DRIVE AUDIT RECORDINGS FOLDER</Label>
                        <div className="h-11 border bg-white flex items-center px-3 text-xs text-muted-foreground font-mono">
                          https://drive.google.com/drive/folders/bde-daily-recordings-...
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-black text-muted-foreground">BEST CALL AUDIO RECORDING</Label>
                          <div className="h-11 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">
                            Audio File Attached (best_call_dean.mp3)
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-black text-muted-foreground">WORST CALL AUDIO RECORDING</Label>
                          <div className="h-11 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">
                            Audio File Attached (call_objection_review.mp3)
                          </div>
                        </div>
                      </div>

                      {/* Excel leads uploader preview */}
                      <div className="p-4 border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-black uppercase text-primary flex items-center gap-2">
                              <FileSpreadsheet className="size-4" /> Potential Clients Leads Sheet (.xlsx, .csv)
                            </p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">
                              Upload the day's scraped / contacted leads matching standardized schema
                            </p>
                          </div>
                          <a
                            href="/templates/potential_clients_sample.csv"
                            download="potential_clients_sample.csv"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary/30 text-primary font-black text-[9px] uppercase tracking-wider hover:bg-primary/10 transition-colors shadow-sm"
                          >
                            <Download className="size-3" /> Download Sample Format
                          </a>
                        </div>
                        <div className="p-3 bg-white border border-primary/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="size-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-800 font-mono">Potential_Clients_Leads_Template.xlsx</span>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded-none border-none">
                            Verified Format (15 Columns)
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : selectedTemplate?.category === "Business" ? (
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
              ) : selectedTemplate?.id === "hr-full-spec-template" ? (
                <div className="space-y-6">
                  {/* 1. DAILY TASK MANAGEMENT */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="size-4" /> 1️⃣ DAILY TASK MANAGEMENT & EXECUTION
                        </span>
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Multi-Task Tracking
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="p-4 border bg-white space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-black uppercase text-slate-900">Conduct BDE Login Strategy & Daily Target Alignment</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-900 border">Priority: High • Status: Completed</span>
                        </div>
                        <p className="text-xs text-slate-700 font-bold">Assigned By: Management • Outcome: Sourced 15 new candidate leads & aligned 90-call targets.</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. RECRUITMENT & CANDIDATE FUNNEL */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Users className="size-4" /> 2️⃣ RECRUITMENT & CANDIDATE FUNNEL (12 STAGES)
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[8px] font-black uppercase rounded-none">
                          Pipeline Health
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Resumes Sourced</p><p className="text-xl font-black text-primary mt-0.5">35</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Connected Calls</p><p className="text-xl font-black text-primary mt-0.5">24</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Follow-up Calls</p><p className="text-xl font-black text-primary mt-0.5">18</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Screenings Done</p><p className="text-xl font-black text-primary mt-0.5">12</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">1st Round Scheduled</p><p className="text-xl font-black text-primary mt-0.5">6</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">1st Round Selected</p><p className="text-xl font-black text-emerald-600 mt-0.5">4</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Final Round Scheduled</p><p className="text-xl font-black text-primary mt-0.5">3</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Final Round Selected</p><p className="text-xl font-black text-emerald-600 mt-0.5">2</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Documentation Completed</p><p className="text-xl font-black text-slate-900 mt-0.5">2</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Candidates Onboarded</p><p className="text-xl font-black text-indigo-600 mt-0.5">1</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Successfully Joined</p><p className="text-xl font-black text-emerald-600 mt-0.5">1</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Awaiting Joining</p><p className="text-xl font-black text-amber-600 mt-0.5">1</p></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. BDE TEAM GOVERNANCE & CALL MONITORING */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <PhoneCall className="size-4" /> 3️⃣ BDE TEAM MANAGEMENT & CALL MONITORING
                        </span>
                        <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[8px] font-black uppercase rounded-none">
                          Mandatory PDF Upload
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">BDEs Handled</p><p className="text-xl font-black text-primary mt-0.5">5</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Login Meetings</p><p className="text-xl font-black text-primary mt-0.5">1</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Day-End Meetings</p><p className="text-xl font-black text-primary mt-0.5">1</p></div>
                        <div className="p-3 border bg-white text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Queries Resolved</p><p className="text-xl font-black text-emerald-600 mt-0.5">4</p></div>
                      </div>

                      {/* Monitored employee review card */}
                      <div className="p-4 border bg-white space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-black uppercase text-slate-900">BDE Executive: Business Executive 1</span>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded-none">Feedback Provided: Yes</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                          <p>Recorded Calls Reviewed: 6</p>
                          <p>Live Calls Barged: 3</p>
                        </div>
                        <p className="text-xs text-slate-600"><strong>Observations:</strong> Good pitch cadence; handled pricing objection smoothly.</p>
                        <div className="pt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-rose-600" />
                            <span className="text-xs font-mono font-bold text-slate-800">BDE_Feedback_Report_BDE1.pdf</span>
                          </div>
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[7px] font-black uppercase rounded-none px-2 py-0.5">PDF Attached & Verified</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4. TRAINING & OPERATIONS */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Briefcase className="size-4" /> 4️⃣ TRAINING, HR OPERATIONS & CAMPUS OUTREACH
                        </span>
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Operations Matrix
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border bg-white space-y-1">
                          <span className="text-[9px] font-black uppercase text-primary">Training Program</span>
                          <p className="text-xs font-bold text-slate-900">Product & Process Training • 1 Session Conducted (8 Attendees)</p>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[7px] font-black uppercase rounded-none">Status: Completed</Badge>
                        </div>
                        <div className="p-4 border bg-white space-y-1">
                          <span className="text-[9px] font-black uppercase text-primary">HR Documentation Ops</span>
                          <p className="text-xs font-bold text-slate-900">3 Offer Letters Released • 15 Attendance Records Verified</p>
                          <Badge className="bg-blue-100 text-blue-800 text-[7px] font-black uppercase rounded-none">All Records Updated</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 5. ACCOUNTABILITY & ESCALATIONS */}
                  <Card className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                    <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                      <CardTitle className="text-[10px] font-black flex items-center justify-between text-primary uppercase tracking-widest">
                        <span className="flex items-center gap-2">
                          <Clock className="size-4" /> 5️⃣ ACCOUNTABILITY, PENDING RESPONSIBILITIES & ESCALATIONS
                        </span>
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black uppercase rounded-none">
                          Audited
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-left">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 border bg-emerald-50/50 border-emerald-200 text-center"><p className="text-[8px] font-black text-emerald-900 uppercase">9:05 AM Login Sync</p><p className="text-xs font-black text-emerald-700 mt-1">✓ Attended</p></div>
                        <div className="p-3 border bg-emerald-50/50 border-emerald-200 text-center"><p className="text-[8px] font-black text-emerald-900 uppercase">11:00 AM Update</p><p className="text-xs font-black text-emerald-700 mt-1">✓ Submitted</p></div>
                        <div className="p-3 border bg-emerald-50/50 border-emerald-200 text-center"><p className="text-[8px] font-black text-emerald-900 uppercase">12:55 PM Pre-Lunch</p><p className="text-xs font-black text-emerald-700 mt-1">✓ Submitted</p></div>
                      </div>
                      <div className="p-4 border bg-blue-50/30 border-blue-200 space-y-1">
                        <p className="text-[9px] font-black uppercase text-blue-900">Challenges / Escalations Status</p>
                        <p className="text-xs font-bold text-blue-950">No critical blockers. Sourcing velocity on track for campus drive next week.</p>
                      </div>
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
    </div>
  );
}
