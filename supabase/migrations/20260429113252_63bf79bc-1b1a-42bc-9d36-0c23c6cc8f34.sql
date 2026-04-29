
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'user');
create type public.doc_status as enum ('queued','processing','completed','failed','finalized');
create type public.job_stage as enum (
  'queued','started','parsing_started','parsing_completed',
  'extraction_started','extraction_completed','storing_result','completed','failed'
);

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "user_roles_admin_manage" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO PROFILE + FIRST USER ADMIN ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  user_count int;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  select count(*) into user_count from public.user_roles;
  if user_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ DOCUMENTS ============
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  original_name text not null,
  storage_path text not null,
  mime_type text,
  extension text,
  size bigint not null default 0,
  status doc_status not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create index documents_user_id_idx on public.documents(user_id);
create index documents_status_idx on public.documents(status);
create index documents_created_at_idx on public.documents(created_at desc);

create policy "documents_select" on public.documents
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "documents_insert" on public.documents
  for insert with check (auth.uid() = user_id);
create policy "documents_update" on public.documents
  for update using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "documents_delete" on public.documents
  for delete using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ============ JOBS ============
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress int not null default 0,
  stage job_stage not null default 'queued',
  error_message text,
  retry_count int not null default 0,
  logs jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jobs enable row level security;
create index jobs_document_id_idx on public.jobs(document_id);
create index jobs_user_id_idx on public.jobs(user_id);

create policy "jobs_select" on public.jobs
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "jobs_insert" on public.jobs
  for insert with check (auth.uid() = user_id);
create policy "jobs_update" on public.jobs
  for update using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ============ RESULTS ============
create table public.results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  extracted_json jsonb not null default '{}'::jsonb,
  finalized boolean not null default false,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.results enable row level security;
create index results_document_id_idx on public.results(document_id);

create policy "results_select" on public.results
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "results_insert" on public.results
  for insert with check (auth.uid() = user_id);
create policy "results_update" on public.results
  for update using (
    (auth.uid() = user_id and finalized = false) or public.has_role(auth.uid(), 'admin')
  );
create policy "results_delete" on public.results
  for delete using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create trigger results_touch before update on public.results
  for each row execute function public.touch_updated_at();

-- ============ ACTIVITY LOGS ============
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;
create policy "activity_select_own_or_admin" on public.activity_logs
  for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "activity_insert_own" on public.activity_logs
  for insert with check (auth.uid() = user_id);

-- ============ STORAGE ============
insert into storage.buckets (id, name, public) values ('documents','documents', false)
  on conflict (id) do nothing;

create policy "docs_storage_read_own" on storage.objects
  for select using (
    bucket_id = 'documents' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(), 'admin'))
  );
create policy "docs_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "docs_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'documents' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(), 'admin'))
  );

-- ============ REALTIME ============
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.results;
alter table public.documents replica identity full;
alter table public.jobs replica identity full;
alter table public.results replica identity full;
