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
import { Plus, Search, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BatchesPage = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", style: "", level: "", days: [] as string[], start_time: "", end_time: "", studio_id: "", instructor_id: "", capacity: "" });

  const generateBatchCode = (name: string, studioId: string) => {
    const studio = studios.find((s) => String(s.id) === studioId);
    const cleanName = name.replace(/\s+/g, "");
    return studio?.code ? `${cleanName}-${studio.code}` : cleanName;
  };
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    const [batchRes, studioRes, instrRes] = await Promise.all([
      supabase.from("batches").select("*, studios(name), users(name)").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("studios").select("*").eq("organization_id", 1),
      supabase.from("users").select("*, user_roles!inner(roles!inner(name))").eq("organization_id", 1).eq("user_roles.roles.name", "instructor"),
    ]);
    setBatches(batchRes.data || []);
    setStudios(studioRes.data || []);
    setInstructors(instrRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleDay = (day: string) => {
    setForm((f) => ({ ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day] }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const batchCode = generateBatchCode(form.name, form.studio_id);
    const payload = {
      organization_id: 1, name: form.name, style: form.style || null, level: form.level || null,
      days: form.days, start_time: form.start_time || null, end_time: form.end_time || null,
      studio_id: form.studio_id ? Number(form.studio_id) : null,
      instructor_id: form.instructor_id ? Number(form.instructor_id) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      batch_code: batchCode || null,
    };
    if (editId) {
      const { organization_id, ...updatePayload } = payload;
      await supabase.from("batches").update(updatePayload).eq("id", editId);
      toast.success("Batch updated");
    } else {
      await supabase.from("batches").insert(payload);
      toast.success("Batch added");
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => { setForm({ name: "", style: "", level: "", days: [], start_time: "", end_time: "", studio_id: "", instructor_id: "", capacity: "" }); setEditId(null); setDialogOpen(false); };

  const handleDelete = async (id: number) => {
    await supabase.from("batches").delete().eq("id", id);
    toast.success("Batch deleted");
    fetchData();
  };

  const filtered = batches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || (b.batch_code && b.batch_code.toLowerCase().includes(search.toLowerCase())));

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
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Style</Label><Input placeholder="Hip Hop, Bollywood..." value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} /></div>
                <div><Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map((day) => (
                    <Badge key={day} variant={form.days.includes(day) ? "default" : "outline"} className={`cursor-pointer ${form.days.includes(day) ? "gradient-primary" : ""}`} onClick={() => toggleDay(day)}>{day}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div><Label>Studio</Label>
                <Select value={form.studio_id} onValueChange={(v) => setForm({ ...form, studio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select studio" /></SelectTrigger>
                  <SelectContent>{studios.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Instructor</Label>
                <Select value={form.instructor_id} onValueChange={(v) => setForm({ ...form, instructor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                  <SelectContent>{instructors.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
              <Button className="w-full gradient-primary" onClick={handleSave}>Save</Button>
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
                <TableHead className="hidden md:table-cell">Days</TableHead>
                <TableHead className="hidden md:table-cell">Time</TableHead>
                <TableHead className="hidden lg:table-cell">Instructor</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{batch.batch_code || "—"}</TableCell>
                  <TableCell className="font-medium">{batch.name}</TableCell>
                  <TableCell className="text-muted-foreground">{batch.style || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell"><div className="flex gap-1 flex-wrap">{(batch.days || []).map((d: string) => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}</div></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{batch.start_time && batch.end_time ? `${batch.start_time.slice(0, 5)} - ${batch.end_time.slice(0, 5)}` : "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{batch.users?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({ name: batch.name, style: batch.style || "", level: batch.level || "", days: batch.days || [], start_time: batch.start_time || "", end_time: batch.end_time || "", studio_id: batch.studio_id ? String(batch.studio_id) : "", instructor_id: batch.instructor_id ? String(batch.instructor_id) : "", capacity: batch.capacity ? String(batch.capacity) : "" }); setEditId(batch.id); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(batch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No batches found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default BatchesPage;
