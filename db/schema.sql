-- adoptchurches: the register, the pledges, and the demand it produces.
-- Plain SQL, applied by scripts/db-migrate.mjs; safe to run more than once.

create table if not exists listings_demand (
  listing_id    text primary key,
  collects      integer not null default 0,
  baskets       integer not null default 0,
  views         integer not null default 0,
  last_event_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists events (
  id           bigserial primary key,
  kind         text not null check (kind in ('collect', 'uncollect', 'basket', 'remove', 'view')),
  listing_id   text not null,
  session_id   text,
  created_at   timestamptz not null default now()
);
create index if not exists events_listing_idx on events (listing_id, created_at desc);
create index if not exists events_kind_idx on events (kind, created_at desc);

create table if not exists pledges (
  id            bigserial primary key,
  listing_id    text not null,
  name          text not null,
  email         text not null,
  amount_cents  bigint not null check (amount_cents >= 0),
  currency      text not null default 'USD',
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists pledges_listing_idx on pledges (listing_id);

create table if not exists orders (
  id            bigserial primary key,
  reference     text not null unique,
  name          text not null,
  email         text not null,
  town          text,
  note          text,
  item_count    integer not null default 0,
  subtotal_cents bigint not null default 0,
  reserve_cents  bigint not null default 0,
  total_cents    bigint not null default 0,
  created_at    timestamptz not null default now(),
  emailed_at    timestamptz,
  email_error   text
);

create table if not exists order_items (
  id           bigserial primary key,
  order_id     bigint not null references orders (id) on delete cascade,
  listing_id   text not null,
  name         text not null,
  price_cents  bigint not null default 0,
  price_label  text
);
create index if not exists order_items_order_idx on order_items (order_id);

-- what the site reads to answer "is anyone actually interested?"
create or replace view demand_summary as
  select
    (select count(*) from orders)                              as orders,
    (select coalesce(sum(total_cents), 0) from orders)         as ordered_value_cents,
    (select count(*) from pledges)                             as pledges,
    (select coalesce(sum(amount_cents), 0) from pledges)        as pledged_cents,
    (select coalesce(sum(collects), 0) from listings_demand)    as collects,
    (select coalesce(sum(baskets), 0) from listings_demand)     as baskets,
    (select count(distinct listing_id) from listings_demand
       where collects > 0 or baskets > 0)                      as listings_with_interest;

-- ids returned by Resend, so a letter can be traced after it leaves
alter table orders add column if not exists receipt_email_id text;
alter table orders add column if not exists notify_email_id text;

-- the same traceability for pledge letters
alter table pledges add column if not exists pledge_email_id text;
alter table pledges add column if not exists notify_email_id text;

-- one photograph per building, fetched once and kept here rather than hotlinked
create table if not exists listing_images (
  listing_id  text primary key,
  hero        bytea,
  card        bytea,
  blur        text,
  width       integer,
  height      integer,
  credit      text,
  source_url  text,
  sha256      text,
  bytes       integer,
  fetched_at  timestamptz not null default now()
);
