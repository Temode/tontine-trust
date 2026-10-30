package com.tontinedigitale.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Appel entrant façon WhatsApp : écran plein, sonnerie continue, boutons Décrocher / Refuser.
 * Priorité maximale partout : canal IMPORTANCE_HIGH (le plus haut niveau qu'Android accepte
 * pour un canal), notification PRIORITY_MAX + CATEGORY_CALL, sonnerie jouée par l'app.
 * Les autres notifications passent au plugin Capacitor sans changement.
 */
public class CallMessagingService extends MessagingService {

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
            CallRinger.stop();
            NotificationManagerCompat.from(this).cancel(callId.hashCode());
            Intent close = new Intent(IncomingCallActivity.ACTION_CLOSE).setPackage(getPackageName());
            close.putExtra("call_id", callId);
            sendBroadcast(close);
            return;
        }
        super.onMessageReceived(msg);
    }

    @Override
    public void onNewToken(String token) {
        // Le jeton n'est demandé qu'après connexion (useNativeApp) : repère pour l'écran d'autorisation.
        getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE).edit().putBoolean("push_ready", true).apply();
        super.onNewToken(token);
    }

    private PendingIntent open(String callId, boolean decline, int req) {
        String url = "com.tontinedigitale.app://appel/" + callId + (decline ? "?action=decline" : "");
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url), this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Intent callScreen(String callId, Map<String, String> d) {
        Intent i = new Intent(this, IncomingCallActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        i.putExtra("call_id", callId);
        for (String k : new String[]{"group_id", "group_name", "caller_name", "caller_avatar_url",
                "turn_beneficiary_name", "turn_payout_amount"}) i.putExtra(k, d.get(k));
        return i;
    }

    private void showIncomingCall(String callId, Map<String, String> d) {
        CallChannels.ensure(this);
        CallRinger.start(this);

        String caller = d.get("caller_name");
        String group = d.get("group_name");
        String title = caller != null && !caller.isEmpty() ? caller : group;
        int id = callId.hashCode();
        Intent screen = callScreen(callId, d);
        PendingIntent full = PendingIntent.getActivity(this, id + 2, screen,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // CallStyle.forIncomingCall : Android reconnaît un appel (boutons système Refuser/Répondre,
        // priorité d'appel). Il exige un fullScreenIntent ou un service de premier plan : on garde le premier.
        Person person = new Person.Builder()
                .setName(title != null && !title.isEmpty() ? title : "Appel entrant")
                .setImportant(true)
                .build();
        Notification n = new NotificationCompat.Builder(this, CallChannels.CALLS)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentText("Appel entrant")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setTimeoutAfter(RING_MS)
                .setContentIntent(full)
                .setFullScreenIntent(full, true)
                .setStyle(NotificationCompat.CallStyle.forIncomingCall(
                        person, open(callId, true, id + 1), open(callId, false, id)))
                .addPerson(person)
                .build();
        try {
            NotificationManagerCompat.from(this).notify(id, n);
        } catch (SecurityException ignored) { /* notifications refusées */ }

        // Secours si la surcouche du téléphone ignore l'intention plein écran.
        try { startActivity(screen); } catch (Exception ignored) { }
    }
}
