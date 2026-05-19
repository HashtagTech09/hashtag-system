import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { STYLE_OPTIONS, LEVEL_OPTIONS, buildDisplayStyle, buildEligibilityKey } from "@/lib/styleHierarchy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit, X, Calendar, Loader2 } from "lucide-react";
import BatchSessionsDialog from "@/components/BatchSessionsDialog";
import { TimePickerPopover } from "@/components/ui/time-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useScopedStudents } from "@/hooks/useScopedStudents";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleEntry = { day: string; start_time: string; end_time: string };

const BatchesPage = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", style_base: "", level: "", schedule: [] as ScheduleEntry[], studio_id: "", instructor_id: "", instructor_2_id: "", capacity: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [sessionsBatch, setSessionsBatch] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const generateBatchCode = (name: string, studioId: string) => {
    const studio = studios.find((s) => String(s.id) === studioId);
    const cleanName = name.replace(/\s+/g, "");
    return studio?.code ? `${cleanName}-${studio.code}` : cleanName;
  };

  const fetchData = async () => {
    try {
      const [batchRes, studioRes, instrRes] = await Promise.all([
        supabase.from("batches").select("*, studios(name), users(name)").eq("organization_id", 1).order("created_at", { ascending: false }),
        supabase.from("studios").select("*").eq("organization_id", 1),
        supabase.from("users").select("*, user_roles!inner(roles!inner(name))").eq("organization_id", 1).eq("user_roles.roles.name", "instructor"),
      ]);
      if (batchRes.error) throw batchRes.error;
      if (studioRes.error) throw studioRes.error;
      if (instrRes.error) throw instrRes.error;
      setBatches(batchRes.data || []);
      setStudios(studioRes.data || []);
      setInstructors(instrRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleDay = (day: string) => {
    setForm((f) => {
      const exists = f.schedule.find((s) => s.day === day);
      if (exists) {
        return { ...f, schedule: f.schedule.filter((s) => s.day !== day) };
      }
      return { ...f, schedule: [...f.schedule, { day, start_time: "", end_time: "" }] };
    });
  };

  const updateScheduleTime = (day: string, field: "start_time" | "end_time", value: string) => {
    setForm((f) => ({
      ...f,
      schedule: f.schedule.map((s) => s.day === day ? { ...s, [field]: value } : s),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const batchCode = generateBatchCode(form.name, form.studio_id);
      const displayStyle = buildDisplayStyle(form.style_base, form.level);
      const eligibilityKey = buildEligibilityKey(form.style_base, form.level);
      const payload = {
        organization_id: 1, name: form.name,
        style: displayStyle || null,
        style_base: form.style_base || null,
        level: form.level || null,
        eligibility_key: eligibilityKey || null,
        schedule: form.schedule.length > 0 ? form.schedule : null,
        studio_id: form.studio_id ? Number(form.studio_id) : null,
        instructor_id: form.instructor_id ? Number(form.instructor_id) : null,
        instructor_2_id: form.instructor_2_id ? Number(form.instructor_2_id) : null,
        capacity: form.capacity ? Number(form.capacity) : null,
        batch_code: batchCode || null,
      };
      if (editId) {
        const { organization_id, ...updatePayload } = payload;
        const { error } = await supabase.from("batches").update(updatePayload).eq("id", editId);
        if (error) { toast.error(error.message); return; }
        toast.success("Batch updated");
      } else {
        const { error } = await supabase.from("batches").insert(payload);
        if (error) { toast.error(error.message); return; }
        toast.success("Batch added");
      }
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => { setForm({ name: "", style_base: "", level: "", schedule: [], studio_id: "", instructor_id: "", instructor_2_id: "", capacity: "" }); setEditId(null); setDialogOpen(false); };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("batches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Batch deleted");
    fetchData();
  };

  const getSchedule = (batch: any): ScheduleEntry[] => {
    if (!batch.schedule) return [];
    if (Array.isArray(batch.schedule)) return batch.schedule;
    return [];
  };

  const formatScheduleDisplay = (batch: any) => {
    const sched = getSchedule(batch);
    if (sched.length === 0) return "—";
    return sched.map((s) => `${s.day} ${s.start_time?.slice(0, 5) || ""}–${s.end_time?.slice(0, 5) || ""}`).join(", ");
  };

  const filtered = batches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.batch_code && b.batch_code.toLowerCase().includes(search.toLowerCase()))
  );

  // Sort schedule entries by day order for display
  const sortedSchedule = [...form.schedule].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  return (
    <AdminLayout title="Batches">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search batches..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Batch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit Batch" : "Add Batch"}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {form.name && (
                <div className="p-2 rounded bg-muted text-sm text-muted-foreground">
                  Batch ID: <span className="font-mono font-medium text-foreground">{generateBatchCode(form.name, form.studio_id)}</span>
                </div>
              )}
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Style</Label>
                <Select value={form.style_base} onValueChange={(v) => setForm({ ...form, style_base: v })}>
                  <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.style_base && form.level && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Display: <span className="font-medium">{buildDisplayStyle(form.style_base, form.level)}</span> · Key: <span className="font-mono">{buildEligibilityKey(form.style_base, form.level)}</span>
                  </p>
                )}
              </div>
              <div>
                <Label>Days & Schedule</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((day) => (
                    <Badge
                      key={day}
                      variant={form.schedule.some((s) => s.day === day) ? "default" : "outline"}
                      className={`cursor-pointer ${form.schedule.some((s) => s.day === day) ? "gradient-primary" : ""}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day}
                    </Badge>
                  ))}
                </div>
                {sortedSchedule.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {sortedSchedule.map((entry) => (
                      <div key={entry.day} className="flex items-center gap-2">
                        <span className="text-sm font-medium w-10">{entry.day}</span>
                        <TimePickerPopover value={entry.start_time} onChange={(v) => updateScheduleTime(entry.day, "start_time", v)} placeholder="Start" />
                        <span className="text-muted-foreground text-sm">–</span>
                        <TimePickerPopover value={entry.end_time} onChange={(v) => updateScheduleTime(entry.day, "end_time", v)} placeholder="End" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleDay(entry.day)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div><Label>Studio</Label>
                <Select value={form.studio_id} onValueChange={(v) => setForm({ ...form, studio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select studio" /></SelectTrigger>
                  <SelectContent>{studios.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Instructor 1</Label>
                <Select value={form.instructor_id} onValueChange={(v) => setForm({ ...form, instructor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                  <SelectContent>{instructors.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Instructor 2</Label>
                <Select value={form.instructor_2_id} onValueChange={(v) => setForm({ ...form, instructor_2_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select instructor (optional)" /></SelectTrigger>
                  <SelectContent>{instructors.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <Button className="w-full gradient-primary" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Style</TableHead>
                <TableHead className="hidden md:table-cell">Schedule</TableHead>
                <TableHead className="hidden lg:table-cell">Instructor</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No batches found</TableCell></TableRow>
              ) : (
                filtered.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{batch.batch_code || "—"}</TableCell>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{batch.style || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{formatScheduleDisplay(batch)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {(() => {
                        const i1 = instructors.find((i) => i.id === batch.instructor_id);
                        const i2 = instructors.find((i) => i.id === batch.instructor_2_id);
                        const names = [i1?.name, i2?.name].filter(Boolean).join(", ");
                        return names || "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Sessions" onClick={() => setSessionsBatch(batch)}>
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          const sched = getSchedule(batch);
                          setForm({
                            name: batch.name, style_base: batch.style_base || "", level: batch.level || "",
                            schedule: sched,
                            studio_id: batch.studio_id ? String(batch.studio_id) : "",
                            instructor_id: batch.instructor_id ? String(batch.instructor_id) : "",
                            instructor_2_id: batch.instructor_2_id ? String(batch.instructor_2_id) : "",
                            capacity: batch.capacity ? String(batch.capacity) : "",
                          });
                          setEditId(batch.id);
                          setDialogOpen(true);
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(batch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {sessionsBatch && (
        <BatchSessionsDialog
          open={!!sessionsBatch}
          onOpenChange={(open) => { if (!open) setSessionsBatch(null); }}
          batch={sessionsBatch}
        />
      )}
    </AdminLayout>
  );
};

export default BatchesPage;
