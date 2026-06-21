import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Play, ExternalLink, User } from "lucide-react";

type TurnRow = {
  turn_id: string;
  group_id: string;
  group_name: string;
  turn_number: number;
  due_date: string;
  beneficiary_user_id: string;
  phone: string | null;
  body: string;
  would_send: boolean;
  skip_reason: string | null;
};

type ContribRow = {
  contribution_id: string;
  group_id: string;
  group_name: string;
  turn_id: string;
  turn_number: number | string;
  payer_user_id: string;
  amount: number;
  phone: string | null;
  body: string;
  would_send: boolean;
  skip_reason: string | null;
};

type PreviewResponse = {
  ok: boolean;
  dry_run: boolean;
  base_date: string;
  target_turn_date: string;
  target_due_date: string;
  preview: {
    turn_upcoming_j2: TurnRow[];
    contribution_due_j1: ContribRow[];
  };
};

const TIMEZONES = [
  "Africa/Conakry",
  "UTC",
  "Europe/Paris",
  "Africa/Dakar",
  "Africa/Abidjan",
  "America/New_York",
];

/** Renvoie la date du jour (YYYY-MM-DD) dans la timezone donnée. */
function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function AdminCronPreview() {
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const tzOptions = useMemo(
    () => Array.from(new Set([browserTz, ...TIMEZONES])),
    [browserTz],
  );
  const [tz, setTz] = useState<string>(browserTz);
  const [date, setDate] = useState<string>(() => todayInTz(browserTz));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResponse | null>(null);

  function onTzChange(newTz: string) {
    setTz(newTz);
    setDate(todayInTz(newTz));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data: res, error: err } = await supabase.functions.invoke<PreviewResponse>(
        "send-tontine-reminders",
        { body: { dry_run: true, date, triggered_by: auth.user?.id ?? null } },
      );
      if (err) throw err;
      setData(res!);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-amber-400" /> Aperçu du cron rappels SMS
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Sélectionnez une date de référence pour simuler le job <code>send-tontine-reminders</code> :
          la liste exacte des tontines et membres ciblés en J-2 (prochain tour) et J-1 (cotisation due)
          s'affichera, sans envoi réel.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col">
          <label className="text-xs uppercase tracking-wider text-slate-400 mb-1">
            Fuseau horaire
          </label>
          <select
            value={tz}
            onChange={(e) => onTzChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white min-w-[180px]"
          >
            {tzOptions.map((t) => (
              <option key={t} value={t}>
                {t}
                {t === browserTz ? " (local)" : ""}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-500 mt-1">
            Aujourd'hui en {tz} : {todayInTz(tz)}
          </span>
        </div>
        <div className="flex flex-col">
          <label className="text-xs uppercase tracking-wider text-slate-400 mb-1">
            Date de référence (« aujourd'hui »)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-400 text-slate-900 font-medium text-sm hover:bg-amber-300 disabled:opacity-60"
        >
          <Play className="h-4 w-4" /> {loading ? "Calcul…" : "Prévisualiser"}
        </button>
        {data && (
          <div className="text-xs text-slate-400">
            J-2 = <span className="text-amber-300">{data.target_turn_date}</span> · J-1 ={" "}
            <span className="text-amber-300">{data.target_due_date}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Chaque exécution en aperçu est journalisée dans <code>sms_logs</code> avec le type
        <code className="mx-1">preview_j2</code>/<code>preview_j1</code> (statut « ignoré »), pour
        garder une trace de qui aurait été ciblé.
      </p>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">
          {error}
        </p>
      )}

      {data && (
        <div className="space-y-6">
          <PreviewSection
            title={`Rappels J-2 — prochain tour (${data.preview.turn_upcoming_j2.length})`}
            empty="Aucun tour 'upcoming' avec due_date = J+2."
          >
            {data.preview.turn_upcoming_j2.map((r) => (
              <PreviewRow
                key={r.turn_id}
                groupId={r.group_id}
                groupName={r.group_name}
                userId={r.beneficiary_user_id}
                meta={`Tour #${r.turn_number} · ${r.due_date}`}
                phone={r.phone}
                body={r.body}
                wouldSend={r.would_send}
                skipReason={r.skip_reason}
              />
            ))}
          </PreviewSection>

          <PreviewSection
            title={`Rappels J-1 — cotisation due (${data.preview.contribution_due_j1.length})`}
            empty="Aucune cotisation 'pending' avec due_date = J+1."
          >
            {data.preview.contribution_due_j1.map((r) => (
              <PreviewRow
                key={r.contribution_id}
                groupId={r.group_id}
                groupName={r.group_name}
                userId={r.payer_user_id}
                meta={`Tour #${r.turn_number} · ${r.amount.toLocaleString("fr-FR")} GNF`}
                phone={r.phone}
                body={r.body}
                wouldSend={r.would_send}
                skipReason={r.skip_reason}
              />
            ))}
          </PreviewSection>
        </div>
      )}
    </div>
  );
}

function PreviewSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg">
      <header className="px-4 py-3 border-b border-slate-800 font-semibold text-white">
        {title}
      </header>
      <div className="divide-y divide-slate-800">
        {arr.length === 0 ? <p className="px-4 py-6 text-slate-500 text-sm">{empty}</p> : children}
      </div>
    </section>
  );
}

function PreviewRow({
  groupId,
  groupName,
  userId,
  meta,
  phone,
  body,
  wouldSend,
  skipReason,
}: {
  groupId: string;
  groupName: string;
  userId: string;
  meta: string;
  phone: string | null;
  body: string;
  wouldSend: boolean;
  skipReason: string | null;
}) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            to={`/groupes/${groupId}`}
            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium"
          >
            <ExternalLink className="h-3 w-3" /> {groupName}
          </Link>
          <Link
            to={`/admin/utilisateurs?focus=${userId}`}
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
          >
            <User className="h-3 w-3" /> {userId.slice(0, 8)}…
          </Link>
          <span className="text-slate-500 text-xs">{meta}</span>
          <span className="font-mono text-xs text-slate-400">{phone ?? "—"}</span>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2">{body}</p>
      </div>
      <div className="shrink-0">
        {wouldSend ? (
          <span className="inline-flex px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
            Sera envoyé
          </span>
        ) : (
          <span className="inline-flex px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-400 text-xs">
            Ignoré : {skipReason}
          </span>
        )}
      </div>
    </div>
  );
}