import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Users, Sparkles, RotateCcw, RefreshCw, ChevronDown, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Studio { id: number; name: string; code: string | null; }
interface Batch { id: number; name: string; studio_id: number | null; capacity: number | null; }
interface Enrollment {
  id: number; student_id: number; batch_id: number; status_type: string;
  start_date: string; end_date: string; payment_id: number | null;
  created_at: string; start_cycle_id: number | null; end_cycle_id: number | null;
}
interface Payment {
  id: number; amount: number; gst: number | null; final_amount: number | null;
  payment_mode: string | null;
}
interface DropIn {
  id: number; amount: number; is_adjusted: boolean; payment_id: number | null; created_at: string;
}
interface PlanCycle {
  id: number; name: string; start_date: string; end_date: string | null;
  is_active: boolean; grace_days: number; plan_type: string;
}

const ACCENT = "#ff07ff";

const Dashboard = () => {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [selectedStudio, setSelectedStudio] = useState<string>("all");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dropIns, setDropIns] = useState<DropIn[]>([]);
  const [dropInPayments, setDropInPayments] = useState<Payment[]>([]);
  const [activeCycle, setActiveCycle] = useState<PlanCycle | null>(null);
  const [renewableCount, setRenewableCount] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch studios and active cycle
  useEffect(() => {
    const init = async () => {
      const [studioRes, cycleRes] = await Promise.all([
        supabase.from("studios").select("id, name, code").eq("organization_id", 1).order("name"),
        supabase.from("plan_cycles").select("*").eq("organization_id", 1).eq("is_active", true).limit(1),
      ]);
      setStudios(studioRes.data || []);
      if (cycleRes.data && cycleRes.data.length > 0) {
        setActiveCycle(cycleRes.data[0] as PlanCycle);
      }
    };
    init();
  }, []);

  // Fetch data when active cycle or studio changes
  useEffect(() => {
    if (!activeCycle) return;
    const fetchData = async () => {
      setLoading(true);
      // Fetch batches
      let batchQuery = supabase.from("batches").select("id, name, studio_id, capacity").eq("organization_id", 1);
      if (selectedStudio !== "all") {
        batchQuery = batchQuery.eq("studio_id", parseInt(selectedStudio));
      }
      const batchRes = await batchQuery;
      const batchList = (batchRes.data || []) as Batch[];
      setBatches(batchList);
      const batchIds = batchList.map(b => b.id);

      if (batchIds.length === 0) {
        setEnrollments([]); setPayments([]); setDropIns([]); setDropInPayments([]);
        setRenewableCount(0); setLoading(false);
        return;
      }

      // Fetch enrollments in active cycle (start_cycle_id or end_cycle_id matches, or date range overlap)
      const enrollRes = await supabase
        .from("enrollments")
        .select("id, student_id, batch_id, status_type, start_date, end_date, payment_id, created_at, start_cycle_id, end_cycle_id")
        .eq("organization_id", 1)
        .in("batch_id", batchIds)
        .gte("end_date", activeCycle.start_date)
        .lte("start_date", activeCycle.end_date || "2099-12-31");
      const enrollList = (enrollRes.data || []) as Enrollment[];
      setEnrollments(enrollList);

      // Fetch payments for these enrollments
      const paymentIds = enrollList.map(e => e.payment_id).filter(Boolean) as number[];
      if (paymentIds.length > 0) {
        const payRes = await supabase.from("payments").select("id, amount, gst, final_amount, payment_mode").in("id", paymentIds);
        setPayments((payRes.data || []) as Payment[]);
      } else {
        setPayments([]);
      }

      // Fetch drop-ins in the cycle date range
      const sessionRes = await supabase
        .from("batch_sessions")
        .select("id")
        .eq("organization_id", 1)
        .in("batch_id", batchIds)
        .gte("session_date", activeCycle.start_date)
        .lte("session_date", activeCycle.end_date || "2099-12-31");
      const sessionIds = (sessionRes.data || []).map(s => s.id);

      if (sessionIds.length > 0) {
        const diRes = await supabase
          .from("drop_ins")
          .select("id, amount, is_adjusted, payment_id, created_at")
          .eq("organization_id", 1)
          .in("batch_session_id", sessionIds);
        const diList = (diRes.data || []) as DropIn[];
        setDropIns(diList);

        const diPayIds = diList.map(d => d.payment_id).filter(Boolean) as number[];
        if (diPayIds.length > 0) {
          const diPayRes = await supabase.from("payments").select("id, amount, gst, final_amount, payment_mode").in("id", diPayIds);
          setDropInPayments((diPayRes.data || []) as Payment[]);
        } else {
          setDropInPayments([]);
        }
      } else {
        setDropIns([]); setDropInPayments([]);
      }

      // Renewable count: students whose previous enrollment ended within cycle range or grace
      const prevCycleEnd = activeCycle.start_date; // Previous cycle ended before this one started
      const graceDate = new Date(activeCycle.start_date);
      graceDate.setDate(graceDate.getDate() - 1); // day before current cycle
      const graceLookback = new Date(graceDate);
      graceLookback.setDate(graceLookback.getDate() - (activeCycle.grace_days || 14));

      let renewableQuery = supabase
        .from("enrollments")
        .select("student_id, batch_id")
        .eq("organization_id", 1)
        .gte("end_date", graceLookback.toISOString().split("T")[0])
        .lt("end_date", activeCycle.start_date);
      if (batchIds.length > 0 && selectedStudio !== "all") {
        renewableQuery = renewableQuery.in("batch_id", batchIds);
      }
      const renewableRes = await renewableQuery;
      const uniqueRenewable = new Set((renewableRes.data || []).map((r: any) => r.student_id));
      setRenewableCount(uniqueRenewable.size);

      setLoading(false);
    };
    fetchData();
  }, [activeCycle, selectedStudio]);

  // Computed metrics
  const totalDreams = enrollments.length;
  const headCount = new Set(enrollments.map(e => e.student_id)).size;
  const newDreams = enrollments.filter(e => e.status_type === "NEW").length;
  const revDreams = enrollments.filter(e => e.status_type === "REV").length;
  const renDreams = enrollments.filter(e => e.status_type === "REN").length;

  // Batch-wise data
  const batchData = useMemo(() => {
    const map = new Map<number, number>();
    enrollments.forEach(e => map.set(e.batch_id, (map.get(e.batch_id) || 0) + 1));
    return batches
      .map(b => ({ name: b.name, enrolled: map.get(b.id) || 0, capacity: b.capacity || 35 }))
      .filter(b => b.enrolled > 0)
      .sort((a, b) => b.enrolled - a.enrolled);
  }, [enrollments, batches]);

  // Payment lookup
  const paymentMap = useMemo(() => {
    const m = new Map<number, Payment>();
    payments.forEach(p => m.set(p.id, p));
    dropInPayments.forEach(p => m.set(p.id, p));
    return m;
  }, [payments, dropInPayments]);

  // Date-wise breakdown
  const dateWise = useMemo(() => {
    const map = new Map<string, {
      date: string; NEW: number; REN: number; REV: number; dropIn: number; diAdjusted: number;
      gross: number; gst: number; total: number; cash: number; razorpay: number;
    }>();

    const getOrCreate = (date: string) => {
      if (!map.has(date)) map.set(date, { date, NEW: 0, REN: 0, REV: 0, dropIn: 0, diAdjusted: 0, gross: 0, gst: 0, total: 0, cash: 0, razorpay: 0 });
      return map.get(date)!;
    };

    enrollments.forEach(e => {
      const date = e.created_at.split("T")[0];
      const row = getOrCreate(date);
      if (e.status_type === "NEW") row.NEW++;
      else if (e.status_type === "REN") row.REN++;
      else if (e.status_type === "REV") row.REV++;

      if (e.payment_id) {
        const p = paymentMap.get(e.payment_id);
        if (p) {
          row.gross += Number(p.amount) || 0;
          row.gst += Number(p.gst) || 0;
          row.total += Number(p.final_amount) || 0;
          const mode = (p.payment_mode || "").toLowerCase();
          if (mode === "cash") row.cash += Number(p.final_amount) || 0;
          else if (mode === "razorpay") row.razorpay += Number(p.final_amount) || 0;
        }
      }
    });

    dropIns.forEach(d => {
      const date = d.created_at.split("T")[0];
      const row = getOrCreate(date);
      row.dropIn++;
      if (d.is_adjusted) row.diAdjusted++;

      if (d.payment_id) {
        const p = paymentMap.get(d.payment_id);
        if (p) {
          row.gross += Number(p.amount) || 0;
          row.gst += Number(p.gst) || 0;
          row.total += Number(p.final_amount) || 0;
          const mode = (p.payment_mode || "").toLowerCase();
          if (mode === "cash") row.cash += Number(p.final_amount) || 0;
          else if (mode === "razorpay") row.razorpay += Number(p.final_amount) || 0;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [enrollments, dropIns, paymentMap]);

  // Totals for date-wise
  const dateTotals = useMemo(() => {
    return dateWise.reduce((acc, r) => ({
      NEW: acc.NEW + r.NEW, REN: acc.REN + r.REN, REV: acc.REV + r.REV,
      dropIn: acc.dropIn + r.dropIn, diAdjusted: acc.diAdjusted + r.diAdjusted,
      gross: acc.gross + r.gross, gst: acc.gst + r.gst, total: acc.total + r.total,
      cash: acc.cash + r.cash, razorpay: acc.razorpay + r.razorpay,
    }), { NEW: 0, REN: 0, REV: 0, dropIn: 0, diAdjusted: 0, gross: 0, gst: 0, total: 0, cash: 0, razorpay: 0 });
  }, [dateWise]);

  // Chart data for status distribution
  const statusChartData = [
    { name: "NEW", value: newDreams, fill: ACCENT },
    { name: "REN", value: renDreams, fill: "hsl(var(--success))" },
    { name: "REV", value: revDreams, fill: "hsl(var(--warning))" },
  ].filter(d => d.value > 0);

  const kpiCards = [
    { title: "Total Dreams", value: totalDreams, icon: GraduationCap, subtitle: `Active cycle: ${activeCycle?.name || "—"}` },
    { title: "Head Count", value: headCount, icon: Users, subtitle: "Unique students" },
    { title: "New Dreams", value: newDreams, icon: Sparkles, subtitle: "First-time enrollments" },
    { title: "REV Dreams", value: revDreams, icon: RotateCcw, subtitle: "Revival enrollments" },
    { title: "REN Dreams", value: renDreams, icon: RefreshCw, subtitle: `Renewable: ${renewableCount}`, highlight: true },
    { title: "REN Rate", value: renewableCount > 0 ? `${Math.round((renDreams / renewableCount) * 100)}%` : "—", icon: TrendingUp, subtitle: `${renDreams} / ${renewableCount} renewable`, highlight: true },
  ];

  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <AdminLayout title="Dashboard">
      {/* Studio Filter */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedStudio} onValueChange={setSelectedStudio}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select Studio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Studios</SelectItem>
            {studios.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.code ? `(${s.code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeCycle && (
          <span className="text-sm text-muted-foreground">
            Cycle: <span className="font-medium text-foreground">{activeCycle.name}</span>
            {" "}({activeCycle.start_date} → {activeCycle.end_date || "ongoing"})
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-20">Loading dashboard…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {kpiCards.map(card => (
              <Card key={card.title} className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold" style={card.highlight ? { color: ACCENT } : undefined}>
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Status Distribution Pie */}
            {statusChartData.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dream Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Batch Fill Bar Chart */}
            {batchData.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Batch Fill Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={batchData.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 35]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Bar dataKey="enrolled" fill={ACCENT} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Batch-wise Expandable */}
          <Collapsible open={batchOpen} onOpenChange={setBatchOpen} className="mb-6">
            <Card className="glass-card">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                  <CardTitle className="text-sm">Batch-wise Dreams ({batchData.length} batches)</CardTitle>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${batchOpen ? "rotate-180" : ""}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead className="text-right">Capacity</TableHead>
                        <TableHead className="w-[200px]">Fill</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchData.map(b => {
                        const pct = Math.min(Math.round((b.enrolled / b.capacity) * 100), 100);
                        return (
                          <TableRow key={b.name}>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell className="text-right">{b.enrolled}</TableCell>
                            <TableCell className="text-right">{b.capacity}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Date-wise Breakdown */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm">Date-wise Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">NEW</TableHead>
                      <TableHead className="text-right">REN</TableHead>
                      <TableHead className="text-right">REV</TableHead>
                      <TableHead className="text-right">Drop-In</TableHead>
                      <TableHead className="text-right">DI Adj.</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right" style={{ color: ACCENT }}>Total</TableHead>
                      <TableHead className="text-right">Cash</TableHead>
                      <TableHead className="text-right">Razorpay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateWise.map(row => (
                      <TableRow key={row.date}>
                        <TableCell className="font-medium whitespace-nowrap">{row.date}</TableCell>
                        <TableCell className="text-right">{row.NEW || "—"}</TableCell>
                        <TableCell className="text-right">{row.REN || "—"}</TableCell>
                        <TableCell className="text-right">{row.REV || "—"}</TableCell>
                        <TableCell className="text-right">{row.dropIn || "—"}</TableCell>
                        <TableCell className="text-right">{row.diAdjusted || "—"}</TableCell>
                        <TableCell className="text-right">₹{fmt(row.gross)}</TableCell>
                        <TableCell className="text-right">₹{fmt(row.gst)}</TableCell>
                        <TableCell className="text-right font-semibold" style={{ color: ACCENT }}>₹{fmt(row.total)}</TableCell>
                        <TableCell className="text-right">₹{fmt(row.cash)}</TableCell>
                        <TableCell className="text-right">₹{fmt(row.razorpay)}</TableCell>
                      </TableRow>
                    ))}
                    {dateWise.length > 0 && (
                      <TableRow className="border-t-2 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{dateTotals.NEW}</TableCell>
                        <TableCell className="text-right">{dateTotals.REN}</TableCell>
                        <TableCell className="text-right">{dateTotals.REV}</TableCell>
                        <TableCell className="text-right">{dateTotals.dropIn}</TableCell>
                        <TableCell className="text-right">{dateTotals.diAdjusted}</TableCell>
                        <TableCell className="text-right">₹{fmt(dateTotals.gross)}</TableCell>
                        <TableCell className="text-right">₹{fmt(dateTotals.gst)}</TableCell>
                        <TableCell className="text-right" style={{ color: ACCENT }}>₹{fmt(dateTotals.total)}</TableCell>
                        <TableCell className="text-right">₹{fmt(dateTotals.cash)}</TableCell>
                        <TableCell className="text-right">₹{fmt(dateTotals.razorpay)}</TableCell>
                      </TableRow>
                    )}
                    {dateWise.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">No data for this cycle</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
};

export default Dashboard;
