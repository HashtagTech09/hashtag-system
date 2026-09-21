import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Star } from "lucide-react";

const RatingPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <Button
          key={rating}
          type="button"
          variant={value === rating ? "default" : "outline"}
          className={value === rating ? "gradient-primary" : ""}
          onClick={() => onChange(rating)}
        >
          {rating}
        </Button>
      ))}
    </div>
  </div>
);

const ClassFeedbackForm = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [energyRating, setEnergyRating] = useState(0);
  const [clarityRating, setClarityRating] = useState(0);
  const [liked, setLiked] = useState("");
  const [improve, setImprove] = useState("");
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      const { data, error: loadError } = await supabase.functions.invoke("class-feedback", {
        body: { action: "load", token },
      });
      if (loadError || data?.error) {
        setError(data?.error || loadError?.message || "Could not open this feedback link");
      } else {
        setRequest(data.request);
        setSubmitted(data.request?.status === "submitted");
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || rating === 0) {
      toast.error("Please select an overall rating");
      return;
    }
    setSubmitting(true);
    const { data, error: submitError } = await supabase.functions.invoke("class-feedback", {
      body: {
        action: "submit",
        token,
        rating,
        energy_rating: energyRating || null,
        clarity_rating: clarityRating || null,
        liked,
        improve,
        wants_follow_up: wantsFollowUp,
      },
    });
    setSubmitting(false);

    if (submitError || data?.error) {
      toast.error(data?.error || submitError?.message || "Could not submit feedback");
      return;
    }

    setSubmitted(true);
  };

  const batchLabel = request?.batch
    ? request.batch.batch_code || request.batch.name
    : "Class";
  const session = request?.session;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="max-w-2xl mx-auto px-5 py-8 flex items-center gap-4">
          <img src="/favicon.png" alt="Hashtag" className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold font-display">Hashtag</h1>
            <p className="text-muted-foreground">Quick class feedback</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Opening feedback form...
          </div>
        ) : error ? (
          <Card className="glass-card">
            <CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent>
          </Card>
        ) : submitted ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
              <div>
                <h2 className="text-2xl font-semibold">Feedback received</h2>
                <p className="text-muted-foreground mt-2">Thank you for helping us improve the class experience.</p>
              </div>
            </CardContent>
          </Card>
        ) : request?.status === "expired" ? (
          <Card className="glass-card">
            <CardContent className="py-10 text-center text-muted-foreground">This feedback link has expired.</CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit">{batchLabel}</Badge>
              <CardTitle className="text-2xl">How was the class?</CardTitle>
              <p className="text-sm text-muted-foreground">
                {request?.attendance_date}
                {session?.start_time ? ` • ${session.start_time.slice(0, 5)}-${session.end_time?.slice(0, 5)}` : ""}
                {session?.style ? ` • ${session.style}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Your class team sees feedback without your name. Studio admins may review linked submissions for quality and safety.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <RatingPicker label="Overall experience" value={rating} onChange={setRating} />
              <RatingPicker label="Class energy" value={energyRating} onChange={setEnergyRating} />
              <RatingPicker label="Clarity of teaching" value={clarityRating} onChange={setClarityRating} />

              <div className="space-y-2">
                <Label>What worked well?</Label>
                <Textarea value={liked} onChange={(e) => setLiked(e.target.value)} placeholder="Optional" />
              </div>

              <div className="space-y-2">
                <Label>What can be better?</Label>
                <Textarea value={improve} onChange={(e) => setImprove(e.target.value)} placeholder="Optional" />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Checkbox checked={wantsFollowUp} onCheckedChange={(checked) => setWantsFollowUp(Boolean(checked))} />
                <span className="text-sm text-muted-foreground">I am okay with the studio following up if needed.</span>
              </label>

              <Button className="w-full gradient-primary" size="lg" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                Submit feedback
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ClassFeedbackForm;
