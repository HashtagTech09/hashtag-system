import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const PaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPayments = async () => {
      const { data } = await supabase.from("payments").select("*, students(name)").eq("organization_id", 1).order("created_at", { ascending: false });
      setPayments(data || []);
    };
    fetchPayments();
  }, []);

  const statusColors: Record<string, string> = { success: "bg-success/20 text-success", pending: "bg-warning/20 text-warning", failed: "bg-destructive/20 text-destructive" };

  const filtered = payments.filter((p) => p.students?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Payments">
      <div className="mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.name}</TableCell>
                  <TableCell className="font-display">₹{Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{p.payment_mode || "—"}</TableCell>
                  <TableCell><Badge className={statusColors[p.status] || ""} variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default PaymentsPage;
