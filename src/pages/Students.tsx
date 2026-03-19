import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { getDisplayPhone, getDisplayEmail, getPhoneSource, getEmailSource } from "@/lib/studentUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, Trash2, Edit, Upload } from "lucide-react";
import { toast } from "sonner";

const StudentsPage = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", dob: "", gender: "", user_id: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("*, users(name)")
      .eq("organization_id", 1)
      .order("created_at", { ascending: false });
    setStudents(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, phone, email")
      .eq("organization_id", 1)
      .order("name");
    setUsers(data || []);
  };

  useEffect(() => {
    fetchStudents();
    fetchUsers();
  }, []);

  const uploadPhoto = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) { toast.error("Photo upload failed"); return null; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUserSelect = (userId: string) => {
    setForm({ ...form, user_id: userId });
    if (userId) {
      const user = users.find((u) => u.id === Number(userId));
      if (user && !form.phone && !form.email) {
        setForm((prev) => ({
          ...prev,
          user_id: userId,
          phone: prev.phone || user.phone || "",
          email: prev.email || user.email || "",
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile, "students");
      if (!photoUrl) return;
    }

    const payload: any = {
      organization_id: 1,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      dob: form.dob || null,
      gender: form.gender || null,
      user_id: form.user_id ? Number(form.user_id) : null,
    };
    if (photoUrl) payload.photo = photoUrl;

    if (editId) {
      const { organization_id, ...updatePayload } = payload;
      await supabase.from("students").update(updatePayload).eq("id", editId);
      toast.success("Student updated");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Student added");
    }
    resetForm();
    fetchStudents();
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", dob: "", gender: "", user_id: "" });
    setEditId(null);
    setDialogOpen(false);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleDelete = async (id: number) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student deleted");
    fetchStudents();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
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
              <div>
                <Label>Account Holder (User)</Label>
                <Select value={form.user_id} onValueChange={handleUserSelect}>
                  <SelectTrigger><SelectValue placeholder="Select a user (optional)" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select gender (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
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
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Account Holder</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.photo || undefined} />
                        <AvatarFallback className="text-xs">{student.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{student.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{student.email || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{student.users?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setForm({
                          name: student.name,
                          phone: student.phone || "",
                          email: student.email || "",
                          dob: student.dob || "",
                          gender: student.gender || "",
                          user_id: student.user_id ? String(student.user_id) : "",
                        });
                        if (student.photo) setPhotoPreview(student.photo);
                        setEditId(student.id);
                        setDialogOpen(true);
                      }}><Edit className="h-4 w-4" /></Button>
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
