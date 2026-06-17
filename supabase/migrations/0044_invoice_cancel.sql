-- Invoice cancel/void: add a 'cancelled' status so issued invoices can be
-- voided (number retained for the audit trail) instead of hard-deleted.
-- The status CHECK constraint is replaced robustly regardless of its name.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.invoices drop constraint %I', c);
  end loop;
end $$;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft','sent','viewed','paid','overdue','partially_paid','cancelled'));
