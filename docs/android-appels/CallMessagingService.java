package com.tontinedigitale.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Appel entrant façon WhatsApp : écran plein, sonnerie continue, boutons Décrocher / Refuser.
 * Les autres notifications passent au plugin Capacitor sans changement.
 */
public class CallMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "tontine_calls";
    private static final long RING_MS = 45_000L;

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String kind = d.get("kind");
        String callId = d.get("call_id");
        if ("call_incoming".equals(kind) && callId != null) {
            showIncomingCall(callId, d.get("title"), d.get("body"));
            return;
        }
        if ("call_cancel".equals(kind) && callId != null) {
            NotificationManagerCompat.from(this).cancel(callId.hashCode());
            return;
        }
        super.onMessageReceived(msg);
    }

    private PendingIntent open(String callId, boolean decline, int req) {
        String url = "com.tontinedigitale.app://appel/" + callId + (decline ? "?action=decline" : "");
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url), this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void showIncomingCall(String callId, String title, String body) {
        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Appels Tontine Digitale",
                    NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Appels entrants des tontines");
            ch.setSound(ringtone, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 1000, 800, 1000, 800});
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        int id = callId.hashCode();
        PendingIntent answer = open(callId, false, id);
        PendingIntent decline = open(callId, true, id + 1);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setColor(0xFF0D7377)
                .setContentTitle(title != null ? title : "Appel entrant")
                .setContentText(body != null ? body : "Un membre vous appelle")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(ringtone)
                .setOngoing(true)
                .setAutoCancel(true)
                .setTimeoutAfter(RING_MS)
                .setContentIntent(answer)
                .setFullScreenIntent(answer, true)
                .addAction(0, "Refuser", decline)
                .addAction(0, "Décrocher", answer);

        android.app.Notification n = b.build();
        n.flags |= android.app.Notification.FLAG_INSISTENT; // sonnerie en boucle
        try {
            NotificationManagerCompat.from(this).notify(id, n);
        } catch (SecurityException ignored) { /* notifications refusées */ }
    }
}
