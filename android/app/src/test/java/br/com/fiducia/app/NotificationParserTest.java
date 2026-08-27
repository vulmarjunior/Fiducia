package br.com.fiducia.app;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

public final class NotificationParserTest {
    private static final long NOW = 1_800_000_000_000L;

    @Test
    public void parsesC6Purchase() {
        ParsedAlert result = NotificationParser.parse(
                "com.c6bank.app",
                "Compra aprovada",
                "Compra de R$ 1.234,56 em MERCADO CENTRAL no cartão final 9876",
                NOW
        );

        assertNotNull(result);
        assertEquals("C6", result.source);
        assertEquals(123456L, result.amountCents);
        assertEquals("MERCADO CENTRAL", result.merchant);
        assertEquals("9876", result.cardLast4);
        assertEquals(ParsedAlert.Kind.PURCHASE, result.kind);
    }

    @Test
    public void parsesItauSmsNotificationFromSamsungMessages() {
        ParsedAlert result = NotificationParser.parse(
                "com.samsung.android.messaging",
                "Itaú",
                "Compra aprovada no cartão final 1234: R$ 87,90 em LIVRARIA NORTE, em 27/08.",
                NOW
        );

        assertNotNull(result);
        assertEquals("Itaú", result.source);
        assertEquals(8790L, result.amountCents);
        assertEquals("LIVRARIA NORTE", result.merchant);
        assertEquals("1234", result.cardLast4);
    }

    @Test
    public void parsesRefund() {
        ParsedAlert result = NotificationParser.parse(
                "com.c6bank.app",
                "Estorno realizado",
                "Estorno de R$ 25,00 em LOJA TESTE no cartão final 4421",
                NOW
        );

        assertNotNull(result);
        assertEquals(ParsedAlert.Kind.REFUND, result.kind);
    }

    @Test
    public void ignoresItauTextOutsideMessagesApps() {
        assertNull(NotificationParser.parse(
                "com.random.app", "Itaú", "Compra de R$ 10,00 em TESTE", NOW
        ));
    }

    @Test
    public void ignoresSecurityCodes() {
        assertNull(NotificationParser.parse(
                "com.samsung.android.messaging", "Itaú", "Código de segurança 123456 para compra de R$ 10,00", NOW
        ));
    }

    @Test
    public void ignoresNotificationWithoutAmount() {
        assertNull(NotificationParser.parse(
                "com.c6bank.app", "C6 Bank", "Seu cartão está pronto para uso", NOW
        ));
    }

    @Test
    public void fingerprintDeduplicatesSameTwoMinuteWindow() {
        ParsedAlert first = new ParsedAlert("C6", "com.c6bank.app", ParsedAlert.Kind.PURCHASE, 1000, "Loja", "1234", NOW);
        ParsedAlert second = new ParsedAlert("C6", "com.c6bank.app", ParsedAlert.Kind.PURCHASE, 1000, "LOJA", "1234", NOW + 30_000);
        assertEquals(DiagnosticStore.fingerprint(first), DiagnosticStore.fingerprint(second));
    }
}
