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
import { getDisplayPhone } from "@/lib/studentUtils";

const EnrollmentsPage = () => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", batch_ids: [] as string[], payment_mode: "cash", status_type: "NEW" });

  const fetchData = async () => {
    const [enrollRes, studentRes, batchRes] = await Promise.all([
      supabase.from("enrollments").select("*, students(name, phone, users(phone)), batches(name)").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("students").select("*").eq("organization_id", 1).order("name"),
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
    ]);
    setEnrollments(enrollRes.data || []);
    setStudents(studentRes.data || []);
    setBatches(batchRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleEnroll = async () => {
    if (!form.student_id || form.batch_ids.length === 0) { toast.error("Select a student and at least one batch"); return; }

    // Fetch pricing
    const { data: pricing } = await supabase.from("pricing_plans").select("*").eq("organization_id", 1).eq("batch_count", form.batch_ids.length).single();
    const { data: settings } = await supabase.from("system_settings").select("*").eq("organization_id", 1);
    const regFee = Number(settings?.find((s) => s.key === "registration_fee")?.value || 0);

    const baseAmount = pricing ? Number(pricing.price) : form.batch_ids.length * 3000;
    const applyRegFee = form.status_type === "NEW" || form.status_type === "REV";
    const totalAmount = baseAmount + (applyRegFee ? regFee : 0);

    // Create payment
    const { data: payment, error: payError } = await supabase.from("payments").insert({
      organization_id: 1, student_id: Number(form.student_id), amount: totalAmount,
      payment_mode: form.payment_mode, status: "success",
    }).select().single();

    if (payError) { toast.error("Payment failed"); return; }

    // Create enrollments
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    const enrollmentRecords = form.batch_ids.map((batchId) => ({
      organization_id: 1, student_id: Number(form.student_id), batch_id: Number(batchId),
      payment_id: payment.id, status_type: form.status_type,
      registration_fee_applied: applyRegFee, late_renewal: false,
      start_date: today.toISOString().split("T")[0], end_date: endDate.toISOString().split("T")[0],
    }));

    const { error } = await supabase.from("enrollments").insert(enrollmentRecords);
    if (error) { toast.error("Enrollment failed"); return; }

    toast.success(`Enrolled successfully! Amount: ₹${totalAmount}`);
    setForm({ student_id: "", batch_ids: [], payment_mode: "cash", status_type: "NEW" });
    setDialogOpen(false);
    fetchData();
  };

  const toggleBatch = (id: string) => {
    setForm((f) => ({ ...f, batch_ids: f.batch_ids.includes(id) ? f.batch_ids.filter((b) => b !== id) : [...f.batch_ids, id] }));
  };

  const statusColors: Record<string, string> = { NEW: "bg-success/20 text-success", REN: "bg-primary/20 text-primary", REV: "bg-warning/20 text-warning" };

  const filtered = enrollments.filter((e) => e.students?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Enrollments">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />New Enrollment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Enrollment</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div><Label>Student</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Enrollment Type</Label>
                <Select value={form.status_type} onValueChange={(v) => setForm({ ...form, status_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New Enrollment</SelectItem>
                    <SelectItem value="REN">Renewal</SelectItem>
                    <SelectItem value="REV">Revival</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Batches</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {batches.map((b) => (
                    <Badge key={b.id} variant={form.batch_ids.includes(String(b.id)) ? "default" : "outline"} className={`cursor-pointer ${form.batch_ids.includes(String(b.id)) ? "gradient-primary" : ""}`} onClick={() => toggleBatch(String(b.id))}>{b.name}</Badge>
                  ))}
                </div>
              </div>
              <div><Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gradient-primary" onClick={handleEnroll}>Confirm Enrollment</Button>
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
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Start</TableHead>
                <TableHead className="hidden md:table-cell">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.students?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.batches?.name}</TableCell>
                  <TableCell><Badge className={statusColors[e.status_type] || ""} variant="secondary">{e.status_type}{e.late_renewal ? " (Late)" : ""}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.start_date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.end_date}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No enrollments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default EnrollmentsPage;
