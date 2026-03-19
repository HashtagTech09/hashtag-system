import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Edit, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface StudioForm {
  name: string;
  location: string;
  google_maps_url: string;
  code: string;
  wingperson: string;
  dreamcatcher: string;
}

const emptyForm: StudioForm = { name: "", location: "", google_maps_url: "", code: "", wingperson: "", dreamcatcher: "" };

const StudiosPage = () => {
  const [studios, setStudios] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StudioForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchStudios = async () => {
    const { data } = await supabase.from("studios").select("*").eq("organization_id", 1).order("name");
    setStudios(data || []);
  };

  useEffect(() => { fetchStudios(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name,
      location: form.location || null,
      google_maps_url: form.google_maps_url || null,
      code: form.code || null,
      wingperson: form.wingperson || null,
      dreamcatcher: form.dreamcatcher || null,
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
                <div><Label>Wingperson</Label><Input value={form.wingperson} onChange={(e) => setForm({ ...form, wingperson: e.target.value })} /></div>
                <div><Label>Dreamcatcher</Label><Input value={form.dreamcatcher} onChange={(e) => setForm({ ...form, dreamcatcher: e.target.value })} /></div>
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
                  <TableCell className="text-muted-foreground">{studio.wingperson || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{studio.dreamcatcher || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setForm({
                          name: studio.name,
                          location: studio.location || "",
                          google_maps_url: studio.google_maps_url || "",
                          code: studio.code || "",
                          wingperson: studio.wingperson || "",
                          dreamcatcher: studio.dreamcatcher || "",
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
