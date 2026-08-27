package br.com.fiducia.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DateFormat;
import java.util.Date;

public final class MainActivity extends Activity {
    private LinearLayout eventsContainer;
    private TextView accessStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildContent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private View buildContent() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(7, 29, 24));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(24), dp(32), dp(24), dp(32));
        scroll.addView(root);

        TextView title = text("Fiducia", 30, Color.rgb(74, 222, 128));
        title.setTypeface(null, Typeface.BOLD);
        root.addView(title);

        TextView subtitle = text("Captura diagnóstica de lançamentos", 17, Color.WHITE);
        subtitle.setPadding(0, dp(4), 0, dp(20));
        root.addView(subtitle);

        accessStatus = text("", 15, Color.rgb(184, 201, 193));
        accessStatus.setPadding(0, 0, 0, dp(12));
        root.addView(accessStatus);

        Button openFiducia = button("Abrir o Fiducia");
        openFiducia.setOnClickListener(view -> startActivity(new Intent(this, FiduciaLauncherActivity.class)));
        root.addView(openFiducia);

        Button grantAccess = button("Configurar acesso às notificações");
        grantAccess.setOnClickListener(view -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        root.addView(grantAccess);

        TextView privacy = text(
                "Somente alertas de compra ou estorno identificados como C6 ou Itaú são mantidos. "
                        + "O texto original da notificação não é salvo nem enviado pela internet.",
                13,
                Color.rgb(184, 201, 193)
        );
        privacy.setPadding(0, dp(12), 0, dp(24));
        root.addView(privacy);

        TextView recent = text("Lançamentos reconhecidos neste aparelho", 18, Color.WHITE);
        recent.setTypeface(null, Typeface.BOLD);
        root.addView(recent);

        eventsContainer = new LinearLayout(this);
        eventsContainer.setOrientation(LinearLayout.VERTICAL);
        eventsContainer.setPadding(0, dp(8), 0, dp(8));
        root.addView(eventsContainer);

        Button clear = button("Limpar diagnóstico local");
        clear.setOnClickListener(view -> {
            DiagnosticStore.clear(this);
            refresh();
        });
        root.addView(clear);
        return scroll;
    }

    private void refresh() {
        boolean enabled = isListenerEnabled();
        accessStatus.setText(enabled
                ? "Acesso às notificações: ativo"
                : "Acesso às notificações: desativado — autorize o Fiducia para iniciar o teste.");
        accessStatus.setTextColor(enabled ? Color.rgb(74, 222, 128) : Color.rgb(251, 191, 36));

        eventsContainer.removeAllViews();
        JSONArray events = DiagnosticStore.getEvents(this);
        if (events.length() == 0) {
            eventsContainer.addView(text("Nenhum lançamento reconhecido ainda.", 14, Color.rgb(184, 201, 193)));
            return;
        }
        for (int index = 0; index < events.length(); index++) {
            JSONObject event = events.optJSONObject(index);
            if (event == null) continue;
            String kind = "REFUND".equals(event.optString("kind")) ? "Estorno" : "Compra";
            long cents = event.optLong("amountCents");
            ParsedAlert display = new ParsedAlert("", "", ParsedAlert.Kind.PURCHASE, cents, "", "", 0);
            String card = event.optString("cardLast4");
            String date = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                    .format(new Date(event.optLong("occurredAt")));
            String line = kind + " · " + display.formattedAmount() + "\n"
                    + event.optString("merchant") + " · " + event.optString("source")
                    + (card.isEmpty() ? "" : " · final " + card) + "\n" + date;
            TextView row = text(line, 15, Color.WHITE);
            row.setBackgroundColor(Color.rgb(16, 49, 40));
            row.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            params.setMargins(0, 0, 0, dp(8));
            eventsContainer.addView(row, params);
        }
    }

    private boolean isListenerEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        ComponentName component = new ComponentName(this, NotificationCaptureService.class);
        return enabled != null && enabled.contains(component.flattenToString());
    }

    private TextView text(String value, int sp, int color) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(sp);
        text.setTextColor(color);
        text.setLineSpacing(0, 1.15f);
        return text;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(52)
        );
        params.setMargins(0, 0, 0, dp(10));
        button.setLayoutParams(params);
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
