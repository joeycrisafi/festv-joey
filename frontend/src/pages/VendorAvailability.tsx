import { useState, useEffect, useCallback } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, isSameDay,
  isSameMonth, isToday, isPast, isWeekend, addDays,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { availabilityApi } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailabilityBlock {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  note?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

// Expand a block (startDate → endDate) into individual ISO date strings
function expandBlock(block: AvailabilityBlock): string[] {
  const start = parseISO(block.startDate);
  const end   = parseISO(block.endDate);
  return eachDayOfInterval({ start, end }).map(toISO);
}

// Build a map from ISO date string → block id (for deletion)
function buildDateBlockMap(blocks: AvailabilityBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of blocks) {
    for (const iso of expandBlock(block)) {
      map.set(iso, block.id);
    }
  }
  return map;
}

const REASON_LABELS: Record<string, string> = {
  CLOSED:           'Closed',
  BOOKED_EXTERNAL:  'Booked externally',
  PERSONAL:         'Personal',
  MAINTENANCE:      'Maintenance',
};

const fmtDate = (iso: string) => format(parseISO(iso), 'MMM d, yyyy');
const fmtDateShort = (iso: string) => format(parseISO(iso), 'MMM d');

// ─── Single month calendar ────────────────────────────────────────────────────

function MonthCalendar({
  month,          // first day of the month to render
  blocked,        // Set of ISO strings currently marked blocked (local state)
  onToggle,       // (isoDate, currentlyBlocked) => void
}: {
  month: Date;
  blocked: Set<string>;
  onToggle: (iso: string, currentlyBlocked: boolean) => void;
}) {
  // Build a 6-row grid aligned to Mon–Sun
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex-1 min-w-0">
      {/* Month heading */}
      <p className="font-serif text-lg text-dark text-center mb-4">
        {format(month, 'MMMM yyyy')}
      </p>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="flex items-center justify-center">
            <span className="font-sans text-xs text-muted uppercase">{d}</span>
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map(day => {
          const iso         = toISO(day);
          const inMonth     = isSameMonth(day, month);
          const past        = isPast(day) && !isToday(day);
          const isBlocked   = blocked.has(iso);
          const today       = isToday(day);

          if (!inMonth) {
            return <div key={iso} className="w-9 h-9" />;
          }

          let cellCls =
            'w-9 h-9 rounded-full flex items-center justify-center text-sm font-sans transition-all duration-150 mx-auto ';

          if (past) {
            cellCls += 'opacity-30 cursor-not-allowed text-charcoal';
          } else if (isBlocked) {
            cellCls += 'bg-dark text-white cursor-pointer hover:bg-charcoal group';
          } else if (today) {
            cellCls += 'ring-1 ring-gold text-gold cursor-pointer hover:bg-gold/10';
          } else {
            cellCls += 'text-charcoal cursor-pointer hover:bg-gold/10 hover:text-gold';
          }

          return (
            <div key={iso} className="flex items-center justify-center">
              <button
                type="button"
                disabled={past}
                onClick={() => !past && onToggle(iso, isBlocked)}
                className={cellCls}
                title={isBlocked ? 'Click to unblock' : 'Click to block'}
              >
                <span className={isBlocked ? 'group-hover:hidden' : ''}>{format(day, 'd')}</span>
                {isBlocked && (
                  <span className="hidden group-hover:flex items-center justify-center">
                    <X size={12} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorAvailability() {
  const { token } = useAuth();

  // API state
  const [savedBlocks, setSavedBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState<string | null>(null);
  const [saveError, setSaveError]     = useState<string | null>(null);

  // Calendar navigation — leftMonth is the first of the two visible months
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(new Date()));

  // Local blocked set — ISO date strings
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  // ── Load blocks ────────────────────────────────────────────────────────────
  const loadBlocks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await availabilityApi.getMyBlocks(token) as any;
      if (res.success) {
        const blocks: AvailabilityBlock[] = res.data ?? [];
        setSavedBlocks(blocks);
        // Initialise local blocked set from saved blocks
        const set = new Set<string>();
        for (const b of blocks) {
          for (const iso of expandBlock(b)) set.add(iso);
        }
        setBlocked(set);
      }
    } catch {
      // silent — empty state is fine
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // ── Toggle a single date ──────────────────────────────────────────────────
  function toggleDate(iso: string, currentlyBlocked: boolean) {
    setBlocked(prev => {
      const next = new Set(prev);
      if (currentlyBlocked) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  function blockWeekends() {
    const start = startOfMonth(leftMonth);
    const end   = endOfMonth(addMonths(leftMonth, 1));
    const days  = eachDayOfInterval({ start, end });
    setBlocked(prev => {
      const next = new Set(prev);
      for (const d of days) if (isWeekend(d) && !(isPast(d) && !isToday(d))) next.add(toISO(d));
      return next;
    });
  }

  function blockNext30() {
    const today = new Date();
    const days  = eachDayOfInterval({ start: today, end: addDays(today, 29) });
    setBlocked(prev => {
      const next = new Set(prev);
      for (const d of days) next.add(toISO(d));
      return next;
    });
  }

  function clearMonth() {
    const start = startOfMonth(leftMonth);
    const end   = endOfMonth(addMonths(leftMonth, 1));
    const days  = eachDayOfInterval({ start, end });
    setBlocked(prev => {
      const next = new Set(prev);
      for (const d of days) next.delete(toISO(d));
      return next;
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);

    try {
      // Build a map of currently-saved dates → block id
      const savedMap = buildDateBlockMap(savedBlocks);
      const savedSet = new Set(savedMap.keys());

      // Dates to ADD (in local blocked but not in saved)
      const toAdd = [...blocked].filter(iso => !savedSet.has(iso));

      // Dates to REMOVE (in saved but no longer in blocked)
      const toRemove = [...savedSet].filter(iso => !blocked.has(iso));

      // Group toAdd into contiguous ranges to minimise API calls
      // Sort first, then group consecutive days
      const sortedAdd = [...toAdd].sort();
      const ranges: { start: string; end: string }[] = [];
      for (const iso of sortedAdd) {
        const last = ranges[ranges.length - 1];
        if (last) {
          const prev = addDays(parseISO(last.end), 1);
          if (isSameDay(prev, parseISO(iso))) {
            last.end = iso;
            continue;
          }
        }
        ranges.push({ start: iso, end: iso });
      }

      // DELETE removed blocks — deduplicate by block id
      const idsToDelete = new Set<string>();
      for (const iso of toRemove) {
        const id = savedMap.get(iso);
        if (id) idsToDelete.add(id);
      }
      await Promise.all(
        [...idsToDelete].map(id => availabilityApi.deleteBlock(id, token))
      );

      // POST new ranges
      await Promise.all(
        ranges.map(r =>
          availabilityApi.blockDate({ startDate: r.start, endDate: r.end, reason: 'CLOSED' }, token)
        )
      );

      // Refetch
      await loadBlocks();
      setSaveMsg('Availability updated.');
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const rightMonth = addMonths(leftMonth, 1);

  const btnCls =
    'border border-border text-charcoal font-sans text-xs px-4 py-2 rounded-md hover:border-gold hover:text-gold transition-colors focus:outline-none';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg px-6 md:px-12 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-dark">My Availability</h1>
          <p className="font-sans text-sm text-muted mt-1">
            Block dates you're not available. Planners will only see you as available on open dates.
          </p>
        </div>

        {/* Calendar card */}
        <div className="bg-white border border-border rounded-md p-6 md:p-8">

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => setLeftMonth(m => subMonths(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:border-gold hover:text-gold transition-colors text-charcoal focus:outline-none"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1" /> {/* spacer — headings are inside MonthCalendar */}

            <button
              type="button"
              onClick={() => setLeftMonth(m => addMonths(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:border-gold hover:text-gold transition-colors text-charcoal focus:outline-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex gap-8">
              {[0, 1].map(i => (
                <div key={i} className="flex-1 space-y-2 animate-pulse">
                  <div className="h-6 bg-bg rounded w-32 mx-auto mb-4" />
                  <div className="grid grid-cols-7 gap-y-2">
                    {Array.from({ length: 35 }).map((_, j) => (
                      <div key={j} className="w-9 h-9 rounded-full bg-bg mx-auto" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Two months side-by-side on md+, stacked on mobile */
            <div className="flex flex-col md:flex-row gap-8">
              <MonthCalendar
                month={leftMonth}
                blocked={blocked}
                onToggle={toggleDate}
              />
              <div className="hidden md:block w-px bg-border self-stretch" />
              <MonthCalendar
                month={rightMonth}
                blocked={blocked}
                onToggle={toggleDate}
              />
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-5 mt-6 pt-5 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full ring-1 ring-gold flex items-center justify-center">
                <span className="font-sans text-xs text-gold">8</span>
              </div>
              <span className="font-sans text-xs text-muted">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-dark flex items-center justify-center">
                <span className="font-sans text-xs text-white">8</span>
              </div>
              <span className="font-sans text-xs text-muted">Blocked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-bg flex items-center justify-center opacity-40">
                <span className="font-sans text-xs text-charcoal">8</span>
              </div>
              <span className="font-sans text-xs text-muted">Past / unavailable</span>
            </div>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={blockWeekends} className={btnCls}>
            Block all weekends
          </button>
          <button type="button" onClick={blockNext30} className={btnCls}>
            Block next 30 days
          </button>
          <button type="button" onClick={clearMonth} className={btnCls}>
            Clear visible months
          </button>
        </div>

        {/* Save */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-gold text-dark font-sans text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-md hover:bg-gold-dark transition-colors disabled:opacity-60 focus:outline-none"
          >
            {saving ? 'Saving…' : 'Save Availability'}
          </button>
          {saveMsg && (
            <span className="font-sans text-xs text-green font-semibold">{saveMsg}</span>
          )}
          {saveError && (
            <span className="font-sans text-xs text-red">{saveError}</span>
          )}
        </div>

        {/* Blocked ranges list */}
        {savedBlocks.length > 0 && (
          <div className="bg-white border border-border rounded-md p-6 mt-6">
            <p className="font-sans text-xs font-bold uppercase tracking-widest text-charcoal mb-4">
              Blocked Date Ranges
            </p>
            <div className="space-y-2">
              {savedBlocks.map(block => {
                const sameDay = block.startDate.slice(0, 10) === block.endDate.slice(0, 10);
                const dateLabel = sameDay
                  ? fmtDate(block.startDate.slice(0, 10))
                  : `${fmtDateShort(block.startDate.slice(0, 10))} – ${fmtDate(block.endDate.slice(0, 10))}`;

                return (
                  <div
                    key={block.id}
                    className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-sans text-sm text-dark font-medium">{dateLabel}</span>
                      <span className="font-sans text-xs text-muted bg-bg border border-border rounded-full px-2.5 py-0.5">
                        {REASON_LABELS[block.reason] ?? block.reason}
                      </span>
                      {block.note && (
                        <span className="font-sans text-xs text-muted truncate">{block.note}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await availabilityApi.deleteBlock(block.id, token!);
                          await loadBlocks();
                        } catch {
                          // silent
                        }
                      }}
                      className="text-muted hover:text-red transition-colors flex-shrink-0 focus:outline-none"
                      title="Remove block"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
