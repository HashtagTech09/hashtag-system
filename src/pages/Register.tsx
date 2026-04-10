import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import hashtagLogo from "@/assets/hashtag-pink.png";
import JoinBatchFlow from "@/components/register/JoinBatchFlow";
import DropInFlow from "@/components/register/DropInFlow";
import AccountFlow from "@/components/register/AccountFlow";

const RegisterPage = () => {
  const [tab, setTab] = useState("join");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={hashtagLogo} alt="Hashtag" className="h-10 w-10 rounded-lg" />
          <div>
            <h1 className="font-display font-bold text-foreground text-lg">Hashtag</h1>
            <p className="text-xs text-muted-foreground">Student Registration Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="join">Join a Batch</TabsTrigger>
            <TabsTrigger value="dropin">Drop-In</TabsTrigger>
            <TabsTrigger value="account">My Account</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="mt-6">
            <JoinBatchFlow />
          </TabsContent>
          <TabsContent value="dropin" className="mt-6">
            <DropInFlow />
          </TabsContent>
          <TabsContent value="account" className="mt-6">
            <AccountFlow />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RegisterPage;
