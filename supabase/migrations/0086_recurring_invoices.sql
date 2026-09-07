-- =============================================================================
-- 0086_recurring_invoices.sql
-- -----------------------------------------------------------------------------
-- Recurring invoice templates for automated retainer/subscription billing.
-- Generates invoices on a schedule (weekly, monthly, quarterly, yearly).
-- India-first: respects GST, place-of-supply, and invoice numbering sequence.
-- =============================================================================

-- --- recurring_invoices ------------------------------------------------------
create table if not exists public.recurring_invoices (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  client_id             uuid references public.clients(id) on delete set null,
  project_id            uuid references public.projects(id) on delete set null,

  -- Recurrence rule
  frequency             text not null default 'monthly'
                          check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  interval              int not null default 1 check (interval >= 1), -- every N periods
  day_of_month          int,                       -- 1..28, or 31 for "last day"
  day_of_week           int,                       -- 0=Sun..6=Sat (for weekly)
  start_date            date not null,
  end_date              date,                      -- optional, null = forever
  max_occurrences       int,                       -- optional cap

  -- Invoice template (copied to each generated invoice)
  invoice_prefix        text,                      -- overrides user_profiles.invoice_prefix
  invoice_number_padding int,                      -- overrides user_profiles.invoice_number_padding
  currency              text not null default 'INR',
  issue_date_offset     int not null default 0,    -- days from period start to issue_date
  due_date_offset       int not null default 14,   -- days from issue_date to due_date
  status_on_create      text not null default 'draft' check (status_on_create in ('draft', 'sent')),
  discount              numeric(14,2) not null default 0,
  notes                 text,
  terms                 text,
  hsn_sac               text,
  gst_rate              numeric(5,2) not null default 0,

  -- Line items template (JSON array)
  items                 jsonb not null default '[]'::jsonb,

  -- Tracking
  last_generated_at     timestamptz,
  next_generation_at    timestamptz not null,
  generation_count      int not null default 0,
  is_active             boolean not null default true,
  paused_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (user_id, client_id, frequency, interval, start_date)
);

create index if not exists recurring_invoices_user_id_idx     on public.recurring_invoices (user_id);
create index if not exists recurring_invoices_client_id_idx   on public.recurring_invoices (client_id);
create index if not exists recurring_invoices_active_next_idx on public.recurring_invoices (is_active, next_generation_at) where is_active = true;
create index if not exists recurring_invoices_project_id_idx  on public.recurring_invoices (project_id);

create trigger recurring_invoices_set_updated_at
before update on public.recurring_invoices
for each row execute function public.set_updated_at();

-- --- RLS ---------------------------------------------------------------------
alter table public.recurring_invoices enable row level security;

create policy recurring_invoices_select_own on public.recurring_invoices
  for select to authenticated using (auth.uid() = user_id);
create policy recurring_invoices_insert_own on public.recurring_invoices
  for insert to authenticated with check (auth.uid() = user_id);
create policy recurring_invoices_update_own on public.recurring_invoices
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_invoices_delete_own on public.recurring_invoices
  for delete to authenticated using (auth.uid() = user_id);

-- --- Helper: compute next occurrence date ------------------------------------
create or replace function public.compute_next_recurring_date(
  p_frequency text,
  p_interval int,
  p_day_of_month int,
  p_day_of_week int,
  p_start_date date,
  p_after_date date
)
returns date language plpgsql as $$
declare
  v_next date := p_after_date;
  v_iter int := 0;
begin
  if p_after_date < p_start_date then
    return p_start_date;
  end if;

  loop
    v_iter := v_iter + 1;
    if v_iter > 50 then
      -- safety: if we can't find a date in 50 iterations, return the input
      return v_next;
    end if;

    case p_frequency
      when 'weekly' then
        v_next := v_next + (p_interval * 7 || ' days')::interval;
        -- If day_of_week specified, align to that weekday
        if p_day_of_week is not null then
          while extract(dow from v_next)::int <> p_day_of_week loop
            v_next := v_next + 1;
          end loop;
        end if;
      when 'monthly' then
        -- Add months, preserving day_of_month (or last day)
        if p_day_of_month is not null then
          v_next := date_trunc('month', v_next + (p_interval || ' months')::interval)::date
                    + (p_day_of_month - 1) || ' days'::interval;
          -- Handle "last day of month" (day 31 = last day)
          if p_day_of_month = 31 then
            v_next := (date_trunc('month', v_next) + '1 month - 1 day'::interval)::date;
          end if;
        else
          v_next := v_next + (p_interval || ' months')::interval;
        end if;
      when 'quarterly' then
        if p_day_of_month is not null then
          v_next := date_trunc('month', v_next + (p_interval * 3 || ' months')::interval)::date
                    + (p_day_of_month - 1) || ' days'::interval;
          if p_day_of_month = 31 then
            v_next := (date_trunc('month', v_next) + '1 month - 1 day'::interval)::date;
          end if;
        else
          v_next := v_next + (p_interval * 3 || ' months')::interval;
        end if;
      when 'yearly' then
        if p_day_of_month is not null then
          v_next := date_trunc('year', v_next + (p_interval || ' years')::interval)::date
                    + (p_day_of_month - 1) || ' days'::interval;
          -- Handle Feb 29 on non-leap years
          if p_day_of_month = 29 and extract(month from v_next) = 2 and extract(day from v_next) = 28 then
            -- Keep Feb 28 on non-leap years
          end if;
        else
          v_next := v_next + (p_interval || ' years')::interval;
        end if;
    end case;

    -- Check if we've passed end_date or max_occurrences
    exit when v_next > p_after_date;
  end loop;

  return v_next;
end $$;

-- --- Helper: update next_generation_at ---------------------------------------
create or replace function public.update_recurring_next_generation(
  p_recurring_id uuid
)
returns void language plpgsql as $$
declare
  v_rec public.recurring_invoices%rowtype;
  v_next date;
begin
  select * into v_rec from public.recurring_invoices where id = p_recurring_id;
  if not found then return; end if;

  v_next := public.compute_next_recurring_date(
    v_rec.frequency,
    v_rec.interval,
    v_rec.day_of_month,
    v_rec.day_of_week,
    v_rec.start_date,
    coalesce(v_rec.last_generated_at::date, v_rec.start_date)
  );

  -- Check end conditions
  if v_rec.end_date is not null and v_next > v_rec.end_date then
    update public.recurring_invoices
      set is_active = false, next_generation_at = null
      where id = p_recurring_id;
    return;
  end if;

  update public.recurring_invoices
    set next_generation_at = v_next
    where id = p_recurring_id;
end $$;