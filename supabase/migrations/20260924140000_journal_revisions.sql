-- Fase 5: batas jurnal dinamis (UI), riwayat revisi, lintas bulan, lampiran.

-- ---------------------------------------------------------------------------
-- Journal revision history (append-only; current content stays on journals)
-- ---------------------------------------------------------------------------

create table if not exists public.journal_revisions (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  content varchar(500) not null check (char_length(trim(content)) between 1 and 500),
  revision_no integer not null check (revision_no >= 1),
  created_at timestamptz not null default now(),
  constraint journal_revisions_unique_journal_revision unique (journal_id, revision_no)
);

create index if not exists journal_revisions_journal_idx
  on public.journal_revisions (journal_id, revision_no desc);

alter table public.journal_revisions enable row level security;

drop policy if exists journal_revisions_select_own_or_admin on public.journal_revisions;
create policy journal_revisions_select_own_or_admin
on public.journal_revisions for select to authenticated
using (
  participant_id = auth.uid()
  or public.is_admin()
);

grant select on public.journal_revisions to authenticated;
revoke insert, update, delete on public.journal_revisions from anon, authenticated;

create or replace function public.record_journal_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  if tg_op = 'INSERT' then
    insert into public.journal_revisions (journal_id, participant_id, content, revision_no)
    values (new.id, new.participant_id, new.content, 1);
    return new;
  end if;
  if new.content is distinct from old.content then
    select coalesce(max(revision_no), 0) + 1
    into v_next
    from public.journal_revisions
    where journal_id = new.id;
    insert into public.journal_revisions (journal_id, participant_id, content, revision_no)
    values (new.id, new.participant_id, new.content, greatest(v_next, 1));
  end if;
  return new;
end;
$$;

drop trigger if exists journals_record_revision on public.journals;
create trigger journals_record_revision
after insert or update of content on public.journals
for each row execute function public.record_journal_revision();

-- Seed one revision for any journal that already exists (no history yet).
insert into public.journal_revisions (journal_id, participant_id, content, revision_no)
select j.id, j.participant_id, j.content, 1
from public.journals j
where not exists (
  select 1 from public.journal_revisions r where r.journal_id = j.id
)
on conflict do nothing;
