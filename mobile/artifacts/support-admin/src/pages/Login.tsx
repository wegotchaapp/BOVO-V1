import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useSupportLogin, type SupportLoginMutationError } from "@workspace/api-client-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { setAgent } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useSupportLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submitLogin = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (agent) => {
        setAgent(agent);
        setLocation("/");
      },
      onError: (error: SupportLoginMutationError) => {
        const data = error.data as { error?: string } | undefined;
        toast({
          title: "Login failed",
          description: data?.error || error.message || "Invalid credentials",
          variant: "destructive",
        });
      },
    });
  };

  const onSubmit = (data: LoginFormValues) => submitLogin(data);

  const DEMO_ACCOUNTS: { label: string; email: string; password: string }[] = [
    { label: "Maya (Admin)", email: "maya@saferide.support", password: "support123" },
    { label: "Jordan (Agent)", email: "jordan@saferide.support", password: "support123" },
    { label: "Riley (Agent)", email: "riley@saferide.support", password: "support123" },
  ];

  const fillAndSignIn = (email: string, password: string) => {
    form.setValue("email", email);
    form.setValue("password", password);
    submitLogin({ email, password });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">S</div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bovogo Support</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to the agent console</p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="agent@saferide.com" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>
            </form>
          </Form>

          <div className="mt-6 pt-5 border-t">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
              Demo accounts
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <Button
                  key={a.email}
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                  disabled={loginMutation.isPending}
                  onClick={() => fillAndSignIn(a.email, a.password)}
                  data-testid={`button-demo-${a.email}`}
                >
                  <span>{a.label}</span>
                  <span className="text-xs text-muted-foreground">{a.email}</span>
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              All demo accounts use password <code className="font-mono">support123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
