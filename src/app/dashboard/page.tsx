
'use client';

import * as React from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { TodoWidget } from "@/components/geohrm/todo-widget";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { MissionHeatmapWidget } from "@/components/geohrm/mission-heatmap-widget";
import { ProfileBentoCard } from "@/components/geohrm/profile-bento-card";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";
import { 
  AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  Line
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Users, Briefcase, Zap, 
  ArrowUpRight, ArrowDownRight, Bell, Calendar,
  Target, MousePointer2, 
  BarChart3, LayoutGrid, CheckCircle2, AlertCircle, Clock, Plus,
  PhoneCall, ShieldCheck, ChevronRight, FileText, Settings, UserPlus, Building2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- DATA DEFINITIONS ---
const kpiData = [
  { name: 'Total Revenue', value: '₹18.45L', trend: '+22.4%', up: true, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', sparkline: [30, 45, 35, 50, 48, 65, 55] },
  { name: 'Net Profit', value: '₹4.32L', trend: '+18.7%', up: true, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', sparkline: [20, 30, 25, 40, 38, 45, 42] },
  { name: 'New Leads', value: '142', trend: '+31.5%', up: true, icon: MousePointer2, color: 'text-blue-600', bg: 'bg-blue-50', sparkline: [40, 35, 55, 60, 58, 80, 75] },
  { name: 'Active Projects', value: '24', trend: '+9.1%', up: true, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50', sparkline: [15, 18, 17, 22, 21, 25, 24] },
  { name: 'Team Utilization', value: '84%', trend: '+6.3%', up: true, icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', sparkline: [75, 78, 80, 82, 81, 84, 84] },
];

const revenueTrend = [
  { name: 'Mon', revenue: 2.0, lastWeek: 1.8 },
  { name: 'Tue', revenue: 3.3, lastWeek: 2.1 },
  { name: 'Wed', revenue: 3.6, lastWeek: 2.5 },
  { name: 'Thu', revenue: 3.0, lastWeek: 1.9 },
  { name: 'Fri', revenue: 3.6, lastWeek: 2.2 },
  { name: 'Sat', revenue: 4.5, lastWeek: 3.0 },
  { name: 'Sun', revenue: 3.45, lastWeek: 1.58 },
];

const businessUnits = [
  { name: 'IT Products', value: 7.25, percentage: 39, color: '#6D28D9' },
  { name: 'Software Dev', value: 5.10, percentage: 28, color: '#3B82F6' },
  { name: 'Digital Marketing', value: 3.65, percentage: 20, color: '#F59E0B' },
  { name: 'IT Training', value: 2.45, percentage: 13, color: '#22C55E' },
];

const projectHealth = [
  { name: 'On Track', value: 18, percentage: 75, color: '#22C55E' },
  { name: 'At Risk', value: 4, percentage: 17, color: '#F59E0B' },
  { name: 'Delayed', value: 2, percentage: 8, color: '#EF4444' },
];

const salesFunnel = [
  { name: 'New Leads', value: 142, color: 'bg-purple-500' },
  { name: 'Qualified', value: 57, color: 'bg-blue-500' },
  { name: 'Proposal Sent', value: 24, color: 'bg-orange-500' },
  { name: 'Negotiation', value: 12, color: 'bg-amber-500' },
  { name: 'Won', value: 7, color: 'bg-emerald-500' },
];

const alerts = [
  { title: 'Project Delay', desc: '2 projects delayed', time: '20m ago', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
  { title: 'Revenue Below Target', desc: 'Weekly target: ₹20L', time: '1h ago', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
  { title: 'Client Escalation', desc: 'High priority ticket', time: '2h ago', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  { title: 'Payment Pending', desc: '3 invoices overdue', time: '3h ago', icon: DollarSign, color: 'text-orange-600', bg: 'bg-orange-50' },
  { title: 'New Lead Received', desc: 'Project from ABC Corp', time: '4h ago', icon: MousePointer2, color: 'text-blue-600', bg: 'bg-blue-50' },
];

const recentActivities = [
  { time: '30m ago', text: 'New project "Mobile App Development" created by John Doe', icon: Plus, color: 'text-primary' },
  { time: '1h ago', text: 'Payment of ₹2,45,000 received from ABC Corp by Finance Team', icon: DollarSign, color: 'text-green-600' },
  { time: '2h ago', text: 'New employee Sarah Johnson joined Digital Marketing Team', icon: Users, color: 'text-blue-600' },
  { time: '3h ago', text: 'Facebook Ads campaign "Summer Offer" launched by Marketing Team', icon: Zap, color: 'text-amber-600' },
];

const topClients = [
  { name: 'ABC Corporation', value: 3.25, max: 4 },
  { name: 'TechNova Solutions', value: 2.75, max: 4 },
  { name: 'Global Retail Ltd.', value: 2.10, max: 4 },
  { name: 'EduSmart Technologies', value: 1.85, max: 4 },
  { name: 'Future Labs', value: 1.60, max: 4 },
];

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  
  const userRole = currentUserData?.role;
  const isExecutive = userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  if (!isExecutive) {
    return (
      <div className="space-y-6 max-w-full mx-auto pb-10 font-jakarta">
        <div className="flex flex-col gap-0.5 mb-6 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tighter leading-none text-primary uppercase">
                {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}, {currentUserData?.firstName || 'Strategist'}
            </h1>
        </div>
        <DashboardReminder />
        <div className="w-full animate-fade-in-up">
            <ProfileBentoCard />
        </div>
        <div className="w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <AttendanceWidget />
        </div>
        <div className="w-full animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <MissionHeatmapWidget />
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <ActionItemsWidget />
          <TodoWidget />
          <WorkHoursSummaryWidget />
        </div>
      </div>
    );
  }

  // --- ENTERPRISE EXECUTIVE DASHBOARD ---
  return (
    <div className="min-h-screen space-y-8 pb-20 font-jakarta bg-[#F8FAFC]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-1 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
            Good Morning, {currentUserData?.firstName || 'Executive'} 👋
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Founder & CEO, Cognithorz</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-white rounded-none ring-1 ring-slate-200 p-1 shadow-sm h-12">
            <Button variant="ghost" size="sm" className="h-10 rounded-none px-6 text-[11px] font-black uppercase text-slate-500">2 Jun – 8 Jun 2025</Button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button variant="ghost" size="sm" className="h-10 rounded-none px-6 text-[11px] font-black uppercase bg-slate-50 text-slate-900 shadow-inner">This Week</Button>
          </div>
          <Button variant="outline" size="icon" className="rounded-none h-12 w-12 relative bg-white border-slate-200 hover:border-primary transition-colors">
            <Bell className="size-6 text-slate-600" />
            <span className="absolute top-3 right-3 size-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          </Button>
        </div>
      </div>

      {/* Row 0: Attendance Protocol (Kept for all tiers) */}
      <div className="w-full animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <AttendanceWidget />
      </div>

      {/* Row 1: KPI Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {kpiData.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm rounded-none bg-white group hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-none shadow-sm", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div className={cn("flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-none", kpi.up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {kpi.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {kpi.trend}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{kpi.name}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">vs LW</span>
                </div>
              </div>
              <div className="h-10 w-full opacity-60 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.sparkline.map((v, idx) => ({ v, idx }))}>
                    <Area type="monotone" dataKey="v" stroke={kpi.up ? '#22C55E' : '#EF4444'} fill={kpi.up ? '#22C55E15' : '#EF444415'} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Visual Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        {/* Revenue Trend */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
          <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue Trend (This Week)</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-tight">Financial velocity audit</CardDescription>
            </div>
            <div className="flex gap-6">
               <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-primary" /><span className="text-[10px] font-black uppercase text-slate-600">Current</span></div>
               <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-slate-200" /><span className="text-[10px] font-black uppercase text-slate-400">Previous</span></div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6D28D9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-black uppercase fill-slate-400" tickMargin={15} />
                  <YAxis axisLine={false} tickLine={false} className="text-[10px] font-black fill-slate-400" tickFormatter={(v) => `₹${v}L`} />
                  <Tooltip 
                      contentStyle={{ borderRadius: '0px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: '900' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6D28D9" strokeWidth={4} fill="url(#colorRev)" dot={{ r: 5, fill: '#6D28D9', strokeWidth: 3, stroke: '#FFF' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="lastWeek" stroke="#E2E8F0" strokeWidth={3} strokeDasharray="6 6" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 p-6 bg-slate-50 rounded-none flex items-center justify-between ring-1 ring-slate-100">
                <div className="flex gap-10">
                    <div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">This Week</p><p className="text-lg font-black text-slate-900">₹18.45L</p></div>
                    <div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Week</p><p className="text-lg font-black text-slate-900">₹15.08L</p></div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] uppercase px-4 h-8">+22.4% Growth</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by BU */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue by BU</CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-8">
            <div className="relative size-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={businessUnits} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                        {businessUnits.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black tracking-tighter">₹18.45L</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aggregate</span>
                </div>
            </div>
            <div className="w-full space-y-3">
              {businessUnits.map((unit, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase">
                  <div className="flex items-center gap-3"><div className="size-2 rounded-full" style={{ backgroundColor: unit.color }} /> <span className="text-slate-600">{unit.name}</span></div>
                  <span className="text-slate-900">₹{unit.value.toFixed(2)}L <span className="text-slate-400 ml-1">({unit.percentage}%)</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Health & Alerts */}
        <div className="flex flex-col gap-6">
            <Card className="flex-1 border-none shadow-sm rounded-none bg-white p-6 flex flex-col justify-center">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-6">Mission Health</CardTitle>
                <div className="flex items-center gap-6">
                    <div className="relative size-24 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={projectHealth} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke="none">
                                    {projectHealth.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-sm font-black">24</span>
                        </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                        {projectHealth.map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-[9px] font-black uppercase">
                                <span className="text-slate-400">{h.name}</span>
                                <span className="text-slate-900">{h.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <Button variant="link" className="h-8 p-0 text-[10px] font-black uppercase text-primary mt-4 self-end group" asChild><Link href="/dashboard/projects">View Projects <ChevronRight className="size-3 ml-1 group-hover:translate-x-1 transition-transform"/></Link></Button>
            </Card>

            <Card className="flex-[1.5] border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-800">Critical Signals</CardTitle>
                    <Badge className="bg-rose-500 text-white border-none text-[10px] font-black h-5 px-2.5 shadow-lg shadow-rose-500/20">{alerts.length}</Badge>
                </div>
                <ScrollArea className="flex-1 max-h-[160px]">
                    <div className="p-3 space-y-2">
                        {alerts.map((alert, i) => (
                            <div key={i} className="p-3 rounded-none bg-slate-50 border border-slate-100 flex items-start gap-4 group hover:bg-white hover:border-slate-200 hover:shadow-md transition-all cursor-pointer">
                                <div className={cn("p-2 rounded-none shrink-0 shadow-sm", alert.bg, alert.color)}><alert.icon className="size-4"/></div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase text-slate-800 truncate">{alert.title}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">{alert.desc}</p>
                                </div>
                                <span className="text-[8px] font-black text-slate-300 uppercase shrink-0 mt-1">{alert.time}</span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-3 pt-0">
                    <Button variant="ghost" className="w-full h-9 text-[10px] font-black uppercase text-slate-400 hover:text-primary transition-colors">Audit All Signals</Button>
                </div>
            </Card>
        </div>
      </div>

      {/* Row 3: Tactical Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        {/* Sales Funnel */}
        <Card className="border-none shadow-sm rounded-none bg-white p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Sales Funnel</CardTitle>
            <div className="text-right"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Conversion</p><p className="text-lg font-black text-primary">12.28%</p></div>
          </div>
          <div className="flex-1 flex flex-col gap-3 justify-center">
             {salesFunnel.map((f, i) => (
               <div key={i} className="flex items-center gap-4">
                 <div className="w-32 text-[10px] font-black uppercase text-slate-400 truncate">{f.name}</div>
                 <div 
                   className={cn("h-7 rounded-none border-r-4 border-black/10 transition-all duration-1000 flex items-center px-4 shadow-sm", f.color)} 
                   style={{ width: `${(f.value / salesFunnel[0].value) * 100}%`, opacity: 1 - (i * 0.1) }}
                 >
                    <span className="text-xs font-black text-white">{f.value}</span>
                 </div>
               </div>
             ))}
          </div>
        </Card>

        {/* Marketing Performance */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Marketing ROI</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 grid grid-cols-2 gap-4">
                {[
                    { l: 'Visitors', v: '8,245', t: '+18.6%', up: true },
                    { l: 'Leads', v: '142', t: '+31.5%', up: true },
                    { l: 'Ad Spend', v: '₹92,000', t: '+4.2%', up: false },
                    { l: 'CPL', v: '₹64.79', t: '+5.3%', up: false },
                    { l: 'ROI', v: '4.35x', t: '+16.8%', up: true },
                    { l: 'Efficiency', v: '94%', t: 'Verified', up: true }
                ].map((s, i) => (
                    <div key={i} className="p-4 rounded-none bg-slate-50 border border-slate-100 flex flex-col justify-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">{s.l}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-800 tracking-tight">{s.v}</span>
                            <span className={cn("text-[9px] font-black", s.up ? "text-emerald-600" : "text-rose-600")}>{s.t}</span>
                        </div>
                    </div>
                ))}
            </CardContent>
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100">
                <Button variant="link" className="h-6 p-0 text-[10px] font-black uppercase text-primary w-full justify-center group" asChild><Link href="/dashboard/marketing">Marketing Intelligence Hub <ChevronRight className="size-3 ml-1 group-hover:translate-x-1 transition-transform"/></Link></Button>
            </div>
        </Card>

        {/* Team Overview */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Fleet Deployment</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
                <div className="flex justify-between items-center bg-primary/5 p-6 rounded-none ring-1 ring-primary/10">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Staff</p><div className="flex items-center gap-3 mt-1"><p className="text-4xl font-black text-primary tracking-tighter">84</p><Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-black shadow-sm">+2</Badge></div></div>
                    <div className="text-right"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance</p><p className="text-2xl font-black text-slate-800 mt-1">71 <span className="text-sm text-slate-400 font-bold ml-1">(84%)</span></p></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { l: 'Attrition', v: '1.2%', c: 'text-rose-600' },
                        { l: 'New Joins', v: '2', c: 'text-emerald-600' },
                        { l: 'Openings', v: '6', c: 'text-sky-600' }
                    ].map((m, i) => (
                        <div key={i} className="text-center p-4 rounded-none border border-slate-100 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">{m.l}</p>
                            <p className={cn("text-sm font-black", m.c)}>{m.v}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100">
                <Button variant="link" className="h-6 p-0 text-[10px] font-black uppercase text-primary w-full justify-center group" asChild><Link href="/dashboard/users">People Analytics Portal <ChevronRight className="size-3 ml-1 group-hover:translate-x-1 transition-transform"/></Link></Button>
            </div>
        </Card>

        {/* Weekly Goals */}
        <Card className="border-none shadow-sm rounded-none bg-white p-8 flex flex-col gap-6">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Mission Benchmarks</CardTitle>
          <div className="flex-1 flex flex-col gap-6 justify-center">
            {[
              { l: 'Revenue', v: 92, val: '₹18.45L / ₹20L', c: 'bg-primary' },
              { l: 'New Clients', v: 60, val: '3 / 5', c: 'bg-emerald-500' },
              { l: 'Delivery', v: 75, val: '75% / 90%', c: 'bg-sky-500' },
              { l: 'Lead Target', v: 95, val: '142 / 150', c: 'bg-amber-500' }
            ].map((g, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>{g.l}</span><span className="text-slate-900">{g.val}</span></div>
                <div className="flex items-center gap-4">
                    <Progress value={g.v} className="h-2 rounded-none bg-slate-100 flex-1" indicatorClassName={g.c} />
                    <span className="text-[10px] font-black text-slate-900 w-8">{g.v}%</span>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="h-12 w-full rounded-none text-[10px] font-black uppercase border-slate-200 shadow-sm tracking-widest">Audit All Targets</Button>
        </Card>
      </div>

      {/* Row 4: Financial & Tactical */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        {/* Financial Snapshot */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-50"><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Financial Ledger</CardTitle></div>
            <CardContent className="p-6 grid grid-cols-2 gap-4">
                {[
                    { l: 'Revenue', v: '₹18.45L', t: '+22.4%', c: 'text-emerald-600' },
                    { l: 'Expenses', v: '₹12.13L', t: '+7.8%', c: 'text-rose-600' },
                    { l: 'Net Profit', v: '₹4.32L', t: '+18.7%', c: 'text-emerald-600' },
                    { l: 'Margin', v: '23.4%', t: '+2.1pp', c: 'text-emerald-600' }
                ].map((s, i) => (
                    <div key={i} className="p-4 rounded-none bg-slate-50 border border-slate-100 shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">{s.l}</p>
                        <div className="flex flex-col"><span className="text-sm font-black text-slate-900 tracking-tight">{s.v}</span><span className={cn("text-[9px] font-black mt-1", s.c)}>{s.t}</span></div>
                    </div>
                ))}
            </CardContent>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100"><Button variant="link" className="h-6 p-0 text-[10px] font-black uppercase text-primary w-full group" asChild><Link href="/dashboard/finance">Finance Intelligence Portal <ChevronRight className="size-3 ml-1 group-hover:translate-x-1 transition-transform"/></Link></Button></div>
        </Card>

        {/* Top Clients */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-50"><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Principal Contributors</CardTitle></div>
            <ScrollArea className="h-[280px]">
                <div className="p-6 space-y-6">
                    {topClients.map((client, i) => (
                        <div key={i} className="space-y-2.5">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-600 truncate max-w-[150px]">{client.name}</span>
                                <span className="text-slate-900">₹{client.value.toFixed(2)}L</span>
                            </div>
                            <Progress value={(client.value / client.max) * 100} className="h-2 rounded-none bg-slate-100" indicatorClassName="bg-primary" />
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Card>

        {/* Recent Activities */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-50"><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Operational Log</CardTitle></div>
            <ScrollArea className="h-[280px]">
                <div className="p-6 space-y-8">
                    {recentActivities.map((act, i) => (
                        <div key={i} className="flex gap-4 items-start relative">
                            {i < recentActivities.length - 1 && <div className="absolute left-2.5 top-6 bottom-[-32px] w-[2px] bg-slate-100" />}
                            <div className={cn("size-5 rounded-none flex items-center justify-center shrink-0 z-10 bg-white ring-4 ring-slate-50 shadow-sm")}>
                                <act.icon className={cn("size-3", act.color)} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black text-slate-700 leading-tight line-clamp-2 uppercase tracking-tight">{act.text}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{act.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
           {[
             { l: 'New Project', i: Plus, c: 'bg-purple-600' },
             { l: 'Acquire Lead', i: MousePointer2, c: 'bg-blue-600' },
             { l: 'Add Staff', i: UserPlus, c: 'bg-emerald-600' },
             { l: 'Audit Report', i: FileText, c: 'bg-orange-600' },
             { l: 'Deep Dive', i: BarChart3, c: 'bg-sky-600' },
             { l: 'Terminal', i: Settings, c: 'bg-slate-800' }
           ].map((btn, i) => (
             <Button key={i} variant="outline" className="h-full rounded-none border-none ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex flex-col gap-3 p-4 shadow-sm group active:scale-95 transition-all">
               <div className={cn("p-2.5 rounded-none text-white group-hover:scale-110 transition-transform shadow-md", btn.c)}><btn.i className="size-5" /></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 leading-none">{btn.l}</span>
             </Button>
           ))}
        </div>
      </div>
    </div>
  );
}
