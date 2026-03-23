import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "../store/auth.ts";
import { api } from "../api/client.ts";

// Token comes from the URL — form only needs new + confirm password.
const FormSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordForm = z.infer<typeof FormSchema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChangePasswordForm>({
    resolver: zodResolver(FormSchema),
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    setError(null);
    if (!token) {
      setError("Invalid or missing reset token. Please ask an admin to reset your password again.");
      return;
    }
    try {
      const result = await api.auth.changePassword(token, data.newPassword);
      useAuthStore.setState({ user: result.user });
      navigate(result.user.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set new password");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-raised p-8 shadow-2xl">
        <h1 className="mb-2 text-2xl font-semibold text-white">Set New Password</h1>
        <p className="mb-6 text-sm text-gray-400">
          An admin has reset your password. Please choose a new password to continue.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400" htmlFor="newPassword">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-white outline-none ring-1 ring-white/10 focus:ring-accent"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Set Password & Sign In"}
          </button>
        </form>

        {!token && (
          <p className="mt-4 text-center text-xs text-gray-500">
            <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
