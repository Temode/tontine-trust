DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname IN (
      SELECT udt_name FROM information_schema.columns
      WHERE table_name='notification_preferences' AND column_name='notif_type'
    ) AND e.enumlabel='deposit_status'
  ) THEN
    EXECUTE 'ALTER TYPE ' || (
      SELECT udt_name FROM information_schema.columns
      WHERE table_name='notification_preferences' AND column_name='notif_type'
    ) || ' ADD VALUE ''deposit_status''';
  END IF;
END $$;