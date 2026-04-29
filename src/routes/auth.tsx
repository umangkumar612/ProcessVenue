import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FileStack, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AsyncDoc" },
      { name: "description", content: "Sign in or create your AsyncDoc account to start processing documents." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/app" });
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: String(fd.get("name") ?? "") },
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you can sign in now");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-brand p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/20 backdrop-blur">
            <FileStack className="h-5 w-5 text-gold" />
          </div>
          <span className="font-display text-xl font-semibold">AsyncDoc</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight text-balance">
            Process any document<br />in the background.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/75">
            Drop a file in. Watch the pipeline tick through nine stages live. Review the extracted
            data, finalize it, export it. That's the whole loop.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© AsyncDoc</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
                <FileStack className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold">AsyncDoc</span>
            </Link>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full bg-gradient-brand shadow-glow" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Get started in seconds</p>
              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input id="signup-name" name="name" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full bg-gradient-brand shadow-glow" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
