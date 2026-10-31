package com.tontinedigitale.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * Canal des appels, créé dès le lancement de l'app avec les bons réglages.
 * L'ancien canal "tontine_calls" (resté silencieux sur certains téléphones) est supprimé :
 * Android interdit de remonter l'importance d'un canal existant, d'où le nouvel identifiant.
 */
public final class CallChannels {

    public static final String CALLS = "tontine_calls_v2";
    private static final String LEGACY = "tontine_calls";

    private CallChannels() { }

    public static void ensure(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(LEGACY) != null) nm.deleteNotificationChannel(LEGACY);
        if (nm.getNotificationChannel(CALLS) != null) return;
        NotificationChannel ch = new NotificationChannel(CALLS, "Appels Tontine Digitale",
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Appels entrants des tontines");
        // La sonnerie est jouée par CallRinger : le canal reste muet pour éviter un double son.
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        ch.setBypassDnd(true);
        nm.createNotificationChannel(ch);
    }
}
