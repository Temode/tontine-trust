package com.tontinedigitale.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Sonnerie d'appel jouée par l'app elle-même (boucle + vibration, 60 s max),
 * pour ne jamais dépendre du réglage du canal choisi par le téléphone.
 */
public final class CallRinger {

    private static final long RING_MS = 60_000L;
    private static final long[] PATTERN = {0, 1000, 800};
    private static final Handler handler = new Handler(Looper.getMainLooper());
    private static Ringtone ringtone;
    private static Vibrator vibrator;
    private static PowerManager.WakeLock wakeLock;

    private CallRinger() { }

    public static synchronized void start(Context ctx) {
        stop();
        Context app = ctx.getApplicationContext();
        PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tontine:call");
            wakeLock.acquire(RING_MS);
        }
        try {
            ringtone = RingtoneManager.getRingtone(app,
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if (ringtone != null) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
                ringtone.play();
            }
        } catch (Exception ignored) { }
        vibrator = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(PATTERN, 0));
            } else {
                vibrator.vibrate(PATTERN, 0);
            }
        }
        handler.postDelayed(CallRinger::stop, RING_MS);
    }

    public static synchronized void stop() {
        handler.removeCallbacksAndMessages(null);
        try { if (ringtone != null) ringtone.stop(); } catch (Exception ignored) { }
        ringtone = null;
        if (vibrator != null) vibrator.cancel();
        vibrator = null;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }
}
