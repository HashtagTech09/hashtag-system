

# Link Wingperson & Dreamcatcher to Users

## Overview
Replace the text `wingperson` and `dreamcatcher` columns in `studios` with foreign key references (`wingperson_id`, `dreamcatcher_id`) pointing to the `users` table. Update the UI to use dropdowns for user selection.

## Database Migration

1. Add `wingperson_id` (bigint, nullable, FK → users.id) and `dreamcatcher_id` (bigint, nullable, FK → users.id)
2. Drop old text columns `wingperson` and `dreamcatcher`

## Frontend Changes (`src/pages/Studios.tsx`)

1. **Fetch users** on mount for dropdown options
2. **Query**: Change to `select("*, wingperson:users!wingperson_id(id, name), dreamcatcher:users!dreamcatcher_id(id, name)")` to join user names
3. **Form**: Replace text inputs for Wingperson/Dreamcatcher with `<Select>` dropdowns listing all users
4. **Form state**: Change `wingperson`/`dreamcatcher` from string to `number | null` (user IDs)
5. **Table display**: Show `studio.wingperson?.name` and `studio.dreamcatcher?.name` instead of raw text
6. **Edit prefill**: Set dropdown values from `studio.wingperson_id` and `studio.dreamcatcher_id`

