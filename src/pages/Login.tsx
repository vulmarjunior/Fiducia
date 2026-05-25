import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Logo } from '../components/Logo';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-[#185FA5]/10 rounded-2xl flex items-center justify-center mb-4">
            <Logo size={40} />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Fiducia</CardTitle>
          <CardDescription>
            Sistema de Controle Financeiro Pessoal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Conectando...' : 'Entrar com o Google'}
          </Button>
          <p className="mt-4 text-center text-sm text-gray-500">
            Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
