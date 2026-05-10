import { useState } from "react";
import LoginPage from "./LoginPage";
import PlannerPage from "./PlannerPage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const ACCESS_TOKEN_KEY = "vv_access_token";
const REFRESH_TOKEN_KEY = "vv_refresh_token";

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

export default function App() {
  const [authError, setAuthError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setAuthError("");
  };

  if (auth) {
    return <PlannerPage auth={auth} apiBaseUrl={API_BASE_URL} onLogout={clearSession} />;
  }

  return (
    <LoginPage
      email={email}
      password={password}
      authError={authError}
      isSubmitting={isSubmitting}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={async (event) => {
        event.preventDefault();
        setAuthError("");
        setIsSubmitting(true);
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const body = await response.text();
          if (!response.ok) {
            setAuthError(`Не удалось войти: HTTP ${response.status} ${body}`);
            return;
          }
          setSession(JSON.parse(body) as AuthTokens);
        } finally {
          setIsSubmitting(false);
        }
      }}
    />
  );
}
