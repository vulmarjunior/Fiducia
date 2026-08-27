package br.com.fiducia.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class NotificationCaptureService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification statusBarNotification) {
        if (statusBarNotification == null || statusBarNotification.getNotification() == null) return;

        Notification notification = statusBarNotification.getNotification();
        Bundle extras = notification.extras;
        String title = value(extras, Notification.EXTRA_TITLE);
        String text = value(extras, Notification.EXTRA_BIG_TEXT);
        if (text.isEmpty()) text = value(extras, Notification.EXTRA_TEXT);
        String subText = value(extras, Notification.EXTRA_SUB_TEXT);
        if (!subText.isEmpty()) text = text + "\n" + subText;

        ParsedAlert parsed = NotificationParser.parse(
                statusBarNotification.getPackageName(),
                title,
                text,
                statusBarNotification.getPostTime()
        );
        if (parsed != null) DiagnosticStore.save(getApplicationContext(), parsed);
    }

    private static String value(Bundle extras, String key) {
        if (extras == null) return "";
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }
}
