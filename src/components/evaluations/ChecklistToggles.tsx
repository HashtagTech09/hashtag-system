import { Switch } from "@/components/ui/switch";
import { CHECKLIST_GROUPS, ChecklistValues } from "@/lib/evaluationScoring";

interface Props {
  values: ChecklistValues;
  onChange: (key: string, val: boolean) => void;
  disabled?: boolean;
}

export function ChecklistToggles({ values, onChange, disabled }: Props) {
  return (
    <div className="space-y-6">
      {CHECKLIST_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {group.label}
          </h3>
          <div className="rounded-lg border divide-y">
            {group.fields.map((f) => (
              <label
                key={f.key}
                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
              >
                <span className="text-sm font-medium">{f.label}</span>
                <Switch
                  checked={!!values[f.key]}
                  onCheckedChange={(v) => onChange(f.key, v)}
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
