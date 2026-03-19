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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit, Upload } from "lucide-react";
import { toast } from "sonner";

const StaffPage = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "instructor", source: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fetchData = async () => {
    const { data } = await supabase.from("users").select("*").eq("organization_id", 1).order("created_at", { ascending: false });
    setStaff(data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `users/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) { toast.error("Photo upload failed"); return null; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile);
      if (!photoUrl) return;
    }

    const payload: any = {
      organization_id: 1,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role,
      source: form.source || null,
    };
    if (photoUrl) payload.photo = photoUrl;

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

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", role: "instructor", source: "" });
    setEditId(null);
    setDialogOpen(false);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleDelete = async (id: number) => {
    await supabase.from("users").delete().eq("id", id);
    toast.success("Staff deleted");
    fetchData();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const roleColors: Record<string, string> = { admin: "bg-primary/20 text-primary", manager: "bg-warning/20 text-warning", frontdesk: "bg-success/20 text-success", instructor: "bg-secondary text-secondary-foreground", parent: "bg-accent text-accent-foreground" };

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
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-center">
                <label className="cursor-pointer">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={photoPreview || undefined} />
                    <AvatarFallback><Upload className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
                    <SelectItem value="parent">Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={s.photo || undefined} />
                        <AvatarFallback className="text-xs">{s.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={roleColors[s.role] || ""} variant="secondary">{s.role}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.email || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.phone || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{s.source || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setForm({ name: s.name, email: s.email || "", phone: s.phone || "", role: s.role, source: s.source || "" });
                        if (s.photo) setPhotoPreview(s.photo);
                        setEditId(s.id);
                        setDialogOpen(true);
                      }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No staff found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default StaffPage;
