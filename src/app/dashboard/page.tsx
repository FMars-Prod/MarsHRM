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
import { MonthlyReviewBanner } from "@/components/geohrm/monthly-review-banner";
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

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = React.useState<string>("this-week");

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  
  const userRole = currentUserData?.role;
  const isExecutive = userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'HR Manager';
  const isCEO = userRole === 'CEO/Admin' || userRole === 'CEO/MD';

  if (!isExecutive) {
    return (
      <div className="space-y-3 max-w-full mx-auto pb-4 font-jakarta">
        <MonthlyReviewBanner />
        <div className="flex flex-col gap-0.5 mb-1 animate-fade-in-up">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter leading-none text-primary uppercase">
                {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}, {currentUserData?.firstName || 'Strategist'}
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{currentUserData?.jobTitle || 'Fleet Member'}</p>
        </div>
        <DashboardReminder />
        <div className="w-full animate-fade-in-up">
            <ProfileBentoCard />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="lg:col-span-4">
                <Card className="h-full border-none shadow-sm rounded-none bg-white overflow-hidden">
                    <CardHeader className="p-4 pb-2 border-b bg-muted/5">
                        <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Clock className="size-3.5" /> Shift Control
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <AttendanceWidget />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-8">
                <DailyMonitorWidget />
            </div>
        </div>

        <div className="w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <MissionHeatmapWidget />
        </div>
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <ActionItemsWidget />
          <TodoWidget />
          <WorkHoursSummaryWidget />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-3 pb-6 font-jakarta bg-gradient-to-br from-primary/5 via-[#F8FAFC] to-indigo-500/5 px-2 md:px-4">
      <MonthlyReviewBanner />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 animate-fade-in-up">
        <div className="space-y-0.5">
          <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">
            Good Morning, {currentUserData?.firstName || 'Executive'} 👋
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentUserData?.jobTitle || 'Executive Portal'}</p>
        </div>
        
        <div className="flex flex-wrap items-center bg-white rounded-none ring-1 ring-slate-200 p-0.5 shadow-sm h-8">
            <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[120px] h-7 border-none ring-0 focus:ring-0 rounded-none bg-transparent font-black uppercase text-[8px] tracking-widest text-slate-500">
                    <div className="flex items-center gap-1">
                        <Filter className="size-2.5 opacity-50" />
                        <SelectValue placeholder="Range" />
                    </div>
                </SelectTrigger>
                <SelectContent className="rounded-none">
                    <SelectGroup>
                        <SelectLabel className="text-[8px] font-black uppercase opacity-40">Tactical Range</SelectLabel>
                        <SelectItem value="today" className="text-[10px] font-bold uppercase">Today</SelectItem>
                        <SelectItem value="yesterday" className="text-[10px] font-bold uppercase">Yesterday</SelectItem>
                        <SelectItem value="this-week" className="text-[10px] font-bold uppercase">This Week</SelectItem>
                        <SelectItem value="prev-week" className="text-[10px] font-bold uppercase">Prev Week</SelectItem>
                        <SelectItem value="this-month" className="text-[10px] font-bold uppercase">This Month</SelectItem>
                        <SelectItem value="prev-month" className="text-[10px] font-bold uppercase">Prev Month</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <div className="w-px h-3 bg-slate-200 mx-1 hidden md:block" />
            <div className="px-2 text-[8px] font-black uppercase text-slate-900 truncate">
                {dateFilter.replace('-', ' ')}
            </div>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 animate-fade-in-up">
        <KPICard title="Revenue" value="₹18.45L" trend="↑ 22.4%" color="text-primary" bg="bg-primary/5" sparkline={[30, 45, 35, 50, 48, 65, 55]} />
        <KPICard title="Net Profit" value="₹4.32L" trend="↑ 18.7%" color="text-emerald-600" bg="bg-emerald-50" sparkline={[40, 35, 55, 45, 60, 58, 65]} />
        <KPICard title="New Leads" value="142" trend="↑ 31.5%" color="text-blue-600" bg="bg-blue-50" sparkline={[20, 30, 25, 40, 38, 50, 45]} />
        <KPICard title="Projects" value="24" trend="↑ 9.1%" color="text-amber-600" bg="bg-amber-50" sparkline={[15, 18, 17, 22, 21, 25, 24]} />
        <KPICard title="Utilization" value="84%" trend="↑ 6.3%" color="text-indigo-600" bg="bg-indigo-50" sparkline={[75, 78, 80, 82, 81, 84, 84]} />
      </div>

      {/* OPERATIONAL HUB - PARALLEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up">
        <div className="lg:col-span-4">
            <Card className="h-full border-none shadow-sm rounded-none bg-white overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b bg-muted/5">
                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Clock className="size-3.5" /> Shift Control
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <AttendanceWidget />
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-8">
            <DailyMonitorWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up">
        {/* REVENUE TREND */}
        <Card className="lg:col-span-8 border-none shadow-sm rounded-none bg-white overflow-hidden">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-muted/5">
            <div className="space-y-0.5">
              <CardTitle className="text-[9px] font-black uppercase tracking-widest text-slate-800">Revenue Trend</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-primary">₹18.45L</p>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrendData}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[8px] font-black uppercase fill-slate-400" />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '1px solid #eee', fontSize: '9px', fontWeight: '900' }}
                    formatter={(v) => [`₹${(Number(v)/100000).toFixed(2)}L`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2, fill: 'hsl(var(--primary))', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ALERTS & PRIORITIES */}
        <Card className="lg:col-span-4 border-none shadow-sm rounded-none bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-rose-50/30">
            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-rose-700">Alerts</CardTitle>
            <Badge className="bg-rose-500 text-white rounded-none font-black text-[8px] px-1.5 h-3.5">5</Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[160px]">
              <div className="divide-y">
                {[
                  { t: 'Project Delay', d: '2 units', time: '20m', icon: Briefcase, color: 'text-rose-600' },
                  { t: 'Revenue Risk', d: 'Below target', time: '1h', icon: TrendingUp, color: 'text-amber-600' },
                  { t: 'Escalation', d: 'Priority ticket', time: '2h', icon: AlertCircle, color: 'text-red-600' },
                ].map((alert, i) => (
                  <div key={i} className="p-2 hover:bg-muted/10 transition-all flex items-start gap-2">
                    <div className={cn("p-1 rounded-none bg-muted/20", alert.color)}><alert.icon className="size-3" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center"><p className="font-black text-[10px] uppercase truncate">{alert.t}</p><span className="text-[7px] font-bold text-muted-foreground uppercase opacity-40">{alert.time}</span></div>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase">{alert.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-fade-in-up">
        <AnnouncementsWidget />
        <EventsWidget />
        <ActionItemsWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-fade-in-up">
        <TodoWidget />
        <WorkHoursSummaryWidget />
        <MissionHeatmapWidget />
      </div>

      {/* QUICK ACTIONS */}
      <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden animate-fade-in-up">
        <CardHeader className="p-3 border-b bg-primary/5">
          <CardTitle className="text-[9px] font-black uppercase tracking-widest text-primary">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <ActionButton icon={Briefcase} label="Project" href="/dashboard/projects" />
            <ActionButton icon={MousePointer2} label="Lead" href="/dashboard/clients" />
            <ActionButton icon={UserPlus} label="Staff" href="/dashboard/users" />
            <ActionButton icon={FileText} label="Report" href="/dashboard/reports" />
            <ActionButton icon={BarChart3} label="Data" href="/dashboard/analytics" />
            <ActionButton icon={Settings} label="Setup" href="/dashboard/settings" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, trend, color, bg, sparkline }: any) {
  return (
    <Card className="border-none shadow-sm rounded-none bg-white group hover:shadow-md transition-all p-3 space-y-2 ring-1 ring-border/50">
      <div className="flex items-center justify-between">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <div className={cn("px-1 py-0.5 rounded-none text-[6px] font-black uppercase", bg, color)}>{trend}</div>
      </div>
      <h3 className="text-lg font-black tracking-tighter leading-none">{value}</h3>
      <div className="h-4 w-full opacity-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkline.map((v: number, i: number) => ({ v, i }))}>
            <Area type="monotone" dataKey="v" stroke={color.includes('rose') ? '#EF4444' : '#6D28D9'} fill={color.includes('rose') ? '#EF444410' : '#6D28D910'} strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ActionButton({ icon: Icon, label, href }: { icon: any, label: string, href: string }) {
  return (
    <Button asChild variant="outline" className="h-10 rounded-none border-dashed border flex flex-col gap-1 hover:bg-primary/5 hover:border-primary/40 group transition-all p-1">
      <Link href={href}>
        <Icon className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-[7px] font-black uppercase tracking-tight">{label}</span>
      </Link>
    </Button>
  );
}
