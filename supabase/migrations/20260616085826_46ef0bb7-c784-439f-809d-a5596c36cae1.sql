do $$ begin
  alter type public.notification_kind add value if not exists 'swap_requested';
  alter type public.notification_kind add value if not exists 'swap_responded';
  alter type public.notification_kind add value if not exists 'swap_executed';
end $$;
do $$ begin
  alter type public.rotation_order add value if not exists 'auction';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'auction_outbid';
  alter type public.notification_kind add value if not exists 'auction_won';
  alter type public.notification_kind add value if not exists 'auction_lost';
  alter type public.notification_kind add value if not exists 'auction_closed';
end $$;
do $$ begin
  alter type public.notification_kind add value if not exists 'review_received';
end $$;
do $$ begin
  alter type public.member_status add value if not exists 'suspended';
  alter type public.notification_kind add value if not exists 'member_suspended';
  alter type public.notification_kind add value if not exists 'member_reactivated';
  alter type public.notification_kind add value if not exists 'member_kicked';
  alter type public.notification_kind add value if not exists 'permissions_changed';
  alter type public.notification_kind add value if not exists 'ownership_transferred';
end $$;