import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { getDisplayPhone, getDisplayEmail, getPhoneSource, getEmailSource } from "@/lib/studentUtils";
import StudentTable from "@/components/students/StudentTable";
import StudentDialog from "@/components/students/StudentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

const StudentsPage = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("*, users(name, phone, email)")
      .eq("organization_id", 1)
      .order("created_at", { ascending: false });
    setStudents(data || []);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleDelete = async (id: number) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student deleted");
    fetchStudents();
  };

  const handleEdit = (student: any) => {
    setEditStudent(student);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditStudent(null);
  };

  const handleSaved = () => {
    handleDialogClose();
    fetchStudents();
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(search)) ||
      (s.users?.phone && s.users.phone.includes(search));
  });

  return (
    <AdminLayout title="Students">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button className="gradient-primary" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Add Student
        </Button>
      </div>

      <StudentDialog
        open={dialogOpen}
        onOpenChange={(open) => { if (!open) handleDialogClose(); else setDialogOpen(true); }}
        editStudent={editStudent}
        onSaved={handleSaved}
      />

      <StudentTable
        students={filtered}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
};

export default StudentsPage;
