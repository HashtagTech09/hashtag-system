import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { todayIST } from "@/lib/dateUtils";
import { MapPin, Clock, Users, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StaffDashboard = () => {
  const { staffUser } = useAuth();
  const navigate = useNavigate();
  const [myBatches, setMyBatches] = useState<any[]>([]);
  const [myStudios, setMyStudios] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!staffUser) return;
    const fetchData = async () => {
      // Fetch batches where this staff is instructor
      const { data: batches } = await supabase
        .from("batches")
        .select("*, studios(name, location, google_maps_url)")
        .or(`instructor_id.eq.${staffUser.id},instructor_2_id.eq.${staffUser.id}`)
        .eq("organization_id", 1);
      setMyBatches(batches || []);

      // Fetch studios where staff is wingperson or dreamcatcher
      const { data: studios } = await supabase
        .from("studios")
        .select("*")
        .or(`wingperson_id.eq.${staffUser.id},dreamcatcher_id.eq.${staffUser.id}`)
        .eq("organization_id", 1);
      setMyStudios(studios || []);

      // Today's sessions
      const today = todayIST();
      const batchIds = (batches || []).map(b => b.id);
      if (batchIds.length > 0) {
        const { data: sessions } = await supabase
          .from("batch_sessions")
          .select("*, batches(name, batch_code)")
          .in("batch_id", batchIds)
          .eq("session_date", today)
          .order("start_time");
        setTodaySessions(sessions || []);

        // Get student counts per batch from enrollments
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("batch_id, student_id")
          .in("batch_id", batchIds)
          .lte("start_date", today)
          .gte("end_date", today);
        const counts = new Map<number, number>();
        const seen = new Map<number, Set<number>>();
        (enrollments || []).forEach(e => {
          if (!seen.has(e.batch_id)) seen.set(e.batch_id, new Set());
          seen.get(e.batch_id)!.add(e.student_id);
        });
        seen.forEach((students, batchId) => counts.set(batchId, students.size));
        setStudentCounts(counts);
      }
    };
    fetchData();
  }, [staffUser]);

  const formatSchedule = (schedule: any) => {
    if (!schedule || !Array.isArray(schedule)) return "No schedule";
    return schedule.map((s: any) => `${s.day} ${s.start_time}–${s.end_time}`).join(", ");
  };

  return (
    <AdminLayout title={`Welcome, ${staffUser?.name || "Staff"}`}>
      {/* Today's Sessions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Today's Sessions
        </h2>
        {todaySessions.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              No sessions scheduled for today
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {todaySessions.map(session => (
              <Card key={session.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">{session.batches?.batch_code || session.batches?.name}</span>
                    <Badge variant={session.status === "completed" ? "secondary" : "default"}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {session.start_time} – {session.end_time}
                  </div>
                  {session.style && (
                    <span className="text-xs text-muted-foreground">{session.style}</span>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-3 gradient-primary"
                    onClick={() => navigate("/attendance")}
                  >
                    Mark Attendance
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* My Batches */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          My Batches
        </h2>
        {myBatches.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              No batches assigned
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myBatches.map(batch => (
              <Card key={batch.id} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{batch.batch_code || batch.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-xs text-muted-foreground">{batch.style} • {batch.level}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatSchedule(batch.schedule)}
                  </div>
                  {batch.studios?.name && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {batch.studios.name}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span>{studentCounts.get(batch.id) || 0} students</span>
                    {batch.capacity && <span className="text-muted-foreground">/ {batch.capacity}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* My Studios */}
      {myStudios.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            My Studios
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myStudios.map(studio => (
              <Card key={studio.id} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{studio.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {studio.location && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {studio.location}
                    </div>
                  )}
                  {studio.google_maps_url && (
                    <a
                      href={studio.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Open in Maps
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default StaffDashboard;
