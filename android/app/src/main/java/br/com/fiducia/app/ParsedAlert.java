package br.com.fiducia.app;

import java.util.Locale;

public final class ParsedAlert {
    public enum Kind { PURCHASE, REFUND }

    public final String source;
    public final String sourcePackage;
    public final Kind kind;
    public final long amountCents;
    public final String merchant;
    public final String cardLast4;
    public final long occurredAt;

    public ParsedAlert(
            String source,
            String sourcePackage,
            Kind kind,
            long amountCents,
            String merchant,
            String cardLast4,
            long occurredAt
    ) {
        this.source = source;
        this.sourcePackage = sourcePackage;
        this.kind = kind;
        this.amountCents = amountCents;
        this.merchant = merchant;
        this.cardLast4 = cardLast4;
        this.occurredAt = occurredAt;
    }

    public String formattedAmount() {
        return String.format(Locale.forLanguageTag("pt-BR"), "R$ %,.2f", amountCents / 100.0);
    }
}
