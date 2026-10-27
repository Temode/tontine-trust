package com.tontinedigitale.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/** Prépare les appels dès l'ouverture : canal prioritaire et autorisations, demandées une fois. */
public class MainActivity extends BridgeActivity {

    private static final String PREFS = "tontine_calls";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CallChannels.ensure(this);
        askOnce();
    }

    private void askOnce() {
        if (getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean("asked", false)) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("asked", true).apply();

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
        }
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && !nm.canUseFullScreenIntent()) {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) { }
            }
        }
    }
}
