import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Logo } from '../components/Logo';
import { APP_VERSION } from '../lib/utils';

export function Login() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-gradient-to-br from-blue-100/60 to-emerald-100/60 dark:from-blue-900/15 dark:to-emerald-900/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[30rem] h-[30rem] bg-gradient-to-tr from-cyan-100/60 to-blue-100/60 dark:from-cyan-900/15 dark:to-blue-900/15 rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md overflow-hidden border-border/50 shadow-xl shadow-black/5">
        {/* Gradient brand bar — signature element */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" aria-hidden="true" />

        <CardHeader className="text-center pt-10 pb-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[#185FA5]/10 to-emerald-500/10 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-[#185FA5]/10">
            <Logo size={48} />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Fiducia</CardTitle>
          <CardDescription className="text-sm leading-relaxed max-w-xs mx-auto">
            Seu assistente financeiro pessoal inteligente, descomplicado e totalmente sob o seu controle.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-8">
          <Button
            className="w-full shadow-sm hover:shadow-md transition-shadow"
            size="lg"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Conectando...' : 'Entrar com o Google'}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos{' '}
            <button type="button" className="underline underline-offset-2 hover:text-foreground transition-colors">Termos de Serviço</button>{' '}
            e{' '}
            <button type="button" className="underline underline-offset-2 hover:text-foreground transition-colors">Política de Privacidade</button>.
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground/60">
            v{APP_VERSION}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
