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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { getDisplayPhone } from "@/lib/studentUtils";
import { buildEligibilityKey, STYLE_OPTIONS, LEVEL_OPTIONS } from "@/lib/styleHierarchy";
import { useScopedStudents } from "@/hooks/useScopedStudents";
import { useSimulatedToday, useTestDate } from "@/contexts/TestDateContext";
import { todayIST } from "@/lib/dateUtils";

const DropInsPage = () => {
  const scope = useScopedStudents();
  const { isTestMode } = useTestDate();
  const simulatedToday = useSimulatedToday();
  const [dropIns, setDropIns] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("drop-ins");

  // Drop-in form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    batch_id: "",
    batch_session_id: "",
    amount: "",
    payment_mode: "razorpay",
  });

  // Credit issuance form
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditForm, setCreditForm] = useState({
    student_id: "",
    style_base: "",
    level: "",
    credits_total: "1",
  });

  const fetchData = async () => {
    let dropQ: any = supabase.from("drop_ins").select("*, students(name, phone, users(phone)), batch_sessions(session_date, start_time, end_time, style, batches(name))").eq("organization_id", 1).order("created_at", { ascending: false });
    let studentQ: any = supabase.from("students").select("*").eq("organization_id", 1).order("name");
    let creditQ: any = supabase.from("drop_in_credits").select("*, students(name)").eq("organization_id", 1).order("created_at", { ascending: false });
    if (!scope.unrestricted) {
      if (scope.studentIds.length === 0) {
        setDropIns([]); setStudents([]); setBatches([]); setCredits([]); return;
      }
      dropQ = dropQ.in("student_id", scope.studentIds);
      studentQ = studentQ.in("id", scope.studentIds);
      creditQ = creditQ.in("student_id", scope.studentIds);
    }
    const [dropInRes, studentRes, batchRes, creditRes] = await Promise.all([
      dropQ, studentQ,
      supabase.from("batches").select("*").eq("organization_id", 1).order("name"),
      creditQ,
    ]);
    setDropIns(dropInRes.data || []);
    setStudents(studentRes.data || []);
    setBatches(batchRes.data || []);
    setCredits(creditRes.data || []);
  };

  useEffect(() => { if (!scope.loading) fetchData(); }, [scope.loading, scope.unrestricted, scope.studentIds.join(",")]);

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
      const browseFromDate = isTestMode ? simulatedToday : todayIST();
      let sessionQuery = supabase.from("batch_sessions").select("*")
        .eq("batch_id", Number(form.batch_id))
        .gte("session_date", browseFromDate)
        .order("session_date")
        .order("start_time");

      if (isTestMode) {
        sessionQuery = sessionQuery.in("status", ["scheduled", "completed", "sold_out"]);
      } else {
        sessionQuery = sessionQuery.eq("status", "scheduled");
      }

      const { data } = await sessionQuery;
      setSessions(data || []);
    };
    fetchSessions();
  }, [form.batch_id, isTestMode, simulatedToday]);

  const handleSave = async () => {
    if (!form.student_id || !form.batch_session_id || !form.amount) {
      toast.error("Fill all required fields");
      return;
    }

    const { data: payment, error: payErr } = await supabase.from("payments").insert({
      organization_id: 1,
      student_id: Number(form.student_id),
      amount: Number(form.amount),
      payment_mode: form.payment_mode,
      status: "success",
    }).select().single();

    if (payErr) { toast.error("Payment failed"); return; }

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

  const handleIssueCredits = async () => {
    if (!creditForm.student_id || !creditForm.style_base || !creditForm.level) {
      toast.error("Fill all required fields");
      return;
    }
    const eligibilityKey = buildEligibilityKey(creditForm.style_base, creditForm.level);
    const { error } = await supabase.from("drop_in_credits").insert({
      organization_id: 1,
      student_id: Number(creditForm.student_id),
      eligibility_key: eligibilityKey,
      credits_total: Number(creditForm.credits_total) || 1,
      credits_used: 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Issued ${creditForm.credits_total} credit(s) for ${eligibilityKey}`);
    setCreditForm({ student_id: "", style_base: "", level: "", credits_total: "1" });
    setCreditDialogOpen(false);
    fetchData();
  };

  const filteredDropIns = dropIns.filter(d => d.students?.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredCredits = credits.filter(c => c.students?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Drop-ins">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Ticket className="h-4 w-4 mr-2" />Issue Credits</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Issue Drop-in Credits</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Student</Label>
                  <Select value={creditForm.student_id} onValueChange={v => setCreditForm({ ...creditForm, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Style</Label>
                  <Select value={creditForm.style_base} onValueChange={v => setCreditForm({ ...creditForm, style_base: v })}>
                    <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                    <SelectContent>{STYLE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level</Label>
                  <Select value={creditForm.level} onValueChange={v => setCreditForm({ ...creditForm, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{LEVEL_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {creditForm.style_base && creditForm.level && (
                  <p className="text-xs text-muted-foreground">
                    Eligibility Key: <span className="font-mono font-medium">{buildEligibilityKey(creditForm.style_base, creditForm.level)}</span>
                  </p>
                )}
                <div>
                  <Label>Number of Credits</Label>
                  <Input type="number" min="1" value={creditForm.credits_total} onChange={e => setCreditForm({ ...creditForm, credits_total: e.target.value })} />
                </div>
                <Button className="w-full gradient-primary" onClick={handleIssueCredits}>Issue Credits</Button>
              </div>
            </DialogContent>
          </Dialog>
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
                      <SelectItem value="razorpay">Razorpay</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full gradient-primary" onClick={handleSave}>Confirm Drop-in</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="drop-ins">Drop-ins</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="drop-ins">
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
                  {filteredDropIns.map(d => (
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
                  {filteredDropIns.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No drop-ins found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Eligibility Key</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCredits.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.students?.name}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{c.eligibility_key}</Badge></TableCell>
                      <TableCell>{c.credits_total}</TableCell>
                      <TableCell>{c.credits_used}</TableCell>
                      <TableCell className="font-semibold">{c.credits_total - c.credits_used}</TableCell>
                      <TableCell className="text-muted-foreground">{c.expiry_date || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredCredits.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No credits found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default DropInsPage;
