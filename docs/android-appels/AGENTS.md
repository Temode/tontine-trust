- Keep incoming-call colors in res/values/colors.xml converted from the light-theme CSS HSL tokens; this bridges the native UI to the existing design system.
- Render the chat texture as a cached repeating bitmap drawable with radial shaders, so drawing costs stay low on entry-level phones.
- Keep identity rules in the Android-independent CallIdentity class and exercise them through tests/CallIdentityTest.java, so unknown callers cannot appear as invented people.
- IncomingCallActivity inflates the supplied XML layout and owns only the accept-button animation; CallMessagingService remains the single ringing source to avoid duplicate sound.- The incoming-call notification uses NotificationCompat.CallStyle.forIncomingCall plus setFullScreenIntent, so Android treats it as a call; CallPermissionActivity is the only place that asks for full-screen access, once per install, after push registration.

## Micro dans les appels (à recopier dans android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```
Sans RECORD_AUDIO, le WebView refuse le micro et l'appel ne peut pas transmettre la voix.
