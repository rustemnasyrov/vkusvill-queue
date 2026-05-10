import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  checks: {
    postgres: string;
    redis: string;
  };
};

type User = {
  id: number;
  email: string;
  full_name: string;
  role: "manager" | "courier";
};

type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "vv_access_token";
const REFRESH_TOKEN_KEY = "vv_refresh_token";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [apiResult, setApiResult] = useState<string>("");
  const [email, setEmail] = useState("manager@local.dev");
  const [password, setPassword] = useState("manager123");
  const [auth, setAuth] = useState<AuthTokens | null>(null);

  const setSession = (data: AuthTokens) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    setAuth(data);
  };

  const clearSession = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAuth(null);
    setApiResult("");
    setAuthError("");
  };

  const callAuthedEndpoint = async (path: string) => {
    if (!auth) return;
    setAuthError("");
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
      },
    });
    const body = await response.text();
    if (!response.ok) {
      setAuthError(`${path}: HTTP ${response.status} ${body}`);
      return;
    }
    setApiResult(`${path}: ${body}`);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setHealthError(err.message));
  }, []);

  return (
    <main className="page">
      <h1>Vkusvill Slot Manager (PWA Dev Shell)</h1>
      <p>Frontend в Docker с live reload. Backend health-check:</p>
      <code>{`${API_BASE_URL}/health`}</code>

      {health && (
        <ul>
          <li>Общий статус: {health.status}</li>
          <li>Postgres: {health.checks.postgres}</li>
          <li>Redis: {health.checks.redis}</li>
        </ul>
      )}

      {healthError && <p className="error">Ошибка health-check: {healthError}</p>}

      <hr />
      <h2>Auth dev shell</h2>
      {!auth ? (
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setAuthError("");
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const body = await response.text();
            if (!response.ok) {
              setAuthError(`Login failed: HTTP ${response.status} ${body}`);
              return;
            }
            setSession(JSON.parse(body) as AuthTokens);
          }}
        >
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </label>
          <button type="submit">Login</button>
          <p className="hint">Dev users: manager@local.dev / manager123, courier@local.dev / courier123</p>
        </form>
      ) : (
        <section>
          <p>
            Вход выполнен: <b>{auth.user.full_name}</b> ({auth.user.role})
          </p>
          <div className="row">
            <button onClick={() => callAuthedEndpoint("/auth/me")}>/auth/me</button>
            <button onClick={() => callAuthedEndpoint("/manager/ping")}>/manager/ping</button>
            <button onClick={() => callAuthedEndpoint("/courier/ping")}>/courier/ping</button>
            <button onClick={clearSession}>Logout</button>
          </div>
          {apiResult && <pre>{apiResult}</pre>}
        </section>
      )}
      {authError && <p className="error">{authError}</p>}
    </main>
  );
}
