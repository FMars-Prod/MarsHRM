
'use client';

import * as React from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, orderBy, Timestamp, getDocs, limit } from "firebase/firestore";
import { AttendanceWidget } from "@/components/geohrm/attendance-widget";
import { ActionItemsWidget } from "@/components/geohrm/action-items-widget";
import { TodoWidget } from "@/components/geohrm/todo-widget";
import { WorkHoursSummaryWidget } from "@/components/geohrm/work-hours-summary-widget";
import { MissionHeatmapWidget } from "@/components/geohrm/mission-heatmap-widget";
import { ProfileBentoCard } from "@/components/geohrm/profile-bento-card";
import { DashboardReminder } from "@/components/geohrm/dashboard-reminder";
import { DailyMonitorWidget } from "@/components/geohrm/daily-monitor-widget";
import { AnnouncementsWidget } from "@/components/geohrm/announcements-widget";
import { EventsWidget } from "@/components/geohrm/events-widget";
import { 
  AreaChart, Area, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LineChart, Line, BarChart, Bar, Legend, Funnel, FunnelChart, LabelList
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Users, Briefcase, Zap, 
  ArrowUpRight, ArrowDownRight, Bell, Calendar,
  Target, MousePointer2, 
  BarChart3, LayoutGrid, CheckCircle2, AlertCircle, Clock, Plus,
  PhoneCall, ShieldCheck, ChevronRight, FileText, Settings, UserPlus, Building2, Filter,
  Megaphone, PartyPopper, Info, History, ArrowRight, Share2, MoreHorizontal,
  TrendingDown,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, subWeeks, startOfMonth, endOfMonth, subMonths, isToday, isBefore, isSameDay } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

// --- MOCK DATA FOR SPECIFIC REQUIREMENTS ---
const revenueTrendData = [
  { name: 'Mon', value: 200000 },
  { name: 'Tue', value: 330000 },
  { name: 'Wed', value: 360000 },
  { name: 'Thu', value: 300000 },
  { name: 'Fri', value: 360000 },
  { name: 'Sat', value: 430000 },
  { name: 'Sun', value: 345000 },
];

const revenueBUData = [
  { name: 'IT Products', value: 725000, color: '#6D28D9' },
  { name: 'Software Dev', value: 510000, color: '#3B82F6' },
  { name: 'Digital Marketing', value: 365000, color: '#F43F5E' },
  { name: 'IT Training', value: 245000, color: '#10B981' },
];

const projectHealthData = [
  { name: 'On Track', value: 18, color: '#10B981' },
  { name: 'At Risk', value: 4, color: '#F59E0B' },
  { name: 'Delayed', value: 2, color: '#EF4444' },
];

const salesFunnelData = [
  { value: 142, name: 'New Leads', fill: '#6D28D9' },
  { value: 57, name: 'Qualified', fill: '#3B82F6' },
  { value: 24, name: 'Proposal Sent', fill: '#8B5CF6' },
  { value: 12, name: 'Negotiation', fill: '#F43F5E' },
  { value: 7, name: 'Won', fill: '#10B981' },
];

const topClientsData = [
  { name: 'ABC Corp', value: 325000 },
  { name: 'TechNova', value: 275000 },
  { name: 'Global Retail', value: 210000 },
  { name: 'EduSmart', value: 185000 },
  { name: 'Future Labs', value: 160000 },
];

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = React.useState<string>("this-week");
  const [customStartDate, setCustomStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  
  const userRole = currentUserData?.role;
  const isExecutive = userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'HR Manager';
  const isCEO = userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  if (!isExecutive) {
    return (
      <div className="space-y-6 max-w-full mx-auto pb-10 font-jakarta">
        <div className="flex flex-col gap-0.5 mb-6 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tighter leading-none text-primary uppercase">
                {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}, {currentUserData?.firstName || 'Strategist'}
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">{currentUserData?.jobTitle || 'Fleet Member'}</p>
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

  return (
    <div className="min-h-screen space-y-6 pb-20 font-jakarta bg-gradient-to-br from-primary/5 via-[#F8FAFC] to-indigo-500/5 px-4 md:px-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-8 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
            Good Morning, {currentUserData?.firstName || 'Executive'} 👋
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{currentUserData?.jobTitle || 'Executive Portal'}</p>
        </div>
        
        <div className="flex flex-wrap items-center bg-white rounded-none ring-1 ring-slate-200 p-1 shadow-sm h-auto md:h-12 min-h-12">
            <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px] h-10 border-none ring-0 focus:ring-0 rounded-none bg-transparent font-black uppercase text-[10px] tracking-widest text-slate-500">
                    <div className="flex items-center gap-2">
                        <Filter className="size-3 opacity-50" />
                        <SelectValue placeholder="Tactical Range" />
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-none">
                    <SelectGroup>
                        <SelectLabel className="text-[9px] font-black uppercase opacity-40">Tactical Range</SelectLabel>
                        <SelectItem value="today" className="text-xs font-bold uppercase">Today</SelectItem>
                        <SelectItem value="yesterday" className="text-xs font-bold uppercase">Yesterday</SelectItem>
                        <SelectItem value="this-week" className="text-xs font-bold uppercase">This Week</SelectItem>
                        <SelectItem value="prev-week" className="text-xs font-bold uppercase">Prev Week</SelectItem>
                        <SelectItem value="this-month" className="text-xs font-bold uppercase">This Month</SelectItem>
                        <SelectItem value="prev-month" className="text-xs font-bold uppercase">Prev Month</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block" />
            <div className="px-4 text-[10px] font-black uppercase text-slate-900 truncate">
                {dateFilter.replace('-', ' ')}
            </div>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-fade-in-up">
        <KPICard title="Total Revenue" value="₹18.45L" trend="↑ 22.4%" color="text-primary" bg="bg-primary/5" sparkline={[30, 45, 35, 50, 48, 65, 55]} />
        <KPICard title="Net Profit" value="₹4.32L" trend="↑ 18.7%" color="text-emerald-600" bg="bg-emerald-50" sparkline={[40, 35, 55, 45, 60, 58, 65]} />
        <KPICard title="New Leads" value="142" trend="↑ 31.5%" color="text-blue-600" bg="bg-blue-50" sparkline={[20, 30, 25, 40, 38, 50, 45]} />
        <KPICard title="Active Projects" value="24" trend="↑ 9.1%" color="text-amber-600" bg="bg-amber-50" sparkline={[15, 18, 17, 22, 21, 25, 24]} />
        <KPICard title="Team Utilization" value="84%" trend="↑ 6.3%" color="text-indigo-600" bg="bg-indigo-50" sparkline={[75, 78, 80, 82, 81, 84, 84]} />
      </div>

      {/* ATTENDANCE PROTOCOL (EXEMPT FOR CEO) */}
      {!isCEO && (
        <div className="animate-fade-in-up">
          <AttendanceWidget />
        </div>
      )}

      {/* OPERATIONAL HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
        <div className="lg:col-span-12">
            <DailyMonitorWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
        {/* REVENUE TREND */}
        <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white overflow-hidden">
          <CardHeader className="p-6 border-b flex flex-row items-center justify-between bg-muted/5">
            <div className="space-y-1">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue Trend (This Week)</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-40">Financial velocity audit</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-primary">₹18.45L</p>
              <p className="text-[8px] font-bold text-emerald-600 uppercase">↑ 22.4% Growth</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrendData}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-black uppercase fill-slate-400" />
                  <YAxis axisLine={false} tickLine={false} className="text-[9px] font-bold" tickFormatter={(v) => `₹${v/100000}L`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '1px solid #eee', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: '900' }}
                    formatter={(v) => [`₹${(Number(v)/100000).toFixed(2)}L`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-muted/20 border flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span>This Week: ₹18.45L</span>
              <span className="opacity-40">Last Week: ₹15.08L</span>
            </div>
          </CardContent>
        </Card>

        {/* ALERTS & PRIORITIES */}
        <Card className="lg:col-span-4 border-none shadow-sm rounded-none bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-6 border-b flex flex-row items-center justify-between bg-rose-50/30">
            <div className="space-y-1">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-rose-700">Alerts & Priorities</CardTitle>
            </div>
            <Badge className="bg-rose-500 text-white rounded-none font-black text-[9px] px-2 h-5">5</Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[350px]">
              <div className="divide-y">
                {[
                  { t: 'Project Delay', d: '2 projects delayed', time: '20m ago', icon: Briefcase, color: 'text-rose-600' },
                  { t: 'Revenue Below Target', d: 'Weekly target: ₹20L', time: '1h ago', icon: TrendingUp, color: 'text-amber-600' },
                  { t: 'Client Escalation', d: 'High priority ticket', time: '2h ago', icon: AlertCircle, color: 'text-red-600' },
                  { t: 'Payment Pending', d: '3 invoices overdue', time: '3h ago', icon: DollarSign, color: 'text-rose-600' },
                  { t: 'New Lead Received', d: 'Potential project from ABC Corp', time: '4h ago', icon: MousePointer2, color: 'text-sky-600' },
                ].map((alert, i) => (
                  <div key={i} className="p-4 hover:bg-muted/10 transition-all flex items-start gap-4">
                    <div className={cn("p-2 rounded-none bg-muted/20", alert.color)}>
                      <alert.icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="font-black text-xs uppercase tracking-tight truncate">{alert.t}</p>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">{alert.time}</span>
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{alert.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-muted/5">
            <Button variant="ghost" className="w-full rounded-none h-9 text-[9px] font-black uppercase text-muted-foreground hover:text-primary" asChild>
              <Link href="/dashboard/issues">View All Alerts →</Link>
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        {/* REVENUE BY BUSINESS UNIT */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue by BU</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center">
            <div className="size-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenueBUData} innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                    {revenueBUData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black">₹18.45L</span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase">Total</span>
              </div>
            </div>
            <div className="w-full mt-6 space-y-3">
              {revenueBUData.map((bu, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase">
                  <div className="flex items-center gap-2"><div className="size-2 rounded-none" style={{ backgroundColor: bu.color }} /> <span className="text-slate-600">{bu.name}</span></div>
                  <span className="text-slate-900">₹{(bu.value/100000).toFixed(2)}L</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* PROJECT HEALTH */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Project Health</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center">
            <div className="size-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectHealthData} innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                    {projectHealthData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className="text-xl font-black">24</span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase">Total Projects</span>
              </div>
            </div>
            <div className="w-full mt-6 space-y-3">
              {projectHealthData.map((status, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase">
                  <div className="flex items-center gap-2"><div className="size-2 rounded-none" style={{ backgroundColor: status.color }} /> <span className="text-slate-600">{status.name}</span></div>
                  <span className="text-slate-900">{status.value} Units</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 rounded-none h-9 text-[9px] font-black uppercase text-primary" asChild>
              <Link href="/dashboard/projects">View All Projects →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* SALES FUNNEL */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={salesFunnelData} isAnimationActive>
                    <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" fontSize={10} fontWeight={900} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-none text-center">
              <p className="text-[10px] font-black uppercase text-emerald-700">Conversion Rate: 12.28%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        <AnnouncementsWidget />
        <EventsWidget />
        <ActionItemsWidget />
      </div>

      {/* STRATEGIC SNAPSOT ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        {/* MARKETING PERFORMANCE */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Marketing Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <MarketingMetric label="Website Visitors" val="8,245" trend="+18.6%" up color="text-indigo-600" />
              <MarketingMetric label="Leads Generated" val="142" trend="+31.5%" up color="text-blue-600" />
              <MarketingMetric label="Ad Spend" val="₹92,000" trend="-4.2%" up={false} color="text-rose-600" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 border text-center">
                <p className="text-[8px] font-black uppercase text-muted-foreground mb-1">Cost per Lead</p>
                <p className="text-lg font-black">₹64.79</p>
              </div>
              <div className="p-4 bg-muted/20 border text-center">
                <p className="text-[8px] font-black uppercase text-muted-foreground mb-1">ROI</p>
                <p className="text-lg font-black">4.35x</p>
              </div>
            </div>
            <Button variant="outline" className="w-full rounded-none h-10 text-[9px] font-black uppercase text-muted-foreground hover:text-primary" asChild>
              <Link href="/dashboard/marketing">View Marketing Dashboard →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* TEAM OVERVIEW */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Team Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 border bg-muted/10 text-center"><p className="text-[8px] font-black text-muted-foreground uppercase">Total</p><p className="text-xl font-black">84</p></div>
              <div className="p-4 border bg-emerald-50 text-center"><p className="text-[8px] font-black text-emerald-600 uppercase">Present</p><p className="text-xl font-black text-emerald-700">71</p></div>
              <div className="p-4 border bg-amber-50 text-center"><p className="text-[8px] font-black text-amber-600 uppercase">Leave</p><p className="text-xl font-black text-amber-700">7</p></div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-muted-foreground">Attrition (MTD)</span><Badge variant="outline" className="text-rose-600 border-rose-100 rounded-none text-[9px] font-black">1 (1.2%)</Badge></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-muted-foreground">New Joiners</span><span className="text-sm font-black text-emerald-600">+2</span></div>
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-muted-foreground">Open Positions</span><span className="text-sm font-black text-primary">6</span></div>
            </div>
            <Button variant="outline" className="w-full rounded-none h-10 text-[9px] font-black uppercase text-muted-foreground hover:text-primary" asChild>
              <Link href="/dashboard/analytics">View People Analytics →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* WEEKLY GOALS PROGRESS */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Weekly Goals Progress</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <GoalProgress label="Revenue Target" target="₹20L" current="₹18.45L" percent={92} color="bg-primary" />
            <GoalProgress label="New Clients" target="5" current="3" percent={60} color="bg-blue-600" />
            <GoalProgress label="Project Delivery" target="90%" current="75%" percent={75} color="bg-emerald-600" />
            <GoalProgress label="Leads Target" target="150" current="142" percent={95} color="bg-purple-600" />
            <Button variant="outline" className="w-full rounded-none h-10 text-[9px] font-black uppercase text-muted-foreground hover:text-primary">
              View All Goals →
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        <TodoWidget />
        <WorkHoursSummaryWidget />
        <MissionHeatmapWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        {/* FINANCIAL SNAPSHOT */}
        <Card className="border-none shadow-sm rounded-none bg-slate-900 text-white">
          <CardHeader className="p-6 border-b border-white/10">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Financial Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <div className="grid grid-cols-2 gap-x-8 gap-y-10">
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-white/40">Total Revenue</p><p className="text-2xl font-black">₹18.45L</p><p className="text-[8px] font-black text-emerald-400">↑ 22.4%</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-white/40">Total Expenses</p><p className="text-2xl font-black">₹12.13L</p><p className="text-[8px] font-black text-rose-400">↑ 7.8%</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-white/40">Net Profit</p><p className="text-2xl font-black text-emerald-400">₹4.32L</p><p className="text-[8px] font-black text-emerald-400">↑ 18.7%</p></div>
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-white/40">Profit Margin</p><p className="text-2xl font-black text-primary">23.4%</p><p className="text-[8px] font-black text-primary">↑ 2.1pp</p></div>
            </div>
            <Button className="w-full rounded-none h-11 bg-white text-slate-900 font-black uppercase text-[9px] tracking-widest hover:bg-white/90" asChild>
              <Link href="/dashboard/finance">View Finance Dashboard →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* TOP CLIENTS BY REVENUE */}
        <Card className="border-none shadow-sm rounded-none bg-white">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Top Clients</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientsData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-[9px] font-black uppercase" width={100} />
                  <Tooltip formatter={(v) => `₹${Number(v)/100000}L`} />
                  <Bar dataKey="value" fill="#6D28D9" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Button variant="ghost" className="w-full mt-4 rounded-none h-9 text-[9px] font-black uppercase text-primary" asChild>
              <Link href="/dashboard/clients">View All Clients →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* RECENT ACTIVITIES */}
        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col">
          <CardHeader className="p-6 border-b bg-muted/5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[280px]">
              <div className="divide-y">
                {[
                  { t: 'Project "Mobile App" created', b: 'by John Doe', time: '30m ago', icon: Briefcase },
                  { t: 'Payment of ₹2.45L received', b: 'by Finance Team', time: '1h ago', icon: DollarSign },
                  { t: 'New member Sarah joined', b: 'Digital Marketing', time: '2h ago', icon: UserPlus },
                  { t: 'Facebook Ads campaign launched', b: 'by Marketing Team', time: '3h ago', icon: Zap },
                ].map((act, i) => (
                  <div key={i} className="p-4 flex items-start gap-4">
                    <div className="p-2 rounded-none bg-muted/20 text-slate-500"><act.icon className="size-4" /></div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-tight">{act.t}</p>
                      <div className="flex justify-between items-center"><p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">{act.b}</p><span className="text-[8px] font-bold text-muted-foreground opacity-30">{act.time}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-muted/5">
            <Button variant="ghost" className="w-full rounded-none h-9 text-[9px] font-black uppercase text-muted-foreground hover:text-primary">
              View All Activities →
            </Button>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS */}
      <Card className="border-none shadow-xl rounded-none bg-white overflow-hidden animate-fade-in-up">
        <CardHeader className="p-6 border-b bg-primary/5">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ActionButton icon={Briefcase} label="Create Project" href="/dashboard/projects" />
            <ActionButton icon={MousePointer2} label="Add New Lead" href="/dashboard/clients" />
            <ActionButton icon={UserPlus} label="Add Employee" href="/dashboard/users" />
            <ActionButton icon={FileText} label="Generate Report" href="/dashboard/reports" />
            <ActionButton icon={BarChart3} label="View Analytics" href="/dashboard/analytics" />
            <ActionButton icon={Settings} label="System Settings" href="/dashboard/settings" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, trend, color, bg, sparkline }: any) {
  return (
    <Card className="border-none shadow-sm rounded-none bg-white group hover:shadow-xl transition-all p-6 space-y-4 ring-1 ring-border/50">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <div className={cn("px-2 py-0.5 rounded-none text-[8px] font-black uppercase", bg, color)}>{trend}</div>
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-black tracking-tighter">{value}</h3>
        <p className="text-[8px] font-bold text-muted-foreground uppercase opacity-40">vs Last Week</p>
      </div>
      <div className="h-8 w-full opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline.map((v: number, i: number) => ({ v, i }))}>
            <Area type="monotone" dataKey="v" stroke={color.includes('rose') ? '#EF4444' : '#6D28D9'} fill={color.includes('rose') ? '#EF444410' : '#6D28D910'} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function MarketingMetric({ label, val, trend, up, color }: any) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">{label}</p><p className="text-lg font-black">{val}</p></div>
      <Badge variant="outline" className={cn("rounded-none border-none text-[9px] font-black", up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
        {up ? <ArrowUpRight className="size-3 mr-1" /> : <ArrowDownRight className="size-3 mr-1" />} {trend}
      </Badge>
    </div>
  );
}

function GoalProgress({ label, target, current, percent, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end"><p className="text-[10px] font-black uppercase">{label}</p><span className="text-[10px] font-black text-primary">{percent}%</span></div>
      <Progress value={percent} className="h-2 rounded-none bg-muted/30" indicatorClassName={color} />
      <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase"><span>Current: {current}</span><span>Target: {target}</span></div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
  return (
    <Button asChild variant="outline" className="h-20 rounded-none border-dashed border-2 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/40 group transition-all">
      <Link href={href}>
        <Icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </Link>
    </Button>
  );
}
