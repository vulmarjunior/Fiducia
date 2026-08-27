package br.com.fiducia.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class DiagnosticStore {
    private static final String PREFS = "fiducia_diagnostic";
    private static final String EVENTS = "events";
    private static final int MAX_EVENTS = 20;

    private DiagnosticStore() {}

    public static synchronized boolean save(Context context, ParsedAlert alert) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray current = read(preferences);
        String fingerprint = fingerprint(alert);
        for (int index = 0; index < current.length(); index++) {
            if (fingerprint.equals(current.optJSONObject(index).optString("fingerprint"))) return false;
        }

        JSONObject event = new JSONObject();
        try {
            event.put("fingerprint", fingerprint);
            event.put("source", alert.source);
            event.put("sourcePackage", alert.sourcePackage);
            event.put("kind", alert.kind.name());
            event.put("amountCents", alert.amountCents);
            event.put("merchant", alert.merchant);
            event.put("cardLast4", alert.cardLast4);
            event.put("occurredAt", alert.occurredAt);

            JSONArray updated = new JSONArray();
            updated.put(event);
            for (int index = 0; index < current.length() && updated.length() < MAX_EVENTS; index++) {
                updated.put(current.getJSONObject(index));
            }
            preferences.edit().putString(EVENTS, updated.toString()).apply();
            return true;
        } catch (JSONException exception) {
            return false;
        }
    }

    public static JSONArray getEvents(Context context) {
        return read(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
    }

    public static void clear(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(EVENTS).apply();
    }

    private static JSONArray read(SharedPreferences preferences) {
        try {
            return new JSONArray(preferences.getString(EVENTS, "[]"));
        } catch (JSONException exception) {
            return new JSONArray();
        }
    }

    static String fingerprint(ParsedAlert alert) {
        long twoMinuteBucket = alert.occurredAt / 120000L;
        String input = alert.source + "|" + alert.kind + "|" + alert.amountCents + "|"
                + NotificationParser.normalize(alert.merchant) + "|" + alert.cardLast4 + "|" + twoMinuteBucket;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte value : digest) hex.append(String.format("%02x", value));
            return hex.toString();
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
