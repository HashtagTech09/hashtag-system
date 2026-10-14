import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, History, RefreshCw, Search, X } from "lucide-react";
import { Navigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCrmScope } from "@/hooks/useCrmScope";
import { crm, CRM_ENABLED, crmError, STAGES, nextStages, type CrmLead, type LeadStage } from "@/lib/crm";
import { LeadStageDialog } from "@/components/crm/LeadStageDialog";

const PAGE_SIZE = 20;
const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm min-w-0";
const stageColors: Record<LeadStage, string> = {
  Intake: "text-sky-300 bg-sky-400/10", "In-Progress": "text-amber-300 bg-amber-400/10",
  Qualified: "text-emerald-300 bg-emerald-400/10", Converted: "text-primary bg-primary/10", Lost: "text-muted-foreground bg-muted",
};
const dateLabel = (date: string) => new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function LeadsWorkspace() {
  const { user } = useAuth();
  const scope = useCrmScope();
  const client = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [studio, setStudio] = useState("all");
  const [stage, setStage] = useState("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<CrmLead | null>(null);
  const [historyLead, setHistoryLead] = useState<CrmLead | null>(null);
  const [notice, setNotice] = useState("");
  const rootKey = ["crm", user?.id];
  const leads = useQuery({
    queryKey: [...rootKey, "leads", search, studio, stage, page],
    enabled: !!scope.data?.length, gcTime: 0, retry: false, refetchInterval: 30000,
    queryFn: async () => {
      let query = crm.from("crm_leads").select("*", { count: "exact" }).order("changed_at", { ascending: false }).order("id");
      if (studio !== "all") query = query.eq("studio_id", Number(studio));
      if (stage !== "all") query = query.eq("stage", stage as LeadStage);
      const safeSearch = search.replace(/[^a-zA-Z0-9 @.+-]/g, "").trim().slice(0, 100);
      if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
      const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });
  const history = useQuery({
    queryKey: [...rootKey, "history", historyLead?.id], enabled: !!historyLead && !!scope.data?.length,
    gcTime: 0, retry: false, refetchInterval: historyLead ? 15000 : false,
    queryFn: async () => {
      const { data, error } = await crm.from("crm_lead_history").select("*").eq("lead_id", historyLead!.id).order("version", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });
  const mutation = useMutation({
    mutationFn: async ({ lead, to, note, correction }: { lead: CrmLead; to: LeadStage; note: string; correction: boolean }) => {
      const { data, error } = await crm.rpc("crm_change_stage", { p_lead: lead.id, p_version: lead.version, p_stage: to, p_note: note || null, p_correction: correction });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      setEditing(null);
      setNotice(variables.correction ? "Stage corrected. Meta delivery is held for review." : "Stage saved. Meta update queued.");
    },
    onSettled: () => client.invalidateQueries({ queryKey: rootKey }),
  });

  if (scope.isPending) return <p role="status" className="py-8 text-muted-foreground">Loading lead access...</p>;
  if (scope.isError) return <div role="alert" className="py-8 space-y-3"><p>Lead access could not be checked.</p><Button variant="outline" onClick={() => scope.refetch()}>Try again</Button></div>;
  if (!scope.data?.length) return <p role="alert" className="py-8 text-muted-foreground">No CRM studio access assigned to this account.</p>;
  const isAdmin = (lead: CrmLead) => scope.data.some(item => item.organization_id === lead.organization_id && item.is_admin);

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Leads</h2>
      <Button variant="outline" size="icon" title="Refresh leads" aria-label="Refresh leads" disabled={leads.isFetching} onClick={() => client.invalidateQueries({ queryKey: rootKey })}><RefreshCw className={`h-4 w-4 ${leads.isFetching ? "animate-spin" : ""}`} /></Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_180px_160px]">
      <form className="flex gap-2 min-w-0" onSubmit={event => { event.preventDefault(); setSearch(searchInput); setPage(0); }}>
        <Input aria-label="Search leads" placeholder="Name, email or phone" value={searchInput} maxLength={100} onChange={event => setSearchInput(event.target.value)} />
        <Button type="submit" variant="outline" size="icon" className="shrink-0" title="Search leads" aria-label="Submit search"><Search className="h-4 w-4" /></Button>
      </form>
      <select aria-label="Studio" value={studio} className={selectClass} onChange={event => { setStudio(event.target.value); setPage(0); }}><option value="all">All my studios</option>{scope.data.map(item => <option key={item.studio_id} value={item.studio_id}>{item.studio_name}</option>)}</select>
      <select aria-label="Stage filter" value={stage} className={selectClass} onChange={event => { setStage(event.target.value); setPage(0); }}><option value="all">All stages</option>{STAGES.map(value => <option key={value}>{value}</option>)}</select>
    </div>
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    {leads.isError ? <div role="alert" className="py-8 space-y-3"><p>Leads could not be loaded.</p><Button variant="outline" onClick={() => leads.refetch()}>Try again</Button></div>
      : leads.isPending ? <p role="status" className="py-8 text-muted-foreground">Loading leads...</p>
      : <>
        <div className="divide-y divide-border border-y border-border">
          {!leads.data?.rows.length && <p className="py-12 text-center text-muted-foreground">No leads found.</p>}
          {leads.data?.rows.map(lead => <article key={lead.id} className="grid min-w-0 gap-3 py-4 lg:grid-cols-[minmax(150px,1fr)_minmax(120px,0.7fr)_130px_172px] lg:items-center">
            <div className="min-w-0"><h3 className="font-medium break-words">{lead.name}</h3><p className="text-sm text-muted-foreground break-all">{lead.email || lead.phone || "No contact details"}</p>{lead.email && lead.phone && <p className="text-sm text-muted-foreground">{lead.phone}</p>}</div>
            <div className="text-sm min-w-0"><p className="break-words">{scope.data.find(item => item.studio_id === lead.studio_id)?.studio_name}</p><p className="text-muted-foreground break-words">{lead.style || "No style selected"}</p></div>
            <span className={`w-fit rounded px-2 py-1 text-xs font-medium ${stageColors[lead.stage]}`}>{lead.stage}</span>
            <div className="flex items-center gap-2 lg:justify-end">
              <Button variant="outline" size="sm" className="w-32" disabled={mutation.isPending || (!nextStages(lead.stage).length && !isAdmin(lead))} onClick={() => { mutation.reset(); setNotice(""); setEditing(lead); }}><ArrowRight className="mr-2 h-4 w-4" />Update stage</Button>
              <Button variant="ghost" size="icon" title={`History for ${lead.name}`} aria-label={`History for ${lead.name}`} onClick={() => setHistoryLead(lead)}><History className="h-4 w-4" /></Button>
            </div>
          </article>)}
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{leads.data?.count || 0} leads</span><div className="flex items-center gap-3"><Button variant="outline" size="icon" title="Previous page" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Page {page + 1}</span><Button variant="outline" size="icon" title="Next page" aria-label="Next page" disabled={(page + 1) * PAGE_SIZE >= (leads.data?.count || 0)} onClick={() => setPage(value => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
      </>}
    {historyLead && <section className="border-t pt-5 space-y-4" aria-label="Lead history"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold break-words">{historyLead.name}: activity</h3><Button variant="ghost" size="icon" aria-label="Close history" title="Close history" className="shrink-0" onClick={() => setHistoryLead(null)}><X className="h-4 w-4" /></Button></div>
      {history.isPending ? <p role="status">Loading activity...</p> : history.isError ? <p role="alert">Activity could not be loaded.</p> : <ol className="divide-y divide-border">{history.data?.map(item => <li key={item.id} className="py-3 text-sm space-y-1">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{item.from_stage ? `${item.from_stage} to ` : ""}{item.to_stage}{item.is_correction ? " (correction)" : ""}</span><span className={item.delivery_status === "failed" || item.delivery_status === "expired" ? "text-destructive" : "text-muted-foreground"}>Meta: {item.delivery_status}</span></div>
        <p className="text-muted-foreground break-all">{dateLabel(item.changed_at)}{item.actor_id === user?.id ? " by you" : item.actor_id ? ` by staff ${item.actor_id}` : " via intake"}</p>
        {item.note && <p className="whitespace-pre-wrap break-words">{item.note}</p>}
        {item.delivery_code && <p className="text-xs text-muted-foreground">{item.delivery_code} / {item.attempts} attempts</p>}
      </li>)}</ol>}
    </section>}
    {editing && <LeadStageDialog key={editing.id} lead={editing} isAdmin={isAdmin(editing)} busy={mutation.isPending} error={mutation.isError ? crmError(mutation.error) : null} onClose={() => setEditing(null)} onSave={(to, note, correction) => mutation.mutate({ lead: editing, to, note, correction })} />}
  </div>;
}

export default function LeadsPage() {
  if (!CRM_ENABLED) return <Navigate to="/" replace />;
  return <AdminLayout title="Leads"><LeadsWorkspace /></AdminLayout>;
}
