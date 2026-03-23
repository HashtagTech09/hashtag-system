import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editStudent: any | null;
  onSaved: () => void;
}

const StudentDialog = ({ open, onOpenChange, editStudent, onSaved }: StudentDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // New user creation fields
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  // Selected/linked user
  const [linkedUser, setLinkedUser] = useState<any>(null);

  // Student form fields
  const [form, setForm] = useState({ name: "", phone: "", email: "", dob: "", gender: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const isEdit = !!editStudent;

  useEffect(() => {
    if (open && editStudent) {
      // Edit mode: skip to step 2 with user pre-loaded
      setStep(2);
      setLinkedUser(editStudent.users ? { id: editStudent.user_id, name: editStudent.users.name, phone: editStudent.users.phone, email: editStudent.users.email } : null);
      setForm({
        name: editStudent.name || "",
        phone: editStudent.phone || "",
        email: editStudent.email || "",
        dob: editStudent.dob || "",
        gender: editStudent.gender || "",
      });
      if (editStudent.photo) setPhotoPreview(editStudent.photo);
    } else if (open) {
      resetAll();
    }
  }, [open, editStudent]);

  const resetAll = () => {
    setStep(1);
    setSearchPhone("");
    setSearchResults([]);
    setSearched(false);
    setShowNewUserForm(false);
    setNewUserName("");
    setNewUserEmail("");
    setLinkedUser(null);
    setForm({ name: "", phone: "", email: "", dob: "", gender: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSearchUser = async () => {
    if (!searchPhone.trim()) { toast.error("Enter a phone number"); return; }
    setSearching(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, phone, email")
      .eq("organization_id", 1)
      .eq("phone", searchPhone.trim());
    setSearchResults(data || []);
    setSearched(true);
    setSearching(false);

    if (data && data.length === 1) {
      selectUser(data[0]);
    } else if (!data || data.length === 0) {
      setShowNewUserForm(true);
    }
  };

  const selectUser = (user: any) => {
    setLinkedUser(user);
    setForm((prev) => ({
      ...prev,
      phone: prev.phone || user.phone || "",
      email: prev.email || user.email || "",
    }));
    setStep(2);
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim()) { toast.error("User name is required"); return; }
    const { data, error } = await supabase
      .from("users")
      .insert({
        name: newUserName.trim(),
        phone: searchPhone.trim(),
        email: newUserEmail.trim() || null,
        organization_id: 1,
        source: "frontdesk",
      })
      .select("id, name, phone, email")
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("User created");
    selectUser(data);
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `students/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) { toast.error("Photo upload failed"); return null; }
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!linkedUser) { toast.error("A linked user is required"); return; }
    if (!form.name.trim()) { toast.error("Student name is required"); return; }

    let photoUrl: string | null = null;
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile);
      if (!photoUrl) return;
    }

    const payload: any = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      dob: form.dob || null,
      gender: form.gender || null,
      user_id: linkedUser.id,
    };
    if (photoUrl) payload.photo = photoUrl;

    if (isEdit) {
      await supabase.from("students").update(payload).eq("id", editStudent.id);
      toast.success("Student updated");
    } else {
      payload.organization_id = 1;
      const { error } = await supabase.from("students").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Student added");
    }
    onSaved();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Student" : step === 1 ? "Find or Create User" : "Add Student"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && !isEdit && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the phone number to find an existing user or create a new one.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Phone number"
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  setSearched(false);
                  setShowNewUserForm(false);
                  setSearchResults([]);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearchUser()}
              />
              <Button onClick={handleSearchUser} disabled={searching}>
                <Search className="h-4 w-4 mr-1" />Search
              </Button>
            </div>

            {searched && searchResults.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Multiple users found:</p>
                {searchResults.map((u) => (
                  <Button key={u.id} variant="outline" className="w-full justify-start" onClick={() => selectUser(u)}>
                    {u.name} — {u.phone}
                  </Button>
                ))}
              </div>
            )}

            {searched && searchResults.length === 0 && !showNewUserForm && (
              <p className="text-sm text-muted-foreground">No user found with this phone.</p>
            )}

            {showNewUserForm && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="h-4 w-4" />
                  Create New User
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="User's full name" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Optional" />
                </div>
                <p className="text-xs text-muted-foreground">Phone: {searchPhone}</p>
                <Button className="w-full gradient-primary" onClick={handleCreateUser}>
                  Create User & Continue
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Linked user badge */}
            {linkedUser && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  👤 {linkedUser.name} — {linkedUser.phone}
                </Badge>
                {!isEdit && (
                  <Button variant="ghost" size="sm" onClick={() => { setStep(1); setLinkedUser(null); }}>
                    <ArrowLeft className="h-3 w-3 mr-1" />Change
                  </Button>
                )}
              </div>
            )}

            {/* Photo */}
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
            <div><Label>Phone (student-specific)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Leave blank to use user's phone" /></div>
            <div><Label>Email (student-specific)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Leave blank to use user's email" /></div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select gender (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full gradient-primary" onClick={handleSave}>Save</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentDialog;
