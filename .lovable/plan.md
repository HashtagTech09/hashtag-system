

# Enable Auto-Confirm Email Signups

## What This Does
Enables automatic email confirmation for new signups so you can create accounts and log in immediately without needing to verify your email. This is ideal for development.

## How
Use the `cloud--configure_auth` tool to set `enable_signup` to `true` and `double_confirm_changes` to `false`, with auto-confirm enabled.

## Important Note
This should be disabled before going to production — email verification protects against fake accounts.

