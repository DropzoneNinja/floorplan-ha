import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, RegisterSchema } from "@floorplan-ha/shared";
import type { z } from "zod";
import { useAuthStore } from "../store/auth.ts";
import { api } from "../api/client.ts";

type LoginForm = z.infer<typeof LoginSchema>;
type RegisterForm = z.infer<typeof RegisterSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(RegisterSchema) });

  const onLogin = async (data: LoginForm) => {
    setError(null);
    try {
      const result = await api.auth.login(data.email, data.password);
      if ("requiresPasswordReset" in result && result.requiresPasswordReset) {
        navigate(`/change-password?token=${encodeURIComponent(result.resetToken)}`, { replace: true });
        return;
      }
      const { user } = result as { token: string; user: { id: string; email: string; role: string } };
      useAuthStore.setState({ user });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setError(null);
    try {
      await api.auth.register(data.email, data.password, data.confirmPassword);
      setSuccessMsg("Account created — you can now sign in.");
      registerForm.reset();
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const switchMode = (next: "login" | "register") => {
    setError(null);
    setSuccessMsg(null);
    setMode(next);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-raised p-8 shadow-2xl">
        <h1 className="mb-2 text-2xl font-semibold text-white">HomePlan HA</h1>

        {/* Mode tabs */}
        <div className="mb-6 flex gap-4 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={[
              "text-sm font-medium transition-colors",
              mode === "login" ? "text-white" : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={[
              "text-sm font-medium transition-colors",
              mode === "register" ? "text-white" : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            Register
          </button>
        </div>

        {successMsg && (
          <p className="mb-4 rounded-lg bg-green-900/40 px-3 py-2 text-sm text-green-300">{successMsg}</p>
        )}

        {mode === "login" ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...loginForm.register("email")}
                className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-400">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register("password")}
                className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              />
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-400">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
            )}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loginForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400" htmlFor="reg-email">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                {...registerForm.register("email")}
                className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              />
              {registerForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-400">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                {...registerForm.register("password")}
                className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              />
              {registerForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-400">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400" htmlFor="reg-confirm">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                {...registerForm.register("confirmPassword")}
                className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
            )}

            <p className="text-xs text-gray-600">
              Registration requires your email to be pre-authorized by an admin.
            </p>

            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {registerForm.formState.isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
