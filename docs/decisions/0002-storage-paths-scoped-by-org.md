# 0002. Certificate files live under an org-scoped Storage path

- Status: accepted
- Date: 2026-10-03

## Context

Certificates of insurance name businesses, policy numbers and limits. They belong to one organisation and must never be readable by another. Files live in Supabase Storage, which applies RLS policies on `storage.objects` using the object name. The `certificates` table already isolates rows by `org_id`, but the file store needs its own rule, and the two must not disagree.

## Decision

- One private bucket, `certificates`: `public = false`, 10 MB limit, `application/pdf`, `image/png` and `image/jpeg` only.
- Object name: `<org_id>/<certificate_id>/<file_name>`. The first segment decides access:
  - members of that org can select, insert and update;
  - only owners can delete;
  - inserts and updates must be exactly two folders deep, and an update cannot move a file into another org's folder.
- Policies read the first segment through `public.storage_object_org_id(name)`. It returns the segment as a uuid only when it is a canonical lowercase uuid, and null otherwise. A bare `(storage.foldername(name))[1]::uuid` cast would raise an error for any object whose first segment is not a uuid, and that error would break bucket listings for every member. Null never matches an org.
- `certificates.storage_path` has a check constraint: it must start with the row's own `org_id/id/` and have exactly one file-name segment after that. A row therefore cannot point at another org's file, and paths are unique by construction.
- The browser gets files only through short-lived signed URLs created server-side for a path the caller can already read. The bucket is never public.

## Consequences

- Isolation is enforced twice, on the row and on the file, and both use the same org id.
- The certificate id must exist before upload. The app either creates the row first (`status = 'pending'`) or generates the uuid client-side and uses it for both.
- Deleting a certificate or vendor row does not delete its files. The app removes `<org_id>/<certificate_id>/` first. Orphaned files are invisible to other orgs but still use storage.
- Server jobs (extraction, demo seeding) use the service role, which bypasses these policies. They must build paths from the org id they are working on, never from user input.
