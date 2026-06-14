"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { DigitCodeInput } from "./DigitCodeInput";
import type { ApiError, AppUser, AuthMode, LoginAs } from "./types";

export function AuthScreen({
  onLoggedIn,
  onError,
  error,
}: {
  onLoggedIn: (user: AppUser) => void;
  onError: (value: string) => void;
  error: string;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginAs, setLoginAs] = useState<LoginAs>("owner");
  const [storeCodeSlots, setStoreCodeSlots] = useState<string[]>(() =>
    Array.from({ length: 8 }, () => ""),
  );
  const [createTrainerDialog, setCreateTrainerDialog] = useState<{
    storeName: string;
    storeCode: string;
    username: string;
  } | null>(null);
  const [createTrainerAccountError, setCreateTrainerAccountError] = useState("");

  useEffect(() => {
    setCreateTrainerDialog(null);
    setCreateTrainerAccountError("");
    /** Reset the 8-digit entry whenever we enter a mode that uses it. */
    if (
      mode === "register-trainer" ||
      mode === "set-password" ||
      (mode === "login" && loginAs === "trainer")
    ) {
      setStoreCodeSlots(Array.from({ length: 8 }, () => ""));
    }
  }, [mode, loginAs]);

  useEffect(() => {
    if (!createTrainerDialog) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreateTrainerDialog(null);
        setCreateTrainerAccountError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createTrainerDialog]);

  const needsStoreCode =
    mode === "register-trainer" ||
    mode === "set-password" ||
    (mode === "login" && loginAs === "trainer");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const storeCode = storeCodeSlots.join("");
    if (needsStoreCode && !/^\d{8}$/.test(storeCode)) {
      onError("Enter the full 8-digit store code.");
      return;
    }
    onError("");
    try {
      const [endpoint, payload] = (() => {
        if (mode === "login" && loginAs === "owner") {
          return [
            "/api/auth/login",
            {
              mode: "owner",
              username: formData.get("username"),
              password: formData.get("password"),
            },
          ] as const;
        }
        if (mode === "login" && loginAs === "trainer") {
          return [
            "/api/auth/login",
            {
              mode: "trainer",
              storeCode,
              username: formData.get("username"),
            },
          ] as const;
        }
        if (mode === "register-admin") {
          return [
            "/api/auth/register",
            {
              storeName: formData.get("storeName"),
              name: formData.get("name"),
              username: formData.get("username"),
              password: formData.get("password"),
            },
          ] as const;
        }
        if (mode === "set-password") {
          return [
            "/api/auth/set-password",
            {
              storeCode,
              username: formData.get("username"),
              password: formData.get("password"),
            },
          ] as const;
        }
        return [
          "/api/auth/register-trainer",
          {
            storeCode,
            username: formData.get("username"),
          },
        ] as const;
      })();
      const res = await api<{ user: AppUser }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onLoggedIn(res.user);
    } catch (err) {
      const apiErr = err as ApiError;
      if (
        mode === "login" &&
        loginAs === "trainer" &&
        apiErr.code === "unknown_trainer_username" &&
        apiErr.storeName
      ) {
        onError("");
        setCreateTrainerAccountError("");
        setCreateTrainerDialog({
          storeName: apiErr.storeName,
          storeCode,
          username: String(formData.get("username") ?? "").trim(),
        });
        return;
      }
      onError(apiErr.message);
    }
  }

  const submitLabel = (() => {
    if (mode === "register-admin") return "Create store";
    if (mode === "register-trainer") return "Create trainer account";
    if (mode === "set-password") return "Set password & sign in";
    return "Sign in";
  })();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-8">
      {createTrainerDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-trainer-from-login-title"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) {
              setCreateTrainerDialog(null);
              setCreateTrainerAccountError("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <h3 id="create-trainer-from-login-title" className="text-lg font-semibold">
              Create trainer account?
            </h3>
            <p className="mt-2 text-sm opacity-80">
              There is no account for <strong className="text-foreground">{createTrainerDialog.username}</strong>{" "}
              at <strong className="text-foreground">{createTrainerDialog.storeName}</strong> yet. Create a
              new trainer account with this username and join this store?
            </p>
            {createTrainerAccountError && (
              <p className="mt-2 text-sm text-rose-600">{createTrainerAccountError}</p>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setCreateTrainerDialog(null);
                  setCreateTrainerAccountError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
                onClick={async () => {
                  if (!createTrainerDialog) return;
                  setCreateTrainerAccountError("");
                  try {
                    const res = await api<{ user: AppUser }>("/api/auth/register-trainer", {
                      method: "POST",
                      body: JSON.stringify({
                        storeCode: createTrainerDialog.storeCode,
                        username: createTrainerDialog.username,
                      }),
                    });
                    setCreateTrainerDialog(null);
                    onLoggedIn(res.user);
                  } catch (caught) {
                    setCreateTrainerAccountError((caught as Error).message);
                  }
                }}
              >
                Create account
              </button>
            </div>
          </div>
        </div>
      )}
      <form
        onSubmit={submit}
        className="relative z-10 w-full rounded-xl bg-card p-5 shadow-sm"
        autoComplete="on"
      >
        <h1 className="text-2xl font-bold">Train Trackr</h1>
        <p className="mb-4 text-sm opacity-75">Developed by Liam Powers</p>

        {mode === "set-password" && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Set or reset your password</p>
            <p className="mt-1 opacity-90">
              Use this if you were promoted to admin and never set a password, or if
              you forgot your password. Enter your username, the 8-digit store code,
              and a new password. You&apos;ll be signed in right away and can use
              that password from now on.
            </p>
          </div>
        )}

        {mode === "login" && (
          <div
            role="tablist"
            aria-label="Sign in as"
            className="mb-4 flex gap-2 rounded-lg border bg-slate-100 p-1 dark:bg-slate-800"
          >
            {(
              [
                ["owner", "Sign in"],
                ["trainer", "Invited Code"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={loginAs === key}
                onClick={() => setLoginAs(key)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  loginAs === key
                    ? "btn-accent"
                    : "bg-transparent text-foreground/80 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {needsStoreCode && (
          <DigitCodeInput
            slots={storeCodeSlots}
            onSlotsChange={setStoreCodeSlots}
            label="Store code"
            helper="Enter the 8-digit store code from your manager"
            idPrefix="store-code-digit"
          />
        )}

        {mode === "register-admin" && (
          <>
            <input
              name="storeName"
              placeholder="Store name"
              className="mb-2 w-full rounded-lg border p-3 text-base"
              required
              autoComplete="organization"
            />
            <input
              name="name"
              placeholder="Full name"
              className="mb-2 w-full rounded-lg border p-3 text-base"
              required
              autoComplete="name"
            />
          </>
        )}

        <input
          name="username"
          type="text"
          placeholder="Username"
          className="mb-2 w-full rounded-lg border p-3 text-base"
          required
          minLength={2}
          maxLength={64}
          pattern="[a-zA-Z0-9._-]+"
          title="Letters, numbers, dots, dashes, and underscores only"
          autoComplete="username"
        />

        {(mode === "register-admin" ||
          mode === "set-password" ||
          (mode === "login" && loginAs === "owner")) && (
          <input
            name="password"
            type="password"
            placeholder={
              mode === "login"
                ? "Password"
                : mode === "set-password"
                  ? "New password (min 8)"
                  : "Password (min 8)"
            }
            className="mb-2 w-full rounded-lg border p-3 text-base"
            required
            minLength={mode === "login" ? 1 : 8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            enterKeyHint="go"
          />
        )}

        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          className="btn-accent min-h-12 w-full touch-manipulation rounded-lg p-3 text-base font-semibold"
        >
          {submitLabel}
        </button>

        <div className="mt-3 space-y-2 text-center text-sm">
          {mode !== "login" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("login")}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode !== "register-admin" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("register-admin")}
            >
              Create a new store (owner)
            </button>
          )}
          {/*
            "Create new account" (register-trainer) is intentionally hidden
            from the auth screen. Trainers should be invited via the store's
            8-digit code through the in-app invite flow, not self-register
            from the public login page. Re-enable by uncommenting if the
            self-serve trainer flow comes back.
          {mode !== "register-trainer" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => setMode("register-trainer")}
            >
              Create new account
            </button>
          )}
          */}
          {mode === "login" && loginAs === "owner" && (
            <button
              type="button"
              className="min-h-12 w-full touch-manipulation rounded-lg px-2 py-3 text-base underline underline-offset-2"
              onClick={() => {
                onError("");
                setMode("set-password");
              }}
            >
              Forgot password or need to set one?
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
