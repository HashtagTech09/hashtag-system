import { useState, useCallback } from "react";
import Papa from "papaparse";
import AdminLayout from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, CheckCircle2, XCircle, AlertCircle, Download, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { allocateCyclesForPlan, insertEnrollmentCycles } from "@/lib/cycleUtils";

/** Paginated fetch to bypass Supabase 1000-row default limit.
 *  Accepts a factory function so each page gets a fresh query builder. */
async function fetchAll<T>(buildQuery: () => any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const ORG_ID = 1;

const USER_DB_COLUMNS = ["name", "phone", "email", "source"] as const;
const STUDENT_DB_COLUMNS = ["name", "phone", "email", "dob", "gender", "user_phone"] as const;
const ENROLLMENT_DB_COLUMNS = ["student_name", "student_phone", "batch_code", "start_date", "end_date", "status_type", "subscription_plan_name"] as const;
const SMART_ENROLLMENT_COLUMNS = ["student_name", "student_phone", "student_email", "style_level", "studio_code", "cycles"] as const;

type ImportResult = { success: number; errors: number; errorMessages: string[]; extra?: string };

function ImportResultDisplay({ result }: { result: ImportResult }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 20;
  const hasErrors = result.errorMessages.length > 0;

  const downloadSkipped = () => {
    const text = result.errorMessages.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skipped_rows.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleErrors = showAll ? result.errorMessages : result.errorMessages.slice(0, INITIAL_SHOW);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />{result.success} success</Badge>
        <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3 text-destructive" />{result.errors} errors</Badge>
      </div>
      {result.extra && <p className="text-xs text-muted-foreground">{result.extra}</p>}
      {hasErrors && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm text-destructive">Skipped Enrollments ({result.errorMessages.length})</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={downloadSkipped}>
              <Download className="h-3 w-3" /> Download
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="max-h-72 overflow-auto space-y-0.5">
              {visibleErrors.map((msg, i) => (
                <div key={i} className="text-xs font-mono text-destructive/90 py-0.5">
                  {i + 1}. {msg}
                </div>
              ))}
            </div>
            {result.errorMessages.length > INITIAL_SHOW && (
              <Button variant="ghost" size="sm" className="mt-2 text-xs h-6" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show less" : `Show all ${result.errorMessages.length} rows`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function downloadSampleCSV(filename: string, csvString: string) {
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SAMPLES: Record<string, { filename: string; csv: string }> = {
  Users: {
    filename: "sample_users.csv",
    csv: "name,phone,email,source\nJohn Doe,9876543210,john@example.com,referral\nJane Smith,9876543211,jane@example.com,walk-in",
  },
  Students: {
    filename: "sample_students.csv",
    csv: "name,phone,email,dob,gender,user_phone\nJohn Junior,9876543212,jj@example.com,2010-05-15,male,9876543210\nJane Junior,9876543213,,2012-08-20,female,9876543211",
  },
  Enrollments: {
    filename: "sample_enrollments.csv",
    csv: "student_name,student_phone,batch_code,start_date,end_date,status_type,subscription_plan_name\nJohn Junior,9876543212,HipHop-NDA,2025-01-01,2025-03-31,NEW,3 Month Plan\nJane Junior,9876543213,Contemporary-BLR,2025-01-01,2025-06-30,NEW,6 Month Plan",
  },
  "Smart Enrollments": {
    filename: "sample_smart_enrollments.csv",
    csv: "student_name,student_phone,student_email,style_level,studio_code,cycles\nParnika Goel,9811401934,parnika@example.com,Jazz 3,NDA,\"April, May, Grid, July, August, September\"\nJane Smith,9876543211,jane@example.com,Hip Hop 2,NDA,\"April, May, June\"",
  },
};

function CSVImportTab({
  label,
  dbColumns,
  onImport,
}: {
  label: string;
  dbColumns: readonly string[];
  onImport: (rows: Record<string, string>[], mapping: Record<string, string>) => Promise<ImportResult>;
}) {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const optionalCols = ["source", "user_phone", "subscription_plan_name"];

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    Papa.parse(file, {
      complete: (res) => {
        const rows = res.data as string[][];
        if (rows.length < 2) { toast.error("CSV has no data rows"); return; }
        const headers = rows[0].map(h => h.trim());
        setCsvHeaders(headers);
        setCsvData(rows.slice(1).filter(r => r.some(c => c.trim())));
        const autoMap: Record<string, string> = {};
        for (const col of dbColumns) {
          const match = headers.find(h => h.toLowerCase() === col.toLowerCase());
          if (match) autoMap[col] = match;
        }
        setMapping(autoMap);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
  }, [dbColumns]);

  const handleImport = async () => {
    setImporting(true);
    setProgress(10);
    const mappedRows = csvData.map(row => {
      const obj: Record<string, string> = {};
      for (const [dbCol, csvCol] of Object.entries(mapping)) {
        const idx = csvHeaders.indexOf(csvCol);
        if (idx !== -1) obj[dbCol] = row[idx]?.trim() || "";
      }
      return obj;
    });
    setProgress(20);
    try {
      const res = await onImport(mappedRows, mapping);
      setResult(res);
      setProgress(100);
      if (res.success > 0) toast.success(`Imported ${res.success} ${label} records`);
      if (res.errors > 0) toast.error(`${res.errors} rows failed`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setResult({ success: 0, errors: csvData.length, errorMessages: [err.message] });
    }
    setImporting(false);
  };

  const allMapped = dbColumns.filter(c => !optionalCols.includes(c)).every(c => mapping[c]);
  const sample = SAMPLES[label];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input type="file" accept=".csv" onChange={handleFile} className="max-w-sm" />
        {sample && (
          <Button variant="outline" size="sm" onClick={() => downloadSampleCSV(sample.filename, sample.csv)}>
            <Download className="h-4 w-4 mr-1" /> Sample CSV
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Upload a CSV exported from Google Sheets</p>

      {csvHeaders.length > 0 && (
        <>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Column Mapping</CardTitle>
              <CardDescription className="text-xs">Map your CSV columns to database fields</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {dbColumns.map(col => (
                  <div key={col} className="space-y-1">
                    <label className="text-xs font-medium">{col}{!optionalCols.includes(col) && <span className="text-destructive">*</span>}</label>
                    <Select value={mapping[col] || ""} onValueChange={v => setMapping(p => ({ ...p, [col]: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select column" /></SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Preview ({Math.min(5, csvData.length)} of {csvData.length} rows)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>{csvHeaders.map(h => <TableHead key={h} className="text-xs py-1">{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className="text-xs py-1">{cell}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Button onClick={handleImport} disabled={importing || !allMapped} size="sm">
              <Upload className="h-4 w-4 mr-1" /> Import {csvData.length} rows
            </Button>
            {importing && <Progress value={progress} className="w-48 h-2" />}
          </div>

          {result && <ImportResultDisplay result={result} />}
        </>
      )}
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

type OverlapAction = "keep" | "replace" | "skip" | "cancel";
type OverlapConflict = {
  rowIndex: number;
  studentName: string;
  newBatchCode: string;
  newStart: string;
  newEnd: string;
  conflictingEnrollmentIds: number[];
  conflictingBatchNames: string[];
};

export default function ImportPage() {
  const [overlapPrompt, setOverlapPrompt] = useState<{
    conflicts: OverlapConflict[];
    totalRows: number;
    resolver: (action: OverlapAction) => void;
  } | null>(null);
  const [overlapDetailsOpen, setOverlapDetailsOpen] = useState(false);

  const askOverlapResolution = (conflicts: OverlapConflict[], totalRows: number) =>
    new Promise<OverlapAction>((resolve) => {
      setOverlapPrompt({
        conflicts,
        totalRows,
        resolver: (action) => { setOverlapPrompt(null); setOverlapDetailsOpen(false); resolve(action); },
      });
    });

  const importUsers = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    let success = 0, errors = 0;
    const errorMessages: string[] = [];

    const existingUsers = await fetchAll<{ phone: string | null }>(() => supabase.from("users").select("phone").eq("organization_id", ORG_ID));
    const existingPhones = new Set(existingUsers.map(u => u.phone).filter(Boolean));

    const toInsert = rows.filter(r => {
      if (!r.name || !r.phone) { errors++; errorMessages.push(`Missing name or phone`); return false; }
      if (existingPhones.has(r.phone)) { errors++; errorMessages.push(`Duplicate phone: ${r.phone}`); return false; }
      return true;
    });

    for (const batch of chunk(toInsert, 50)) {
      const insertRows = batch.map(r => ({
        name: r.name,
        phone: r.phone || null,
        email: r.email || null,
        source: r.source || "import",
        organization_id: ORG_ID,
      }));
      const { error, data } = await supabase.from("users").insert(insertRows).select();
      if (error) { errors += batch.length; errorMessages.push(error.message); }
      else success += data?.length || 0;
    }
    return { success, errors, errorMessages };
  };

  const importStudents = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    let success = 0, errors = 0;
    const errorMessages: string[] = [];

    const allUsers = await fetchAll<{ id: number; phone: string | null }>(() => supabase.from("users").select("id, phone").eq("organization_id", ORG_ID));
    const phoneToUserId = new Map<string, number>();
    allUsers.forEach(u => { if (u.phone) phoneToUserId.set(u.phone, u.id); });

    const existingStudents = await fetchAll<{ phone: string | null }>(() => supabase.from("students").select("phone").eq("organization_id", ORG_ID));
    const existingPhones = new Set(existingStudents.map(s => s.phone).filter(Boolean));

    const toInsert = rows.filter(r => {
      const phone = r.user_phone || r.phone;
      if (!r.name || !phone) { errors++; errorMessages.push(`Missing name or phone`); return false; }
      if (!phoneToUserId.has(phone)) { errors++; errorMessages.push(`No user found for phone: ${phone}`); return false; }
      if (existingPhones.has(r.phone || phone)) { errors++; errorMessages.push(`Student already exists: ${r.phone || phone}`); return false; }
      return true;
    });

    for (const batch of chunk(toInsert, 50)) {
      const insertRows = batch.map(r => {
        const phone = r.user_phone || r.phone;
        return {
          name: r.name,
          phone: r.phone || phone,
          email: r.email || null,
          dob: r.dob || null,
          gender: r.gender || null,
          user_id: phoneToUserId.get(phone)!,
          organization_id: ORG_ID,
        };
      });
      const { error, data } = await supabase.from("students").insert(insertRows).select();
      if (error) { errors += batch.length; errorMessages.push(error.message); }
      else success += data?.length || 0;
    }
    return { success, errors, errorMessages };
  };

  const importEnrollments = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    let success = 0, errors = 0;
    const errorMessages: string[] = [];
    let usersCreated = 0, studentsCreated = 0;

    // Step 1: Auto-create Users from unique phones
    const uniquePhones = new Map<string, string>(); // phone -> name
    for (const r of rows) {
      if (r.student_phone && r.student_name && !uniquePhones.has(r.student_phone)) {
        uniquePhones.set(r.student_phone, r.student_name);
      }
    }

    const existingUsers = await fetchAll<{ id: number; phone: string | null }>(() => supabase.from("users").select("id, phone").eq("organization_id", ORG_ID));
    const phoneToUserId = new Map<string, number>();
    existingUsers.forEach(u => { if (u.phone) phoneToUserId.set(u.phone, u.id); });

    const newUserPhones = [...uniquePhones.entries()].filter(([phone]) => !phoneToUserId.has(phone));
    for (const batch of chunk(newUserPhones, 50)) {
      const insertRows = batch.map(([phone, name]) => ({
        name, phone, source: "import", organization_id: ORG_ID,
      }));
      const { data, error } = await supabase.from("users").insert(insertRows).select();
      if (error) { errorMessages.push(`User create error: ${error.message}`); }
      else {
        usersCreated += data.length;
        data.forEach(u => { if (u.phone) phoneToUserId.set(u.phone, u.id); });
      }
    }

    // Step 2: Auto-create Students from unique name+phone combos
    const existingStudents = await fetchAll<{ id: number; phone: string | null; name: string }>(() => supabase.from("students").select("id, phone, name").eq("organization_id", ORG_ID));
    const studentKey = (name: string, phone: string) => `${name.toLowerCase().trim()}|${phone}`;
    const existingStudentKeys = new Set(existingStudents.map(s => s.phone ? studentKey(s.name, s.phone) : ""));
    const namePhoneToStudentId = new Map<string, number>();
    existingStudents.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });

    const uniqueStudents = new Map<string, { name: string; phone: string }>();
    for (const r of rows) {
      if (r.student_name && r.student_phone) {
        const key = studentKey(r.student_name, r.student_phone);
        if (!uniqueStudents.has(key) && !existingStudentKeys.has(key)) {
          uniqueStudents.set(key, { name: r.student_name, phone: r.student_phone });
        }
      }
    }

    for (const batch of chunk([...uniqueStudents.values()], 50)) {
      const insertRows = batch.filter(s => phoneToUserId.has(s.phone)).map(s => ({
        name: s.name, phone: s.phone, user_id: phoneToUserId.get(s.phone)!, organization_id: ORG_ID,
      }));
      if (insertRows.length === 0) continue;
      const { data, error } = await supabase.from("students").insert(insertRows).select();
      if (error) { errorMessages.push(`Student create error: ${error.message}`); }
      else {
        studentsCreated += data.length;
        data.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });
      }
    }

    // Refresh student lookup after inserts
    if (studentsCreated > 0) {
      const allStudents = await fetchAll<{ id: number; phone: string | null; name: string }>(() => supabase.from("students").select("id, phone, name").eq("organization_id", ORG_ID));
      allStudents.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });
    }

    // Step 3: Create Enrollments
    const [batches, cycles, subPlans] = await Promise.all([
      fetchAll<{ id: number; batch_code: string | null }>(() => supabase.from("batches").select("id, batch_code").eq("organization_id", ORG_ID)),
      fetchAll<any>(() => supabase.from("plan_cycles").select("*").eq("organization_id", ORG_ID).order("start_date")),
      fetchAll<any>(() => supabase.from("subscription_plans").select("*").eq("organization_id", ORG_ID)),
    ]);
    const codeToBatchId = new Map<string, number>();
    batches.forEach(b => { if (b.batch_code) codeToBatchId.set(b.batch_code.toLowerCase().trim(), b.id); });
    const batchIdToCode = new Map<number, string>();
    batches.forEach(b => { if (b.batch_code) batchIdToCode.set(b.id, b.batch_code); });
    const planByName = new Map<string, any>();
    subPlans.forEach(p => planByName.set(p.name.toLowerCase().trim(), p));

    // Pre-flight: scan rows for overlap with existing active enrollments on OTHER batches
    const candidateStudentIds = new Set<number>();
    const candidates: { rowIndex: number; studentId: number; batchId: number; start: string; end: string; row: Record<string, string> }[] = [];
    rows.forEach((row, rowIndex) => {
      const sid = namePhoneToStudentId.get(studentKey(row.student_name || "", row.student_phone || ""));
      const bid = codeToBatchId.get((row.batch_code || "").toLowerCase().trim());
      if (!sid || !bid || !row.start_date || !row.end_date) return;
      candidateStudentIds.add(sid);
      candidates.push({ rowIndex, studentId: sid, batchId: bid, start: row.start_date, end: row.end_date, row });
    });

    let existingActive: { id: number; student_id: number; batch_id: number; start_date: string; end_date: string }[] = [];
    if (candidateStudentIds.size > 0) {
      const ids = [...candidateStudentIds];
      for (const idChunk of chunk(ids, 200)) {
        const { data } = await supabase
          .from("enrollments")
          .select("id, student_id, batch_id, start_date, end_date")
          .eq("organization_id", ORG_ID)
          .eq("is_active", true)
          .in("student_id", idChunk);
        if (data) existingActive = existingActive.concat(data);
      }
    }

    const conflicts: OverlapConflict[] = [];
    const rowConflictMap = new Map<number, number[]>(); // rowIndex -> enrollment ids to deactivate
    for (const c of candidates) {
      const overlapping = existingActive.filter(e =>
        e.student_id === c.studentId &&
        e.batch_id !== c.batchId &&
        e.start_date <= c.end &&
        e.end_date >= c.start
      );
      if (overlapping.length > 0) {
        conflicts.push({
          rowIndex: c.rowIndex,
          studentName: c.row.student_name,
          newBatchCode: c.row.batch_code,
          newStart: c.start,
          newEnd: c.end,
          conflictingEnrollmentIds: overlapping.map(o => o.id),
          conflictingBatchNames: overlapping.map(o => batchIdToCode.get(o.batch_id) || `Batch ${o.batch_id}`),
        });
        rowConflictMap.set(c.rowIndex, overlapping.map(o => o.id));
      }
    }

    let overlapAction: OverlapAction = "keep";
    if (conflicts.length > 0) {
      overlapAction = await askOverlapResolution(conflicts, rows.length);
    }
    if (overlapAction === "cancel") {
      return { success: 0, errors: 0, errorMessages: ["Import cancelled by operator (overlap conflicts found)"], extra: `Auto-created ${usersCreated} users, ${studentsCreated} students (no enrollments imported)` };
    }

    let deactivated = 0;
    let skipped = 0;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      try {
        const studentId = namePhoneToStudentId.get(studentKey(row.student_name, row.student_phone));
        if (!studentId) { errors++; errorMessages.push(`No student for: ${row.student_name} / ${row.student_phone}`); continue; }

        const batchId = codeToBatchId.get((row.batch_code || "").toLowerCase().trim());
        if (!batchId) { errors++; errorMessages.push(`No batch with code: ${row.batch_code}`); continue; }

        if (!row.start_date || !row.end_date) { errors++; errorMessages.push(`Missing dates for ${row.student_phone}`); continue; }

        // Apply overlap-resolution choice for this row, if it had conflicts
        const conflictIds = rowConflictMap.get(rowIndex);
        if (conflictIds && conflictIds.length > 0) {
          if (overlapAction === "skip") {
            skipped++;
            errorMessages.push(`Skipped (overlap): ${row.student_name} / ${row.student_phone} → ${row.batch_code}`);
            continue;
          }
          if (overlapAction === "replace") {
            const { error: deactErr } = await supabase
              .from("enrollments")
              .update({ is_active: false })
              .in("id", conflictIds);
            if (deactErr) {
              errors++;
              errorMessages.push(`Failed to deactivate prior enrollment(s) for ${row.student_name}: ${deactErr.message}`);
              continue;
            }
            deactivated += conflictIds.length;
          }
          // "keep" falls through to normal insert
        }

        const startCycle = cycles.find(c => c.start_date <= row.start_date && (c.end_date || "2099-12-31") >= row.start_date);
        const endCycle = cycles.find(c => c.start_date <= row.end_date && (c.end_date || "2099-12-31") >= row.end_date);

        const subPlan = row.subscription_plan_name ? planByName.get(row.subscription_plan_name.toLowerCase().trim()) : null;

        const { data: enrollment, error } = await supabase.from("enrollments").insert({
          student_id: studentId,
          batch_id: batchId,
          organization_id: ORG_ID,
          start_date: row.start_date,
          end_date: row.end_date,
          status_type: row.status_type || "NEW",
          start_cycle_id: startCycle?.id || null,
          end_cycle_id: endCycle?.id || null,
          subscription_plan_id: subPlan?.id || null,
        }).select().single();

        if (error) { errors++; errorMessages.push(error.message); continue; }

        if (subPlan && startCycle) {
          const startIdx = cycles.findIndex(c => c.id === startCycle.id);
          if (startIdx !== -1) {
            const allocated = allocateCyclesForPlan(
              { total_regular_cycles: subPlan.total_regular_cycles, total_grid_cycles: subPlan.total_grid_cycles },
              cycles as any,
              startIdx
            );
            await insertEnrollmentCycles(enrollment.id, studentId, batchId, allocated);
          }
        }

        success++;
      } catch (err: any) {
        errors++;
        errorMessages.push(err.message);
      }
    }
    const overlapExtra = conflicts.length > 0
      ? ` · Overlap resolution: ${overlapAction} (${conflicts.length} conflict row(s)${deactivated > 0 ? `, ${deactivated} prior enrollment(s) deactivated` : ""}${skipped > 0 ? `, ${skipped} row(s) skipped` : ""})`
      : "";
    return {
      success, errors, errorMessages,
      extra: `Auto-created ${usersCreated} users, ${studentsCreated} students${overlapExtra}`,
    };
  };

  /** Build batch_code from style_level + studio_code: "Jazz 3" + "NDA" → "Jazz3-NDA" */
  function buildBatchCodeFromInput(styleLevel: string, studioCode: string): string {
    return `${styleLevel.replace(/\s+/g, '')}-${studioCode.trim()}`;
  }

  /** Match a cycle token like "April", "Grid", "January'27" to a plan_cycle row */
  const usedCycleIds = new Set<number>();

  function matchCycleToken(token: string, allCycles: any[]): any | null {
    // Sanitize: remove zero-width chars, normalize smart quotes to ASCII apostrophe
    let t = token.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
    t = t.replace(/[\u2018\u2019\u2032\u02BC]/g, "'");
    const tLower = t.toLowerCase();

    // 1. Direct match (exact, case-insensitive) — skip already-used
    let match = allCycles.find(c => c.name.toLowerCase() === tLower && !usedCycleIds.has(c.id));
    if (match) { usedCycleIds.add(match.id); return match; }

    // 2. Year suffix: "January'27" → try "January'27", "January 27"
    const yearMatch = t.match(/^(.+?)['']\s*(\d{2,4})$/);
    if (yearMatch) {
      const base = yearMatch[1].trim();
      const year = yearMatch[2];
      match = allCycles.find(c => c.name.toLowerCase() === `${base}'${year}`.toLowerCase() && !usedCycleIds.has(c.id));
      if (match) { usedCycleIds.add(match.id); return match; }
      match = allCycles.find(c => c.name.toLowerCase() === `${base} ${year}`.toLowerCase() && !usedCycleIds.has(c.id));
      if (match) { usedCycleIds.add(match.id); return match; }
    }

    // 3. Normalize: "Grid 2.0" → also try "Grid'2.0"
    const spaceNormalized = t.replace(/\s+/g, "'");
    if (spaceNormalized !== t) {
      match = allCycles.find(c => c.name.toLowerCase() === spaceNormalized.toLowerCase() && !usedCycleIds.has(c.id));
      if (match) { usedCycleIds.add(match.id); return match; }
    }

    // 3b. Insert apostrophe at letter-digit boundary: "Grid2.0" → "Grid'2.0"
    const apostropheInserted = t.replace(/([a-zA-Z])(\d)/, "$1'$2");
    if (apostropheInserted !== t) {
      match = allCycles.find(c => c.name.toLowerCase() === apostropheInserted.toLowerCase() && !usedCycleIds.has(c.id));
      if (match) { usedCycleIds.add(match.id); return match; }
    }

    // 3c. Bare-name fallback on normalized variants (e.g. "Grid'2.0" matches "Grid'2.0'26")
    for (const variant of [spaceNormalized, apostropheInserted]) {
      if (variant === t) continue;
      const vLower = variant.toLowerCase();
      match = allCycles.find(c => {
        const cLower = c.name.toLowerCase();
        return (cLower.startsWith(vLower + "'") || cLower.startsWith(vLower + " ") || cLower === vLower) && !usedCycleIds.has(c.id);
      });
      if (match) { usedCycleIds.add(match.id); return match; }
    }

    // 4. Bare-name fallback: "April" → match cycle whose name starts with "April" (e.g. "April'26")
    match = allCycles.find(c => {
      const cLower = c.name.toLowerCase();
      return (cLower.startsWith(tLower + "'") || cLower.startsWith(tLower + " ")) && !usedCycleIds.has(c.id);
    });
    if (match) { usedCycleIds.add(match.id); return match; }

    return null;
  }

  const importSmartEnrollments = async (rows: Record<string, string>[]): Promise<ImportResult> => {
    let success = 0, errors = 0;
    const errorMessages: string[] = [];
    let usersCreated = 0, studentsCreated = 0;

    // Fetch reference data (paginated)
    const [allBatches, allCycles, allPlans, allUsers, allStudentsRef] = await Promise.all([
      fetchAll<any>(() => supabase.from("batches").select("id, batch_code, style_base, level").eq("organization_id", ORG_ID)),
      fetchAll<any>(() => supabase.from("plan_cycles").select("*").eq("organization_id", ORG_ID).order("start_date")),
      fetchAll<any>(() => supabase.from("subscription_plans").select("*").eq("organization_id", ORG_ID)),
      fetchAll<{ id: number; phone: string | null }>(() => supabase.from("users").select("id, phone").eq("organization_id", ORG_ID)),
      fetchAll<{ id: number; phone: string | null; name: string }>(() => supabase.from("students").select("id, phone, name").eq("organization_id", ORG_ID)),
    ]);

    const codeToBatch = new Map<string, any>();
    allBatches.forEach(b => { if (b.batch_code) codeToBatch.set(b.batch_code.toLowerCase(), b); });

    const phoneToUserId = new Map<string, number>();
    allUsers.forEach(u => { if (u.phone) phoneToUserId.set(u.phone, u.id); });

    const studentKey = (name: string, phone: string) => `${name.toLowerCase().trim()}|${phone}`;
    const namePhoneToStudentId = new Map<string, number>();
    allStudentsRef.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });

    // Auto-create users (one per unique phone, first occurrence name)
    const uniquePhones = new Map<string, { name: string; email: string }>();
    for (const r of rows) {
      if (r.student_phone && r.student_name && !uniquePhones.has(r.student_phone) && !phoneToUserId.has(r.student_phone)) {
        uniquePhones.set(r.student_phone, { name: r.student_name, email: r.student_email || "" });
      }
    }
    for (const batch of chunk([...uniquePhones.entries()], 50)) {
      const insertRows = batch.map(([phone, { name, email }]) => ({
        name, phone, email: email || null, source: "import", organization_id: ORG_ID,
      }));
      const { data, error } = await supabase.from("users").insert(insertRows).select();
      if (error) { errorMessages.push(`User create error: ${error.message}`); }
      else {
        usersCreated += data.length;
        data.forEach(u => { if (u.phone) phoneToUserId.set(u.phone, u.id); });
      }
    }

    // Auto-create students (one per unique name+phone)
    const existingStudentKeys = new Set(allStudentsRef.map(s => s.phone ? studentKey(s.name, s.phone) : ""));
    const uniqueStudents = new Map<string, { name: string; phone: string; email: string }>();
    for (const r of rows) {
      if (r.student_name && r.student_phone) {
        const key = studentKey(r.student_name, r.student_phone);
        if (!uniqueStudents.has(key) && !existingStudentKeys.has(key)) {
          uniqueStudents.set(key, { name: r.student_name, phone: r.student_phone, email: r.student_email || "" });
        }
      }
    }
    for (const batch of chunk([...uniqueStudents.values()], 50)) {
      const insertRows = batch.filter(s => phoneToUserId.has(s.phone)).map(s => ({
        name: s.name, phone: s.phone, email: s.email || null, user_id: phoneToUserId.get(s.phone)!, organization_id: ORG_ID,
      }));
      if (insertRows.length === 0) continue;
      const { data, error } = await supabase.from("students").insert(insertRows).select();
      if (error) { errorMessages.push(`Student create error: ${error.message}`); }
      else {
        studentsCreated += data.length;
        data.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });
      }
    }

    // Refresh student lookup
    if (studentsCreated > 0) {
      const refreshedStudents = await fetchAll<{ id: number; phone: string | null; name: string }>(() => supabase.from("students").select("id, phone, name").eq("organization_id", ORG_ID));
      refreshedStudents.forEach(s => { if (s.phone) namePhoneToStudentId.set(studentKey(s.name, s.phone), s.id); });
    }

    // Process each row
    for (const row of rows) {
      try {
        const studentId = namePhoneToStudentId.get(studentKey(row.student_name, row.student_phone));
        if (!studentId) { errors++; errorMessages.push(`No student for: ${row.student_name} / ${row.student_phone}`); continue; }

        // Resolve batch_code
        const batchCode = buildBatchCodeFromInput(row.style_level || "", row.studio_code || "");
        const batch = codeToBatch.get(batchCode.toLowerCase());
        if (!batch) { errors++; errorMessages.push(`No batch with code: ${batchCode} (from "${row.style_level}" + "${row.studio_code}")`); continue; }

        // Parse cycles — reset used tracker per row
        usedCycleIds.clear();
        const cycleTokens = (row.cycles || "").split(",").map(t => t.trim()).filter(Boolean);
        if (cycleTokens.length === 0) { errors++; errorMessages.push(`No cycles for ${row.student_name}`); continue; }

        const matchedCycles: any[] = [];
        const unmatchedTokens: string[] = [];
        for (const token of cycleTokens) {
          const matched = matchCycleToken(token, allCycles);
          if (matched) matchedCycles.push(matched);
          else unmatchedTokens.push(`${token} [raw: ${JSON.stringify(token)}]`);
        }

        if (unmatchedTokens.length > 0) {
          errors++;
          errorMessages.push(`Unmatched cycles for ${row.student_name}: ${unmatchedTokens.join(", ")}`);
          continue;
        }

        // Sort by start_date and derive validity
        matchedCycles.sort((a, b) => a.start_date.localeCompare(b.start_date));
        const startDate = matchedCycles[0].start_date;
        const endDate = matchedCycles[matchedCycles.length - 1].end_date || matchedCycles[matchedCycles.length - 1].start_date;

        // Auto-detect subscription plan
        const regularCount = matchedCycles.filter(c => c.plan_type === "regular").length;
        const gridCount = matchedCycles.filter(c => c.plan_type === "grid").length;
        const subPlan = allPlans.find(p =>
          p.total_regular_cycles === regularCount && p.total_grid_cycles === gridCount
        );

        const { data: enrollment, error } = await supabase.from("enrollments").insert({
          student_id: studentId,
          batch_id: batch.id,
          organization_id: ORG_ID,
          start_date: startDate,
          end_date: endDate,
          status_type: "NEW",
          start_cycle_id: matchedCycles[0].id,
          end_cycle_id: matchedCycles[matchedCycles.length - 1].id,
          subscription_plan_id: subPlan?.id || null,
        }).select().single();

        if (error) { errors++; errorMessages.push(error.message); continue; }

        // Insert enrollment_cycles
        const allocatedCycles = matchedCycles.map(c => ({ cycleId: c.id, cycleType: c.plan_type }));
        await insertEnrollmentCycles(enrollment.id, studentId, batch.id, allocatedCycles);

        success++;
      } catch (err: any) {
        errors++;
        errorMessages.push(err.message);
      }
    }

    return {
      success, errors, errorMessages,
      extra: `Fetched ${allUsers.length} users, ${allStudentsRef.length} students, ${allBatches.length} batches, ${allCycles.length} cycles. Auto-created ${usersCreated} users, ${studentsCreated} students.`,
    };
  };

  return (
    <AdminLayout title="Import Data">
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-xl font-bold">Import Data</h1>
        <p className="text-sm text-muted-foreground">Upload CSV files exported from Google Sheets. The Enrollments tab auto-creates users & students from phone numbers.</p>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="smart-enrollments">Smart Enrollments</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <CSVImportTab label="Users" dbColumns={USER_DB_COLUMNS} onImport={importUsers} />
          </TabsContent>
          <TabsContent value="students">
            <CSVImportTab label="Students" dbColumns={STUDENT_DB_COLUMNS} onImport={importStudents} />
          </TabsContent>
          <TabsContent value="enrollments">
            <CSVImportTab label="Enrollments" dbColumns={ENROLLMENT_DB_COLUMNS} onImport={importEnrollments} />
          </TabsContent>
          <TabsContent value="smart-enrollments">
            <CSVImportTab label="Smart Enrollments" dbColumns={SMART_ENROLLMENT_COLUMNS} onImport={importSmartEnrollments} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!overlapPrompt} onOpenChange={(o) => { if (!o && overlapPrompt) overlapPrompt.resolver("cancel"); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Existing active enrollments detected</DialogTitle>
          </DialogHeader>
          {overlapPrompt && (
            <div className="space-y-4">
              <p className="text-sm">
                <span className="font-medium">{overlapPrompt.conflicts.length}</span> of <span className="font-medium">{overlapPrompt.totalRows}</span> row(s) would create an additional active enrollment for a student who already has an overlapping one on a different batch.
              </p>
              <div className="space-y-2 text-xs">
                <Collapsible open={overlapDetailsOpen} onOpenChange={setOverlapDetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                      <ChevronDown className={`h-3 w-3 transition-transform ${overlapDetailsOpen ? "rotate-180" : ""}`} />
                      {overlapDetailsOpen ? "Hide" : "Show"} details
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="max-h-56 overflow-auto bg-muted/40 rounded p-2 space-y-1">
                      {overlapPrompt.conflicts.map(c => (
                        <div key={c.rowIndex} className="border-b border-border/40 pb-1 last:border-0">
                          <div className="font-medium">{c.studentName} → {c.newBatchCode} ({c.newStart} → {c.newEnd})</div>
                          <div className="text-muted-foreground">already in: {c.conflictingBatchNames.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">Keep both</span> — import as additional batches (current behaviour).</p>
                <p><span className="font-medium text-foreground">Replace</span> — deactivate the prior overlapping enrollment(s), then import.</p>
                <p><span className="font-medium text-foreground">Skip</span> — drop only these rows; non-conflict rows still import.</p>
                <p><span className="font-medium text-foreground">Cancel</span> — abort the entire enrollment import.</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => overlapPrompt?.resolver("cancel")}>Cancel import</Button>
            <Button variant="outline" onClick={() => overlapPrompt?.resolver("skip")}>Skip conflicts</Button>
            <Button variant="outline" onClick={() => overlapPrompt?.resolver("keep")}>Keep both</Button>
            <Button onClick={() => overlapPrompt?.resolver("replace")}>Replace previous</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}