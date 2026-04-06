-- supabase/schema.sql

-- ─── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fuzzy search

-- ─── USERS ────────────────────────────────────────────────────
-- We extend Supabase's built-in auth.users table
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  bio          text,
  avatar_url   text,
  karma        integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── COMMUNITIES ──────────────────────────────────────────────
create table public.communities (
  id           uuid primary key default uuid_generate_v4(),
  name         text unique not null,           -- e.g. "programming"
  display_name text not null,
  description  text,
  banner_url   text,
  created_by   uuid references public.profiles(id) on delete set null,
  member_count integer not null default 1,
  created_at   timestamptz not null default now()
);

create table public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- ─── POSTS ────────────────────────────────────────────────────
create table public.posts (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  body         text,
  url          text,                            -- for link posts
  author_id    uuid references public.profiles(id) on delete set null,
  community_id uuid references public.communities(id) on delete cascade,
  score        integer not null default 0,      -- upvotes - downvotes
  upvotes      integer not null default 0,
  downvotes    integer not null default 0,
  comment_count integer not null default 0,
  -- tsvector column for full-text search
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored,
  created_at   timestamptz not null default now()
);

-- GIN index for full-text search
create index posts_search_idx on public.posts using gin(search_vector);
-- B-tree indexes for sorting and filtering
create index posts_community_created_idx on public.posts(community_id, created_at desc);
create index posts_score_idx on public.posts(score desc);

-- ─── COMMENTS ─────────────────────────────────────────────────
create table public.comments (
  id           uuid primary key default uuid_generate_v4(),
  body         text not null,
  author_id    uuid references public.profiles(id) on delete set null,
  post_id      uuid references public.posts(id) on delete cascade,
  parent_id    uuid references public.comments(id) on delete cascade,  -- null = top-level
  score        integer not null default 0,
  depth        integer not null default 0,      -- cached depth for performance
  path         text not null default '',        -- materialized path for ordering
  created_at   timestamptz not null default now()
);

create index comments_post_idx    on public.comments(post_id);
create index comments_parent_idx  on public.comments(parent_id);

-- ─── VOTES ────────────────────────────────────────────────────
create table public.post_votes (
  user_id   uuid references public.profiles(id) on delete cascade,
  post_id   uuid references public.posts(id) on delete cascade,
  value     smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)              -- one vote per user per post
);

create table public.comment_votes (
  user_id    uuid references public.profiles(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

-- ─── MATERIALIZED VIEW: community stats ───────────────────────
create materialized view public.community_stats as
select
  c.id                                          as community_id,
  c.name,
  count(distinct cm.user_id)                    as member_count,
  count(distinct p.id)                          as post_count,
  max(p.created_at)                             as last_post_at,
  coalesce(sum(p.score), 0)                     as total_score
from public.communities c
left join public.community_members cm on cm.community_id = c.id
left join public.posts p              on p.community_id  = c.id
group by c.id, c.name;

create unique index community_stats_idx on public.community_stats(community_id);

-- ─── TRIGGERS ─────────────────────────────────────────────────

-- 1. Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Update post score + karma when vote is cast
create or replace function public.handle_post_vote()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts
    set score     = score + new.value,
        upvotes   = upvotes   + case when new.value = 1  then 1 else 0 end,
        downvotes = downvotes + case when new.value = -1 then 1 else 0 end
    where id = new.post_id;

    -- update author karma
    update public.profiles p
    set karma = karma + new.value
    from public.posts po
    where po.id = new.post_id and p.id = po.author_id;

  elsif TG_OP = 'UPDATE' then
    -- user flipped their vote
    update public.posts
    set score     = score + (new.value - old.value),
        upvotes   = upvotes   + case when new.value =  1 then 1 else 0 end
                              - case when old.value =  1 then 1 else 0 end,
        downvotes = downvotes + case when new.value = -1 then 1 else 0 end
                              - case when old.value = -1 then 1 else 0 end
    where id = new.post_id;

    update public.profiles p
    set karma = karma + (new.value - old.value)
    from public.posts po
    where po.id = new.post_id and p.id = po.author_id;

  elsif TG_OP = 'DELETE' then
    update public.posts
    set score     = score - old.value,
        upvotes   = upvotes   - case when old.value =  1 then 1 else 0 end,
        downvotes = downvotes - case when old.value = -1 then 1 else 0 end
    where id = old.post_id;

    update public.profiles p
    set karma = karma - old.value
    from public.posts po
    where po.id = old.post_id and p.id = po.author_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger post_vote_trigger
  after insert or update or delete on public.post_votes
  for each row execute function public.handle_post_vote();

-- 3. Update comment count on posts
create or replace function public.handle_comment_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comment_count = comment_count - 1 where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger comment_count_trigger
  after insert or delete on public.comments
  for each row execute function public.handle_comment_count();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.post_votes        enable row level security;
alter table public.comment_votes     enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Communities: anyone can read, authenticated users can create
create policy "communities_read"   on public.communities for select using (true);
create policy "communities_insert" on public.communities for insert with check (auth.uid() is not null);

-- Community members
create policy "members_read"   on public.community_members for select using (true);
create policy "members_insert" on public.community_members for insert with check (auth.uid() = user_id);
create policy "members_delete" on public.community_members for delete using (auth.uid() = user_id);

-- Posts: anyone reads, authenticated users create, authors update/delete
create policy "posts_read"   on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() is not null);
create policy "posts_update" on public.posts for update using (auth.uid() = author_id);
create policy "posts_delete" on public.posts for delete using (auth.uid() = author_id);

-- Comments
create policy "comments_read"   on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert with check (auth.uid() is not null);
create policy "comments_delete" on public.comments for delete using (auth.uid() = author_id);

-- Votes: users manage their own votes only
create policy "post_votes_all" on public.post_votes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comment_votes_all" on public.comment_votes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── SEED: default communities ────────────────────────────────
insert into public.communities (name, display_name, description) values
  ('general',     'General',      'General discussion about everything'),
  ('programming', 'Programming',  'Code, projects, and engineering talk'),
  ('askforumdb',  'AskForumDB',   'Questions and answers from the community'),
  ('news',        'World News',   'Current events and news from around the world');