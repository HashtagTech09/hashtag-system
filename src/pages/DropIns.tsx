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
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getDisplayPhone } from "@/lib/studentUtils";

const DropInsPage = () => {
  const [dropIns, setDropIns] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    batch_id: "",
    batch_session_id: "",
    amount: "",
    payment_mode: "cash",
  });

  const fetchData = async () => {
    const [dropInRes, studentRes, batchRes] = await Promise.all([
      supabase.from("drop_ins").select("*, students(name, phone, users(phone)), batch_sessions(session_date, start_time, end_time, style, batches(name))").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("students").select("*").eq("organization_id", 1).order("name"),
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
    ]);
    setDropIns(dropInRes.data || []);
    setStudents(studentRes.data || []);
    setBatches(batchRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  // Load default drop-in fee from settings
  useEffect(() => {
    const loadFee = async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("organization_id", 1).eq("key", "drop_in_fee").single();
      if (data) setForm(f => ({ ...f, amount: data.value }));
    };
    loadFee();
  }, []);

  // Fetch upcoming sessions when batch changes
  useEffect(() => {
    if (!form.batch_id) { setSessions([]); return; }
    const fetchSessions = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase.from("batch_sessions").select("*")
        .eq("batch_id", Number(form.batch_id))
        .eq("status", "scheduled")
        .gte("session_date", today)
        .order("session_date");
      setSessions(data || []);
    };
    fetchSessions();
  }, [form.batch_id]);

  const handleSave = async () => {
    if (!form.student_id || !form.batch_session_id || !form.amount) {
      toast.error("Fill all required fields");
      return;
    }

    // Create payment
    const { data: payment, error: payErr } = await supabase.from("payments").insert({
      organization_id: 1,
      student_id: Number(form.student_id),
      amount: Number(form.amount),
      payment_mode: form.payment_mode,
      status: "success",
    }).select().single();

    if (payErr) { toast.error("Payment failed"); return; }

    // Create drop-in
    const { error } = await supabase.from("drop_ins").insert({
      organization_id: 1,
      student_id: Number(form.student_id),
      batch_session_id: Number(form.batch_session_id),
      amount: Number(form.amount),
      payment_id: payment.id,
    });

    if (error) { toast.error(error.message); return; }

    toast.success("Drop-in recorded!");
    setForm(f => ({ ...f, student_id: "", batch_id: "", batch_session_id: "" }));
    setDialogOpen(false);
    fetchData();
  };

  const filtered = dropIns.filter(d => d.students?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Drop-ins">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />New Drop-in</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Record Drop-in</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Student</Label>
                <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Batch</Label>
                <Select value={form.batch_id} onValueChange={v => setForm({ ...form, batch_id: v, batch_session_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>{batches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {sessions.length > 0 && (
                <div>
                  <Label>Session</Label>
                  <Select value={form.batch_session_id} onValueChange={v => setForm({ ...form, batch_session_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                    <SelectContent>
                      {sessions.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.session_date} • {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)} {s.style ? `• ${s.style}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={v => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gradient-primary" onClick={handleSave}>Confirm Drop-in</Button>
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
                <TableHead>Batch</TableHead>
                <TableHead>Session Date</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Adjusted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.students?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.batch_sessions?.batches?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.batch_sessions?.session_date || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{d.batch_sessions?.style || "—"}</Badge></TableCell>
                  <TableCell className="font-display">₹{Number(d.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_adjusted ? "default" : "secondary"}>
                      {d.is_adjusted ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No drop-ins found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default DropInsPage;
