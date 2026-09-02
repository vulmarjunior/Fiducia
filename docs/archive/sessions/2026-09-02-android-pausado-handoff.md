# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessão ativa — Fiducia Android e captura assistida

**Objetivo:** criar um APK diagnóstico que mantenha o site como interface principal por TWA e capture localmente alertas de cartão para validação em aparelho real.

**Escopo autorizado:** C6 por notificação do aplicativo; Itaú pela notificação do aplicativo de mensagens; Samsung Wallet ignorada; nenhuma leitura direta de SMS, Open Finance, e-mail, Groq ou criação automática de transações.

**Plano:** preparar toolchain; implementar shell TWA, acesso explícito às notificações, allowlist e parser local; gerar APK diagnóstico; validar formatos reais; somente depois integrar candidatos ao Firebase com autenticação e idempotência.

**Estado:** Pausado / Pendente para estudos futuros. Após série de tentativas para o importador de notificações (incluindo APK diagnóstico compilado em `artifacts/`), a funcionalidade permanece formalmente congelada e pendente, pois será alvo de maiores estudos antes de qualquer nova tentativa. Nenhuma alteração de código ou integração com Firebase deve ser feita nesta frente no momento.

**Arquivos tocados:** módulo `android/`, `.gitignore`, `docs/ARQUITETURA_ANDROID.md`, `docs/MASTER_PLAN.md` e este registro. `AGENTS.md` e `.firebaserc` se originaram como alterações preexistentes do usuário e foram incluídos no handoff por autorização expressa para enviar tudo.

**Validações concluídas:**

- `testDebugUnitTest`: 7/7 cenários aprovados;
- `lintDebug`: aprovado;
- `assembleDebug`: aprovado;
- APK assinado com certificado Android Debug e inspecionado como `br.com.fiducia.app`, minSdk 26, targetSdk 36;
- SHA-256 do APK: `69A02D6C1F6E34FFB44DAE9FEE15C0C8B424BFE4AFE4235BEF61881A4402ECDF`.

**Validação no aparelho:** APK instalado por ADB no Samsung SM-S918B (`RXCX10APPJE`) e atividade principal aberta em 2026-08-27. A instalação retornou `Success`; pacote confirmado como `br.com.fiducia.app`, versão `0.1.0-diagnostic`. Acesso especial confirmado pelo Android e teste sintético ponta a ponta aprovado: notificação C6 fictícia gerou localmente compra de R$ 12,34, estabelecimento `LOJA TESTE` e cartão final `1234`.

**Pendente:** Fica formalmente pendente para estudos futuros mais aprofundados. Não criar transações nem candidatos no Firebase, não publicar o APK, não efetuar alterações no parser e não incrementar a versão web `0.15.5`.

## Handoff para outra máquina

O próximo ambiente precisa ser preparado antes de recompilar ou instalar o APK:

- Node.js e dependências web usuais do repositório (`npm install`);
- Microsoft OpenJDK 17; nesta máquina foi usado `17.0.20.101`;
- Android Studio;
- Android SDK em versão compatível, com `platform-tools` 37.0.1, `platforms;android-36`, `build-tools;36.0.0` e `cmdline-tools;latest`;
- variáveis `JAVA_HOME` apontando para o JDK 17 e `ANDROID_HOME` apontando para o SDK Android, ou os equivalentes configurados no Android Studio;
- não é necessário instalar Gradle global: o repositório contém o Wrapper, que baixa e verifica o Gradle 8.13 pelo SHA-256 oficial.

O APK em `artifacts/` é artefato local ignorado pelo Git. Na outra máquina, reconstruir em `android/` com:

```powershell
.\gradlew.bat lintDebug testDebugUnitTest assembleDebug
```

A saída será `android/app/build/outputs/apk/debug/app-debug.apk`. Como o Play Protect bloqueia o sideload por navegador/WhatsApp quando há `NOTIFICATION_LISTENER`, instalar o diagnóstico por ADB (`adb install -r <apk>`). A nova máquina gerará outra chave ADB, portanto o Samsung solicitará uma nova autorização de depuração USB.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
