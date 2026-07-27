import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { AccountOwnerType } from "@/lib/accountOwner";
import { UserRound, UsersRound } from "lucide-react";

interface AccountOwnerChoiceProps {
  value: AccountOwnerType;
  onChange: (value: AccountOwnerType) => void;
  disableSelf?: boolean;
  selfDescription?: string;
  parentDescription?: string;
}

export default function AccountOwnerChoice({
  value,
  onChange,
  disableSelf = false,
  selfDescription = "Use my details for the student profile.",
  parentDescription = "I am a parent or guardian managing one or more students.",
}: AccountOwnerChoiceProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as AccountOwnerType)}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <Label
        htmlFor="owner-self"
        className={cn(
          "rounded-lg border p-4 transition-all",
          disableSelf ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          value === "self" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <div className="flex items-start gap-3">
          <RadioGroupItem id="owner-self" value="self" className="mt-1" disabled={disableSelf} />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <UserRound className="h-4 w-4" />
              Use my details
            </div>
            <p className="text-xs text-muted-foreground">{selfDescription}</p>
          </div>
        </div>
      </Label>

      <Label
        htmlFor="owner-parent"
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-all",
          value === "parent_guardian" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <div className="flex items-start gap-3">
          <RadioGroupItem id="owner-parent" value="parent_guardian" className="mt-1" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <UsersRound className="h-4 w-4" />
              Parent-owned
            </div>
            <p className="text-xs text-muted-foreground">{parentDescription}</p>
          </div>
        </div>
      </Label>
    </RadioGroup>
  );
}
