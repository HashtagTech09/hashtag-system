// Simple checklist scoring: 15 boolean fields, 1 point each.

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

export const MAX_SCORE = CHECKLIST_KEYS.length;

export type ChecklistValues = Record<string, boolean>;

export function computeScore(checklist: ChecklistValues) {
  const total = CHECKLIST_KEYS.reduce((acc, k) => acc + (checklist[k] ? 1 : 0), 0);
  const pct = (total / MAX_SCORE) * 100;
  return { total, pct };
}
