-- Campos públicos complementares para o fluxo: aprovado -> editar -> liberar no portal.
alter table public.stall_registrations
  add column if not exists photo_url text,
  add column if not exists logo_url text,
  add column if not exists public_description text,
  add column if not exists public_ready boolean not null default false;

create index if not exists stall_registrations_public_ready_idx
  on public.stall_registrations(status, public_ready);

insert into storage.buckets (id, name, public)
values ('stall-assets', 'stall-assets', true)
on conflict (id) do update set public = true;

-- O servidor Admin usa SUPABASE_SECRET_KEY para gravar os arquivos.
-- A API pública só retorna linhas com status = approved e public_ready = true.
