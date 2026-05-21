import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, MessageCircle, ClipboardCheck, User, Search } from "lucide-react";
import { getDisplayPhone } from "@/lib/studentUtils";

export interface BatchPopupEnrollment {
  student_id: number;
  displayStatus: string;
}

export interface BatchPopupBatch {
  id: number;
  name: string;
}

interface Props {
  batch: BatchPopupBatch | null;
  enrollments: BatchPopupEnrollment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StudentRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  users?: { phone: string | null; email: string | null; name: string | null } | null;
  status: string;
}

const statusVariant = (s: string): "default" | "secondary" | "outline" => {
  if (s === "NEW") return "default";
  if (s === "REN" || s === "REV") return "secondary";
  return "outline";
};

const normalizePhone = (p?: string | null) => (p || "").replace(/[^\d+]/g, "");

export default function BatchDetailsPopup({ batch, enrollments, open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Per-student status (first enrollment wins). Stable input regardless of array identity.
  const statusByStudent = useMemo(() => {
    const m = new Map<number, string>();
    enrollments.forEach(e => {
      if (!m.has(e.student_id)) m.set(e.student_id, e.displayStatus);
    });
    return m;
  }, [enrollments]);

  const studentIds = useMemo(() => Array.from(statusByStudent.keys()).sort((a, b) => a - b), [statusByStudent]);
  const idKey = studentIds.join(",");

  const { data: students, isLoading } = useQuery({
    queryKey: ["batch-popup-students", batch?.id, idKey],
    enabled: open && !!batch && studentIds.length > 0,
    queryFn: async (): Promise<StudentRow[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, phone, email, users(name, phone, email)")
        .in("id", studentIds);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        status: statusByStudent.get(s.id) || "",
      }));
    },
  });

  const filteredSorted = useMemo(() => {
    const list = students || [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(s =>
          (s.name || "").toLowerCase().includes(q) ||
          (getDisplayPhone(s) || "").toLowerCase().includes(q)
        )
      : list;
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
  }, [students, search]);

  const total = students?.length ?? statusByStudent.size;

  const Body = (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students…"
          className="pl-9 bg-background/50"
        />
      </div>

      <ScrollArea className={isMobile ? "h-[55vh]" : "h-[55vh] max-h-[420px]"}>
        <div className="space-y-1.5 pr-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : filteredSorted.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              {search ? "No students match your search." : "No students in this batch."}
            </div>
          ) : (
            filteredSorted.map(s => {
              const phone = getDisplayPhone(s);
              const phoneClean = normalizePhone(phone);
              return (
                <div
                  key={s.id}
                  className="group flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-primary/30 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold shrink-0">
                    {(s.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{s.name}</span>
                      {s.status && (
                        <Badge variant={statusVariant(s.status)} className="text-[10px] px-1.5 py-0">
                          {s.status}
                        </Badge>
                      )}
                    </div>
                    {phone && phone !== "—" && (
                      <div className="text-xs text-muted-foreground truncate">{phone}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    {phoneClean && (
                      <>
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Call"
                        >
                          <a href={`tel:${phoneClean}`} onClick={e => e.stopPropagation()}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="WhatsApp"
                        >
                          <a
                            href={`https://wa.me/${phoneClean.replace(/^\+/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Mark Attendance"
                      onClick={() => {
                        if (batch) navigate(`/attendance?batch=${batch.id}`);
                        onOpenChange(false);
                      }}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Open Profile"
                      onClick={() => {
                        navigate(`/students?id=${s.id}`);
                        onOpenChange(false);
                      }}
                    >
                      <User className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const title = (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-lg">{batch?.name || "Batch"}</span>
      <span className="text-xs text-muted-foreground">{total} student{total === 1 ? "" : "s"}</span>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-2xl">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle asChild><div>{title}</div></DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 flex flex-col flex-1 min-h-0">{Body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl shadow-elegant backdrop-blur-xl border-primary/20">
        <DialogHeader className="text-left">
          <DialogTitle asChild><div>{title}</div></DialogTitle>
        </DialogHeader>
        {Body}
      </DialogContent>
    </Dialog>
  );
}
