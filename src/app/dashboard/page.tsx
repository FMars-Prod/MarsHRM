'use client';

import * as React from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, orderBy, Timestamp, getDocs, limit, or, and, collectionGroup } from "firebase/firestore";
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
import { WfhSetupReminder } from "@/components/geohrm/wfh-setup-reminder";
import { MeetingStatusBanner } from "@/components/geohrm/meeting-status-banner";
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
  Activity,
  Video,
  Timer
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, addDays, subWeeks, startOfMonth, endOfMonth, subMonths, isToday, isBefore, isSameDay, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function UpcomingMeetingsWidget() {
    const { user } = useUser();
    const firestore = useFirestore();

    const meetingsQuery = useMemoFirebase(() => {
        if (!user) return null;
        const now = new Date();
        const end = addDays(now, 7);
        return query(
            collection(firestore, 'meetings'),
            and(
                or(where('participantIds', 'array-contains', user.uid), where('createdBy', '==', user.uid)),
                where('date', '>=', Timestamp.fromDate(now)),
                where('date', '<=', Timestamp.fromDate(end))
            ),
            orderBy('date', 'asc'),
            limit(4)
        );
    }, [user, firestore]);

    const { data: meetings, isLoading } = useCollection<any>(meetingsQuery);

    return (
        <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden h-full flex flex-col">
            <CardHeader className="p-4 pb-2 border-b bg-primary/5">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Video className="size-3.5" /> Upcoming Meetings
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 text-left">
                <ScrollArea className="h-[200px]">
                    {isLoading ? (
                        <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-none" />)}</div>
                    ) : meetings && meetings.length > 0 ? (
                        <div className="divide-y divide-border/50 text-left">
                            {meetings.map((m: any) => (
                                <Link href="/dashboard/meetings" key={m.id} className="block p-4 hover:bg-muted/10 transition-all group">
                                    <div className="flex items-start justify-between gap-3 text-left">
                                        <div className="space-y-1 text-left">
                                            <p className="font-black text-xs uppercase tracking-tight truncate max-w-[180px] text-left">{m.title}</p>
                                            <div className="flex items-center gap-2 text-[8px] font-black text-muted-foreground uppercase opacity-40 text-left">
                                                <Clock className="size-2.5" />
                                                {format(m.date.toDate(), 'PPP p')}
                                            </div>
                                        </div>
                                        <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[7px] font-black uppercase px-2 h-4 shrink-0 flex gap-1">
                                            <Timer className="size-2" />
                                            {formatDistanceToNow(m.date.toDate())}
                                        </Badge>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center opacity-20 uppercase font-black text-[9px] tracking-widest">No Meetings Scheduled</div>
                    )}
                </ScrollArea>
            </CardContent>
            <div className="p-3 border-t bg-muted/5">
                <Button variant="ghost" size="sm" className="w-full h-7 rounded-none font-black uppercase text-[8px] tracking-widest text-primary hover:bg-primary/5" asChild>
                    <Link href="/dashboard/meetings">View All <ChevronRight className="size-2.5 ml-1" /></Link>
                </Button>
            </div>
        </Card>
    );
}

function KPICard({ title, value, trend, color, bg, sparkline, href }: any) {
  const content = (
    <Card className="border-none shadow-sm rounded-none bg-white group hover:shadow-md transition-all p-3 space-y-2 ring-1 ring-border/50 cursor-pointer h-full text-left">
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

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
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

export default function DashboardPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const [dateFilter, setDateFilter] = React.useState<string>("this-week");

  const currentUserDataRef = useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]);
  const { data: currentUserData } = useDoc<any>(currentUserDataRef);
  
  const userRole = currentUserData?.role;
  const isExecutive = userRole === 'CEO/Admin' || userRole === 'CEO/MD' || userRole === 'HR Manager';

  // --- Real Stats Aggregation ---
  const clientsQuery = useMemoFirebase(() => query(collection(firestore, 'clients')), [firestore]);
  const { data: clients } = useCollection<any>(clientsQuery);

  const transactionsQuery = useMemoFirebase(() => query(collection(firestore, 'financial_transactions')), [firestore]);
  const { data: manualTransactions } = useCollection<any>(transactionsQuery);

  const sessionsQuery = useMemoFirebase(() => query(collection(firestore, 'marketing_sessions')), [firestore]);
  const { data: marketingSessions } = useCollection<any>(sessionsQuery);

  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const { stats, funnelData } = React.useMemo(() => {
    let collected = 0;
    let pending = 0;
    let workforceCost = 0;
    let marketingSpent = 0;

    // Revenue from client payments
    clients?.forEach(c => {
        (c.payments || []).forEach((p: any) => {
            collected += parseFloat(p.amountReceived || '0');
            if (p.status !== 'Paid') pending += (parseFloat(p.amount) - parseFloat(p.amountReceived || '0'));
        });
    });

    // Manual Transactions
    manualTransactions?.forEach(t => {
        if (t.type === 'income') collected += (t.amount || 0);
        else collected -= (t.amount || 0); 
    });

    // Workforce & Marketing
    allUsers?.forEach(u => workforceCost += (u.payrollAmount || 0));
    marketingSessions?.forEach(s => {
        if (s.type === 'spend') {
            marketingSpent += (s.adSpends?.reduce((a: number, c: any) => a + (c.amount || 0), 0) || 0);
        }
    });

    const netProfit = collected - workforceCost - marketingSpent;
    const leadsCount = clients?.filter((c: any) => c.status === 'Prospect' || c.status === 'Lead').length || 0;
    const projectsCount = clients?.filter((c: any) => c.status === 'Active').length || 0;
    const completedCount = clients?.filter((c: any) => c.completionPercent === 100).length || 0;

    const data = [
        { value: (clients?.length || 0), name: 'Total Prospects', fill: '#6D28D9' },
        { value: (clients?.filter((c: any) => c.status === 'Active' || c.completionPercent > 0).length || 0), name: 'Qualified Leads', fill: '#8B5CF6' },
        { value: projectsCount, name: 'Active Projects', fill: '#A78BFA' },
        { value: completedCount, name: 'Completed Deals', fill: '#C4B5FD' },
    ];

    return {
        stats: {
            revenue: collected,
            profit: netProfit,
            leads: leadsCount,
            projects: projectsCount,
            utilization: 84 
        },
        funnelData: data
    };
  }, [clients, manualTransactions, allUsers, marketingSessions]);

  if (!isExecutive) {
    return (
      <div className="space-y-3 max-w-full mx-auto pb-4 font-jakarta text-left">
        <MonthlyReviewBanner />
        <MeetingStatusBanner />
        <WfhSetupReminder />
        <div className="flex flex-col gap-0.5 mb-1 animate-fade-in-up text-left">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter leading-none text-primary uppercase text-left">
                {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 17 ? "Good Afternoon" : "Good Evening"}, {currentUserData?.firstName || 'User'}
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-left">{currentUserData?.jobTitle || 'Team Member'}</p>
        </div>
        <DashboardReminder />
        <div className="w-full animate-fade-in-up">
            <ProfileBentoCard />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="lg:col-span-4 space-y-3">
                <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden">
                    <CardHeader className="p-4 pb-2 border-b bg-muted/5">
                        <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 text-left">
                            <Clock className="size-3.5" /> Shift Control
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 text-left">
                        <AttendanceWidget />
                    </CardContent>
                </Card>
                <UpcomingMeetingsWidget />
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
    <div className="min-h-screen space-y-3 pb-6 font-jakarta bg-gradient-to-br from-primary/5 via-[#F8FAFC] to-indigo-50/5 px-2 md:px-4 text-left">
      <MonthlyReviewBanner />
      <MeetingStatusBanner />
      <WfhSetupReminder />
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 animate-fade-in-up text-left">
        <div className="space-y-0.5 text-left">
          <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none text-left">
            Good Morning, {currentUserData?.firstName || 'Executive'} 👋
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">{currentUserData?.jobTitle || 'Executive Portal'}</p>
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
                        <SelectLabel className="text-[8px] font-black uppercase opacity-40">Range</SelectLabel>
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
        <KPICard title="Revenue" value={`₹${(stats.revenue/100000).toFixed(2)}L`} trend="Confirmed" color="text-primary" bg="bg-primary/5" sparkline={[30, 45, 35, 50, 48, 65, 55]} href="/dashboard/finance" />
        <KPICard title="Surplus" value={`₹${(stats.profit/100000).toFixed(2)}L`} trend={stats.profit >= 0 ? "Surplus" : "Deficit"} color={stats.profit >= 0 ? "text-emerald-600" : "text-rose-600"} bg={stats.profit >= 0 ? "bg-emerald-50" : "bg-rose-50"} sparkline={[40, 35, 55, 45, 60, 58, 65]} href="/dashboard/finance" />
        <KPICard title="Leads" value={stats.leads} trend="Active" color="text-blue-600" bg="bg-blue-50" sparkline={[20, 30, 25, 40, 38, 50, 45]} href="/dashboard/clients" />
        <KPICard title="Projects" value={stats.projects} trend="Active" color="text-amber-600" bg="bg-amber-50" sparkline={[15, 18, 17, 22, 21, 25, 24]} href="/dashboard/projects" />
        <KPICard title="Utilization" value={`${stats.utilization}%`} trend="Verified" color="text-indigo-600" bg="bg-indigo-50" sparkline={[75, 78, 80, 82, 81, 84, 84]} href="/dashboard/analytics" />
      </div>

      {/* OPERATIONAL HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up">
        <div className="lg:col-span-4 space-y-3">
            <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b bg-muted/5">
                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 text-left">
                        <Clock className="size-3.5" /> Shift Control
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 text-left">
                    <AttendanceWidget />
                </CardContent>
            </Card>
            <UpcomingMeetingsWidget />
        </div>
        <div className="lg:col-span-8">
            <DailyMonitorWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in-up text-left">
        {/* PIPELINE FUNNEL */}
        <Card className="lg:col-span-6 border-none shadow-sm rounded-none bg-white overflow-hidden text-left">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-muted/5 text-left">
            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-slate-800 text-left">Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-left">
            <div className="h-[250px] w-full text-left">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip contentStyle={{ borderRadius: '0px', fontSize: '10px' }} />
                  <Funnel
                    dataKey="value"
                    data={funnelData}
                    isAnimationActive
                  >
                    <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ALERTS & PRIORITIES */}
        <Card className="lg:col-span-6 border-none shadow-sm rounded-none bg-white overflow-hidden flex flex-col text-left">
          <CardHeader className="p-3 border-b flex flex-row items-center justify-between bg-rose-50/30 text-left">
            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-rose-700 text-left">Priority Alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 text-left">
            <ScrollArea className="h-[250px] text-left">
              <div className="divide-y text-left">
                {[
                  { t: 'High Spend Alert', d: 'Marketing budget usage > 80%', time: 'Just Now', icon: Zap, color: 'text-amber-600' },
                  { t: 'Project Blocked', d: 'Resource required for Technical Sprint', time: '1h', icon: Briefcase, color: 'text-rose-600' },
                  { t: 'Pending Approval', d: '3 Leave requests waiting HR action', time: '2h', icon: Clock, color: 'text-blue-600' },
                ].map((alert, i) => (
                  <div key={i} className="p-4 hover:bg-muted/10 transition-all flex items-start gap-4 text-left">
                    <div className={cn("p-2 rounded-none bg-muted/20", alert.color)}><alert.icon className="size-4" /></div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center text-left"><p className="font-black text-[11px] uppercase truncate text-left">{alert.t}</p><span className="text-[8px] font-bold text-muted-foreground uppercase opacity-40 text-left">{alert.time}</span></div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 text-left">{alert.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-fade-in-up text-left">
        <AnnouncementsWidget />
        <EventsWidget />
        <ActionItemsWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-fade-in-up text-left">
        <TodoWidget />
        <WorkHoursSummaryWidget />
        <MissionHeatmapWidget />
      </div>

      {/* QUICK ACTIONS */}
      <Card className="border-none shadow-sm rounded-none bg-white overflow-hidden animate-fade-in-up text-left">
        <CardHeader className="p-3 border-b bg-primary/5 text-left">
          <CardTitle className="text-[9px] font-black uppercase tracking-widest text-primary text-left">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-3 text-left">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-left">
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
