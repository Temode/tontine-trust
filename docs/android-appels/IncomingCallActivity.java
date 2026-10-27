package com.tontinedigitale.app;

import android.app.Activity;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
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
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.PathInterpolator;
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
    private AnimatorSet acceptAnimation;
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
        findViewById(R.id.call_root).setBackground(new CallWallpaperDrawable(this));

        Intent in = getIntent();
        callId = in.getStringExtra("call_id");
        groupId = in.getStringExtra("group_id");
        String name = in.getStringExtra("caller_name");
        String group = in.getStringExtra("group_name");
        String avatar = in.getStringExtra("caller_avatar_url");
        CallIdentity identity = CallIdentity.from(name, group);
        ((TextView) findViewById(R.id.call_name)).setText(identity.title);
        ((TextView) findViewById(R.id.call_group)).setText(identity.subtitle);
        TextView initials = findViewById(R.id.call_initials);
        if (identity.callerKnown) {
            initials.setText(identity.initials);
            loadAvatar(avatar);
        } else {
            initials.setVisibility(View.GONE);
            findViewById(R.id.call_unknown).setVisibility(View.VISIBLE);
        }
        bindTurn(in.getStringExtra("turn_beneficiary_name"), in.getStringExtra("turn_payout_amount"));

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
        // La sonnerie et la vibration viennent de la notification d'appel (une seule source).
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
                    if (isFinishing() || isDestroyed()) return;
                    ImageView iv = findViewById(R.id.call_avatar);
                    iv.setImageBitmap(bmp);
                    iv.setVisibility(View.VISIBLE);
                    findViewById(R.id.call_initials).setVisibility(View.GONE);
                });
            } catch (Exception ignored) { }
        }).start();
    }

    /** « Tour d'Alpha · cagnotte 2 400 000 GNF » ; ligne masquée si une donnée manque. */
    private void bindTurn(String beneficiary, String rawAmount) {
        TextView line = findViewById(R.id.call_turn);
        String first = CallIdentity.firstName(beneficiary);
        String amount = CallIdentity.formatAmount(rawAmount);
        if (first.isEmpty() || amount.isEmpty()) {
            line.setVisibility(View.GONE);
            return;
        }
        String prefix = CallIdentity.turnPrefix(first);
        String middle = " · cagnotte ";
        SpannableString s = new SpannableString(prefix + first + middle + amount);
        int fStart = prefix.length(), fEnd = fStart + first.length();
        int aStart = fEnd + middle.length(), aEnd = s.length();
        int turnColor = ContextCompat.getColor(this, R.color.call_turn);
        int fgColor = ContextCompat.getColor(this, R.color.call_foreground);
        s.setSpan(new ForegroundColorSpan(turnColor), fStart, fEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new StyleSpan(Typeface.BOLD), fStart, fEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new ForegroundColorSpan(fgColor), aStart, aEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        s.setSpan(new StyleSpan(Typeface.BOLD), aStart, aEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        line.setText(s);
        line.setVisibility(View.VISIBLE);
    }

    @Override protected void onResume() {
        super.onResume();
        // Équivalent natif de prefers-reduced-motion. Recontrôlé à chaque reprise.
        if (Settings.Global.getFloat(getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f) {
            return;
        }
        // La respiration est portée par les deux anneaux ; le bouton reste fixe pour être visé.
        acceptAnimation = new AnimatorSet();
        acceptAnimation.playTogether(breathe(findViewById(R.id.accept_ring_1), 0L),
                breathe(findViewById(R.id.accept_ring_2), 300L));
        acceptAnimation.start();
    }

    private AnimatorSet breathe(View ring, long delay) {
        ObjectAnimator x = ObjectAnimator.ofFloat(ring, View.SCALE_X, 1f, 1.06f);
        ObjectAnimator y = ObjectAnimator.ofFloat(ring, View.SCALE_Y, 1f, 1.06f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(ring, View.ALPHA, 1f, 0.55f);
        for (ObjectAnimator animator : new ObjectAnimator[]{x, y, alpha}) {
            // CSS ease-in-out sur chaque demi-cycle : 900ms aller + 900ms retour.
            animator.setDuration(900L);
            animator.setStartDelay(delay);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.setRepeatMode(ValueAnimator.REVERSE);
            animator.setInterpolator(new PathInterpolator(0.42f, 0f, 0.58f, 1f));
        }
        AnimatorSet set = new AnimatorSet();
        set.playTogether(x, y, alpha);
        return set;
    }

    @Override protected void onPause() {
        stopAcceptAnimation();
        super.onPause();
    }

    private void stopAcceptAnimation() {
        if (acceptAnimation != null) {
            acceptAnimation.cancel();
            acceptAnimation = null;
        }
        for (int id : new int[]{R.id.accept_ring_1, R.id.accept_ring_2}) {
            View ring = findViewById(id);
            if (ring != null) {
                ring.setScaleX(1f);
                ring.setScaleY(1f);
                ring.setAlpha(1f);
            }
        }
    }

    @Override public void onBackPressed() { /* on ne ferme pas un appel avec Retour */ }

    @Override
    protected void onDestroy() {
        stopAcceptAnimation();
        handler.removeCallbacksAndMessages(null);
        stopRinging();
        try { unregisterReceiver(closeReceiver); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
