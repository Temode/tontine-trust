-- Règle : jamais d'adresse email comme nom d'expéditeur dans une notification.
DO $$ BEGIN
  ASSERT public.member_display_name('Aïssatou Bah') = 'Aïssatou Bah', 'nom présent conservé';
  ASSERT public.member_display_name(NULL) = 'Un membre', 'nom absent';
  ASSERT public.member_display_name('  ') = 'Un membre', 'nom vide';
  ASSERT public.member_display_name('comptea@yopmail.com') = 'Un membre', 'email masqué';
END $$;
