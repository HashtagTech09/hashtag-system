

# Upgrade Import Page: Sample Templates + Auto-Extract Users/Students from Enrollments

## Overview
Two improvements to the Import page:
1. Add downloadable sample CSV templates for each tab showing expected columns
2. Add a 4th tab "All-in-One" (or enhance the Enrollments tab) that accepts a single enrollment CSV and automatically creates users and students before creating enrollments

## Changes

### 1. Sample CSV Templates
Add a "Download Sample CSV" button on each tab that generates a small example file:

- **Users**: `name, phone, email, source` with 2 example rows
- **Students**: `name, phone, email, dob, gender, user_phone` with 2 example rows
- **Enrollments**: `student_name, student_phone, batch_name, start_date, end_date, status_type, subscription_plan_name` with 2 example rows

Implementation: Generate CSV string in-browser and trigger download via Blob URL.

### 2. Smart Enrollment Import (Auto-Extract Users + Students)
Add a new column `student_name` to the enrollment import. When importing enrollments:

**Step 1 — Extract & create Users**: Collect unique phone numbers from `student_phone` column. For each unique phone, check if a user exists. If not, create one using the first `student_name` found for that phone. Source = "import".

**Step 2 — Extract & create Students**: For each unique `student_name + student_phone` combo, check if a student exists. If not, create one linked to the user_id from step 1.

**Step 3 — Create Enrollments**: Proceed with existing enrollment logic (batch lookup, cycle allocation, etc.)

Show a summary: "Created X users, Y students, Z enrollments".

### Files Modified
- **`src/pages/Import.tsx`**:
  - Add `Download Sample` button to each `CSVImportTab` (pass sample data as prop)
  - Add `student_name` to `ENROLLMENT_DB_COLUMNS`
  - Rewrite `importEnrollments` to auto-create users and students first
  - Update result display to show user/student/enrollment counts

### Technical Details
- Sample CSV download: `new Blob([csvString], {type: 'text/csv'})` → `URL.createObjectURL` → click hidden anchor
- User extraction: `Map<phone, name>` from rows → filter out existing phones → batch insert
- Student extraction: `Map<phone+name, row>` from rows → filter out existing → batch insert with looked-up user_id
- Enrollment creation: same as current but now students are guaranteed to exist

