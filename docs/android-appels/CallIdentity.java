package com.tontinedigitale.app;

import java.text.DecimalFormatSymbols;
import java.text.NumberFormat;
import java.util.Locale;

/** Règles communes de présentation, sans dépendance Android. */
public final class CallIdentity {
    /** Espace fine insécable (U+202F), séparateur de milliers de la charte. */
    public static final char THIN_NBSP = '\u202F';
    /** Espace insécable (U+00A0) entre le montant et la devise. */
    public static final char NBSP = '\u00A0';

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
        if (known) {
            return new CallIdentity(name, tontine + " · Appel entrant", initialsOf(name, 2), true);
        }
        // Appelant inconnu : la tontine en titre, silhouette à la place des initiales.
        return new CallIdentity(tontine, "Appel entrant d'un membre", "", false);
    }

    /** Prénom seul ; vide si la valeur n'est pas un nom présentable. */
    public static String firstName(String fullName) {
        String n = clean(fullName);
        if (n.isEmpty() || n.contains("@")) return "";
        return n.split(" ")[0];
    }

    /** « Tour de » ou « Tour d' » selon l'initiale (élision devant voyelle ou h muet). */
    public static String turnPrefix(String firstName) {
        if (firstName == null || firstName.isEmpty()) return "Tour de ";
        char c = Character.toLowerCase(firstName.charAt(0));
        return "aàâäeéèêëiîïoôöuùûüyh".indexOf(c) >= 0 ? "Tour d'" : "Tour de ";
    }

    /**
     * Montant brut → « 2 400 000 GNF » : milliers en espace fine insécable,
     * espace insécable avant la devise. Retourne "" si la valeur est illisible.
     */
    public static String formatAmount(String raw) {
        long value;
        try { value = Long.parseLong(clean(raw)); } catch (NumberFormatException e) { return ""; }
        NumberFormat nf = NumberFormat.getInstance(Locale.FRANCE);
        nf.setMaximumFractionDigits(0);
        nf.setGroupingUsed(true);
        String s = nf.format(value);
        // Selon la version d'Android, le séparateur obtenu est U+00A0 ou U+202F :
        // on impose U+202F pour rester aligné sur le web (Intl fr-FR).
        char sep = new DecimalFormatSymbols(Locale.FRANCE).getGroupingSeparator();
        s = s.replace(sep, THIN_NBSP).replace(NBSP, THIN_NBSP).replace(' ', THIN_NBSP);
        return s + NBSP + "GNF";
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
