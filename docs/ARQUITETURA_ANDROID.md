# Fiducia Android — Arquitetura do protótipo diagnóstico

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Estado e objetivo

O módulo `android/` gera um APK diagnóstico separado do build web. O site continua publicado e operando normalmente na versão `0.15.5`; não houve migração de banco, alteração no Firebase nem publicação Android.

O objetivo desta fase é descobrir, com dados reais do aparelho do proprietário, se as notificações do C6 e os alertas de SMS exibidos pelo aplicativo de mensagens do Samsung contêm informação suficiente para acelerar o lançamento de compras e estornos.

## Arquitetura

1. `MainActivity` apresenta o estado da permissão, os eventos sanitizados e o botão para abrir o Fiducia.
2. `FiduciaLauncherActivity` abre `https://fiducianew.vercel.app/` com Android Browser Helper. Enquanto o domínio não publicar Digital Asset Links para uma chave release, o Chrome pode exibir a barra de Custom Tab em vez de uma TWA totalmente verificada.
3. `NotificationCaptureService` recebe notificações somente depois de autorização manual nas configurações do Android.
4. `NotificationParser` aceita apenas:
   - notificações identificadas como C6 por pacote ou pelo texto `C6 Bank`/`Banco C6`;
   - notificações dos pacotes Samsung Messages ou Google Messages que também identifiquem o Itaú;
   - compra, pagamento, estorno ou reembolso com valor no formato brasileiro.
5. `DiagnosticStore` salva no máximo 20 resultados interpretados em `SharedPreferences`, com deduplicação por SHA-256 e janela de dois minutos.

## Limites de privacidade

O APK solicita apenas acesso à internet e o acesso especial do Android às notificações. Ele não solicita leitura de SMS, contatos, arquivos, localização, acessibilidade ou telefone.

O texto bruto da notificação é processado em memória e descartado. O diagnóstico local conserva somente origem, pacote de origem, tipo, valor, estabelecimento interpretado, últimos quatro dígitos quando disponíveis e horário. Nesta fase nenhum desses campos é enviado pela internet ou gravado no Firebase.

Alertas de token, senha, login, acesso e código de segurança são descartados antes do armazenamento. Samsung Wallet e notificações sem valor financeiro reconhecível ficam fora do fluxo.

## Como compilar

Pré-requisitos locais: Microsoft OpenJDK 17 e Android SDK 36.

```powershell
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME='C:\Users\44435\AppData\Local\Android\Sdk'
cd android
.\gradlew.bat lintDebug testDebugUnitTest assembleDebug
```

Saída do build: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Roteiro de validação no aparelho

1. Instalar `artifacts/Fiducia-diagnostic-debug.apk`, aceitando a instalação local somente para este teste.
2. Abrir o Fiducia e tocar em **Configurar acesso às notificações**.
3. Autorizar exclusivamente o serviço **Captura de lançamentos do Fiducia**.
4. Produzir ou aguardar uma compra real de pequeno valor no C6 e uma compra no Itaú que gere SMS.
5. Reabrir o APK e conferir origem, valor, estabelecimento e final do cartão.
6. Testar, se ocorrer naturalmente, uma compra online, uma compra com cartão físico e um estorno.
7. Se um evento não for reconhecido ou vier incorreto, registrar uma captura de tela da notificação ocultando dados sensíveis; não é necessário fornecer token, saldo, telefone ou texto de autenticação.

## Critérios para a próxima fase

A integração com o Firebase só deve começar depois que os formatos reais estiverem calibrados. A próxima fase deverá incluir uma chave release controlada pelo proprietário, Digital Asset Links no domínio, autenticação do aparelho, fila de candidatos idempotente e confirmação humana antes de criar qualquer transação.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
