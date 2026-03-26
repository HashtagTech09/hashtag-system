import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Layers, CreditCard, UserCheck } from "lucide-react";
import { todayIST } from "@/lib/dateUtils";

const Dashboard = () => {
  const [stats, setStats] = useState({ students: 0, batches: 0, enrollments: 0, todayAttendance: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [students, batches, enrollments, attendance] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", 1),
        supabase.from("batches").select("id", { count: "exact", head: true }).eq("organization_id", 1),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("organization_id", 1),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("organization_id", 1).eq("date", todayIST()),
      ]);
      setStats({
        students: students.count || 0,
        batches: batches.count || 0,
        enrollments: enrollments.count || 0,
        todayAttendance: attendance.count || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Total Students", value: stats.students, icon: GraduationCap, color: "text-primary" },
    { title: "Active Batches", value: stats.batches, icon: Layers, color: "text-primary" },
    { title: "Enrollments", value: stats.enrollments, icon: CreditCard, color: "text-primary" },
    { title: "Today's Attendance", value: stats.todayAttendance, icon: UserCheck, color: "text-primary" },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.title} className="glass-card animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">Use the sidebar to navigate to different sections and manage your dance studio.</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Activity feed will appear here as you start using the system.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
