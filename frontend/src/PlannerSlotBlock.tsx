import { useCallback, useRef, useState } from "react";
import { HOUR_HEIGHT, HOUR_MS } from "./plannerUtils";

export type SlotModel = {
  id: number;
  store_id: number;
  status: "OPEN" | "BOOKED" | "CLOSED" | "CANCELLED";
  start_at: string;
  end_at: string;
};

const SLOT_STATUSES = ["OPEN", "BOOKED", "CLOSED", "CANCELLED"] as const;

type Props = {
  slot: SlotModel;
  onDragPayload: () => string;
  onPatchStatus: (nextStatus: (typeof SLOT_STATUSES)[number]) => void;
  onResizeCommit: (newEnd: Date) => void;
};

export default function PlannerSlotBlock({ slot, onDragPayload, onPatchStatus, onResizeCommit }: Props) {
  const start = new Date(slot.start_at);
  const end = new Date(slot.end_at);
  const baseDurationMs = end.getTime() - start.getTime();

  const [previewDurationMs, setPreviewDurationMs] = useState<number | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    gridEl: HTMLElement;
    handleEl: HTMLElement;
    slotTopPx: number;
    startMs: number;
    originEndMs: number;
  } | null>(null);

  const durationMs = previewDurationMs ?? baseDurationMs;
  const hoursFromMidnight = start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600;
  const top = hoursFromMidnight * HOUR_HEIGHT;
  const height = Math.max(HOUR_HEIGHT, (durationMs / HOUR_MS) * HOUR_HEIGHT);

  const canDragResize = slot.status === "OPEN" || slot.status === "CLOSED";

  const cleanupResizeListeners = useCallback((gridEl: HTMLElement, onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) => {
    gridEl.removeEventListener("pointermove", onMove);
    gridEl.removeEventListener("pointerup", onUp);
    gridEl.removeEventListener("pointercancel", onUp);
  }, []);

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canDragResize) return;
    event.preventDefault();
    event.stopPropagation();
    const handleEl = event.currentTarget as HTMLElement;
    const gridEl = (handleEl.closest(".day-grid") as HTMLElement) ?? handleEl.parentElement!;
    handleEl.setPointerCapture(event.pointerId);

    resizeRef.current = {
      pointerId: event.pointerId,
      gridEl,
      handleEl,
      slotTopPx: top,
      startMs: start.getTime(),
      originEndMs: end.getTime(),
    };

    const onMove = (e: PointerEvent) => {
      const ctx = resizeRef.current;
      if (!ctx || e.pointerId !== ctx.pointerId) return;
      const rect = gridEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pxHeight = Math.max(HOUR_HEIGHT, y - ctx.slotTopPx);
      const dh = Math.max(1, Math.round(pxHeight / HOUR_HEIGHT));
      setPreviewDurationMs(dh * HOUR_MS);
    };

    const onUp = (e: PointerEvent) => {
      const ctx = resizeRef.current;
      if (!ctx || e.pointerId !== ctx.pointerId) return;
      cleanupResizeListeners(gridEl, onMove, onUp);
      resizeRef.current = null;
      try {
        if (ctx.handleEl.hasPointerCapture(e.pointerId)) {
          ctx.handleEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      const rect = gridEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pxHeight = Math.max(HOUR_HEIGHT, y - ctx.slotTopPx);
      const dh = Math.max(1, Math.round(pxHeight / HOUR_HEIGHT));
      const nextEnd = new Date(ctx.startMs + dh * HOUR_MS);
      setPreviewDurationMs(null);
      if (nextEnd.getTime() !== ctx.originEndMs) {
        onResizeCommit(nextEnd);
      }
    };

    gridEl.addEventListener("pointermove", onMove);
    gridEl.addEventListener("pointerup", onUp);
    gridEl.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      className={`slot-block status-${slot.status.toLowerCase()}`}
      style={{ top, height }}
      draggable={canDragResize}
      title={canDragResize ? "Потянуть блок — перемещение по сетке; нижний край — длительность (шаг 1 ч)" : undefined}
      onDragStart={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".slot-resize-handle") || target.closest("button")) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", onDragPayload());
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="slot-title">
        #{slot.id} {slot.status}
      </div>
      <div className="slot-time">
        {String(start.getHours()).padStart(2, "0")}:{String(start.getMinutes()).padStart(2, "0")}—
        {(previewDurationMs !== null ? new Date(start.getTime() + previewDurationMs) : end).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div className="slot-actions">
        {SLOT_STATUSES.filter((s) => s !== "BOOKED").map((nextStatus) => (
          <button
            key={`${slot.id}-${nextStatus}`}
            type="button"
            className="tiny-btn"
            onClick={() => onPatchStatus(nextStatus)}
          >
            {nextStatus}
          </button>
        ))}
      </div>
      {canDragResize ? (
        <div
          className="slot-resize-handle"
          role="slider"
          aria-label="Изменить длительность слота"
          aria-valuemin={1}
          aria-valuemax={48}
          aria-valuenow={Math.round(durationMs / HOUR_MS)}
          onPointerDown={onResizePointerDown}
        />
      ) : null}
    </div>
  );
}
