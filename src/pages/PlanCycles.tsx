import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, format, parseISO, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

const PlanCyclesPage = () => {
  const [cycles, setCycles] = useState<any[]>([]);
  const [subPlans, setSubPlans] = useState<any[]>([]);
  const [subPlanCycles, setSubPlanCycles] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Cycle dialog
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<any>(null);
  const [cycleForm, setCycleForm] = useState({ name: "", start_date: "", end_date: "", plan_type: "regular", grace_days: 14 });

  // Sub plan dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({ name: "", description: "", sequence: [{ plan_type: "regular" }] as { plan_type: string }[] });

  // Calendar
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const fetchData = async () => {
    const [cycleRes, planRes, seqRes, sessRes] = await Promise.all([
      supabase.from("plan_cycles").select("*").eq("organization_id", 1).order("start_date"),
      supabase.from("subscription_plans").select("*").eq("organization_id", 1).order("id"),
      supabase.from("subscription_plan_cycles").select("*").order("sequence_order"),
      supabase.from("batch_sessions").select("*, batches(name)").eq("organization_id", 1).order("session_date"),
    ]);
    setCycles(cycleRes.data || []);
    setSubPlans(planRes.data || []);
    setSubPlanCycles(seqRes.data || []);
    setSessions(sessRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  // --- Cycle CRUD ---
  const openCycleDialog = (cycle?: any) => {
    if (cycle) {
      setEditingCycle(cycle);
      setCycleForm({ name: cycle.name, start_date: cycle.start_date, end_date: cycle.end_date || "", plan_type: cycle.plan_type, grace_days: cycle.grace_days ?? (cycle.plan_type === "grid" ? 21 : 14) });
    } else {
      setEditingCycle(null);
      setCycleForm({ name: "", start_date: "", end_date: "", plan_type: "regular", grace_days: 14 });
    }
    setCycleDialogOpen(true);
  };

  const handleSaveCycle = async () => {
    if (!cycleForm.name || !cycleForm.start_date) { toast.error("Name and start date required"); return; }

    const duration = cycleForm.end_date ? differenceInDays(parseISO(cycleForm.end_date), parseISO(cycleForm.start_date)) : null;

    // Overlap check
    const overlapping = cycles.filter(c => c.id !== editingCycle?.id).some(c => {
      const cStart = parseISO(c.start_date);
      const cEnd = c.end_date ? parseISO(c.end_date) : new Date("2099-12-31");
      const fStart = parseISO(cycleForm.start_date);
      const fEnd = cycleForm.end_date ? parseISO(cycleForm.end_date) : new Date("2099-12-31");
      return fStart <= cEnd && fEnd >= cStart;
    });
    if (overlapping) { toast.error("Cycle dates overlap with an existing cycle"); return; }

    const graceDays = cycleForm.grace_days;
    const registrationDeadline = cycleForm.start_date ? (() => {
      const d = new Date(cycleForm.start_date);
      d.setDate(d.getDate() + graceDays);
      return d.toISOString().split("T")[0];
    })() : null;

    const data = {
      organization_id: 1,
      name: cycleForm.name,
      start_date: cycleForm.start_date,
      end_date: cycleForm.end_date || null,
      plan_type: cycleForm.plan_type,
      duration_days: duration,
      grace_days: graceDays,
      registration_deadline: registrationDeadline,
    };

    if (editingCycle) {
      const { error } = await supabase.from("plan_cycles").update(data).eq("id", editingCycle.id);
      if (error) { toast.error("Failed to update"); return; }
    } else {
      const { error } = await supabase.from("plan_cycles").insert(data);
      if (error) { toast.error("Failed to create"); return; }
    }

    toast.success(editingCycle ? "Cycle updated" : "Cycle created");
    setCycleDialogOpen(false);
    fetchData();
  };

  const toggleCycleActive = async (cycle: any) => {
    if (!cycle.is_active) {
      // Deactivate all others first
      await supabase.from("plan_cycles").update({ is_active: false }).eq("organization_id", 1);
    }
    await supabase.from("plan_cycles").update({ is_active: !cycle.is_active }).eq("id", cycle.id);
    fetchData();
  };

  const deleteCycle = async (id: number) => {
    await supabase.from("plan_cycles").delete().eq("id", id);
    toast.success("Cycle deleted");
    fetchData();
  };

  // --- Subscription Plan CRUD ---
  const openPlanDialog = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan);
      const seq = subPlanCycles.filter(s => s.subscription_plan_id === plan.id).sort((a, b) => a.sequence_order - b.sequence_order).map(s => ({ plan_type: s.plan_type }));
      setPlanForm({ name: plan.name, description: plan.description || "", sequence: seq.length ? seq : [{ plan_type: "regular" }] });
    } else {
      setEditingPlan(null);
      setPlanForm({ name: "", description: "", sequence: [{ plan_type: "regular" }] });
    }
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || planForm.sequence.length === 0) { toast.error("Name and at least one cycle required"); return; }

    const totalRegular = planForm.sequence.filter(s => s.plan_type === "regular").length;
    const totalGrid = planForm.sequence.filter(s => s.plan_type === "grid").length;

    const planData = {
      organization_id: 1,
      name: planForm.name,
      description: planForm.description || null,
      total_cycles: planForm.sequence.length,
      total_regular_cycles: totalRegular,
      total_grid_cycles: totalGrid,
    };

    let planId: number;
    if (editingPlan) {
      const { error } = await supabase.from("subscription_plans").update(planData).eq("id", editingPlan.id);
      if (error) { toast.error("Failed to update"); return; }
      planId = editingPlan.id;
      await supabase.from("subscription_plan_cycles").delete().eq("subscription_plan_id", planId);
    } else {
      const { data, error } = await supabase.from("subscription_plans").insert(planData).select().single();
      if (error) { toast.error("Failed to create"); return; }
      planId = data.id;
    }

    const seqRows = planForm.sequence.map((s, i) => ({
      subscription_plan_id: planId,
      sequence_order: i + 1,
      plan_type: s.plan_type,
    }));
    await supabase.from("subscription_plan_cycles").insert(seqRows);

    toast.success(editingPlan ? "Plan updated" : "Plan created");
    setPlanDialogOpen(false);
    fetchData();
  };

  const deletePlan = async (id: number) => {
    await supabase.from("subscription_plans").delete().eq("id", id);
    toast.success("Plan deleted");
    fetchData();
  };

  const togglePlanActive = async (plan: any) => {
    await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    fetchData();
  };

  // --- Calendar helpers ---
  const getCycleForDate = (date: Date) => {
    return cycles.find(c => {
      const start = parseISO(c.start_date);
      const end = c.end_date ? parseISO(c.end_date) : new Date("2099-12-31");
      return date >= start && date <= end;
    });
  };

  const getSessionsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return sessions.filter(s => s.session_date === dateStr);
  };

  // Build modifiers for calendar
  const regularDates: Date[] = [];
  const gridDates: Date[] = [];
  cycles.forEach(c => {
    if (!c.end_date) return;
    const days = eachDayOfInterval({ start: parseISO(c.start_date), end: parseISO(c.end_date) });
    if (c.plan_type === "regular") regularDates.push(...days);
    else gridDates.push(...days);
  });

  const sessionDates = sessions.map(s => parseISO(s.session_date));

  const selectedCycle = selectedDate ? getCycleForDate(selectedDate) : null;
  const selectedSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  const statusColors: Record<string, string> = {
    scheduled: "bg-primary/20 text-primary",
    completed: "bg-success/20 text-success",
    cancelled: "bg-destructive/20 text-destructive",
    holiday: "bg-warning/20 text-warning",
    sold_out: "bg-muted text-muted-foreground",
  };

  return (
    <AdminLayout title="Plan Cycles">
      <Tabs defaultValue="cycles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        {/* --- CYCLES TAB --- */}
        <TabsContent value="cycles">
          <div className="flex justify-end mb-4">
            <Button className="gradient-primary" onClick={() => openCycleDialog()}><Plus className="h-4 w-4 mr-2" />Add Cycle</Button>
          </div>
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Start</TableHead>
                     <TableHead>End</TableHead>
                     <TableHead>Days</TableHead>
                     <TableHead>Registration</TableHead>
                     <TableHead>Active</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge className={c.plan_type === "regular" ? "bg-primary/20 text-primary" : "bg-purple-500/20 text-purple-400"} variant="secondary">
                          {c.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.start_date}</TableCell>
                      <TableCell className="text-muted-foreground">{c.end_date || "Open"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.duration_days ?? "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const todayStr = new Date().toISOString().split("T")[0];
                          const isOpen = !c.registration_deadline || todayStr <= c.registration_deadline;
                          return (
                            <Badge className={isOpen ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"} variant="secondary">
                              {isOpen ? "Open" : "Closed"}
                            </Badge>
                          );
                        })()}
                        <span className="text-xs text-muted-foreground ml-1">
                          {c.registration_deadline ? `until ${c.registration_deadline}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={c.is_active} onCheckedChange={() => toggleCycleActive(c)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openCycleDialog(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteCycle(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cycles.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No cycles</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cycle Dialog */}
          <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingCycle ? "Edit Cycle" : "Add Cycle"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={cycleForm.name} onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })} placeholder="e.g. March'26" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start Date</Label><Input type="date" value={cycleForm.start_date} onChange={e => setCycleForm({ ...cycleForm, start_date: e.target.value })} /></div>
                  <div><Label>End Date</Label><Input type="date" value={cycleForm.end_date} onChange={e => setCycleForm({ ...cycleForm, end_date: e.target.value })} /></div>
                </div>
                {cycleForm.start_date && cycleForm.end_date && (
                  <p className="text-sm text-muted-foreground">Duration: {differenceInDays(parseISO(cycleForm.end_date), parseISO(cycleForm.start_date))} days</p>
                )}
                <div>
                  <Label>Type</Label>
                  <Select value={cycleForm.plan_type} onValueChange={v => setCycleForm({ ...cycleForm, plan_type: v, grace_days: v === "grid" ? 21 : 14 })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grace Days</Label>
                  <Input type="number" value={cycleForm.grace_days} onChange={e => setCycleForm({ ...cycleForm, grace_days: Number(e.target.value) })} />
                  {cycleForm.start_date && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Registration deadline: {(() => { const d = new Date(cycleForm.start_date); d.setDate(d.getDate() + cycleForm.grace_days); return d.toISOString().split("T")[0]; })()}
                    </p>
                  )}
                </div>
                <Button className="w-full gradient-primary" onClick={handleSaveCycle}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* --- SUBSCRIPTION PLANS TAB --- */}
        <TabsContent value="plans">
          <div className="flex justify-end mb-4">
            <Button className="gradient-primary" onClick={() => openPlanDialog()}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
          </div>
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead>Total Cycles</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subPlans.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.total_regular_cycles > 0 && <Badge variant="secondary" className="bg-primary/20 text-primary mr-1">{p.total_regular_cycles} Regular</Badge>}
                        {p.total_grid_cycles > 0 && <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">{p.total_grid_cycles} Grid</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.total_cycles}</TableCell>
                      <TableCell><Switch checked={p.is_active} onCheckedChange={() => togglePlanActive(p)} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openPlanDialog(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePlan(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {subPlans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No plans</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Plan Dialog */}
          <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingPlan ? "Edit Plan" : "Add Plan"}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div><Label>Name</Label><Input value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="e.g. 3 Regular Months" /></div>
                <div><Label>Description</Label><Input value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} /></div>
                <div>
                  <Label>Cycle Sequence</Label>
                  <div className="space-y-2 mt-2">
                    {planForm.sequence.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                        <Select value={s.plan_type} onValueChange={v => {
                          const seq = [...planForm.sequence];
                          seq[i] = { plan_type: v };
                          setPlanForm({ ...planForm, sequence: seq });
                        }}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="grid">Grid</SelectItem>
                          </SelectContent>
                        </Select>
                        {planForm.sequence.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => setPlanForm({ ...planForm, sequence: planForm.sequence.filter((_, j) => j !== i) })}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setPlanForm({ ...planForm, sequence: [...planForm.sequence, { plan_type: "regular" }] })}>
                      <Plus className="h-3 w-3 mr-1" />Add Cycle
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {planForm.sequence.filter(s => s.plan_type === "regular").length} Regular + {planForm.sequence.filter(s => s.plan_type === "grid").length} Grid = {planForm.sequence.length} Total
                  </p>
                </div>
                <Button className="w-full gradient-primary" onClick={handleSavePlan}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* --- CALENDAR TAB --- */}
        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  className="pointer-events-auto"
                  modifiers={{
                    regular: regularDates,
                    grid: gridDates,
                    hasSession: sessionDates,
                  }}
                  modifiersStyles={{
                    regular: { backgroundColor: "hsl(210 100% 50% / 0.15)" },
                    grid: { backgroundColor: "hsl(270 100% 60% / 0.15)" },
                  }}
                  modifiersClassNames={{
                    hasSession: "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
                  }}
                />
                {/* Legend */}
                <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(210 100% 50% / 0.3)" }} />Regular</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(270 100% 60% / 0.3)" }} />Grid</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" />Session</div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4">
                {selectedDate ? (
                  <div className="space-y-4">
                    <h3 className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
                    {selectedCycle ? (
                      <div className="p-3 rounded-lg border border-border">
                        <p className="text-sm font-medium">{selectedCycle.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={selectedCycle.plan_type === "regular" ? "bg-primary/20 text-primary" : "bg-purple-500/20 text-purple-400"} variant="secondary">
                            {selectedCycle.plan_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{selectedCycle.start_date} → {selectedCycle.end_date || "Open"}</span>
                          {selectedCycle.is_active && <Badge className="bg-success/20 text-success" variant="secondary">Active</Badge>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No cycle for this date</p>
                    )}
                    {selectedSessions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Sessions ({selectedSessions.length})</p>
                        {selectedSessions.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-2 rounded border border-border">
                            <div>
                              <span className="text-sm font-medium">{s.batches?.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{s.start_time}–{s.end_time}</span>
                            </div>
                            <Badge className={statusColors[s.status] || ""} variant="secondary">{s.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No sessions on this date</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Select a date to view details</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default PlanCyclesPage;
