-- AI Debate Sessions table for the team-only AI Panel feature

create table if not exists public.ai_debate_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  topic       text not null,
  mode        text not null check (mode in ('debate', 'collaborate', 'compare')),
  rounds      int  not null default 3,
  transcript  jsonb not null default '[]',
  context     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.ai_debate_sessions enable row level security;

create policy "Users manage own debate sessions"
  on public.ai_debate_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
