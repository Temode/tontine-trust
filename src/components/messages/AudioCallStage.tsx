import { useEffect, useRef, useState } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { Participant } from "livekit-client";
import {
  ChevronDown,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioOutput } from "@/hooks/useAudioOutput";
import { useCallTimer } from "@/hooks/useCallTimer";
import { formatGNF, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TurnFacts {
  beneficiary_user_id: string | null;
  beneficiary_name: string | null;
  payout_amount: number | null;
}

const SPEAKING_RING =
  "0 0 0 3px hsl(var(--primary-900)), 0 0 0 6px hsl(var(--primary-300))";
const BENEFICIARY_RING =
  "0 0 0 3px hsl(var(--primary-900)), 0 0 0 5px hsl(var(--accent))";

/** Maintien de la désignation après le dernier mot détecté. */
const FLOOR_HOLD_MS = 1500;

function displayName(p: Participant): string {
  return p.name || p.identity;
}

function firstName(full: string | null | undefined): string | null {
  if (!full) return null;
  return full.trim().split(/\s+/)[0] ?? null;
}

/**
 * Écran d'appel audio — le défaut des appels de tontine.
 * Rendu uniquement quand aucune caméra n'est active ; la grille vidéo
 * (CallStage) reprend la main dès qu'une caméra s'allume.
 */
export function AudioCallStage({
  groupId,
  groupName,
  connectedAt,
  onMinimize,
  onHangup,
}: {
  groupId?: string;
  groupName?: string;
  connectedAt: string | null;
  onMinimize: () => void;
  onHangup: () => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const elapsed = useCallTimer(connectedAt);
  const { supported: audioOutSupported, currentKind, toggleSpeaker } = useAudioOutput();

  const [turn, setTurn] = useState<TurnFacts | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [designatedId, setDesignatedId] = useState<string | null>(null);
  const silenceTimerRef = useRef<number | null>(null);

  // Tour en cours et cagnotte — source : vue next_turn_per_group
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    supabase
      .from("next_turn_per_group")
      .select("beneficiary_user_id, beneficiary_name, payout_amount")
      .eq("group_id", groupId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setTurn(data as TurnFacts);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Qui a la parole : un participant est désigné dès qu'il parle et le
  // reste 1,5 s après son dernier mot, pour que l'anneau ne clignote pas
  // sur les silences d'une phrase.
  useEffect(() => {
    const speakingNow = participants.find((p) => p.isSpeaking);
    if (speakingNow) {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setDesignatedId((prev) =>
        prev === speakingNow.identity ? prev : speakingNow.identity,
      );
      return;
    }
    if (designatedId === null || silenceTimerRef.current !== null) return;
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      setDesignatedId(null);
    }, FLOOR_HOLD_MS);
  }, [participants, designatedId]);

  // Le minuteur de maintien ne survit pas à la fermeture de l'écran.
  useEffect(
    () => () => {
      if (silenceTimerRef.current !== null) {
        window.clearTimeout(silenceTimerRef.current);
      }
    },
    [],
  );

  const remotes = participants.filter((p) => p.identity !== localParticipant?.identity);
  const speaker =
    participants.find((p) => p.identity === designatedId) ??
    remotes[0] ??
    localParticipant ??
    null;
  const holdsFloor = speaker !== null && speaker.identity === designatedId;

  const beneficiaryId = turn?.beneficiary_user_id ?? null;
  const beneficiaryFirstName = firstName(turn?.beneficiary_name);

  const visibleOthers = remotes.slice(0, 4);
  const hiddenCount = Math.max(0, remotes.length - visibleOthers.length);

  // La confirmation de raccrochage retombe d'elle-même après 4 s
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const onHangupClick = () => {
    if (remotes.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void room.disconnect().catch(() => {});
    onHangup();
  };

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const camEnabled = localParticipant?.isCameraEnabled ?? false;
  const speakerOn = currentKind === "speaker";

  return (
    <div className="call-surface flex h-full flex-col text-primary-foreground">
      {/* Barre haute */}
      <header className="flex h-[60px] items-center justify-between px-[18px]">
        <button
          type="button"
          onClick={onMinimize}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-primary-foreground"
          aria-label="Réduire l'appel"
        >
          <ChevronDown className="h-[21px] w-[21px]" />
        </button>
        <span className="inline-flex h-9 items-center gap-[7px] rounded-full bg-white/[0.08] px-3.5 text-body-sm font-semibold text-primary-foreground">
          <Users className="h-[17px] w-[17px]" />
          <span className="num">{participants.length}</span>
        </span>
      </header>

      {/* Scène */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5">
        {/* Nappe de lumière — purement décorative */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] rounded-full"
          style={{
            transform: "translate(-50%, -62%)",
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.34) 0%, transparent 66%)",
          }}
        />

        {/* Avatar de celui qui parle */}
        {speaker && (
          <div
            className="relative flex h-[158px] w-[158px] items-center justify-center rounded-full bg-primary"
            style={{ boxShadow: speaker.isSpeaking ? SPEAKING_RING : undefined }}
          >
            <span className="font-display text-[50px] font-bold text-primary-foreground">
              {getInitials(displayName(speaker))}
            </span>
          </div>
        )}

        <p className="mt-5 font-display text-title font-bold">
          {speaker ? displayName(speaker) : groupName ?? "Appel"}
        </p>
        <p className="mt-1 text-body-sm text-primary-200">
          {speaker?.isSpeaking ? "parle" : "en écoute"}
        </p>

        {/* Bandeau des autres participants */}
        {remotes.length > 0 && (
          <div className="mt-[34px] flex gap-4">
            {visibleOthers.map((p) => {
              const micMuted =
                p.getTrackPublication(Track.Source.Microphone)?.isMuted ?? false;
              const isBeneficiary = beneficiaryId !== null && p.identity === beneficiaryId;
              return (
                <div key={p.identity} className="flex w-[62px] flex-col items-center">
                  <div
                    className={cn(
                      "relative flex h-14 w-14 items-center justify-center rounded-full bg-primary",
                      micMuted && "bg-primary/55",
                    )}
                    style={{ boxShadow: isBeneficiary ? BENEFICIARY_RING : undefined }}
                  >
                    <span
                      className={cn(
                        "font-display text-[19px] font-bold text-primary-foreground",
                        micMuted && "text-primary-foreground/55",
                      )}
                    >
                      {getInitials(displayName(p))}
                    </span>
                    {micMuted && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary-900 ring-2 ring-primary-900">
                        <MicOff className="h-[13px] w-[13px] text-primary-200" />
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 w-[62px] truncate text-center text-caption text-primary-200",
                      isBeneficiary && "font-semibold text-accent",
                    )}
                  >
                    {firstName(displayName(p))}
                  </span>
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <div className="flex w-[62px] flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-primary-200/30">
                  <span className="num text-base font-semibold text-primary-200">
                    +{hiddenCount}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bloc de faits */}
        <div className="mt-9 text-center">
          <p className="num text-body-sm text-primary-200">
            {groupName ?? "Appel"} · {elapsed}
          </p>
          {beneficiaryFirstName && turn?.payout_amount != null && (
            <p className="mt-[3px] text-body-sm text-primary-200">
              Tour de <span className="font-semibold text-accent">{beneficiaryFirstName}</span>
              {" · "}cagnotte{" "}
              <span className="num font-semibold text-primary-foreground">
                {formatGNF(turn.payout_amount, { withCurrency: true })}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Liste des membres (bouton Membres) */}
      {membersOpen && (
        <div className="mx-4 mb-3 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-primary-800 p-2">
          {participants.map((p) => {
            const micMuted =
              p.getTrackPublication(Track.Source.Microphone)?.isMuted ?? false;
            return (
              <div
                key={p.identity}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
              >
                <span className="truncate text-body-sm text-primary-foreground">
                  {p.identity === localParticipant?.identity ? "Vous" : displayName(p)}
                </span>
                {micMuted ? (
                  <MicOff className="h-3.5 w-3.5 shrink-0 text-primary-200" />
                ) : (
                  <Mic className="h-3.5 w-3.5 shrink-0 text-primary-200" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dock */}
      <div className="mx-4 mb-[22px] grid grid-cols-3 gap-y-4 rounded-[28px] border border-white/10 bg-primary-800 px-3.5 py-5">
        <DockButton
          label="Haut-parleur"
          active={speakerOn}
          disabled={!audioOutSupported}
          onClick={() => void toggleSpeaker()}
          icon={<Volume2 className="h-[25px] w-[25px]" />}
        />
        <DockButton
          label="Vidéo"
          active={camEnabled}
          onClick={() => void localParticipant?.setCameraEnabled(!camEnabled)}
          icon={<Video className="h-[25px] w-[25px]" />}
        />
        <DockButton
          label="Micro"
          active={micEnabled}
          onClick={() => void localParticipant?.setMicrophoneEnabled(!micEnabled)}
          icon={<Mic className="h-[25px] w-[25px]" />}
        />
        <DockButton
          label="Membres"
          active={membersOpen}
          onClick={() => setMembersOpen((v) => !v)}
          icon={<Users className="h-[25px] w-[25px]" />}
        />
        <DockButton
          label="Réduire"
          onClick={onMinimize}
          icon={<Minimize2 className="h-[25px] w-[25px]" />}
        />
        <DockButton
          label={confirming ? "Confirmer" : "Terminer"}
          danger
          onClick={onHangupClick}
          icon={<Phone className="h-[25px] w-[25px] rotate-[135deg]" />}
        />
      </div>
    </div>
  );
}

function DockButton({
  label,
  icon,
  active = false,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-[60px] w-[60px] items-center justify-center rounded-full",
          danger
            ? "bg-destructive text-destructive-foreground"
            : active
              ? "bg-primary-200 text-accent-foreground"
              : "bg-white/10 text-primary-foreground",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "text-caption",
          active && !danger ? "text-primary-foreground" : "text-primary-200",
        )}
      >
        {label}
      </span>
    </button>
  );
}
