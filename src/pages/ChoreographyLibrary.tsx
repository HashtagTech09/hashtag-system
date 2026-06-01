import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/class-media/${path}`;
}

export default function ChoreographyLibrary() {
  const [items, setItems] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState("all");
  const [instructor, setInstructor] = useState("all");
  const [open, setOpen] = useState<any | null>(null);

  useEffect(() => {
    void (async () => {
      const [{ data: s }, { data: u }] = await Promise.all([
        supabase.from("studios").select("id, name").eq("organization_id", 1).order("name"),
        supabase.from("users").select("id, name").eq("organization_id", 1).order("name"),
      ]);
      setStudios(s || []);
      setInstructors(u || []);
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [studio, instructor]);

  const load = async () => {
    let q = supabase
      .from("choreography_uploads")
      .select("*, batches(name, batch_code)")
      .eq("kind", "choreography")
      .order("taught_on", { ascending: false })
      .limit(200);
    if (studio !== "all") q = q.eq("studio_id", Number(studio));
    if (instructor !== "all") q = q.eq("instructor_id", Number(instructor));
    const { data } = await q;
    setItems(data || []);
  };

  const userMap = useMemo(() => new Map<number, string>(instructors.map((u: any) => [u.id, u.name])), [instructors]);
  const studioMap = useMemo(() => new Map<number, string>(studios.map((s: any) => [s.id, s.name])), [studios]);

  const filtered = items.filter((i) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (i.style || "").toLowerCase().includes(s) ||
      (i.batches?.name || "").toLowerCase().includes(s) ||
      (i.batches?.batch_code || "").toLowerCase().includes(s) ||
      (userMap.get(i.instructor_id) || "").toLowerCase().includes(s)
    );
  });

  return (
    <AdminLayout title="Choreography Library">
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold font-display">Choreography Library</h1>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Search style, batch, instructor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Select value={studio} onValueChange={setStudio}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Studio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All studios</SelectItem>
              {studios.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={instructor} onValueChange={setInstructor}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Instructor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All instructors</SelectItem>
              {instructors.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No choreography videos yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((i) => (
              <button
                key={i.id}
                onClick={() => setOpen(i)}
                className="group text-left"
              >
                <Card className="overflow-hidden transition-shadow hover:shadow-md">
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    <Play className="h-10 w-10 text-primary opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {i.batches?.batch_code || "—"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{i.style || "—"}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{userMap.get(i.instructor_id) || "—"}</p>
                    <p className="text-xs text-muted-foreground">{studioMap.get(i.studio_id) || "—"} · {i.taught_on}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}

        <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {open?.batches?.batch_code} · {open?.style} · {open?.taught_on}
              </DialogTitle>
            </DialogHeader>
            {open && (
              <video src={publicUrl(open.storage_path)} controls className="w-full rounded-lg bg-black" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
