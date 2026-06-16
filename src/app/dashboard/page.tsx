
'use client';

import * as React from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { TodoWidget } from "@/components/geohrm/todo-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { MissionHeatmapWidget } from "@/components/geohrm/mission-heatmap-widget";
import { ProfileBentoCard } from "@/components/geohrm/profile-bento-card";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LabelList, ComposedChart 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Users, Briefcase, Zap, 
  ArrowUpRight, ArrowDownRight, Bell, Calendar,
  MoreVertical, Target, MousePointer2, PieChart as PieChartIcon,
  BarChart3, LayoutGrid, CheckCircle2, AlertCircle, Clock, Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- MOCK DATA FOR EXECUTIVE DASHBOARD ---
const kpiData = [
  { name: 'Revenue', value: '₹18.45L', trend: '+22.4%', up: true, sparkline: [40, 30, 45, 50, 48, 60, 55] },
  { name: 'Net Profit', value: '₹4.32L', trend: '+18.7%', up: true, sparkline: [20, 25, 22, 30, 35, 32, 40] },
  { name: 'New Leads', value: '142', trend: '+31.5%', up: true, sparkline: [50, 40, 60, 70, 65, 80, 75] },
  { name: 'Active Projects', value: '24', trend: '+9.1%', up: true, sparkline: [15, 18, 17, 20, 22, 21, 24] },
  { name: 'Team Utilization', value: '84%', trend: '-6.3%', up: false, sparkline: [88, 90, 85, 82, 80, 84, 83] },
];

const revenueTrend = [
  { name: 'Mon', revenue: 2000, lastWeek: 1800 },
  { name: 'Tue', revenue: 2400, lastWeek: 2100 },
  { name: 'Wed', revenue: 1800, lastWeek: 2500 },
  { name: 'Thu', revenue: 2200, lastWeek: 1900 },
  { name: 'Fri', revenue: 3000, lastWeek: 2200 },
  { name: 'Sat', revenue: 4500, lastWeek: 3000 },
  { name: 'Sun', revenue: 3800, lastWeek: 3500 },
];

const businessUnits = [
  { name: 'IT Products', value: 39, color: '#6D28D9' },
  { name: 'Software Dev', value: 28, color: '#8B5CF6' },
  { name: 'Digital Marketing', value: 20, color: '#A78BFA' },
  { name: 'IT Training', value: 13, color: '#C4B5FD' },
];

const projectHealth = [
  { name: 'On Track', value: 75, color: '#22C55E' },
  { name: 'At Risk', value: 17, color: '#F59E0B' },
  { name: 'Delayed', value: 8, color: '#EF4444' },
];

const salesFunnel = [
  { name: 'New Leads', value: 142 },
  { name: 'Qualified', value: 57 },
  { name: 'Proposal Sent', value: 24 },
  { name: 'Negotiation', value: 12 },
  { name: 'Won', value: 7 },
];

const marketingStats = [
  { label: 'Visitors', value: '8,245', trend: '+18.6%' },
  { label: 'Leads', value: '142', trend: '+31.5%' },
  { label: 'Ad Spend', value: '₹92,000', trend: '+4.2%' },
  { label: 'ROI', value: '4.35x', trend: '+16.8%' },
  { label: 'CPL', value: '₹64.79', trend: '-5.3%' },
];

const recentActivities = [
  { time: '20m ago', text: 'Project "Mobile App" created by John Doe', icon: Plus, color: 'text-primary' },
  { time: '1h ago', text: '₹2.45L received from ABC Corp', icon: DollarSign, color: 'text-green-600' },
  { time: '2h ago', text: 'New employee Sarah Johnson joined', icon: Users, color: 'text-blue-600' },
  { time: '3h ago', text: 'Marketing campaign "Summer Offer" launched', icon: Zap, color: 'text-amber-600' },
];

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const currentUserDocRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc(currentUserDocRef);
  
  const userRole = (currentUserData as any)?.role;
  const isAdmin = userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  if (!isAdmin) {
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

  // --- MODERN ADMIN DASHBOARD (CEO/MD) ---
  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4 overflow-hidden font-jakarta bg-[#F8FAFC]">
      {/* Top Header Section */}
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-2">
            Good Morning, {(currentUserData as any)?.firstName || 'CEO'} 👋
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Leadership Terminal</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-xl ring-1 ring-slate-200 p-1 shadow-sm">
            <Button variant="ghost" size="sm" className="h-8 rounded-lg px-4 text-[10px] font-black uppercase">This Week</Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg px-4 text-[10px] font-black uppercase bg-slate-50 text-slate-900 shadow-inner">{format(new Date(), 'PP')}</Button>
          </div>
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 relative">
            <Bell className="size-5 text-slate-600" />
            <span className="absolute top-2 right-2 size-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </Button>
          <div className="flex items-center gap-3 ml-2 pl-3 border-l border-slate-200">
             <div className="text-right">
               <p className="text-xs font-black uppercase tracking-tight text-slate-900">{(currentUserData as any)?.firstName} {(currentUserData as any)?.lastName}</p>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{(currentUserData as any)?.role}</p>
             </div>
             <Avatar className="h-10 w-10 ring-2 ring-white shadow-md">
                <AvatarImage src={(currentUserData as any)?.avatar} className="object-cover" />
                <AvatarFallback className="font-black text-xs">{(currentUserData as any)?.firstName?.[0]}</AvatarFallback>
             </Avatar>
          </div>
        </div>
      </div>

      {/* Row 1: KPI Grid */}
      <div className="grid grid-cols-5 gap-4 shrink-0">
        {kpiData.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm rounded-2xl bg-white group hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-primary/5 text-primary">
                  {i === 0 ? <DollarSign className="size-4" /> : i === 1 ? <TrendingUp className="size-4" /> : i === 2 ? <MousePointer2 className="size-4" /> : i === 3 ? <Briefcase className="size-4" /> : <Zap className="size-4" />}
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full", kpi.up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {kpi.up ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                  {kpi.trend}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.name}</p>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter">{kpi.value}</h3>
              </div>
              <div className="h-8 w-full mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpi.sparkline.map((v, idx) => ({ v, idx }))}>
                    <Area type="monotone" dataKey="v" stroke={kpi.up ? '#22C55E' : '#EF4444'} fill={kpi.up ? '#22C55E20' : '#EF444420'} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Charts Grid */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        <Card className="col-span-2 border-none shadow-sm rounded-2xl bg-white flex flex-col overflow-hidden">
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between shrink-0">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Revenue Trend</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-60">Weekly performance vs last week</CardDescription>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-primary" /><span className="text-[10px] font-black uppercase">Current</span></div>
               <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-slate-200" /><span className="text-[10px] font-black uppercase text-slate-400">Previous</span></div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6D28D9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[9px] font-black uppercase fill-slate-400" />
                <YAxis axisLine={false} tickLine={false} className="text-[9px] font-black fill-slate-400" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#6D28D9" strokeWidth={3} fill="url(#colorRev)" />
                <Line type="monotone" dataKey="lastWeek" stroke="#E2E8F0" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white flex flex-col overflow-hidden">
          <CardHeader className="p-4 pb-0 shrink-0">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Revenue by Unit</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={businessUnits} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {businessUnits.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full mt-4 space-y-2">
              {businessUnits.map((unit, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase">
                  <div className="flex items-center gap-2"><div className="size-2 rounded-full" style={{ backgroundColor: unit.color }} /> {unit.name}</div>
                  <span className="text-slate-500">{unit.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white flex flex-col overflow-hidden">
          <CardHeader className="p-4 pb-0 shrink-0">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Project Health</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 flex flex-col items-center justify-center">
            <div className="relative size-32 mb-4">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={projectHealth} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" stroke="none">
                     {projectHealth.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-xl font-black">24</span>
                 <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Projects</span>
               </div>
            </div>
            <div className="w-full space-y-2">
              {projectHealth.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: h.color }} />
                    <span className="text-[9px] font-black uppercase text-slate-700">{h.name}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-900">{h.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Funnel & Performance */}
      <div className="grid grid-cols-12 gap-4 shrink-0 h-48">
        <Card className="col-span-3 border-none shadow-sm rounded-2xl bg-white p-4 flex flex-col gap-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 shrink-0">Sales Funnel</CardTitle>
          <div className="flex-1 flex flex-col gap-1 justify-center">
             {salesFunnel.map((f, i) => (
               <div key={i} className="flex items-center gap-3">
                 <div 
                   className="h-6 rounded-lg bg-primary/20 border-r-4 border-primary transition-all duration-1000" 
                   style={{ width: `${(f.value / salesFunnel[0].value) * 100}%`, opacity: 1 - (i * 0.15) }}
                 />
                 <span className="text-[9px] font-black uppercase text-slate-500 whitespace-nowrap">{f.name}: {f.value}</span>
               </div>
             ))}
          </div>
        </Card>

        <Card className="col-span-3 border-none shadow-sm rounded-2xl bg-white p-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4">Marketing Pulse</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {marketingStats.slice(0, 4).map((s, i) => (
              <div key={i} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-black text-slate-800">{s.value}</span>
                  <span className={cn("text-[7px] font-black", s.trend.startsWith('+') ? "text-emerald-600" : "text-rose-600")}>{s.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-3 border-none shadow-sm rounded-2xl bg-white p-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4">Team Overview</CardTitle>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div><p className="text-xl font-black text-slate-900">84</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total Staff</p></div>
              <div className="text-right"><p className="text-xl font-black text-emerald-600">71</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Present</p></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-slate-500">Utilization Target</span><span className="text-primary">84% / 90%</span></div>
              <Progress value={84} className="h-1.5 rounded-full bg-slate-100" />
            </div>
          </div>
        </Card>

        <Card className="col-span-3 border-none shadow-sm rounded-2xl bg-white p-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4">Goals Progress</CardTitle>
          <div className="space-y-3">
            {[
              { l: 'Revenue', v: 92, c: 'bg-primary' },
              { l: 'Clients', v: 60, c: 'bg-emerald-500' },
              { l: 'Delivery', v: 75, c: 'bg-sky-500' },
              { l: 'Leads', v: 95, c: 'bg-amber-500' }
            ].map((g, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[7px] font-black uppercase text-slate-400"><span>{g.l}</span><span>{g.v}%</span></div>
                <Progress value={g.v} className="h-1 rounded-full bg-slate-50" indicatorClassName={g.c} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 4: Snapshots & Actions */}
      <div className="grid grid-cols-4 gap-4 shrink-0 h-40">
        <Card className="border-none shadow-sm rounded-2xl bg-white p-4 overflow-hidden">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">Financial Snapshot</CardTitle>
          <div className="space-y-2">
            <div className="p-2 rounded-xl bg-emerald-50 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase text-emerald-700">Income</span>
              <span className="text-xs font-black text-emerald-900">₹18.45L</span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase text-rose-700">Expense</span>
              <span className="text-xs font-black text-rose-900">₹12.13L</span>
            </div>
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">Top Clients</CardTitle>
          <div className="space-y-2">
            {['ABC Corp', 'TechNova', 'Global Retail'].map((c, i) => (
               <div key={i} className="flex items-center justify-between text-[9px] font-bold">
                 <span className="uppercase tracking-tight text-slate-600">{c}</span>
                 <span className="font-black text-slate-900">₹{3.25 - (i * 0.5)}L</span>
               </div>
            ))}
          </div>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white p-4 overflow-hidden">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800 mb-3">Activity Feed</CardTitle>
          <ScrollArea className="h-24">
            <div className="space-y-3">
              {recentActivities.map((act, i) => (
                <div key={i} className="flex gap-2">
                  <div className={cn("p-1 rounded-md bg-slate-50", act.color)}><act.icon className="size-2.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-bold text-slate-800 truncate">{act.text}</p>
                    <p className="text-[7px] font-black text-slate-400 uppercase">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <div className="grid grid-cols-2 gap-2">
           {[
             { l: 'New Project', i: Plus, c: 'bg-primary' },
             { l: 'Add Lead', i: MousePointer2, c: 'bg-emerald-500' },
             { l: 'Add Staff', i: Users, c: 'bg-sky-500' },
             { l: 'Report', i: BarChart3, c: 'bg-amber-500' }
           ].map((btn, i) => (
             <Button key={i} variant="outline" className="h-full rounded-2xl border-none ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex flex-col gap-1 p-2 shadow-sm">
               <div className={cn("p-1.5 rounded-lg text-white", btn.c)}><btn.i className="size-3" /></div>
               <span className="text-[8px] font-black uppercase tracking-widest">{btn.l}</span>
             </Button>
           ))}
        </div>
      </div>
    </div>
  );
}
