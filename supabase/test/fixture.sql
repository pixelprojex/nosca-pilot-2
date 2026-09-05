-- Supabase-shaped fixture: roles, auth schema, auth.uid(), storage schema,
-- and a non-superuser "postgres"-like owner that bypasses RLS and is a
-- member of anon/authenticated so `set role` works.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supa login nosuperuser createrole bypassrls;
grant anon, authenticated, service_role to supa;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
alter table auth.users owner to supa;
grant usage on schema auth to supa, anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
-- storage, owned by a separate admin like Supabase's, so policy creation from supa is NOT allowed (mirrors the dashboard restriction)
create role storage_admin nologin;
create schema storage authorization storage_admin;
create table storage.buckets (id text primary key, name text, public boolean default false);
alter table storage.buckets owner to storage_admin;
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid);
alter table storage.objects owner to storage_admin;
alter table storage.objects enable row level security;
grant usage on schema storage to supa, anon, authenticated;
grant all on storage.buckets to supa; grant select, insert, update, delete on storage.objects to supa, anon, authenticated;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
grant usage, create on schema public to supa;
grant usage on schema public to anon, authenticated;
alter default privileges for role supa in schema public grant all on tables to anon, authenticated;
alter default privileges for role supa in schema public grant execute on functions to anon, authenticated;
