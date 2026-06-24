'use client';

import * as React from 'react';
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    DollarSign, TrendingUp, TrendingDown, Activity, 
    PieChart as PieChartIcon, Target, Search, 
    Filter, LayoutGrid, ArrowUpRight, ArrowDownRight,
    Map as MapIcon, Wallet, Briefcase, Globe,
    ChevronRight, MoreHorizontal, MousePointer2
} from "lucide-react";
import { 
    Area, AreaChart, ResponsiveContainer, 
    XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
    Bar, BarChart, CartesianGrid
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Link from 'next/link';

// --- MOCK DATA ---
const revenueSparkline = [
    { v: 30 }, { v: 45 }, { v: 35 }, { v: 50 }, { v: 48 }, { v: 65 }, { v: 55 }
];

const expenseBreakdown = [
    { name: 'Workforce Salaries', value: 8.5, color: 'hsl(var(--primary))' },
    { name: 'Operational Costs', value: 3.63, color: 'hsl(var(--accent))' },
];

const teamData = [
    { name: "Engineering Team", revenue: "₹7.42L", cost: "₹4.10L", progress: 85 },
    { name: "Design Team", revenue: "₹3.10L", cost: "₹1.85L", progress: 92 },
    { name: "Marketing Team", revenue: "₹4.25L", cost: "₹2.40L", progress: 78 },
    { name: "Sales Team", revenue: "₹2.10L", cost: "₹1.20L", progress: 65 },
    { name: "Operations Team", revenue: "₹1.58L", cost: "₹2.58L", progress: 45 },
];

const funnelData = [
    { stage: 'Proposal', value: 100, color: 'hsl(var(--primary))' },
    { stage: 'Negotiation', value: 65, color: 'hsl(var(--chart-5))' },
    { stage: 'Closing', value: 24, color: '#22c55e' },
];

export default function FinancePage() {
    return (
        <div className="space-y-8 animate-fade-in-up pb-20 font-jakarta">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-slate-900">Financial Ledger</h1>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Executive Audit Terminal</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Audit search..." 
                            className="h-10 w-64 pl-10 bg-white/50 border-none ring-1 ring-border/50 rounded-none text-xs font-bold uppercase tracking-tight shadow-sm" 
                        />
                    </div>
                    <div className="flex bg-muted/30 p-1 rounded-none ring-1 ring-border/50">
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase bg-white shadow-sm text-primary">This Month</Button>
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase text-muted-foreground hover:bg-white/50">This Quarter</Button>
                    </div>
                </div>
            </div>

            {/* Row 1: Core Financial KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                    title="Revenue" 
                    value="₹18.45L" 
                    trend="+22.4%" 
                    up={true} 
                    chart={<Sparkline data={revenueSparkline} color="#22c55e" />}
                    icon={DollarSign}
                    color="text-green-600"
                    bg="bg-green-50"
                />
                <KPICard 
                    title="Expenses" 
                    value="₹12.13L" 
                    trend="+7.8%" 
                    up={false} 
                    chart={<DonutChart data={expenseBreakdown} />}
                    description="Salaries vs Ops"
                    icon={TrendingDown}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
                <KPICard 
                    title="Net Profit" 
                    value="₹4.32L" 
                    trend="+18.7%" 
                    up={true} 
                    chart={<Activity className="size-8 text-emerald-500 opacity-20" />}
                    icon={TrendingUp}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <KPICard 
                    title="Profit Margin" 
                    value="23.4%" 
                    trend="+2.1pp" 
                    up={true} 
                    chart={<Target className="size-8 text-primary opacity-20" />}
                    icon={PieChartIcon}
                    color="text-primary"
                    bg="bg-primary/5"
                />
            </div>

            {/* Row 2: Marketing & Pipeline Operations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Marketing Budget Overview */}
                <Card className="bg-white/50 backdrop-blur-sm border-none ring-1 ring-border/50 rounded-none shadow-xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Marketing Budget Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-10">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-2">Total Budget</p>
                                <p className="text-3xl font-black tracking-tighter text-slate-900">₹5.00L</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-2">Spent to Date</p>
                                <p className="text-xl font-black text-slate-600">₹3.20L</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Progress value={64} className="h-1.5 rounded-none bg-muted" indicatorClassName="bg-primary shadow-[0_0_10px_rgba(109,40,217,0.3)]" />
                            <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Utilization: 64%</span>
                                <span>Target: {'<'}₹5.00L</span>
                            </div>
                        </div>
                        <div className="p-6 bg-emerald-50 rounded-none border-l-4 border-emerald-500 shadow-sm">
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Remaining Balance</p>
                            <p className="text-2xl font-black text-emerald-900">₹1.80L</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Client Project Value */}
                <Card className="bg-white/50 backdrop-blur-sm border-none ring-1 ring-border/50 rounded-none shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <Globe className="absolute -right-10 -bottom-10 size-64 text-primary" />
                    </div>
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Client Project Value</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8 relative z-10">
                        <div className="space-y-1">
                            <p className="text-5xl font-black tracking-tighter text-slate-900">₹24.80L</p>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary/10 text-primary border-none rounded-none text-[8px] font-black uppercase px-2 h-4">10 ACTIVE PROJECTS</Badge>
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Global Portfolio</span>
                            </div>
                        </div>
                        
                        <div className="pt-8 space-y-4">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/5 rounded-none text-primary"><MapIcon className="size-4" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Geo-Spatial Reach</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">4 Major Hubs Active</p>
                                </div>
                             </div>
                        </div>
                        <Button variant="ghost" className="w-full h-12 rounded-none border border-border/50 bg-white/50 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5">Review Locations</Button>
                    </CardContent>
                </Card>

                {/* Pending Value in Pipeline */}
                <Card className="bg-white/50 backdrop-blur-sm border-none ring-1 ring-border/50 rounded-none shadow-xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Pipeline Velocity</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8">
                        <div className="space-y-1">
                            <p className="text-4xl font-black tracking-tighter text-slate-900">₹14.25L</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pending Conversion Value</p>
                        </div>

                        <div className="space-y-4 py-4">
                            {funnelData.map((stage, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                        <span>{stage.stage}</span>
                                        <span>{stage.value}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-none overflow-hidden">
                                        <div 
                                            className="h-full transition-all duration-1000" 
                                            style={{ width: `${stage.value}%`, backgroundColor: stage.color }} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: HRM Team Revenue & Performance */}
            <Card className="bg-white/50 backdrop-blur-sm border-none ring-1 ring-border/50 rounded-none shadow-xl overflow-hidden">
                <CardHeader className="p-8 border-b bg-muted/10 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">HRM Team Revenue & Performance</CardTitle>
                        <CardDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Talent-to-Revenue Audit mapping</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-none h-10 border-none ring-1 ring-border/50 bg-white text-[9px] font-black uppercase tracking-widest text-primary shadow-sm hover:shadow-md transition-all">Export Ledger</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/5">
                            <TableRow className="hover:bg-transparent border-border/50">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-muted-foreground py-6 px-8">Team Name</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-muted-foreground py-6">Revenue Contribution</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-muted-foreground py-6">Workforce Cost</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-muted-foreground py-6 text-right px-8">Target vs Actual</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamData.map((team, i) => (
                                <TableRow key={i} className="border-border/50 hover:bg-primary/5 transition-colors group">
                                    <TableCell className="py-8 px-8 font-black text-sm uppercase tracking-tight text-slate-800">{team.name}</TableCell>
                                    <TableCell className="text-sm font-black text-emerald-600">{team.revenue}</TableCell>
                                    <TableCell className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">{team.cost}</TableCell>
                                    <TableCell className="text-right px-8 max-w-[240px]">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground">
                                                <span>Performance Index</span>
                                                <span className="text-primary">{team.progress}%</span>
                                            </div>
                                            <Progress value={team.progress} className="h-1 rounded-none bg-muted" indicatorClassName="bg-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Tactical Footer */}
            <footer className="pt-10 flex items-center justify-between text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.4em] border-t border-dashed">
                <p>© 2026 MARSHRM</p>
                <p>BY FORTUMARS</p>
            </footer>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function KPICard({ title, value, trend, up, chart, description, icon: Icon, color, bg }: any) {
    return (
        <Card className="bg-white/50 backdrop-blur-sm border-none ring-1 ring-border/50 rounded-none shadow-sm p-6 space-y-4 group transition-all hover:shadow-xl">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                         <div className={cn("p-1.5 rounded-none", bg, color)}><Icon className="size-3" /></div>
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</p>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
                </div>
                <Badge className={cn(
                    "border-none rounded-none text-[8px] font-black px-2 h-5 shadow-sm",
                    up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                    {up ? <ArrowUpRight className="size-2 mr-1" /> : <ArrowDownRight className="size-2 mr-1" />}
                    {trend}
                </Badge>
            </div>
            <div className="h-12 w-full mt-4 flex items-center justify-center">
                {chart}
            </div>
            {description && (
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{description}</p>
            )}
        </Card>
    );
}

function Sparkline({ data, color }: { data: any[], color: string }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <Area type="monotone" dataKey="v" stroke={color} fill={`${color}10`} strokeWidth={2} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function DonutChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie 
                    data={data} 
                    innerRadius={15} 
                    outerRadius={25} 
                    dataKey="value" 
                    stroke="none"
                    paddingAngle={4}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
}
