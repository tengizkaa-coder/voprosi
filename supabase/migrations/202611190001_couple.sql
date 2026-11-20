create table public.couple_categories (id text primary key, name text not null, subtitle text, icon text, color text, level int not null);
create table public.couple_questions (id int primary key check(id between 1 and 667), category text not null references public.couple_categories(id), text text not null, level int not null);
create table public.couple_state (id int primary key check(id=1), asked jsonb not null default '{}', current_id int not null default 1, generation bigint not null default 0, revision bigint not null default 0);
insert into public.couple_state(id) values(1);
create table public.couple_reset_tokens (token uuid primary key default gen_random_uuid(), actor text not null, generation bigint not null, expires_at timestamptz not null default now()+interval '5 minutes');
create table public.couple_updates (id bigint primary key, status text not null default 'processing', started_at timestamptz not null default now());
alter table public.couple_categories enable row level security;
alter table public.couple_questions enable row level security;
alter table public.couple_state enable row level security;
alter table public.couple_reset_tokens enable row level security;
alter table public.couple_updates enable row level security;
revoke all on public.couple_categories, public.couple_questions, public.couple_state, public.couple_reset_tokens, public.couple_updates from anon, authenticated;
grant all on public.couple_categories, public.couple_questions, public.couple_state, public.couple_reset_tokens, public.couple_updates to service_role;
create function public.couple_snapshot() returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('asked',coalesce((select jsonb_agg(jsonb_build_object('id',key::int,'at',value#>>'{}') order by value desc) from jsonb_each(s.asked)),'[]'::jsonb),'current',current_id,'generation',generation,'revision',revision) from couple_state s where id=1;
$$;
create function public.couple_action(p_action text, p_actor text, p_id int default null, p_category text default null, p_random boolean default false, p_generation bigint default null, p_confirmation text default null) returns jsonb language plpgsql set search_path=public as $$
declare s couple_state%rowtype; next_id int; reset_id uuid; changed boolean:=false;
begin
 select * into s from couple_state where id=1 for update;
 if p_action='state' then return couple_snapshot(); end if;
 if p_generation is null or p_generation<>s.generation then raise exception 'STALE_GENERATION'; end if;
 if p_category is not null and not exists(select 1 from couple_categories where id=p_category) then raise exception 'INVALID_CATEGORY'; end if;
 if p_action='reset_request' then
  delete from couple_reset_tokens where expires_at<now() or actor=p_actor;
  insert into couple_reset_tokens(actor,generation) values(p_actor,s.generation) returning token into reset_id;
  return couple_snapshot()||jsonb_build_object('reset_token',reset_id);
 elsif p_action='reset' then
  delete from couple_reset_tokens where token::text=p_confirmation and actor=p_actor and generation=s.generation and expires_at>now() returning token into reset_id;
  if reset_id is null then raise exception 'INVALID_RESET_TOKEN'; end if;
  update couple_state set asked='{}',current_id=1,generation=generation+1,revision=revision+1 where id=1;
  delete from couple_reset_tokens;
  return couple_snapshot();
 elsif p_action in ('mark','undo','select') then
  if p_id is null or not exists(select 1 from couple_questions where id=p_id) then raise exception 'INVALID_QUESTION'; end if;
  if p_action='mark' then
   if s.asked ? p_id::text then return couple_snapshot(); end if;
   s.asked:=s.asked||jsonb_build_object(p_id::text,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
   changed:=true;
  elsif p_action='undo' then
   update couple_state set asked=asked-p_id::text,revision=revision+1 where id=1;
   return couple_snapshot();
  elsif not (s.asked ? p_id::text) then
   update couple_state set current_id=p_id,revision=revision+1 where id=1;
   return couple_snapshot();
  end if;
 elsif p_action not in ('next','resume') then raise exception 'INVALID_ACTION';
 end if;
 if p_action='resume' and not (s.asked ? s.current_id::text) and (p_category is null or exists(select 1 from couple_questions where id=s.current_id and category=p_category)) then return couple_snapshot(); end if;
 select q.id into next_id from couple_questions q where not (s.asked ? q.id::text) and (p_category is null or q.category=p_category) order by case when p_random then random() else q.id::float8 end limit 1;
 update couple_state set asked=s.asked,current_id=coalesce(next_id,current_id),revision=revision+1 where id=1;
 return couple_snapshot()||jsonb_build_object('exhausted',next_id is null);
end;
$$;
create function public.couple_claim_update(p_id bigint) returns text language plpgsql set search_path=public as $$
declare u couple_updates%rowtype;
begin
 insert into couple_updates(id) values(p_id) on conflict do nothing;
 if found then return 'claimed'; end if;
 select * into u from couple_updates where id=p_id for update;
 if u.status='done' then return 'done'; end if;
 if u.started_at>now()-interval '60 seconds' then return 'busy'; end if;
 update couple_updates set started_at=now() where id=p_id;
 return 'claimed';
end;
$$;
revoke all on function public.couple_snapshot(), public.couple_action(text,text,int,text,boolean,bigint,text), public.couple_claim_update(bigint) from public, anon, authenticated;
grant execute on function public.couple_snapshot(), public.couple_action(text,text,int,text,boolean,bigint,text), public.couple_claim_update(bigint) to service_role;
