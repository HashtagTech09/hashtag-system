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

const StaffPage = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "instructor", studio_id: "" });
  const [editId, setEditId] = useState<number | null>(null);

  const fetchData = async () => {
    const [staffRes, studioRes] = await Promise.all([
      supabase.from("users").select("*").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("studios").select("*").eq("organization_id", 1),
    ]);
    setStaff(staffRes.data || []);
    setStudios(studioRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = { organization_id: 1, name: form.name, email: form.email || null, phone: form.phone || null, role: form.role, studio_id: form.studio_id ? Number(form.studio_id) : null };
    if (editId) {
      const { organization_id, ...updatePayload } = payload;
      await supabase.from("users").update(updatePayload).eq("id", editId);
      toast.success("Staff updated");
    } else {
      await supabase.from("users").insert(payload);
      toast.success("Staff added");
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => { setForm({ name: "", email: "", phone: "", role: "instructor", studio_id: "" }); setEditId(null); setDialogOpen(false); };

  const handleDelete = async (id: number) => {
    await supabase.from("users").delete().eq("id", id);
    toast.success("Staff deleted");
    fetchData();
  };

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const roleColors: Record<string, string> = { admin: "bg-primary/20 text-primary", manager: "bg-warning/20 text-warning", frontdesk: "bg-success/20 text-success", instructor: "bg-secondary text-secondary-foreground" };

  return (
    <AdminLayout title="Staff Management">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="frontdesk">Front Desk</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Studio</Label>
                <Select value={form.studio_id} onValueChange={(v) => setForm({ ...form, studio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select studio" /></SelectTrigger>
                  <SelectContent>
                    {studios.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gradient-primary" onClick={handleSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="hidden md:table-cell">Studio</TableHead><TableHead className="w-24">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge className={roleColors[s.role] || ""} variant="secondary">{s.role}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.email || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.studios?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setForm({ name: s.name, email: s.email || "", phone: s.phone || "", role: s.role, studio_id: s.studio_id ? String(s.studio_id) : "" }); setEditId(s.id); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No staff found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default StaffPage;
