import type { FormEvent } from "react";

type LoginPageProps = {
  email: string;
  password: string;
  authError: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function LoginPage({
  email,
  password,
  authError,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginPageProps) {
  return (
    <div className="login-shell" aria-labelledby="login-title">
      <div className="login-backdrop" aria-hidden />
      <div className="login-panel">
        <header className="login-header">
          <div className="login-logo" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="currentColor" opacity="0.12" />
              <path
                d="M12 26V14h4.2c2.4 0 4 1.4 4 3.4 0 1.1-.5 2-1.4 2.6l1.6 6h-2.2l-1.4-5.4h-1.6V26H12zm4-7.2c1.1 0 1.8-.6 1.8-1.5 0-.9-.7-1.5-1.8-1.5H14v3h2z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 id="login-title" className="login-title">
            SLOT MANAGER
          </h1>
          <p className="login-subtitle">Войдите, чтобы открыть планировщик слотов</p>
        </header>

        <form className="login-form-card" onSubmit={onSubmit} noValidate>
          {authError ? (
            <div className="login-alert" role="alert">
              {authError}
            </div>
          ) : null}

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="login-input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@company.ru"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Пароль
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="login-input"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
              disabled={isSubmitting}
              required
            />
          </div>

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="login-spinner" aria-hidden />
                Входим…
              </>
            ) : (
              "Войти"
            )}
          </button>

          <p className="login-hint">
            Для разработки: <code>manager@local.dev</code> / <code>manager123</code> или{" "}
            <code>courier@local.dev</code> / <code>courier123</code>
          </p>
        </form>
      </div>
    </div>
  );
}
