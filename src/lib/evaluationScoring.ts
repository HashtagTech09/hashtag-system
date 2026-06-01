// Scoring helpers for instructor evaluation reports.
// 15 boolean checklist fields (1 pt each) + attire (0-5) + culture (0-5) = max 25.

export const CHECKLIST_GROUPS = [
  {
    label: "Teaching & Conduct",
    fields: [
      { key: "form", label: "Form" },
      { key: "relationship_building", label: "Relationship Building" },
      { key: "syllabus_followed", label: "Syllabus Followed" },
      { key: "information_imparted", label: "Information Imparted" },
      { key: "punctuality", label: "Punctuality" },
    ],
  },
  {
    label: "Operations",
    fields: [
      { key: "absentee_calls", label: "Absentee Calls Done" },
      { key: "absentee_update", label: "Absentee Update Done" },
      { key: "attendance_marked", label: "Attendance Marked" },
      { key: "registration_followup", label: "Registration Follow-Up Done" },
      { key: "renewal_followup", label: "Renewal Follow-Up Done" },
    ],
  },
  {
    label: "Class Management",
    fields: [
      { key: "playlist_prepared", label: "Playlist Prepared" },
      { key: "videos_shot", label: "Videos Shot During Class" },
      { key: "story_posted", label: "Story Posted" },
      { key: "briefing_done", label: "Briefing & Announcement Done" },
      { key: "poa_shared", label: "Plan of Action Shared With Dreamcatcher" },
    ],
  },
] as const;

export const CHECKLIST_KEYS = CHECKLIST_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export const MAX_SCORE = 25;

export type ChecklistValues = Record<string, boolean>;

export function computeScore(checklist: ChecklistValues, attire: number, culture: number) {
  const boolPoints = CHECKLIST_KEYS.reduce((acc, k) => acc + (checklist[k] ? 1 : 0), 0);
  const total = boolPoints + (attire || 0) + (culture || 0);
  const pct = (total / MAX_SCORE) * 100;
  return { boolPoints, total, pct };
}

export type PerfLevel = {
  label: "Excellent" | "Good" | "Needs Improvement" | "Action Required";
  tone: "success" | "primary" | "warning" | "destructive";
};

export function performanceLevel(pct: number): PerfLevel {
  if (pct >= 90) return { label: "Excellent", tone: "success" };
  if (pct >= 80) return { label: "Good", tone: "primary" };
  if (pct >= 70) return { label: "Needs Improvement", tone: "warning" };
  return { label: "Action Required", tone: "destructive" };
}

export function toneToBadgeClass(tone: PerfLevel["tone"]) {
  switch (tone) {
    case "success":
      return "bg-success/20 text-success";
    case "primary":
      return "bg-primary/20 text-primary";
    case "warning":
      return "bg-warning/20 text-warning";
    case "destructive":
      return "bg-destructive/20 text-destructive";
  }
}
