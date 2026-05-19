import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Edit, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useScopedStudents } from "@/hooks/useScopedStudents";

interface StudioForm {
  name: string;
  location: string;
  google_maps_url: string;
  code: string;
  wingperson_id: string;
  dreamcatcher_id: string;
}

const emptyForm: StudioForm = { name: "", location: "", google_maps_url: "", code: "", wingperson_id: "", dreamcatcher_id: "" };

const StudiosPage = () => {
  const scope = useScopedStudents();
  const [studios, setStudios] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StudioForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchStudios = async () => {
    let q: any = supabase
      .from("studios")
      .select("*, wingperson:users!studios_wingperson_id_fkey(id, name), dreamcatcher:users!studios_dreamcatcher_id_fkey(id, name)")
      .eq("organization_id", 1)
      .order("name");
    if (!scope.unrestricted) {
      if (scope.studioIds.length === 0) { setStudios([]); return; }
      q = q.in("id", scope.studioIds);
    }
    const { data } = await q;
    setStudios(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from("users").select("id, name").eq("organization_id", 1).order("name");
    setUsers(data || []);
  };

  useEffect(() => {
    if (scope.loading) return;
    fetchStudios(); fetchUsers();
  }, [scope.loading, scope.unrestricted, scope.studioIds.join(",")]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name,
      location: form.location || null,
      google_maps_url: form.google_maps_url || null,
      code: form.code || null,
      wingperson_id: form.wingperson_id ? Number(form.wingperson_id) : null,
      dreamcatcher_id: form.dreamcatcher_id ? Number(form.dreamcatcher_id) : null,
    };
    if (editId) {
      await supabase.from("studios").update(payload).eq("id", editId);
      toast.success("Studio updated");
    } else {
      await supabase.from("studios").insert({ organization_id: 1, ...payload });
      toast.success("Studio added");
    }
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(false);
    fetchStudios();
  };

  const handleDelete = async (id: number) => {
    await supabase.from("studios").delete().eq("id", id);
    toast.success("Studio deleted");
    fetchStudios();
  };

  const filtered = studios.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AdminLayout title="Studios">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search studios..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Studio</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit Studio" : "Add Studio"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>Google Maps URL</Label><Input value={form.google_maps_url} onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Wingperson</Label>
                  <Select value={form.wingperson_id} onValueChange={(v) => setForm({ ...form, wingperson_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dreamcatcher</Label>
                  <Select value={form.dreamcatcher_id} onValueChange={(v) => setForm({ ...form, dreamcatcher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <TableHead>Studio</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Map</TableHead>
                <TableHead>Wingperson</TableHead>
                <TableHead>Dreamcatcher</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((studio) => (
                <TableRow key={studio.id}>
                  <TableCell className="font-medium">{studio.name}</TableCell>
                  <TableCell className="text-muted-foreground">{studio.code || "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{studio.location || "—"}</TableCell>
                  <TableCell>
                    {studio.google_maps_url ? (
                      <a href={studio.google_maps_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{studio.wingperson?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{studio.dreamcatcher?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setForm({
                          name: studio.name,
                          location: studio.location || "",
                          google_maps_url: studio.google_maps_url || "",
                          code: studio.code || "",
                          wingperson_id: studio.wingperson_id ? String(studio.wingperson_id) : "",
                          dreamcatcher_id: studio.dreamcatcher_id ? String(studio.dreamcatcher_id) : "",
                        });
                        setEditId(studio.id);
                        setDialogOpen(true);
                      }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(studio.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No studios found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default StudiosPage;
