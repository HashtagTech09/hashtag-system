
-- Add auth_id column to users table to link to auth.users
ALTER TABLE public.users ADD COLUMN auth_id uuid;

-- Create unique index (partial - only where auth_id is not null)
CREATE UNIQUE INDEX idx_users_auth_id ON public.users (auth_id) WHERE auth_id IS NOT NULL;
