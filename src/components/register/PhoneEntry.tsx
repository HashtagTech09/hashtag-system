import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhoneEntryProps {
  onStudentFound: (student: any, user: any) => void;
  onNewUser: (phone: string) => void;
}

export default function PhoneEntry({ onStudentFound, onNewUser }: PhoneEntryProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    const searchPhone = cleaned.length === 10 ? cleaned : cleaned.slice(-10);

    setLoading(true);
    try {
      // Search in students table first
      const { data: students } = await supabase
        .from("students")
        .select("*, users(*)")
        .eq("organization_id", 1)
        .or(`phone.ilike.%${searchPhone},users.phone.ilike.%${searchPhone}`);

      if (students && students.length > 0) {
        onStudentFound(students[0], students[0].users);
        return;
      }

      // Search in users table
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .eq("organization_id", 1)
        .ilike("phone", `%${searchPhone}`);

      if (users && users.length > 0) {
        // User exists but no student record — find associated students
        const { data: studentsByUser } = await supabase
          .from("students")
          .select("*, users(*)")
          .eq("user_id", users[0].id);

        if (studentsByUser && studentsByUser.length > 0) {
          onStudentFound(studentsByUser[0], users[0]);
          return;
        }
      }

      // Not found — new user flow
      onNewUser(searchPhone);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Enter your phone number</Label>
        <p className="text-sm text-muted-foreground mt-1">We'll use this to find or create your account</p>
      </div>
      <div className="flex gap-2">
        <Input
          type="tel"
          placeholder="10-digit phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="text-lg"
          maxLength={13}
          onKeyDown={e => e.key === "Enter" && handleLookup()}
        />
        <Button onClick={handleLookup} disabled={loading} className="gradient-primary shrink-0">
          {loading ? "Looking up..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
