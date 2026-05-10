import { useEffect, useMemo, useState } from "react";
import PlannerSlotBlock from "./PlannerSlotBlock";
import { addDays, HOUR_HEIGHT, HOUR_MS, startOfWeek, toIsoDate, toLocalIsoDateTime } from "./plannerUtils";

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

type Store = {
  id: number;
  name: string;
};

type SlotTemplate = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
};

type Slot = {
  id: number;
  store_id: number;
  status: "OPEN" | "BOOKED" | "CLOSED" | "CANCELLED";
  start_at: string;
  end_at: string;
};

const SLOT_STATUSES = ["OPEN", "BOOKED", "CLOSED", "CANCELLED"] as const;

type Props = {
  auth: AuthTokens;
  apiBaseUrl: string;
  onLogout: () => void;
};

export default function PlannerPage({ auth, apiBaseUrl, onLogout }: Props) {
  const [stores, setStores] = useState<Store[]>([]);
  const [templates, setTemplates] = useState<SlotTemplate[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [managerError, setManagerError] = useState<string>("");
  const [managerInfo, setManagerInfo] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(1);

  const isManager = auth.user.role.trim().toLowerCase() === "manager";

  const callAuthedJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${body}`);
    return JSON.parse(body) as T;
  };

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekFrom = toIsoDate(weekStart);
  const weekTo = toIsoDate(addDays(weekStart, 6));
  const hourRows = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = slot.start_at.slice(0, 10);
      const prev = map.get(day) ?? [];
      prev.push(slot);
      map.set(day, prev);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start_at.localeCompare(b.start_at));
    return map;
  }, [slots]);

  const loadManagerData = async () => {
    if (!isManager) return;
    try {
      setManagerError("");
      const storesData = await callAuthedJson<Store[]>("/manager/stores");
      const templatesData = await callAuthedJson<SlotTemplate[]>("/manager/slot-templates");
      setStores(storesData);
      setTemplates(templatesData);
      if (storesData[0] && !storesData.find((s) => s.id === selectedStoreId)) setSelectedStoreId(storesData[0].id);
      if (templatesData[0] && !templatesData.find((t) => t.id === selectedTemplateId)) setSelectedTemplateId(templatesData[0].id);
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  const loadSlots = async () => {
    if (!isManager) return;
    try {
      setManagerError("");
      const list = await callAuthedJson<Slot[]>(
        `/manager/slots?storeId=${selectedStoreId}&from=${weekFrom}&to=${weekTo}`,
      );
      setSlots(list);
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  const createSlot = async (startDate: Date, durationHours: number) => {
    try {
      setManagerError("");
      const end = new Date(startDate.getTime() + durationHours * HOUR_MS);
      await callAuthedJson<Slot>("/manager/slots", {
        method: "POST",
        body: JSON.stringify({
          store_id: selectedStoreId,
          start_at: toLocalIsoDateTime(startDate),
          end_at: toLocalIsoDateTime(end),
          status: "OPEN",
        }),
      });
      setManagerInfo("Slot created");
      await loadSlots();
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  const patchSlot = async (slotId: number, nextStatus: (typeof SLOT_STATUSES)[number]) => {
    try {
      setManagerError("");
      await callAuthedJson(`/manager/slots/${slotId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadSlots();
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  const moveSlot = async (slotId: number, day: Date, hour: number, durationMs: number) => {
    try {
      setManagerError("");
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMs);
      await callAuthedJson<Slot>(`/manager/slots/${slotId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ start_at: toLocalIsoDateTime(start), end_at: toLocalIsoDateTime(end) }),
      });
      setManagerInfo("Slot moved");
      await loadSlots();
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  const resizeSlotEnd = async (slotId: number, newEnd: Date) => {
    try {
      setManagerError("");
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;
      const start = new Date(slot.start_at);
      if (newEnd.getTime() <= start.getTime()) return;
      await callAuthedJson<Slot>(`/manager/slots/${slotId}/move`, {
        method: "PATCH",
        body: JSON.stringify({
          start_at: toLocalIsoDateTime(start),
          end_at: toLocalIsoDateTime(newEnd),
        }),
      });
      setManagerInfo("Длительность слота обновлена");
      await loadSlots();
    } catch (error) {
      setManagerError((error as Error).message);
    }
  };

  useEffect(() => {
    if (isManager) void loadManagerData();
  }, [isManager]);

  useEffect(() => {
    if (isManager) void loadSlots();
  }, [isManager, selectedStoreId, weekStart]);

  if (!isManager) {
    return (
      <main className="page">
        <h2>Planner is available for manager role only.</h2>
        <p>Current role: {auth.user.role}</p>
        <button onClick={onLogout}>Logout</button>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="manager-section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Weekly Slot Planner</h2>
          <button onClick={onLogout}>Logout</button>
        </div>

        <div className="manager-toolbar">
          <label>
            Store
            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(Number(e.target.value))}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Template (used for + day button)
            <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(Number(e.target.value))}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.start_time}-{template.end_time})
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <button onClick={() => setWeekStart((prev) => addDays(prev, -7))}>← Prev week</button>
            <button onClick={() => setWeekStart(startOfWeek(new Date()))}>Current</button>
            <button onClick={() => setWeekStart((prev) => addDays(prev, 7))}>Next week →</button>
            <button onClick={() => loadSlots()}>Refresh</button>
          </div>
        </div>

        <p className="hint">
          Неделя: <b>{weekFrom}</b> — <b>{weekTo}</b>. Перетаскивайте блок слота между днями/часами (шаг 1 час). Тяните{" "}
          <b>нижний край</b> блока — длительность с шагом 1 час (только OPEN/CLOSED).
        </p>
        {managerInfo && <p className="hint">{managerInfo}</p>}
        {managerError && <p className="error">{managerError}</p>}

        <div className="planner">
          <div className="planner-header">
            <div className="hour-head">Hours</div>
            {weekDays.map((day) => (
              <div key={toIsoDate(day)} className="day-head">
                <div>{day.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit" })}</div>
                <button
                  className="small-btn"
                  onClick={() => {
                    const template = templates.find((t) => t.id === selectedTemplateId);
                    if (!template) return;
                    const [startHour] = template.start_time.split(":").map(Number);
                    const [endHour] = template.end_time.split(":").map(Number);
                    const duration = Math.max(1, endHour - startHour);
                    const startDate = new Date(day);
                    startDate.setHours(startHour, 0, 0, 0);
                    void createSlot(startDate, duration);
                  }}
                >
                  + day slot
                </button>
              </div>
            ))}
          </div>

          <div className="planner-body">
            <div className="hour-column">
              {hourRows.map((h) => (
                <div key={h} className="hour-cell">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayIso = toIsoDate(day);
              const daySlots = slotsByDay.get(dayIso) ?? [];
              return (
                <div key={dayIso} className="day-column">
                  <div
                    className="day-grid"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const payloadRaw = event.dataTransfer.getData("text/plain");
                      if (!payloadRaw) return;
                      const payload = JSON.parse(payloadRaw) as { slotId: number; durationMs: number };
                      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const y = event.clientY - rect.top;
                      const hour = Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)));
                      void moveSlot(payload.slotId, day, hour, payload.durationMs);
                    }}
                  >
                    {hourRows.map((hour) => (
                      <div key={`${dayIso}-${hour}`} className="grid-hour-line">
                        <button
                          className="plus-btn"
                          title="Add one-hour slot"
                          onClick={() => {
                            const start = new Date(day);
                            start.setHours(hour, 0, 0, 0);
                            void createSlot(start, 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                    ))}

                    {daySlots.map((slot) => (
                      <PlannerSlotBlock
                        key={slot.id}
                        slot={slot}
                        onDragPayload={() =>
                          JSON.stringify({
                            slotId: slot.id,
                            durationMs: new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime(),
                          })
                        }
                        onPatchStatus={(nextStatus) => patchSlot(slot.id, nextStatus)}
                        onResizeCommit={(newEnd) => void resizeSlotEnd(slot.id, newEnd)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
