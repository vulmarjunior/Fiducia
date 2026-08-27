package br.com.fiducia.app;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NotificationParser {
    private static final Pattern MONEY = Pattern.compile("R\\$\\s*([0-9]{1,3}(?:\\.[0-9]{3})*|[0-9]+),([0-9]{2})", Pattern.CASE_INSENSITIVE);
    private static final Pattern LAST_FOUR = Pattern.compile("(?:final|terminado em|cart[aã]o)[^0-9]{0,18}([0-9]{4})(?![0-9])", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern[] MERCHANT_PATTERNS = new Pattern[] {
            Pattern.compile("(?:em|no estabelecimento)\\s+(.+?)(?=,|[.;\\n]|\\s+(?:no|com)\\s+cart[aã]o|$)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE),
            Pattern.compile("(?:compra|pagamento)[^R]{0,45}R\\$\\s*[0-9.,]+\\s+(?:em|no)\\s+(.+?)(?=,|[.;\\n]|\\s+(?:no|com)\\s+cart[aã]o|$)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
    };

    private NotificationParser() {}

    public static ParsedAlert parse(String packageName, String title, String body, long occurredAt) {
        String safePackage = packageName == null ? "" : packageName.trim();
        String combined = ((title == null ? "" : title) + "\n" + (body == null ? "" : body)).trim();
        String normalized = normalize(combined);
        String normalizedPackage = safePackage.toLowerCase(Locale.ROOT);

        boolean isC6 = normalizedPackage.contains("c6") || normalized.contains("c6 bank") || normalized.contains("banco c6");
        boolean isMessages = normalizedPackage.equals("com.google.android.apps.messaging")
                || normalizedPackage.equals("com.samsung.android.messaging");
        boolean isItau = isMessages && normalized.contains("itau");
        if (!isC6 && !isItau) return null;

        if (containsAny(normalized, "codigo de seguranca", "codigo de verificacao", "token", "senha", "login", "acesso realizado", "otp")) {
            return null;
        }

        ParsedAlert.Kind kind;
        if (containsAny(normalized, "estorno", "reembolso", "compra cancelada", "valor devolvido")) {
            kind = ParsedAlert.Kind.REFUND;
        } else if (containsAny(normalized, "compra", "pagamento", "cartao utilizado", "aprovada", "aprovado")) {
            kind = ParsedAlert.Kind.PURCHASE;
        } else {
            return null;
        }

        Matcher moneyMatcher = MONEY.matcher(combined);
        if (!moneyMatcher.find()) return null;
        long reais = Long.parseLong(moneyMatcher.group(1).replace(".", ""));
        long amountCents = reais * 100 + Long.parseLong(moneyMatcher.group(2));
        if (amountCents <= 0) return null;

        String lastFour = "";
        Matcher cardMatcher = LAST_FOUR.matcher(combined);
        if (cardMatcher.find()) lastFour = cardMatcher.group(1);

        String merchant = extractMerchant(combined);
        return new ParsedAlert(
                isC6 ? "C6" : "Itaú",
                safePackage,
                kind,
                amountCents,
                merchant,
                lastFour,
                occurredAt
        );
    }

    private static String extractMerchant(String text) {
        for (Pattern pattern : MERCHANT_PATTERNS) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String candidate = matcher.group(1).trim();
                if (!candidate.isEmpty() && candidate.length() <= 80) return candidate;
            }
        }
        return "Estabelecimento não identificado";
    }

    static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) if (value.contains(term)) return true;
        return false;
    }
}
