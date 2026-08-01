#!/usr/bin/env python3.11
"""Fix trigger function and remaining errors."""
import psycopg2

conn = psycopg2.connect(
    host="db.nnqlazhrwmkrmynoohds.supabase.co", port=5432,
    dbname="postgres", user="postgres", password="Jaimepaco.307",
    sslmode="require"
)
cur = conn.cursor()

# 1. updated_at trigger function (full dollar-quoted)
print("1. Creation trigger updated_at...")
cur.execute("""
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$
""")
conn.commit()
print("   OK")

# 2. Trigger sur projects
print("2. Trigger sur projects...")
cur.execute("""
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();
""")
conn.commit()
print("   OK")

# 3. Storage policies for uploads (RLS on storage.objects)
print("3. Storage policies...")
# Auth users can upload screenshots
cur.execute("""
drop policy if exists "Users upload screenshots" on storage.objects;
create policy "Users upload screenshots" on storage.objects
  for insert with check (
    bucket_id = 'screenshots' and auth.role() = 'authenticated'
  );
""")
conn.commit()
print("   OK screenshots upload")

cur.execute("""
drop policy if exists "Users upload videos" on storage.objects;
create policy "Users upload videos" on storage.objects
  for insert with check (
    bucket_id = 'videos' and auth.role() = 'authenticated'
  );
""")
conn.commit()
print("   OK videos upload")

# 4. Verify everything
print("\n4. Verification complete:")
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
print(f"   Tables: {tables}")

cur.execute("SELECT trigger_name FROM information_schema.triggers WHERE table_schema='public'")
triggers = [r[0] for r in cur.fetchall()]
print(f"   Triggers: {triggers}")

cur.execute("SELECT id, name FROM public.templates ORDER BY id")
print(f"   Templates: {cur.fetchall()}")

cur.close()
conn.close()
print("\nSUPABASE 100% PRET!")
