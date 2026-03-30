import { useState, useEffect } from "react";
import { toISTDateString } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Send } from "lucide-react";
import { getDisplayPhone } from "@/lib/studentUtils";
import { toast } from "sonner";

const PaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sendingReceipt, setSendingReceipt] = useState<number | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      const { data } = await supabase.from("payments").select("*, students(name, phone, email, users(phone, email))").eq("organization_id", 1).order("created_at", { ascending: false });
      setPayments(data || []);
    };
    fetchPayments();
  }, []);

  const statusColors: Record<string, string> = { success: "bg-success/20 text-success", pending: "bg-warning/20 text-warning", failed: "bg-destructive/20 text-destructive" };

  const filtered = payments.filter((p) => p.students?.name?.toLowerCase().includes(search.toLowerCase()));

  const handleResendReceipt = async (payment: any) => {
    setSendingReceipt(payment.id);
    try {
      const student = payment.students;
      const templateData = {
        student_name: student?.name || "Student",
        amount: payment.final_amount || payment.amount,
        payment_mode: payment.payment_mode || "cash",
        transaction_id: payment.gateway_payment_id || `CASH-${payment.id}`,
        date: toISTDateString(payment.created_at),
      };

      // Send email if available
      const email = student?.email || student?.users?.email;
      if (email) {
        await supabase.functions.invoke("send-receipt", {
          body: { channel: "email", recipient: email, template_name: "payment-receipt", template_data: templateData, student_id: student?.id, payment_id: payment.id },
        });
      }

      // Send WhatsApp
      const phone = student ? getDisplayPhone(student) : null;
      if (phone) {
        await supabase.functions.invoke("send-receipt", {
          body: { channel: "whatsapp", recipient: phone.replace(/\D/g, ""), template_name: "payment-receipt", template_data: templateData, student_id: student?.id, payment_id: payment.id },
        });
      }

      toast.success("Receipt sent!");
    } catch {
      toast.error("Failed to send receipt");
    } finally {
      setSendingReceipt(null);
    }
  };

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
                <TableHead>Phone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">Net Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Razorpay Ref</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.students ? getDisplayPhone(p.students) : "—"}</TableCell>
                  <TableCell className="font-display">₹{Number(p.final_amount || p.amount).toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell font-display">{p.net_amount ? `₹${Number(p.net_amount).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{p.payment_mode || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.rzp_account ? <Badge variant="outline" className="capitalize">{p.rzp_account}</Badge> : "—"}</TableCell>
                  <TableCell><Badge className={statusColors[p.status] || ""} variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{p.gateway_payment_id || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{toISTDateString(p.created_at)}</TableCell>
                  <TableCell>
                    {p.status === "success" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResendReceipt(p)}
                        disabled={sendingReceipt === p.id}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default PaymentsPage;
