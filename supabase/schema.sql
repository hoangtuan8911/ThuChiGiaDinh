-- Chạy một lần trong Supabase: SQL Editor → New query → Run.
-- Mỗi tài khoản chỉ đọc và ghi sổ của chính mình.

create table if not exists public.books (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.books enable row level security;

grant select, insert, update on public.books to authenticated;

drop policy if exists "books_select" on public.books;
create policy "books_select" on public.books
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "books_insert" on public.books;
create policy "books_insert" on public.books
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "books_update" on public.books;
create policy "books_update" on public.books
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
