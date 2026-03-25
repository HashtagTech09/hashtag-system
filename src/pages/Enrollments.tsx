import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { getDisplayPhone } from "@/lib/studentUtils";
import { parseISO } from "date-fns";

const EnrollmentsPage = () => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subPlans, setSubPlans] = useState<any[]>([]);
  const [subPlanCycles, setSubPlanCycles] = useState<any[]>([]);
  const [planCycles, setPlanCycles] = useState<any[]>([]);
  const [eligibleDropIn, setEligibleDropIn] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detectedStatus, setDetectedStatus] = useState<string>("NEW");
  const [latestEndDate, setLatestEndDate] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_id: "", batch_ids: [] as string[], payment_mode: "cash",
    subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "",
    start_cycle_id: null as number | null, end_cycle_id: null as number | null,
  });

  const fetchData = async () => {
    const [enrollRes, studentRes, batchRes, planRes, seqRes, cycleRes] = await Promise.all([
      supabase.from("enrollments").select("*, students(name, phone, users(phone)), batches(name), subscription_plans(name), start_cycle:plan_cycles!enrollments_start_cycle_id_fkey(name), end_cycle:plan_cycles!enrollments_end_cycle_id_fkey(name)").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("students").select("*").eq("organization_id", 1).order("name"),
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
      supabase.from("subscription_plans").select("*").eq("organization_id", 1).eq("is_active", true).order("id"),
      supabase.from("subscription_plan_cycles").select("*").order("sequence_order"),
      supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
    ]);
    setEnrollments(enrollRes.data || []);
    setStudents(studentRes.data || []);
    setBatches(batchRes.data || []);
    setSubPlans(planRes.data || []);
    setSubPlanCycles(seqRes.data || []);
    setPlanCycles(cycleRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-detect student status based on enrollment history
  useEffect(() => {
    const detectStatus = async () => {
      if (!form.student_id) { setDetectedStatus("NEW"); setLatestEndDate(null); return; }
      const { data } = await supabase.from("enrollments")
        .select("end_date")
        .eq("student_id", Number(form.student_id))
        .eq("organization_id", 1)
        .order("end_date", { ascending: false })
        .limit(1);
      if (!data || data.length === 0) { setDetectedStatus("NEW"); setLatestEndDate(null); return; }
      const latest = data[0].end_date;
      setLatestEndDate(latest);
      const todayStr = new Date().toISOString().split("T")[0];
      if (latest >= todayStr) { setDetectedStatus("REN"); }
      else {
        // Check grace: if within grace_days of the active cycle, still REN (late)
        const activeCycle = planCycles.find(c => c.is_active);
        const graceDays = activeCycle?.grace_days || 14;
        const latestDate = new Date(latest);
        const graceEnd = new Date(latestDate);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        const graceEndStr = graceEnd.toISOString().split("T")[0];
        if (todayStr <= graceEndStr) { setDetectedStatus("REN"); }
        else { setDetectedStatus("REV"); }
      }
    };
    detectStatus();
  }, [form.student_id, planCycles]);

  // Check for eligible drop-ins when student + batches change
  useEffect(() => {
    const checkDropIns = async () => {
      if (!form.student_id || form.batch_ids.length === 0) { setEligibleDropIn(null); return; }
      const todayStr = new Date().toISOString().split("T")[0];
      const selectedStyles = batches.filter(b => form.batch_ids.includes(String(b.id))).map(b => b.style).filter(Boolean);
      if (selectedStyles.length === 0) { setEligibleDropIn(null); return; }

      const { data } = await supabase.from("drop_ins")
        .select("*, batch_sessions(session_date, style, start_time, end_time, batches(name))")
        .eq("student_id", Number(form.student_id))
        .eq("is_adjusted", false)
        .eq("organization_id", 1)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) { setEligibleDropIn(null); return; }

      // Find most recent eligible: session_date >= today AND style matches
      const eligible = data.find(d => {
        const sess = d.batch_sessions;
        if (!sess) return false;
        return sess.session_date >= todayStr && selectedStyles.includes(sess.style);
      });
      setEligibleDropIn(eligible || null);
    };
    checkDropIns();
  }, [form.student_id, form.batch_ids, batches]);
  // Find the first cycle with open registration (or next upcoming)
  const getStartCycleIndex = (): number => {
    const todayStr = new Date().toISOString().split("T")[0];
    // First: find a cycle whose registration is still open
    const openIdx = planCycles.findIndex(c => {
      if (c.registration_deadline && todayStr > c.registration_deadline) return false;
      // Must not be fully in the past
      const endDate = c.end_date || "2099-12-31";
      return endDate >= todayStr;
    });
    if (openIdx !== -1) return openIdx;
    // Fallback: next upcoming cycle by start_date
    const futureIdx = planCycles.findIndex(c => c.start_date > todayStr);
    return futureIdx !== -1 ? futureIdx : 0;
  };

  const startCycleIndex = planCycles.length > 0 ? getStartCycleIndex() : 0;
  const startCycle = planCycles[startCycleIndex];
  const currentCycleClosed = (() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const activeCycle = planCycles.find(c => c.is_active);
    if (!activeCycle) return false;
    return activeCycle.registration_deadline && todayStr > activeCycle.registration_deadline;
  })();

  // Check if a plan's sequence matches upcoming cycles starting from the open cycle
  const isPlanValid = (plan: any): boolean => {
    const requiredRegular = plan.total_regular_cycles || 0;
    const requiredGrid = plan.total_grid_cycles || 0;
    const totalRequired = plan.total_cycles || (requiredRegular + requiredGrid);
    if (totalRequired === 0) return false;

    // Only look at the next `totalRequired` cycles — plan must fit within that window
    const windowEnd = Math.min(startCycleIndex + totalRequired, planCycles.length);
    if (windowEnd - startCycleIndex < totalRequired) return false;

    let regularAvailable = 0;
    let gridAvailable = 0;
    for (let i = startCycleIndex; i < windowEnd; i++) {
      if (planCycles[i].plan_type === "regular") regularAvailable++;
      else if (planCycles[i].plan_type === "grid") gridAvailable++;
    }
    return regularAvailable >= requiredRegular && gridAvailable >= requiredGrid;
  };

  const validPlans = subPlans.filter(p => isPlanValid(p));

  // Compute cycle assignment when subscription plan changes
  const computeCycleAssignment = (planId: string) => {
    if (!planId || planId === "none") {
      setForm(f => ({ ...f, subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null }));
      return;
    }

    const plan = subPlans.find(p => p.id === Number(planId));
    if (!plan) return;

    const sequence = subPlanCycles.filter(s => s.subscription_plan_id === plan.id).sort((a, b) => a.sequence_order - b.sequence_order);

    // Walk through calendar cycles, skip cycles of different type
    const matched: any[] = [];
    let calIdx = startCycleIndex;
    for (const seqEntry of sequence) {
      while (calIdx < planCycles.length) {
        const cycle = planCycles[calIdx];
        if (cycle.plan_type === seqEntry.plan_type) {
          matched.push(cycle);
          calIdx++;
          break;
        }
        calIdx++;
      }
    }

    if (matched.length === sequence.length) {
      const startCycle = matched[0];
      const endCycle = matched[matched.length - 1];
      setForm(f => ({
        ...f,
        subscription_plan_id: planId,
        computed_start: startCycle.start_date,
        computed_end: endCycle.end_date || "",
        start_cycle_name: startCycle.name,
        end_cycle_name: endCycle.name,
        start_cycle_id: startCycle.id,
        end_cycle_id: endCycle.id,
      }));
    } else {
      toast.error("Not enough matching cycles in calendar for this plan");
      setForm(f => ({ ...f, subscription_plan_id: planId, computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null }));
    }
  };

  // Compute fee breakdown for display
  const computeFeeBreakdown = () => {
    const batchCount = form.batch_ids.length;
    const batchFee = batchCount * 3000; // Will be overridden by pricing_plans lookup in handleEnroll
    const todayStr = new Date().toISOString().split("T")[0];
    const applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || (detectedStatus === "REN" && latestEndDate && todayStr > latestEndDate);
    const regFee = applyRegFee ? 500 : 0;
    const dropInAdj = eligibleDropIn ? Number(eligibleDropIn.amount) : 0;
    const isLateRenewal = detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false;
    return { batchCount, batchFee, regFee, dropInAdj, total: Math.max(0, batchFee + regFee - dropInAdj), applyRegFee: !!applyRegFee, isLateRenewal };
  };

  const feeBreakdown = computeFeeBreakdown();

  const handleEnroll = async () => {
    if (!form.student_id || form.batch_ids.length === 0) { toast.error("Select a student and at least one batch"); return; }

    const { data: pricing } = await supabase.from("pricing_plans").select("*").eq("organization_id", 1).eq("batch_count", form.batch_ids.length).single();
    const todayStr = new Date().toISOString().split("T")[0];

    const applyRegFee = detectedStatus === "NEW" || detectedStatus === "REV" || (detectedStatus === "REN" && latestEndDate && todayStr > latestEndDate);
    const regFee = applyRegFee ? 500 : 0;
    const isLateRenewal = detectedStatus === "REN" && latestEndDate ? todayStr > latestEndDate : false;

    const baseAmount = pricing ? Number(pricing.price) : form.batch_ids.length * 3000;
    let totalAmount = baseAmount + regFee;

    // Apply drop-in adjustment
    const dropInAdjustment = eligibleDropIn ? Number(eligibleDropIn.amount) : 0;
    totalAmount = Math.max(0, totalAmount - dropInAdjustment);

    const { data: payment, error: payError } = await supabase.from("payments").insert({
      organization_id: 1, student_id: Number(form.student_id), amount: totalAmount,
      payment_mode: form.payment_mode, status: "success",
    }).select().single();

    if (payError) { toast.error("Payment failed"); return; }

    const today = new Date();
    const startDate = form.computed_start || today.toISOString().split("T")[0];
    const endDate = form.computed_end || (() => { const d = new Date(today); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })();

    const enrollmentRecords = form.batch_ids.map((batchId) => ({
      organization_id: 1, student_id: Number(form.student_id), batch_id: Number(batchId),
      payment_id: payment.id, status_type: detectedStatus,
      registration_fee_applied: !!applyRegFee, late_renewal: isLateRenewal,
      start_date: startDate, end_date: endDate,
      subscription_plan_id: form.subscription_plan_id ? Number(form.subscription_plan_id) : null,
      start_cycle_id: form.start_cycle_id,
      end_cycle_id: form.end_cycle_id,
    }));

    const { error } = await supabase.from("enrollments").insert(enrollmentRecords);
    if (error) { toast.error("Enrollment failed"); return; }

    // Mark drop-in as adjusted
    if (eligibleDropIn) {
      await supabase.from("drop_ins").update({ is_adjusted: true, adjusted_at: new Date().toISOString() }).eq("id", eligibleDropIn.id);
    }

    toast.success(`Enrolled successfully! Amount: ₹${totalAmount.toLocaleString()}${dropInAdjustment > 0 ? ` (Drop-in adjusted: -₹${dropInAdjustment})` : ""}`);
    setEligibleDropIn(null);
    setDetectedStatus("NEW");
    setLatestEndDate(null);
    setForm({ student_id: "", batch_ids: [], payment_mode: "cash", subscription_plan_id: "", computed_start: "", computed_end: "", start_cycle_name: "", end_cycle_name: "", start_cycle_id: null, end_cycle_id: null });
    setDialogOpen(false);
    fetchData();
  };

  const toggleBatch = (id: string) => {
    setForm((f) => ({ ...f, batch_ids: f.batch_ids.includes(id) ? f.batch_ids.filter((b) => b !== id) : [...f.batch_ids, id] }));
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  const filtered = enrollments.filter((e) => e.students?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Enrollments">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />New Enrollment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Enrollment</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {currentCycleClosed && startCycle && (
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-sm">
                  <p className="text-warning font-medium">Registrations for the current cycle are closed.</p>
                  <p className="text-muted-foreground mt-1">You are being enrolled starting from <span className="font-medium text-foreground">{startCycle.name}</span>.</p>
                </div>
              )}
              <div><Label>Student</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Enrollment Type</Label>
                <Select value={form.status_type} onValueChange={(v) => setForm({ ...form, status_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New Enrollment</SelectItem>
                    <SelectItem value="REN">Renewal</SelectItem>
                    <SelectItem value="REV">Revival</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subscription Plan (optional)</Label>
                <Select value={form.subscription_plan_id} onValueChange={computeCycleAssignment}>
                  <SelectTrigger><SelectValue placeholder="No plan (manual dates)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No plan</SelectItem>
                    {validPlans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.computed_start && (
                  <div className="mt-2 p-2 rounded border border-border text-sm">
                    <p className="text-muted-foreground">
                      Validity: <span className="text-foreground font-medium">{form.start_cycle_name}</span> → <span className="text-foreground font-medium">{form.end_cycle_name}</span>
                    </p>
                    <p className="text-muted-foreground">{form.computed_start} to {form.computed_end || "Open"}</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Select Batches</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {batches.map((b) => (
                    <Badge key={b.id} variant={form.batch_ids.includes(String(b.id)) ? "default" : "outline"} className={`cursor-pointer ${form.batch_ids.includes(String(b.id)) ? "gradient-primary" : ""}`} onClick={() => toggleBatch(String(b.id))}>{b.name}</Badge>
                  ))}
                </div>
              </div>
              {eligibleDropIn && (
                <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-sm">
                  <p className="text-success font-medium">Drop-in available for adjustment</p>
                  <p className="text-muted-foreground mt-1">
                    Session: {eligibleDropIn.batch_sessions?.session_date} • Style: {eligibleDropIn.batch_sessions?.style} • Amount: <span className="font-medium text-foreground">₹{Number(eligibleDropIn.amount).toLocaleString()}</span>
                  </p>
                  <p className="text-muted-foreground mt-1">This amount will be deducted from the enrollment fee.</p>
                </div>
              )}
              <div><Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gradient-primary" onClick={handleEnroll}>Confirm Enrollment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <TableHead className="hidden md:table-cell">Cycles</TableHead>
                <TableHead className="hidden md:table-cell">Start</TableHead>
                <TableHead className="hidden md:table-cell">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.students?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.students ? getDisplayPhone(e.students) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.batches?.name}</TableCell>
                  <TableCell><Badge className={statusColors[e.status_type] || ""} variant="secondary">{e.status_type}{e.late_renewal ? " (Late)" : ""}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.subscription_plans?.name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {e.start_cycle && e.end_cycle ? `${e.start_cycle.name} → ${e.end_cycle.name}` : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.start_date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.end_date}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No enrollments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default EnrollmentsPage;
