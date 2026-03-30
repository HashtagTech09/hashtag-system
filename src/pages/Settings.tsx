import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, AlertTriangle } from "lucide-react";

const SettingsPage = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, pricingRes] = await Promise.all([
        supabase.from("system_settings").select("*").eq("organization_id", 1),
        supabase.from("pricing_plans").select("*").eq("organization_id", 1).order("batch_count"),
      ]);
      const map: Record<string, string> = {};
      (settingsRes.data || []).forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
      setPricingPlans(pricingRes.data || []);
    };
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from("system_settings").upsert({ organization_id: 1, key, value }, { onConflict: "organization_id,key" });
    }
    toast.success("Settings saved");
  };

  const handleSavePricing = async (id: number, price: string) => {
    await supabase.from("pricing_plans").update({ price: Number(price) }).eq("id", id);
    toast.success("Pricing updated");
  };

  const handleTestModeToggle = async (checked: boolean) => {
    const newValue = checked ? "true" : "false";
    setSettings({ ...settings, test_mode: newValue });
    await supabase.from("system_settings").upsert(
      { organization_id: 1, key: "test_mode", value: newValue },
      { onConflict: "organization_id,key" }
    );
    toast.success(checked ? "Test mode enabled — no real messages will be sent" : "Test mode disabled — messages will be sent for real");
  };

  const isTestMode = settings.test_mode === "true";

  return (
    <AdminLayout title="Settings">
      <div className="grid gap-6 max-w-2xl">
        {isTestMode && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm font-medium text-warning">TEST MODE ON — no real messages will be sent</span>
          </div>
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Test Mode
              {isTestMode && <Badge variant="secondary" className="bg-warning/20 text-warning">Active</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Enable test mode</p>
                <p className="text-xs text-muted-foreground">When ON, emails and WhatsApp messages are logged but not actually sent</p>
              </div>
              <Switch checked={isTestMode} onCheckedChange={handleTestModeToggle} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">System Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Registration Fee (₹)</Label>
              <Input type="number" value={settings.registration_fee || ""} onChange={(e) => setSettings({ ...settings, registration_fee: e.target.value })} />
            </div>
            <div>
              <Label>Drop-in Fee (₹)</Label>
              <Input type="number" value={settings.drop_in_fee || ""} onChange={(e) => setSettings({ ...settings, drop_in_fee: e.target.value })} />
            </div>
            <div>
              <Label>Renewal Grace Days</Label>
              <Input type="number" value={settings.renewal_grace_days || ""} onChange={(e) => setSettings({ ...settings, renewal_grace_days: e.target.value })} />
            </div>
            <Button className="gradient-primary" onClick={handleSaveSettings}><Save className="h-4 w-4 mr-2" />Save Settings</Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Pricing Plans</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className="flex items-center gap-4">
                <Label className="w-24 shrink-0">{plan.batch_count} batch{plan.batch_count > 1 ? "es" : ""}</Label>
                <Input
                  type="number"
                  defaultValue={plan.price}
                  onBlur={(e) => handleSavePricing(plan.id, e.target.value)}
                  className="max-w-32"
                />
                <span className="text-muted-foreground text-sm">₹</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SettingsPage;
