
'use client';

import * as React from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, orderBy, Timestamp, getDocs, or, and, limit } from "firebase/firestore";
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
  Line
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Users, Briefcase, Zap, 
  ArrowUpRight, ArrowDownRight, Bell, Calendar,
  Target, MousePointer2, 
  BarChart3, LayoutGrid, CheckCircle2, AlertCircle, Clock, Plus,
  PhoneCall, ShieldCheck, ChevronRight, FileText, Settings, UserPlus, Building2, Filter,
  Megaphone,
  PartyPopper,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, subWeeks, startOfMonth, endOfMonth, subMonths, isToday, addDays, isBefore, isSameDay } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

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

  // --- TACTICAL RANGE LOGIC ---
  const dateRange = React.useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateFilter) {
        case 'today':
            start = startOfDay(now);
            end = endOfDay(now);
            break;
        case 'yesterday':
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
            break;
        case 'this-week':
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfDay(now);
            break;
        case 'prev-week':
            start = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
            end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
            break;
        case 'this-month':
            start = startOfMonth(now);
            end = endOfDay(now);
            break;
        case 'prev-month':
            start = startOfMonth(subMonths(now, 1));
            end = endOfMonth(subMonths(now, 1));
            break;
        case 'custom-date':
            start = startOfDay(new Date(customStartDate));
            end = endOfDay(new Date(customStartDate));
            break;
        case 'custom-range':
            start = startOfDay(new Date(customStartDate));
            end = endOfDay(new Date(customEndDate));
            break;
        default:
            start = startOfWeek(now, { weekStartsOn: 1 });
            end = endOfDay(now);
            break;
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  // --- DATA STREAMS FOR EXECUTIVE VIEW ---
  const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
  const { data: clients } = useCollection<any>(clientsQuery);

  const leaveRequestsQuery = useMemoFirebase(() => {
    if (!isExecutive) return null;
    return query(collection(firestore, "leave_requests"), where("status", "in", ["Pending", "Pending HR Approval"]));
  }, [firestore, isExecutive]);
  const { data: leaveRequests } = useCollection<any>(leaveRequestsQuery);

  const announcementsQuery = useMemoFirebase(() => query(collection(firestore, 'announcements')), [firestore]);
  const { data: announcements } = useCollection<any>(announcementsQuery);

  const eventsQuery = useMemoFirebase(() => query(collection(firestore, 'events')), [firestore]);
  const { data: events } = useCollection<any>(eventsQuery);

  const issuesQuery = useMemoFirebase(() => query(collection(firestore, 'issue_reports'), where('status', 'in', ['Open', 'In Progress'])), [firestore]);
  const { data: openIssues } = useCollection<any>(issuesQuery);

  // --- NOTIFICATION CALCULATIONS ---
  const unreadAnnouncementsCount = announcements?.length || 0; 
  const todaysEventsCount = events?.filter((e: any) => e.date && isToday(e.date.toDate())).length || 0;
  const totalNotifications = (leaveRequests?.length || 0) + unreadAnnouncementsCount + todaysEventsCount + (openIssues?.length || 0);

  // --- KPI CALCULATIONS ---
  const stats = React.useMemo(() => {
    if (!clients) return { revenue: 0, leads: 0, activeProjects: 0 };
    
    let revenue = 0;
    let leads = 0;
    let activeProjects = 0;

    clients.forEach(c => {
      const created = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt || Date.now());
      const isWithin = isBefore(created, dateRange.end) && (isBefore(dateRange.start, created) || isSameDay(dateRange.start, created));
      
      if (isWithin && c.status === 'Lead') leads++;
      if (c.status === 'Active') activeProjects++;

      (c.payments || []).forEach((p: any) => {
        const pDate = p.invoiceDate ? new Date(p.invoiceDate) : (p.dueDate ? new Date(p.dueDate) : created);
        if (isBefore(pDate, dateRange.end) && (isBefore(dateRange.start, pDate) || isSameDay(dateRange.start, pDate))) {
            revenue += parseFloat(p.amountReceived || '0') || 0;
        }
      });
    });

    return { revenue, leads, activeProjects };
  }, [clients, dateRange]);

  const kpiData = [
    { name: 'Total Revenue', value: `₹${(stats.revenue / 100000).toFixed(2)}L`, trend: '+22.4%', up: true, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', sparkline: [30, 45, 35, 50, 48, 65, 55] },
    { name: 'New Leads', value: stats.leads.toString(), trend: '+31.5%', up: true, icon: MousePointer2, color: 'text-blue-600', bg: 'bg-blue-50', sparkline: [40, 35, 55, 60, 58, 80, 75] },
    { name: 'Active Projects', value: stats.activeProjects.toString(), trend: '+9.1%', up: true, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50', sparkline: [15, 18, 17, 22, 21, 25, 24] },
    { name: 'Team Utilization', value: '84%', trend: '+6.3%', up: true, icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', sparkline: [75, 78, 80, 82, 81, 84, 84] },
    { name: 'Project Health', value: 'On Track', trend: 'Audit', up: true, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', sparkline: [90, 92, 91, 94, 95, 94, 94] },
  ];

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
    <div className="min-h-screen space-y-8 pb-20 font-jakarta bg-gradient-to-br from-purple-500/5 via-[#F8FAFC] to-indigo-500/5">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-6 pt-8 animate-fade-in-up">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none text-left">
            Good Morning, {currentUserData?.firstName || 'Executive'} 👋
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest text-left">Founder & CEO, Cognithorz</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
                    <SelectGroup>
                        <SelectLabel className="text-[9px] font-black uppercase opacity-40">Custom Range</SelectLabel>
                        <SelectItem value="custom-date" className="text-xs font-bold uppercase">Specific Date</SelectItem>
                        <SelectItem value="custom-range" className="text-xs font-bold uppercase">Select Range</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>

            {(dateFilter === 'custom-date' || dateFilter === 'custom-range') && (
                <div className="flex gap-1 items-center px-2 animate-fade-in-up">
                    <Input 
                        type="date" 
                        value={customStartDate} 
                        onChange={e => setCustomStartDate(e.target.value)} 
                        className="h-8 rounded-none w-28 text-[9px] font-black bg-muted/20 border-none ring-1 ring-border" 
                    />
                    {dateFilter === 'custom-range' && (
                        <>
                            <span className="text-[8px] font-black uppercase opacity-20">to</span>
                            <Input 
                                type="date" 
                                value={customEndDate} 
                                onChange={e => setCustomEndDate(e.target.value)} 
                                className="h-8 rounded-none w-28 text-[9px] font-black bg-muted/20 border-none ring-1 ring-border" 
                            />
                        </>
                    )}
                </div>
            )}
            
            <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block" />
            <div className="px-4 text-[10px] font-black uppercase text-slate-900 truncate max-w-[200px] text-left">
                {dateFilter.replace('-', ' ')}
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
                <button className="rounded-none h-12 w-12 flex items-center justify-center relative bg-white ring-1 ring-slate-200 hover:ring-primary transition-all">
                    <Bell className="size-6 text-slate-600" />
                    {totalNotifications > 0 && (
                        <span className="absolute top-3 right-3 size-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-none border-none shadow-3xl" align="end" sideOffset={12}>
                <div className="p-6 border-b bg-white">
                    <h4 className="text-lg font-black uppercase tracking-tighter text-primary text-left">Notifications</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-left">Latest Updates</p>
                </div>
                <ScrollArea className="max-h-[400px]">
                    <div className="p-4 space-y-2">
                        {totalNotifications === 0 ? (
                            <div className="py-12 text-center opacity-30 grayscale flex flex-col items-center">
                                <CheckCircle2 className="size-10 mb-2" />
                                <p className="font-bold uppercase text-[10px] tracking-widest text-center">No alerts</p>
                            </div>
                        ) : (
                            <>
                                {leaveRequests?.map((req: any, i: number) => (
                                    <Link 
                                        href="/dashboard/leave" 
                                        key={i}
                                        className="flex items-center gap-3 p-3 bg-sky-50 hover:bg-sky-100 transition-all border border-sky-100 group"
                                    >
                                        <div className="size-8 bg-sky-500 text-white flex items-center justify-center rounded-none"><Briefcase className="size-4"/></div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[10px] font-bold uppercase text-sky-700">Leave Request</p>
                                            <p className="text-xs font-black truncate text-sky-900">{req.employeeName}</p>
                                        </div>
                                    </Link>
                                ))}
                                {todaysEventsCount > 0 && (
                                    <Link 
                                        href="/dashboard/events" 
                                        className="flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 transition-all border border-amber-100 group"
                                    >
                                        <div className="size-8 bg-amber-500 text-white flex items-center justify-center rounded-none"><PartyPopper className="size-4"/></div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[10px] font-bold uppercase text-amber-700">Events Today</p>
                                            <p className="text-xs font-black truncate text-amber-900">{todaysEventsCount} celebrations</p>
                                        </div>
                                    </Link>
                                )}
                                {openIssues?.map((issue: any, i: number) => (
                                    <Link 
                                        href="/dashboard/issues" 
                                        key={i}
                                        className="flex items-center gap-3 p-3 bg-rose-50 hover:bg-rose-100 transition-all border border-rose-100 group"
                                    >
                                        <div className="size-8 bg-rose-500 text-white flex items-center justify-center rounded-none"><AlertCircle className="size-4"/></div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[10px] font-bold uppercase text-rose-700">Support Ticket</p>
                                            <p className="text-xs font-black truncate text-rose-900">{issue.title}</p>
                                        </div>
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-muted/10">
                    <Button variant="ghost" className="w-full rounded-none h-10 text-[9px] font-black uppercase text-muted-foreground hover:text-primary transition-colors" asChild>
                        <Link href="/dashboard/monitor">Go to Monitor</Link>
                    </Button>
                </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Row 0: Attendance Protocol */}
      <div className="w-full px-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <AttendanceWidget />
      </div>

      {/* Row 1: KPI Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 px-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {kpiData.map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm rounded-none bg-white group hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
            <CardContent className="p-6 flex flex-col gap-4 text-left">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-none shadow-sm", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div className={cn("flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-none", kpi.up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {kpi.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {kpi.trend}
                </div>
              </div>
              <div className="space-y-1 text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{kpi.name}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Audit</span>
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

      {/* Row 2: Daily Monitor (Operational Presence) */}
      <div className="px-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <DailyMonitorWidget />
      </div>

      {/* Row 3: Tactical Intelligence Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Card className="lg:col-span-2 border-none shadow-sm rounded-none bg-white flex flex-col overflow-hidden">
          <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between text-left">
            <div className="space-y-1 text-left">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Growth Velocity</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase opacity-40 tracking-tight">Financial trend audit</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                    { name: 'W1', value: 10 }, { name: 'W2', value: 25 }, { name: 'W3', value: 20 }, { name: 'W4', value: 45 }
                ]}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6D28D9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-[10px] font-black uppercase fill-slate-400" />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: '0px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: '900' }} />
                  <Area type="monotone" dataKey="value" stroke="#6D28D9" strokeWidth={4} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-none bg-white flex flex-col">
          <CardHeader className="p-8 pb-0 text-left">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue by BU</CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-8">
            <div className="relative size-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={[
                            { name: 'Technical', value: 400, color: '#6D28D9' },
                            { name: 'Marketing', value: 300, color: '#3B82F6' },
                            { name: 'CSR', value: 100, color: '#22C55E' }
                        ]} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                        {[0, 1, 2].map((i) => <Cell key={i} fill={['#6D28D9', '#3B82F6', '#22C55E'][i]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-full space-y-3">
              {['Technical', 'Marketing', 'CSR'].map((unit, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] font-black uppercase">
                  <div className="flex items-center gap-3 text-left"><div className="size-2 rounded-full" style={{ backgroundColor: ['#6D28D9', '#3B82F6', '#22C55E'][i] }} /> <span className="text-slate-600">{unit}</span></div>
                  <span className="text-slate-900">Verified Audit</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
            <ActionItemsWidget />
        </div>
      </div>

      {/* Row 4: Communication (Announcements & Events) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <AnnouncementsWidget />
          <EventsWidget />
      </div>

      {/* Row 5: Task Management & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <TodoWidget />
          <WorkHoursSummaryWidget />
          <MissionHeatmapWidget />
      </div>
    </div>
  );
}
