package com.tontinedigitale.app;

public final class CallIdentityTest {
    private static void equal(String expected, String actual) {
        if (!expected.equals(actual)) throw new AssertionError(expected + " != " + actual);
    }

    public static void main(String[] args) {
        CallIdentity known = CallIdentity.from("Mamadou Diallo", "Tontine teste");
        equal("Mamadou Diallo", known.title);
        equal("Tontine teste", known.subtitle);
        equal("MD", known.initials);
        equal("tOnTiNe teste", CallIdentity.from("Mamadou", "  tOnTiNe   teste  ").subtitle);
        equal("Tontine Famille", CallIdentity.from("Mamadou", "Famille").subtitle);
        for (String unknown : new String[]{null, "", "  ", "Un membre", " UN MEMBRE ", "membre@example.test"}) {
            CallIdentity identity = CallIdentity.from(unknown, "Tontine teste");
            equal("Tontine teste", identity.title);
            equal("Appel entrant", identity.subtitle);
            equal("T", identity.initials);
            if (identity.callerKnown) throw new AssertionError("Anonymous caller marked known");
        }
        CallIdentity fallback = CallIdentity.from("", "Famille");
        equal("Tontine Famille", fallback.title);
        equal("F", fallback.initials);
        equal("Tontine Digitale", CallIdentity.from(null, null).title);
        System.out.println("CallIdentity: all rules passed");
    }
}