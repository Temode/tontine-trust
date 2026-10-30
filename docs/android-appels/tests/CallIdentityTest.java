package com.tontinedigitale.app;

public final class CallIdentityTest {
    private static void equal(String expected, String actual) {
        if (!expected.equals(actual)) throw new AssertionError(expected + " != " + actual);
    }

    public static void main(String[] args) {
        CallIdentity known = CallIdentity.from("Mariama Bah", "Famille Diallo");
        equal("Mariama Bah", known.title);
        equal("Famille Diallo · Appel entrant", known.subtitle);
        equal("MB", known.initials);
        if (!known.callerKnown) throw new AssertionError("Known caller marked unknown");
        for (String unknown : new String[]{null, "", "  ", "Un membre", " UN MEMBRE ", "membre@example.test"}) {
            CallIdentity identity = CallIdentity.from(unknown, "Famille Diallo");
            equal("Famille Diallo", identity.title);
            equal("Appel entrant d'un membre", identity.subtitle);
            equal("", identity.initials);
            if (identity.callerKnown) throw new AssertionError("Anonymous caller marked known");
        }
        equal("Tontine Digitale", CallIdentity.from(null, null).title);

        equal("Alpha", CallIdentity.firstName("  Alpha   Condé "));
        equal("", CallIdentity.firstName("alpha@example.test"));
        equal("Tour d'", CallIdentity.turnPrefix("Alpha"));
        equal("Tour d'", CallIdentity.turnPrefix("Hawa"));
        equal("Tour de ", CallIdentity.turnPrefix("Mariama"));

        equal("2\u202F400\u202F000\u00A0GNF", CallIdentity.formatAmount("2400000"));
        equal("10\u202F000\u00A0GNF", CallIdentity.formatAmount("10000"));
        equal("", CallIdentity.formatAmount(""));
        equal("", CallIdentity.formatAmount("abc"));
        System.out.println("CallIdentity: all rules passed");
    }
}
