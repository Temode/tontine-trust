package com.tontinedigitale.app;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Réponse à un appel sans ouvrir l'application : téléphone verrouillé, page web à l'arrêt.
 * Authentifiée par le jeton court signé par le serveur et reçu dans la notification
 * (valable 90 s, pour cet appel et ce membre uniquement). Aucune session stockée ici.
 * Trois essais en 10 s ; en cas d'échec, le serveur passera le membre en « Pas de réponse ».
 */
public final class CallResponder {

    private static final long[] DELAYS_MS = {0L, 3_000L, 7_000L};

    private CallResponder() { }

    public static void send(String url, String token, String action) {
        if (url == null || url.isEmpty() || token == null || token.isEmpty()) return;
        new Thread(() -> {
            for (long delay : DELAYS_MS) {
                try {
                    if (delay > 0) Thread.sleep(delay);
                    if (post(url, token, action)) return;
                } catch (InterruptedException e) {
                    return;
                } catch (Exception ignored) { /* réseau indisponible : essai suivant */ }
            }
        }, "call-respond").start();
    }

    private static boolean post(String url, String token, String action) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(3_000);
        c.setReadTimeout(3_000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        String body = "{\"token\":\"" + token.replace("\"", "") + "\",\"action\":\"" + action + "\"}";
        try (OutputStream os = c.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }
        int code = c.getResponseCode();
        c.disconnect();
        // 401 = jeton expiré, 409 = appel déjà terminé : réessayer ne changerait rien.
        return code < 500;
    }
}
