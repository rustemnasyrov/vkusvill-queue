import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  checks: {
    postgres: string;
    redis: string;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setError(err.message));
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

      {error && <p className="error">Ошибка health-check: {error}</p>}
    </main>
  );
}
