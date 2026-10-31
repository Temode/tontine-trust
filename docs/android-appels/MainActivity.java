package com.tontinedigitale.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/** Prépare les appels : canal prioritaire, autorisation notifications, écran plein écran une fois. */
public class MainActivity extends BridgeActivity {

    public static final String PREFS = "tontine_calls";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CallChannels.ensure(this);
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.getBoolean("asked", false)) {
            p.edit().putBoolean("asked", true).apply();
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        maybeAskFullScreen();
    }

    /** Après connexion (jeton push reçu), une seule fois par installation, et seulement si refusé. */
    private void maybeAskFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return;
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.getBoolean("push_ready", false) || p.getBoolean("fsi_prompted", false)) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.canUseFullScreenIntent()) return;
        p.edit().putBoolean("fsi_prompted", true).apply();
        startActivity(new Intent(this, CallPermissionActivity.class));
    }
}
