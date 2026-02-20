import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Recycle, Mail, Lock, ArrowLeft, Leaf } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Inloggen mislukt", description: error.message, variant: "destructive" });
    } else {
      navigate("/admin");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail verstuurd", description: "Controleer je inbox voor de reset-link." });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-emerald-800">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 h-64 w-64 rounded-full bg-white/5" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Recycle className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">Kringloop Komtgoed</span>
          </div>
          
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Beheer je kringloop&shy;bedrijf op één plek
            </h1>
            <p className="text-lg text-white/75 leading-relaxed">
              Klussen, klanten, offertes en facturen — alles overzichtelijk in één dashboard.
            </p>
            <div className="flex items-center gap-3 pt-4">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Leaf className="h-4 w-4" />
                <span>Duurzaam ondernemen</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-white/40">© 2026 Kringloop Komtgoed</p>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Recycle className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Kringloop Komtgoed</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {forgotPassword ? "Wachtwoord herstellen" : "Welkom terug"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {forgotPassword
                ? "Voer je e-mailadres in om een reset-link te ontvangen"
                : "Log in om verder te gaan naar het dashboard"}
            </p>
          </div>

          {forgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mailadres</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="email" type="email" placeholder="naam@voorbeeld.nl"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {loading ? "Versturen..." : "Reset-link versturen"}
              </Button>
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
                onClick={() => setForgotPassword(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Terug naar inloggen
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mailadres</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="email" type="email" placeholder="naam@voorbeeld.nl"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Wachtwoord</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="password" type="password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setForgotPassword(true)}
                >
                  Wachtwoord vergeten?
                </button>
              </div>
              <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                {loading ? "Inloggen..." : "Inloggen"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
