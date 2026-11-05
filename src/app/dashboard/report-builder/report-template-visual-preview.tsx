"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  FileText, Activity, DollarSign, PhoneCall, Clock, Briefcase, 
  Users, CheckCircle2, FileSpreadsheet, MapPin, LocateFixed, Navigation, ExternalLink
} from "lucide-react";
import type { ReportTemplate } from "./page";

export const ReportTemplateVisualPreview = React.forwardRef<HTMLDivElement, { template: ReportTemplate }>(
  ({ template }, ref) => {
    return (
      <div 
        ref={ref} 
        className="space-y-6 max-w-3xl mx-auto text-left p-6 bg-white rounded-none border border-slate-200/80 shadow-sm font-jakarta"
      >
        {/* BRAND HEADER FOR VISUAL EXPORT */}
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="text-base font-black uppercase tracking-tight text-primary">
                DAILY REPORT: {template?.name}
              </h2>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              EXACT USER-SIDE SUBMISSION LAYOUT • {template?.category}
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
        {template?.id === "business-full-spec-template" ? (
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

                <div className="p-4 border bg-white space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-black uppercase text-slate-900">Principal - ABC Polytechnic College</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-900 border">Deal: ₹75,000 • Quotation Sent</span>
                  </div>
                  <p className="text-xs text-slate-700 font-bold">Contact: Dr. Ramanathan (+91 98401 23456) • Stage: Commercial Evaluation</p>
                  <p className="text-[10px] text-primary font-black uppercase">Next Action: Follow up on MoU approval this Thursday 2:00 PM</p>
                </div>

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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-primary/30 text-primary font-black text-[9px] uppercase tracking-wider">
                      Sample Format Attached
                    </span>
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
        ) : template?.id === "hr-full-spec-template" ? (
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
          </div>
        ) : template?.category === "Business" ? (
          <div className="space-y-6">
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
          </div>
        ) : (
          <div className="space-y-6">
            {template?.sections.map((sec, sIdx) => (
              <Card key={sec.id} className="bg-gradient-to-br from-primary/5 to-transparent border ring-1 ring-border/50 shadow-sm rounded-none overflow-hidden text-left">
                <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                  <CardTitle className="text-[10px] font-black flex items-center gap-2 text-primary uppercase tracking-widest">
                    <span>{sIdx + 1}️⃣</span> {sec.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {sec.fields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-[9px] uppercase font-black text-muted-foreground">{field.name}</Label>
                      {field.type === "textarea" ? (
                        <div className="min-h-[70px] border bg-muted/10 p-3 text-xs font-bold text-muted-foreground">
                          {field.placeholder || "Enter details..."}
                        </div>
                      ) : field.type === "select" ? (
                        <div className="h-10 border bg-muted/10 flex items-center px-3 text-xs font-bold text-muted-foreground uppercase">
                          {field.options?.[0] || "Select Option"}
                        </div>
                      ) : (
                        <Input placeholder={field.placeholder || "Value..."} disabled className="h-10 rounded-none bg-muted/10 text-xs font-bold" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* GPS COORDINATES SECTION */}
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
                  <p className="font-mono text-[9px] font-bold text-slate-600">
                    10.77091, 76.09277
                  </p>
                </div>

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
    );
  }
);

ReportTemplateVisualPreview.displayName = "ReportTemplateVisualPreview";

