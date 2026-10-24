package com.tontinedigitale.app;

import java.util.Locale;

/** Règles communes de présentation, sans dépendance Android. */
public final class CallIdentity {
    public final String title;
    public final String subtitle;
    public final String initials;
    public final boolean callerKnown;

    private CallIdentity(String title, String subtitle, String initials, boolean known) {
        this.title = title;
        this.subtitle = subtitle;
        this.initials = initials;
        this.callerKnown = known;
    }

    public static CallIdentity from(String caller, String group) {
        String name = clean(caller);
        String tontine = clean(group);
        boolean known = !name.isEmpty() && !name.contains("@")
                && !name.equalsIgnoreCase("Un membre");
        if (tontine.isEmpty()) tontine = "Tontine Digitale";
        if (!tontine.toLowerCase(Locale.ROOT).startsWith("tontine")) tontine = "Tontine " + tontine;
        String initialSource = clean(group);
        if (initialSource.isEmpty()) initialSource = tontine;
        return new CallIdentity(known ? name : tontine, known ? tontine : "Appel entrant",
                initialsOf(known ? name : initialSource, known ? 2 : 1), known);
    }

    private static String clean(String text) {
        return text == null ? "" : text.replaceAll("[\\s\\p{Z}]+", " ").trim();
    }

    private static String initialsOf(String text, int limit) {
        StringBuilder initials = new StringBuilder();
        int count = 0;
        for (String part : text.split(" ")) {
            if (!part.isEmpty() && count++ < limit) initials.appendCodePoint(part.codePointAt(0));
        }
        return initials.toString().toUpperCase(Locale.ROOT);
    }
}