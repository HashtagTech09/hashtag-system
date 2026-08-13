import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import hashtagLogo from "@/assets/hashtag-pink.png";
import JoinBatchFlow from "@/components/register/JoinBatchFlow";
import DropInFlow from "@/components/register/DropInFlow";
import AccountFlow from "@/components/register/AccountFlow";
import { TestDateProvider, useTestDate } from "@/contexts/TestDateContext";

function TestDateBanner() {
  const { isTestMode, simulatedDate, setSimulatedDate } = useTestDate();
  if (!isTestMode) return null;

  const selected = simulatedDate ? new Date(simulatedDate + "T00:00:00") : undefined;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
      <div className="flex items-center gap-2 flex-1">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <span className="text-xs font-medium text-warning">
          TEST MODE — simulating registration on:
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 justify-start text-left font-normal", !selected && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {selected ? format(selected, "PPP") : "Today"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (d) {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  setSimulatedDate(`${y}-${m}-${day}`);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {simulatedDate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setSimulatedDate(null)}
            title="Reset to today"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface RegisterPageProps {
  embedded?: boolean;
}

const RegisterPage = ({ embedded = false }: RegisterPageProps) => {
  const [tab, setTab] = useState("join");
  const tabHelp =
    tab === "join"
      ? "Choose studio, style, batch, then review the final amount before payment."
      : tab === "dropin"
        ? "Book a single class without changing your batch enrollment."
        : "Renew your current batch or add another batch under the same account.";

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"}>
      {!embedded && (
        <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <img src={hashtagLogo} alt="Hashtag" className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="font-display font-bold text-foreground text-lg">Hashtag</h1>
              <p className="text-xs text-muted-foreground">Student Registration Portal</p>
            </div>
          </div>
        </div>
      )}

      <div className={cn("max-w-2xl mx-auto space-y-4", embedded ? "px-0 py-0" : "px-4 py-6")}>
        {embedded && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-3">
            <img src={hashtagLogo} alt="Hashtag" className="h-9 w-9 rounded-lg" />
            <div>
              <h2 className="font-display font-semibold text-foreground">Student Registration Portal</h2>
            </div>
          </div>
        )}
        <TestDateBanner />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="join">Join Batch</TabsTrigger>
            <TabsTrigger value="dropin">Drop-in</TabsTrigger>
            <TabsTrigger value="account">My Account</TabsTrigger>
          </TabsList>
          <p className="mt-3 text-center text-xs text-muted-foreground">{tabHelp}</p>

          <TabsContent value="join" forceMount className={cn("mt-6", tab !== "join" && "hidden")}>
            <JoinBatchFlow />
          </TabsContent>
          <TabsContent value="dropin" forceMount className={cn("mt-6", tab !== "dropin" && "hidden")}>
            <DropInFlow />
          </TabsContent>
          <TabsContent value="account" forceMount className={cn("mt-6", tab !== "account" && "hidden")}>
            <AccountFlow />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegisterPage;
