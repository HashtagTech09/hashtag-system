import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MyReports() {
  const { staffUser } = useAuth();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (!staffUser) return;
    void (async () => {
      const { data } = await supabase
        .from("instructor_reports")
        .select("*, batches(name, batch_code), studios:studio_id(name)")
        .eq("instructor_id", staffUser.id)
        .order("session_date", { ascending: false })
        .limit(100);
      setReports(data || []);
    })();
  }, [staffUser]);

  return (
    <AdminLayout title="My Reports">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold font-display">My Reports</h1>
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No reports submitted yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {r.batches?.batch_code || "—"}
                      </Badge>
                      <span className="font-semibold truncate">{r.batches?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.session_date} · {r.style || "—"} · {r.students_present} students
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{r.total_score ?? 0}/15</p>
                    <p className="text-xs text-muted-foreground">{Math.round(Number(r.compliance_pct || 0))}%</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
