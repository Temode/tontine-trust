
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname='ledger_entry_type' AND e.enumlabel='coordinator_fee'
  ) THEN
    ALTER TYPE public.ledger_entry_type ADD VALUE 'coordinator_fee';
  END IF;
END $$;
