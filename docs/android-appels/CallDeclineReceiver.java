package com.tontinedigitale.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/** Bouton « Refuser » de la notification système : refuse sans déverrouiller ni ouvrir l'app. */
public class CallDeclineReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent in) {
        String callId = in.getStringExtra("call_id");
        CallRinger.stop();
        CallResponder.send(in.getStringExtra("respond_url"), in.getStringExtra("respond_token"), "declined");
        if (callId != null) {
            NotificationManagerCompat.from(ctx).cancel(callId.hashCode());
            Intent close = new Intent(IncomingCallActivity.ACTION_CLOSE).setPackage(ctx.getPackageName());
            close.putExtra("call_id", callId);
            ctx.sendBroadcast(close);
        }
    }
}
