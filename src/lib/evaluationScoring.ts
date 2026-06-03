// Scoring: 15 checklist booleans (1 pt each) + Attire (0-5) + Culture (0-5) = max 25.

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

export const CHECKLIST_MAX = CHECKLIST_KEYS.length; // 15
export const RATING_MAX = 10; // 5 + 5
export const MAX_SCORE = CHECKLIST_MAX + RATING_MAX; // 25

export type ChecklistValues = Record<string, boolean>;

export function computeScore(
  checklist: ChecklistValues,
  attire = 0,
  culture = 0,
) {
  const checklistTotal = CHECKLIST_KEYS.reduce((acc, k) => acc + (checklist[k] ? 1 : 0), 0);
  const ratingTotal = (attire || 0) + (culture || 0);
  const total = checklistTotal + ratingTotal;
  const pct = (total / MAX_SCORE) * 100;
  return { checklistTotal, ratingTotal, total, pct };
}
