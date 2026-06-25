UPDATE public.notification_preferences
SET enabled = true, updated_at = now()
WHERE user_id = 'b9857ed1-4c33-461c-bdc5-79c54cfcb95e'
  AND channel = 'sms'
  AND notif_type IN (
    'contribution_confirmed','contribution_due','contribution_received',
    'turn_paid','payout_released','payout_hold_extended',
    'withdrawal_requested','withdrawal_processing','withdrawal_paid','withdrawal_failed','withdrawal_cancelled',
    'payment_confirmed_by_admin','payment_rejected_by_admin',
    'cycle_started','cycle_completed','group_completed',
    'member_suspended','member_kicked','member_reactivated',
    'penalty_waived','system'
  );