import { useState } from "react";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nextStages, STAGES, type CrmLead, type LeadStage } from "@/lib/crm";

type Props = {
  lead: CrmLead; isAdmin: boolean; busy: boolean; error: string | null;
  onClose: () => void;
  onSave: (stage: LeadStage, note: string, correction: boolean) => void;
};

export function LeadStageDialog({ lead, isAdmin, busy, error, onClose, onSave }: Props) {
  const [correction, setCorrection] = useState(false);
  const allowed = correction ? STAGES.filter(stage => stage !== "Converted" && stage !== lead.stage) : nextStages(lead.stage);
  const [stage, setStage] = useState<LeadStage | "">(nextStages(lead.stage)[0] || "");
  const [note, setNote] = useState("");
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-md w-[calc(100%-2rem)]">
      <DialogHeader>
        <DialogTitle>Update stage</DialogTitle>
        <DialogDescription className="break-words">{lead.name}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (stage && allowed.includes(stage)) onSave(stage, note, correction); }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>{lead.stage}</span><ArrowRight className="h-4 w-4" /><span>{stage || "Select stage"}</span></div>
        {isAdmin && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={correction} disabled={busy} onChange={event => {
          setCorrection(event.target.checked); setStage("");
        }} />Administrative correction</label>}
        <div className="space-y-2">
          <Label htmlFor="crm-stage">New stage</Label>
          <select id="crm-stage" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={stage} disabled={busy} onChange={event => setStage(event.target.value as LeadStage)} required>
            <option value="" disabled>Select stage</option>
            {allowed.map(value => <option key={value}>{value}</option>)}
            <option disabled>Converted (verified payment)</option>
          </select>
        </div>
        <div className="space-y-2"><Label htmlFor="crm-note">{correction ? "Correction reason" : "Note (optional)"}</Label>
          <Textarea id="crm-note" value={note} maxLength={2000} required={correction} disabled={busy} onChange={event => setNote(event.target.value)} className="min-h-24" />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !stage || !allowed.includes(stage) || (correction && !note.trim())}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save stage
          </Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
