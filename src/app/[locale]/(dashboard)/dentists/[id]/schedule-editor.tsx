"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSchedule } from "@/server/actions/dentists";

interface ScheduleRange {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const; // Mon → Sun

export function ScheduleEditor({
  dentistId,
  dentistName,
  initial,
}: {
  dentistId: string;
  dentistName: string;
  initial: ScheduleRange[];
}) {
  const t = useTranslations("Schedule");
  const tToast = useTranslations("Toast");
  const router = useRouter();
  const [ranges, setRanges] = useState<ScheduleRange[]>(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function rangesForDay(day: number): ScheduleRange[] {
    return ranges.filter((r) => r.dayOfWeek === day);
  }

  function addRange(day: number) {
    setRanges((rs) => [...rs, { dayOfWeek: day, startTime: "09:00", endTime: "12:00" }]);
  }

  function removeRange(day: number, index: number) {
    setRanges((rs) => {
      let idx = -1;
      let count = -1;
      for (let i = 0; i < rs.length; i++) {
        if (rs[i]!.dayOfWeek === day) {
          count++;
          if (count === index) {
            idx = i;
            break;
          }
        }
      }
      if (idx < 0) return rs;
      const next = [...rs];
      next.splice(idx, 1);
      return next;
    });
  }

  function updateRange(
    day: number,
    index: number,
    patch: Partial<Pick<ScheduleRange, "startTime" | "endTime">>,
  ) {
    setRanges((rs) => {
      let count = -1;
      return rs.map((r) => {
        if (r.dayOfWeek !== day) return r;
        count++;
        if (count !== index) return r;
        return { ...r, ...patch };
      });
    });
  }

  function onSave() {
    setFormError(null);
    startTransition(async () => {
      const res = await setSchedule({ dentistId, schedules: ranges });
      if (!res.ok) {
        if (res.error.code === "OVERLAPPING_RANGES") {
          setFormError(t("errors.OVERLAPPING_RANGES"));
        } else if (res.error.code === "INVALID_INPUT") {
          // Surface the first relevant error code.
          const first = Object.values(res.error.fields ?? {}).flat()[0];
          setFormError(
            first
              ? t(`errors.${first as "INVALID_TIME" | "RANGE_INVERTED"}`)
              : t("errors.OVERLAPPING_RANGES"),
          );
        } else {
          setFormError(t("errors.OVERLAPPING_RANGES"));
        }
        toast.error(tToast("error"), { description: tToast("errorDesc") });
        return;
      }
      toast.success(tToast("scheduleUpdated"), {
        description: tToast("scheduleUpdatedDesc", { name: dentistName }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wider uppercase">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <div className="border-border/60 divide-border/60 bg-card divide-y rounded-lg border">
        {DAY_INDICES.map((day) => {
          const dayRanges = rangesForDay(day);
          return (
            <div key={day} className="grid gap-3 px-4 py-3 md:grid-cols-[140px_1fr_auto]">
              <div className="text-foreground self-center text-sm font-medium">
                {t(`days.${day as 0 | 1 | 2 | 3 | 4 | 5 | 6}`)}
              </div>
              <div className="space-y-2">
                {dayRanges.length === 0 ? (
                  <div className="text-muted-foreground text-xs italic">{t("noRange")}</div>
                ) : (
                  dayRanges.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <label className="text-muted-foreground text-xs">{t("from")}</label>
                      <Input
                        type="time"
                        value={r.startTime}
                        onChange={(e) => updateRange(day, i, { startTime: e.target.value })}
                        className="num h-8 w-24"
                      />
                      <label className="text-muted-foreground text-xs">{t("to")}</label>
                      <Input
                        type="time"
                        value={r.endTime}
                        onChange={(e) => updateRange(day, i, { endTime: e.target.value })}
                        className="num h-8 w-24"
                      />
                      <button
                        type="button"
                        onClick={() => removeRange(day, i)}
                        className="text-muted-foreground hover:text-destructive size-7 rounded-md text-base transition"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRange(day)}
                className="self-start whitespace-nowrap"
              >
                + {t("addRange")}
              </Button>
            </div>
          );
        })}
      </div>

      {formError && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {formError}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
