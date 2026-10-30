package com.tontinedigitale.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;

/**
 * Écran unique « Recevoir les appels de votre tontine », montré par MainActivity
 * seulement si canUseFullScreenIntent() est faux. Un bouton ouvre directement la page
 * système de l'app pour l'affichage plein écran ; « Plus tard » ferme sans rien bloquer.
 */
public class CallPermissionActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_call_permission);
        findViewById(R.id.fsi_allow).setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) { }
            }
            finish();
        });
        findViewById(R.id.fsi_later).setOnClickListener(v -> finish());
    }
}
