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
    private static final long RING_MS = 60_000L;

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String kind = d.get("kind");
        String callId = d.get("call_id");
        if ("call_incoming".equals(kind) && callId != null) {
            showIncomingCall(callId, d);
            return;
        }
        if ("call_cancel".equals(kind) && callId != null) {
            NotificationManagerCompat.from(this).cancel(callId.hashCode());
            Intent close = new Intent(IncomingCallActivity.ACTION_CLOSE).setPackage(getPackageName());
            close.putExtra("call_id", callId);
            sendBroadcast(close);
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

    private PendingIntent fullScreen(String callId, Map<String, String> d, int req) {
        Intent i = new Intent(this, IncomingCallActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        i.putExtra("call_id", callId);
        for (String k : new String[]{"group_id", "group_name", "caller_name", "caller_avatar_url",
                "turn_beneficiary_name", "turn_payout_amount"}) i.putExtra(k, d.get(k));
        return PendingIntent.getActivity(this, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void showIncomingCall(String callId, Map<String, String> d) {
        String caller = d.get("caller_name");
        String group = d.get("group_name");
        String title = caller != null && !caller.isEmpty() ? caller : d.get("title");
        String body = group != null && !group.isEmpty() ? "Appel audio · Tontine " + group : d.get("body");
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
                .setFullScreenIntent(fullScreen(callId, d, id + 2), true)
                .addAction(0, "Refuser", decline)
                .addAction(0, "Décrocher", answer);

        android.app.Notification n = b.build();
        n.flags |= android.app.Notification.FLAG_INSISTENT; // sonnerie en boucle
        try {
            NotificationManagerCompat.from(this).notify(id, n);
        } catch (SecurityException ignored) { /* notifications refusées */ }
    }
}
