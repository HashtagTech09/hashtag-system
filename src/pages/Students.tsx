import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const StudentsPage = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", parent_name: "", parent_phone: "", source: "" });
  const [editId, setEditId] = useState<number | null>(null);

  const fetchStudents = async () => {
    const { data } = await supabase.from("students").select("*").eq("organization_id", 1).order("created_at", { ascending: false });
    setStudents(data || []);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = { organization_id: 1, name: form.name, phone: form.phone || null, email: form.email || null, parent_name: form.parent_name || null, parent_phone: form.parent_phone || null, source: form.source || null };
    if (editId) {
      const { organization_id, ...updatePayload } = payload;
      await supabase.from("students").update(updatePayload).eq("id", editId);
      toast.success("Student updated");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error?.message?.includes("unique")) { toast.error("Phone number already exists"); return; }
      if (error) { toast.error(error.message); return; }
      toast.success("Student added");
    }
    resetForm();
    fetchStudents();
  };

  const resetForm = () => { setForm({ name: "", phone: "", email: "", parent_name: "", parent_phone: "", source: "" }); setEditId(null); setDialogOpen(false); };

  const handleDelete = async (id: number) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student deleted");
    fetchStudents();
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone && s.phone.includes(search))
  );

  return (
    <AdminLayout title="Students">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit Student" : "Add Student"}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Parent Name</Label><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></div>
              <div><Label>Parent Phone</Label><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></div>
              <div><Label>Source</Label><Input placeholder="Instagram, Walk-in, Referral..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
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
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{student.email || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{student.source || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({ name: student.name, phone: student.phone || "", email: student.email || "", parent_name: student.parent_name || "", parent_phone: student.parent_phone || "", source: student.source || "" }); setEditId(student.id); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(student.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No students found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default StudentsPage;
