import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Trash2, Edit, Upload, Star, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { ALL_ROLES, roleColors, type UserRole } from "@/lib/roleUtils";
import { useAuth } from "@/hooks/useAuth";

interface RoleRecord {
  id: number;
  name: string;
  type: string;
}

const UsersPage = () => {
  const { session } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", source: "" });
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [primaryRoleId, setPrimaryRoleId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ userId: 0, userName: "", email: "", password: "", hasLogin: false });
  const [authLoading, setAuthLoading] = useState(false);
  const [scopeRestricted, setScopeRestricted] = useState(false);
  const [extraStudentIds, setExtraStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const managerRoleId = roles.find((r) => r.name === "manager")?.id ?? null;
  const isManagerSelected = managerRoleId != null && selectedRoles.includes(managerRoleId);

  const fetchData = async () => {
    const [staffRes, rolesRes, studentsRes] = await Promise.all([
      supabase.from("users").select("*, user_roles(*, roles(name, type))").eq("organization_id", 1).order("created_at", { ascending: false }),
      supabase.from("roles").select("*"),
      supabase.from("students").select("id, name, phone").eq("organization_id", 1).order("name"),
    ]);
    setStaff(staffRes.data || []);
    setRoles(rolesRes.data || []);
    setAllStudents(studentsRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `users/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) { toast.error("Photo upload failed"); return null; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    if (selectedRoles.length === 0) { toast.error("At least one role is required"); return; }

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile);
      if (!photoUrl) return;
    }

    const payload: any = {
      organization_id: 1,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || null,
    };
    if (photoUrl) payload.photo = photoUrl;
    payload.scope_restricted = isManagerSelected ? scopeRestricted : false;

    let userId: number;

    if (editId) {
      const { organization_id, ...updatePayload } = payload;
      await supabase.from("users").update(updatePayload).eq("id", editId);
      userId = editId;
      // Delete old user_roles and re-insert
      await supabase.from("user_roles").delete().eq("user_id", editId).eq("organization_id", 1);
    } else {
      const { data, error } = await supabase.from("users").insert(payload).select("id").single();
      if (error || !data) { toast.error("Failed to create user"); return; }
      userId = data.id;
    }

    // Insert user_roles
    const effectivePrimary = primaryRoleId && selectedRoles.includes(primaryRoleId) ? primaryRoleId : selectedRoles[0];
    const roleInserts = selectedRoles.map((roleId) => ({
      user_id: userId,
      role_id: roleId,
      organization_id: 1,
      is_primary: roleId === effectivePrimary,
    }));
    await supabase.from("user_roles").insert(roleInserts);

    // Sync extra-student access for managers
    await supabase.from("manager_student_access" as any).delete().eq("manager_user_id", userId);
    if (isManagerSelected && extraStudentIds.length > 0) {
      const rows = extraStudentIds.map((sid) => ({
        manager_user_id: userId,
        student_id: sid,
        organization_id: 1,
      }));
      await supabase.from("manager_student_access" as any).insert(rows);
    }

    toast.success(editId ? "User updated" : "User added");
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", source: "" });
    setSelectedRoles([]);
    setPrimaryRoleId(null);
    setEditId(null);
    setDialogOpen(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    setScopeRestricted(false);
    setExtraStudentIds([]);
    setStudentSearch("");
  };

  const handleDelete = async (id: number) => {
    // 1. Unlink from batches (instructor)
    await supabase.from("batches").update({ instructor_id: null }).eq("instructor_id", id);
    // 2. Unlink from studios
    await supabase.from("studios").update({ dreamcatcher_id: null }).eq("dreamcatcher_id", id);
    await supabase.from("studios").update({ wingperson_id: null }).eq("wingperson_id", id);

    // 3. Delete related students
    const { error: studentsError } = await supabase
      .from("students").delete().eq("user_id", id);
    if (studentsError) { toast.error("Failed to delete linked students"); return; }

    // 4. Delete related user_roles
    const { error: rolesError } = await supabase
      .from("user_roles").delete().eq("user_id", id);
    if (rolesError) { toast.error("Failed to delete user roles"); return; }

    // 5. Delete the user
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }

    toast.success("User deleted");
    fetchData();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const getUserRoles = (user: any): UserRole[] => user.user_roles || [];

  const getSortedRoles = (userRoles: UserRole[]) => {
    return [...userRoles].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  };

  return (
    <AdminLayout title="User Management">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit User" : "Add User"}</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-center">
                <label className="cursor-pointer">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={photoPreview || undefined} />
                    <AvatarFallback><Upload className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <Label>Roles *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <span className="text-sm capitalize">{role.name}</span>
                      {selectedRoles.includes(role.id) && (
                        <button
                          type="button"
                          onClick={() => setPrimaryRoleId(role.id)}
                          className={`ml-auto ${primaryRoleId === role.id ? "text-primary" : "text-muted-foreground/40"}`}
                          title="Set as primary"
                        >
                          <Star className={`h-3.5 w-3.5 ${primaryRoleId === role.id ? "fill-primary" : ""}`} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Click ★ to set primary role</p>
              </div>
              <div><Label>Source</Label><Input placeholder="Instagram, Walk-in, Referral..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>

              {isManagerSelected && (
                <div className="border border-border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Restrict to assigned scope</Label>
                      <p className="text-xs text-muted-foreground">When on, this manager only sees students in their studios, batches they instruct, or extras below.</p>
                    </div>
                    <Switch checked={scopeRestricted} onCheckedChange={setScopeRestricted} />
                  </div>
                  {scopeRestricted && (
                    <div>
                      <Label className="text-sm">Extra students ({extraStudentIds.length} selected)</Label>
                      <Input
                        placeholder="Search students..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="mt-1 mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-background">
                        {allStudents
                          .filter((st) => st.name?.toLowerCase().includes(studentSearch.toLowerCase()))
                          .slice(0, 100)
                          .map((st) => (
                            <label key={st.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
                              <Checkbox
                                checked={extraStudentIds.includes(st.id)}
                                onCheckedChange={(c) => {
                                  setExtraStudentIds((prev) =>
                                    c ? [...prev, st.id] : prev.filter((x) => x !== st.id)
                                  );
                                }}
                              />
                              <span>{st.name}</span>
                              {st.phone && <span className="text-muted-foreground text-xs ml-auto">{st.phone}</span>}
                            </label>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Studios and batches are assigned on the Studios and Batches pages.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button className="w-full gradient-primary" onClick={handleSave}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const userRoles = getSortedRoles(getUserRoles(s));
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={s.photo || undefined} />
                          <AvatarFallback className="text-xs">{s.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.map((ur) => (
                          <Badge key={ur.id} className={roleColors[ur.roles?.name || ""] || ""} variant="secondary">
                            {ur.is_primary && <Star className="h-3 w-3 mr-1 fill-current" />}
                            {ur.roles?.name}
                          </Badge>
                        ))}
                        {userRoles.length === 0 && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{s.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{s.phone || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{s.source || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title={s.auth_id ? "Reset Login Password" : "Create Login"} onClick={() => {
                          setAuthForm({ userId: s.id, userName: s.name, email: s.email || "", password: "", hasLogin: Boolean(s.auth_id) });
                          setAuthDialogOpen(true);
                        }}>
                          <KeyRound className={`h-4 w-4 ${s.auth_id ? "text-warning" : "text-primary"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          setForm({ name: s.name, email: s.email || "", phone: s.phone || "", source: s.source || "" });
                          if (s.photo) setPhotoPreview(s.photo);
                          const urs = getUserRoles(s);
                          setSelectedRoles(urs.map((ur: UserRole) => ur.role_id));
                          const primary = urs.find((ur: UserRole) => ur.is_primary);
                          setPrimaryRoleId(primary?.role_id || null);
                          setEditId(s.id);
                          setScopeRestricted(!!s.scope_restricted);
                          const { data: msa } = await supabase
                            .from("manager_student_access" as any)
                            .select("student_id")
                            .eq("manager_user_id", s.id);
                          setExtraStudentIds(((msa as any[]) || []).map((r) => r.student_id));
                          setDialogOpen(true);
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Reset Login Dialog */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{authForm.hasLogin ? "Reset Login for" : "Create Login for"} {authForm.userName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="staff@hashtag.dance" />
            </div>
            <div>
              <Label>Temporary Password *</Label>
              <Input type="text" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <Button
              className="w-full gradient-primary"
              disabled={authLoading || !authForm.email || authForm.password.length < 6}
              onClick={async () => {
                setAuthLoading(true);
                try {
                  const { data, error } = await supabase.functions.invoke("create-staff-auth", {
                    body: { user_id: authForm.userId, email: authForm.email, password: authForm.password },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast.success(authForm.hasLogin ? "Login password reset successfully" : "Login account created successfully");
                  setAuthDialogOpen(false);
                  fetchData();
                } catch (err: any) {
                  toast.error(err.message || "Failed to create login");
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              {authLoading ? (authForm.hasLogin ? "Resetting..." : "Creating...") : (authForm.hasLogin ? "Reset Login Password" : "Create Login Account")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default UsersPage;
