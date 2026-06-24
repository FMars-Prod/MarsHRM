'use client';

import * as React from 'react';
import { PageHeader } from "@/components/geohrm/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
    DollarSign, TrendingUp, TrendingDown, Activity, 
    PieChart as PieChartIcon, Target, Search, 
    Filter, LayoutGrid, ArrowUpRight, ArrowDownRight,
    Map as MapIcon, Wallet, Briefcase, Globe,
    ChevronRight, MoreHorizontal
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

// --- THEME CONSTANTS ---
const COLORS = {
    bg: '#121214',
    card: '#1C1C1E',
    primary: '#6D28D9',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#EF4444',
    slate: '#94A3B8'
};

// --- MOCK DATA ---
const revenueSparkline = [
    { v: 30 }, { v: 45 }, { v: 35 }, { v: 50 }, { v: 48 }, { v: 65 }, { v: 55 }
];

const expenseBreakdown = [
    { name: 'Workforce Salaries', value: 8.5, color: '#F59E0B' },
    { name: 'Operational Costs', value: 3.63, color: '#F59E0B' },
];

const teamData = [
    { name: "Engineering Team", revenue: "₹7.42L", cost: "₹4.10L", progress: 85 },
    { name: "Design Team", revenue: "₹3.10L", cost: "₹1.85L", progress: 92 },
    { name: "Marketing Team", revenue: "₹4.25L", cost: "₹2.40L", progress: 78 },
    { name: "Sales Team", revenue: "₹2.10L", cost: "₹1.20L", progress: 65 },
    { name: "Operations Team", revenue: "₹1.58L", cost: "₹2.58L", progress: 45 },
];

const funnelData = [
    { stage: 'Proposal', value: 100, color: '#6D28D9' },
    { stage: 'Negotiation', value: 65, color: '#3B82F6' },
    { stage: 'Closing', value: 24, color: '#10B981' },
];

export default function FinancePage() {
    return (
        <div className="min-h-screen bg-[#121214] text-slate-100 space-y-8 p-1 font-jakarta pb-20">
            {/* Minimal Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Financial Ledger</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Executive Audit Terminal</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
                        <Input 
                            placeholder="Audit search..." 
                            className="h-10 w-64 pl-10 bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none text-xs font-bold uppercase tracking-tight" 
                        />
                    </div>
                    <div className="flex bg-[#1C1C1E] p-1 rounded-none ring-1 ring-slate-800">
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase bg-[#2C2C2E] text-white">This Month</Button>
                        <Button variant="ghost" size="sm" className="h-8 rounded-none px-4 text-[9px] font-black uppercase text-slate-500">This Quarter</Button>
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
                    chart={<Sparkline data={revenueSparkline} color={COLORS.emerald} />}
                />
                <KPICard 
                    title="Expenses" 
                    value="₹12.13L" 
                    trend="+7.8%" 
                    up={false} 
                    chart={<DonutChart data={expenseBreakdown} />}
                    description="Salaries vs Ops"
                />
                <KPICard 
                    title="Net Profit" 
                    value="₹4.32L" 
                    trend="+18.7%" 
                    up={true} 
                    chart={<Activity className="size-8 text-emerald-500 opacity-20" />}
                />
                <KPICard 
                    title="Profit Margin" 
                    value="23.4%" 
                    trend="+2.1pp" 
                    up={true} 
                    chart={<Target className="size-8 text-primary opacity-20" />}
                />
            </div>

            {/* Row 2: Marketing & Pipeline Operations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Marketing Budget Overview */}
                <Card className="bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none shadow-2xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Marketing Budget Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-10">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Total Budget</p>
                                <p className="text-3xl font-black tracking-tighter">₹5.00L</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Spent to Date</p>
                                <p className="text-xl font-black text-slate-300">₹3.20L</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Progress value={64} className="h-1.5 rounded-none bg-slate-800" indicatorClassName="bg-primary shadow-[0_0_10px_rgba(109,40,217,0.5)]" />
                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-600 tracking-widest">
                                <span>Utilization: 64%</span>
                                <span>Target: {"<"}₹5.00L</span>
                            </div>
                        </div>
                        <div className="p-6 bg-[#2C2C2E] rounded-none border-l-4 border-emerald-500 shadow-xl">
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Remaining Balance</p>
                            <p className="text-2xl font-black text-emerald-50">₹1.80L</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Client Project Value */}
                <Card className="bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Globe className="absolute -right-10 -bottom-10 size-64 text-primary" />
                    </div>
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Client Project Value</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8 relative z-10">
                        <div className="space-y-1">
                            <p className="text-5xl font-black tracking-tighter text-white">₹24.80L</p>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary/20 text-primary border-none rounded-none text-[8px] font-black uppercase px-2 h-4">10 ACTIVE PROJECTS</Badge>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Global Portfolio</span>
                            </div>
                        </div>
                        
                        <div className="pt-8 space-y-4">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-800 rounded-none text-slate-400"><MapIcon className="size-4" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-white uppercase tracking-tight">Geo-Spatial Reach</p>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">4 Major Hubs Active</p>
                                </div>
                             </div>
                        </div>
                        <Button variant="ghost" className="w-full h-12 rounded-none border border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800">Review Locations</Button>
                    </CardContent>
                </Card>

                {/* Pending Value in Pipeline */}
                <Card className="bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none shadow-2xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Pipeline Velocity</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8">
                        <div className="space-y-1">
                            <p className="text-4xl font-black tracking-tighter text-white">₹14.25L</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pending Conversion Value</p>
                        </div>

                        <div className="space-y-4 py-4">
                            {funnelData.map((stage, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        <span>{stage.stage}</span>
                                        <span>{stage.value}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-none overflow-hidden">
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
            <Card className="bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none shadow-2xl overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-800 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">HRM Team Revenue & Performance</CardTitle>
                        <CardDescription className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Talent-to-Revenue Audit mapping</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-none h-10 border-slate-800 bg-transparent text-[9px] font-black uppercase tracking-widest text-slate-400">Export Ledger</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-900/50">
                            <TableRow className="hover:bg-transparent border-slate-800">
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-slate-500 py-6 px-8">Team Name</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-slate-500 py-6">Revenue Contribution</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-slate-500 py-6">Workforce Cost</TableHead>
                                <TableHead className="font-black uppercase tracking-widest text-[9px] text-slate-500 py-6 text-right px-8">Target vs Actual</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamData.map((team, i) => (
                                <TableRow key={i} className="border-slate-800 hover:bg-slate-900/40 transition-colors group">
                                    <TableCell className="py-8 px-8 font-black text-sm uppercase tracking-tight text-white">{team.name}</TableCell>
                                    <TableCell className="text-sm font-black text-emerald-500">{team.revenue}</TableCell>
                                    <TableCell className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{team.cost}</TableCell>
                                    <TableCell className="text-right px-8 max-w-[240px]">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                                <span>Performance Index</span>
                                                <span className="text-primary">{team.progress}%</span>
                                            </div>
                                            <Progress value={team.progress} className="h-1 rounded-none bg-slate-800" indicatorClassName="bg-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Tactical Footer */}
            <footer className="pt-10 flex items-center justify-between text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] border-t border-slate-900/50">
                <p>© 2026 MARSHRM</p>
                <p>BY FORTUMARS</p>
            </footer>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function KPICard({ title, value, trend, up, chart, description }: any) {
    return (
        <Card className="bg-[#1C1C1E] border-none ring-1 ring-slate-800 rounded-none shadow-2xl p-6 space-y-4 group transition-all hover:ring-primary/40">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                    <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
                </div>
                <Badge className={cn(
                    "border-none rounded-none text-[8px] font-black px-2 h-5",
                    up ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                    {up ? <ArrowUpRight className="size-2 mr-1" /> : <ArrowDownRight className="size-2 mr-1" />}
                    {trend}
                </Badge>
            </div>
            <div className="h-12 w-full mt-4 flex items-center justify-center">
                {chart}
            </div>
            {description && (
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{description}</p>
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
