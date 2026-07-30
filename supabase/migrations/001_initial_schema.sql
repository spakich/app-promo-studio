-- App Promo Studio — Supabase schema

-- Projects table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled Project',
  app_name text,
  app_icon_url text,
  template_id text default 'classic',
  format text default 'horizontal' check (format in ('horizontal', 'vertical', 'square')),
  status text default 'draft' check (status in ('draft', 'rendering', 'completed', 'failed')),
  video_url text,
  thumbnail_url text,
  duration_seconds integer default 30,
  fps integer default 30,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Screenshots table
create table if not exists public.screenshots (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  storage_path text not null,
  display_order integer not null default 0,
  caption text,
  transition_type text default 'fade' check (transition_type in ('fade', 'slide', 'zoom', 'none')),
  duration_seconds numeric default 3,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

-- Templates table
create table if not exists public.templates (
  id text primary key,
  name text not null,
  description text,
  thumbnail_url text,
  config jsonb not null default '{}',
  is_premium boolean default false,
  category text default 'general',
  created_at timestamptz default now() not null
);

-- Render jobs table
create table if not exists public.render_jobs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  progress integer default 0,
  output_url text,
  error_message text,
  render_provider text default 'local' check (render_provider in ('local', 'cloud-run', 'lambda')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.projects enable row level security;
alter table public.screenshots enable row level security;
alter table public.templates enable row level security;
alter table public.render_jobs enable row level security;

-- Policies: users can only access their own data
create policy "Users manage own projects" on public.projects
  for all using (auth.uid() = user_id);

create policy "Users manage own screenshots" on public.screenshots
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "Templates are readable by all" on public.templates
  for select using (true);

create policy "Users manage own render jobs" on public.render_jobs
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('screenshots', 'screenshots', true),
  ('videos', 'videos', true),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Users upload own screenshots" on storage.objects
  for insert with check (
    bucket_id = 'screenshots' and auth.uid() = metadata->>'user_id'::uuid
  );

create policy "Screenshots are public" on storage.objects
  for select using (bucket_id = 'screenshots');

create policy "Users upload own videos" on storage.objects
  for insert with check (
    bucket_id = 'videos' and auth.uid() = metadata->>'user_id'::uuid
  );

create policy "Videos are public" on storage.objects
  for select using (bucket_id = 'videos');

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();
