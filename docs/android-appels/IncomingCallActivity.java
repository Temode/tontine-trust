package com.tontinedigitale.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Écran d'appel entrant plein écran (comme WhatsApp), affiché même téléphone verrouillé. */
public class IncomingCallActivity extends Activity {

    public static final String ACTION_CLOSE = "com.tontinedigitale.app.CALL_CLOSE";
    private static final long RING_MS = 60_000L;

    private String callId;
    private String groupId;
    private Ringtone ringtone;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver closeReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            String id = i.getStringExtra("call_id");
            if (id == null || id.equals(callId)) finishCall();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_incoming_call);

        Intent in = getIntent();
        callId = in.getStringExtra("call_id");
        groupId = in.getStringExtra("group_id");
        String name = in.getStringExtra("caller_name");
        String group = in.getStringExtra("group_name");
        String avatar = in.getStringExtra("caller_avatar_url");
        if (name == null || name.isEmpty()) name = "Un membre";

        ((TextView) findViewById(R.id.call_name)).setText(name);
        ((TextView) findViewById(R.id.call_group)).setText(
                group != null && !group.isEmpty() ? "Tontine " + group + " · Appel audio" : "Appel audio Tontine Digitale");
        TextView initials = findViewById(R.id.call_initials);
        initials.setText(initialsOf(name));
        loadAvatar(avatar);

        findViewById(R.id.btn_decline).setOnClickListener(v -> openApp("?action=decline", true));
        findViewById(R.id.btn_accept).setOnClickListener(v -> openApp("", true));
        findViewById(R.id.btn_message).setOnClickListener(v -> {
            stopRinging();
            Intent i = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("com.tontinedigitale.app://appel/" + callId + "?action=decline"), this, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(i);
            finishCall();
        });

        ContextCompat.registerReceiver(this, closeReceiver, new IntentFilter(ACTION_CLOSE),
                ContextCompat.RECEIVER_NOT_EXPORTED);
        startRinging();
        handler.postDelayed(this::finishCall, RING_MS);
    }

    private void openApp(String query, boolean close) {
        stopRinging();
        Intent i = new Intent(Intent.ACTION_VIEW,
                Uri.parse("com.tontinedigitale.app://appel/" + callId + query), this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        if (close) finishCall();
    }

    private void startRinging() {
        try {
            ringtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if (ringtone != null) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
                ringtone.play();
            }
        } catch (Exception ignored) { }
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator != null) {
            long[] pattern = {0, 1000, 800};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            else vibrator.vibrate(pattern, 0);
        }
    }

    private void stopRinging() {
        try { if (ringtone != null) ringtone.stop(); } catch (Exception ignored) { }
        if (vibrator != null) vibrator.cancel();
    }

    private void finishCall() {
        stopRinging();
        handler.removeCallbacksAndMessages(null);
        if (callId != null) NotificationManagerCompat.from(this).cancel(callId.hashCode());
        finish();
    }

    private void loadAvatar(String url) {
        if (url == null || url.isEmpty()) return;
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(3000);
                c.setReadTimeout(3000);
                InputStream is = c.getInputStream();
                Bitmap bmp = BitmapFactory.decodeStream(is);
                is.close();
                if (bmp != null) handler.post(() -> {
                    ImageView iv = findViewById(R.id.call_avatar);
                    iv.setImageBitmap(bmp);
                    iv.setVisibility(android.view.View.VISIBLE);
                    findViewById(R.id.call_initials).setVisibility(android.view.View.GONE);
                });
            } catch (Exception ignored) { }
        }).start();
    }

    private static String initialsOf(String name) {
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length && sb.length() < 2; i++)
            if (!parts[i].isEmpty()) sb.append(Character.toUpperCase(parts[i].charAt(0)));
        return sb.toString();
    }

    @Override public void onBackPressed() { /* on ne ferme pas un appel avec Retour */ }

    @Override
    protected void onDestroy() {
        stopRinging();
        try { unregisterReceiver(closeReceiver); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
