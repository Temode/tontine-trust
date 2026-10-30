import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import type { Participant } from "livekit-client";
import {
  ChevronDown,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  Phone,
  ScreenShare,
  ScreenShareOff,
  User,
  Users,
  Video,
  VideoOff,
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

/**
 * Nom affichable d'un participant, aligné sur member_display_name : jamais
 * d'adresse e-mail ni d'identifiant technique. `null` = membre sans nom.
 */
function nameOf(p: Participant): string | null {
  const n = (p.name ?? "").trim();
  if (!n || n.includes("@") || n === "Un membre") return null;
  return n;
}

function displayName(p: Participant): string {
  return nameOf(p) ?? "Un membre";
}

/** « Tour d'Alpha » / « Tour de Mariama ». */
function turnPrefix(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? "Tour d\u2019" : "Tour de ";
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

  // La bande n'apparaît qu'à partir de trois participants : à deux, elle
  // répéterait la personne déjà mise en avant.
  const showStrip = participants.length >= 3;
  const others = participants.filter((p) => p.identity !== speaker?.identity);
  const visibleOthers = others.slice(0, 4);
  const hiddenCount = Math.max(0, others.length - visibleOthers.length);
  const speakerName = speaker ? nameOf(speaker) : null;
  const ringing = connectedAt === null;
  const stateLine = confirming
    ? "Appuyez encore pour raccrocher"
    : ringing
      ? "Sonnerie en cours"
      : `En conversation · ${elapsed}`;

  // Partage d'écran : celui d'un autre devient l'objet principal ; le mien
  // efface le panneau (desktop) pour laisser l'application lisible.
  const shareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const remoteShare =
    shareTracks.find((t) => t.participant.identity !== localParticipant?.identity) ?? null;
  const selfSharing = localParticipant?.isScreenShareEnabled ?? false;
  const toggleShare = () =>
    void localParticipant?.setScreenShareEnabled(!selfSharing).catch(() => {});

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
  const toggleMic = () => void localParticipant?.setMicrophoneEnabled(!micEnabled);
  const camEnabled = localParticipant?.isCameraEnabled ?? false;
  const speakerOn = currentKind === "speaker";

  return (
    <>
    <div className="call-surface flex h-full flex-col text-primary-foreground md:hidden">
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
            style={{ boxShadow: holdsFloor ? SPEAKING_RING : undefined }}
          >
            {speakerName ? (
              <span className="font-display text-[50px] font-bold text-primary-foreground">
                {getInitials(speakerName)}
              </span>
            ) : (
              <User className="h-[66px] w-[66px] text-primary-200" />
            )}
          </div>
        )}

        <p className="mt-5 font-display text-title font-bold">
          {speakerName ?? groupName ?? "Appel"}
        </p>
        <p className="mt-1 text-body-sm text-primary-200">
          {/* La ligne est réservée quand personne n'a la parole : rien ne bouge. */}
          {speaker && !speakerName
            ? holdsFloor
              ? "Un membre · parle"
              : "Un membre"
            : holdsFloor
              ? "parle"
              : "\u00A0"}
        </p>

        {/* Bandeau des autres participants */}
        {showStrip && (
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
                      {nameOf(p) ? getInitials(nameOf(p) as string) : <User className="h-[22px] w-[22px]" />}
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
                    {p.identity === localParticipant?.identity ? "Vous" : firstName(nameOf(p)) ?? "Un membre"}
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
            {groupName ?? "Appel"} · {ringing ? "Sonnerie en cours" : elapsed}
          </p>
          {beneficiaryFirstName && turn?.payout_amount != null && (
            <p className="mt-[3px] text-body-sm text-primary-200">
              {turnPrefix(beneficiaryFirstName)}<span className="font-semibold text-accent">{beneficiaryFirstName}</span>
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
          active={!micEnabled}
          onClick={toggleMic}
          icon={micEnabled ? <Mic className="h-[25px] w-[25px]" /> : <MicOff className="h-[25px] w-[25px]" />}
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

    {/* ===== Desktop (≥ md) : panneau centré, jamais étiré ===== */}
    {selfSharing ? (
      <SelfShareBar
        micEnabled={micEnabled}
        onToggleMic={toggleMic}
        onStop={toggleShare}
        membersOpen={membersOpen}
        onToggleMembers={() => setMembersOpen((v) => !v)}
        members={<MembersList participants={participants} localId={localParticipant?.identity} />}
        onHangup={onHangupClick}
        confirming={confirming}
      />
    ) : (
      <div className="hidden h-full place-items-center bg-call-scrim p-10 text-primary-foreground md:grid">
        <div
          className={cn(
            "call-surface relative flex flex-col overflow-hidden rounded-[22px] shadow-call-panel",
            remoteShare
              ? "w-[520px] px-[18px] pb-[18px] pt-4 min-[800px]:w-[max(720px,min(1120px,calc(100vw-80px)))]"
              : "w-[520px] items-center px-[34px] pb-[30px] pt-[38px]",
          )}
        >
          {remoteShare ? (
            <>
              <div className="flex items-center gap-[11px] px-0.5 pb-3 pt-0.5">
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-primary font-display text-[12px] font-bold">
                  {nameOf(remoteShare.participant) ? (
                    getInitials(nameOf(remoteShare.participant) as string)
                  ) : (
                    <User className="h-4 w-4 text-primary-200" />
                  )}
                </span>
                <p className="truncate text-[14.5px]">
                  <span className="font-semibold">{displayName(remoteShare.participant)}</span>{" "}
                  partage son écran
                </p>
                <span className="flex-1" />
                <ParticipantsChip
                  count={participants.length}
                  open={membersOpen}
                  onClick={() => setMembersOpen((v) => !v)}
                />
                <MiniButton
                  label="Plein écran"
                  onClick={() => {
                    const el = document.querySelector<HTMLElement>("[data-shared-screen]");
                    void el?.requestFullscreen?.().catch(() => {});
                  }}
                >
                  <Maximize2 className="h-4 w-4" />
                </MiniButton>
                <MiniButton label="Réduire l'appel" onClick={onMinimize}>
                  <ChevronDown className="h-4 w-4" />
                </MiniButton>
              </div>
              {membersOpen && (
                <div className="absolute right-[18px] top-[58px] z-10 w-64">
                  <MembersList participants={participants} localId={localParticipant?.identity} />
                </div>
              )}
              <div
                data-shared-screen
                className="aspect-video max-h-[498px] w-full overflow-hidden rounded-[12px] border border-white/[0.08] bg-primary-800"
              >
                <VideoTrack trackRef={remoteShare} className="h-full w-full object-contain" />
              </div>
              <div className="mt-3.5 flex flex-col items-center gap-4 min-[800px]:flex-row">
                <div className="min-w-0 flex-1 text-center text-body-sm text-primary-200 min-[800px]:text-left">
                  <TurnFacts name={beneficiaryFirstName} amount={turn?.payout_amount ?? null} />
                  <p className="num mt-[7px] text-caption text-primary-200/75">{stateLine}</p>
                </div>
                <DesktopDock
                  speakerOn={speakerOn}
                  speakerSupported={audioOutSupported}
                  onSpeaker={() => void toggleSpeaker()}
                  camEnabled={camEnabled}
                  onCam={() => void localParticipant?.setCameraEnabled(!camEnabled)}
                  micEnabled={micEnabled}
                  onMic={toggleMic}
                  sharing={selfSharing}
                  onShare={toggleShare}
                  onMinimize={onMinimize}
                  onHangup={onHangupClick}
                  confirming={confirming}
                />
              </div>
            </>
          ) : (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[360px] rounded-full"
                style={{
                  transform: "translate(-50%, -34%)",
                  background:
                    "radial-gradient(circle, hsl(var(--primary) / 0.40) 0%, transparent 68%)",
                }}
              />
              <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between">
                <MiniButton label="Réduire l'appel" onClick={onMinimize}>
                  <ChevronDown className="h-4 w-4" />
                </MiniButton>
                <ParticipantsChip
                  count={participants.length}
                  open={membersOpen}
                  onClick={() => setMembersOpen((v) => !v)}
                />
              </div>
              {membersOpen && (
                <div className="absolute right-4 top-[54px] z-20 w-64">
                  <MembersList participants={participants} localId={localParticipant?.identity} />
                </div>
              )}
              <div className="relative z-[1] flex w-full flex-col items-center">
                <div
                  className={cn(
                    "flex h-[136px] w-[136px] items-center justify-center rounded-full",
                    speakerName ? "bg-primary" : "bg-primary-800 shadow-[inset_0_0_0_1px_hsl(var(--primary-200)/0.24)]",
                  )}
                  style={{ boxShadow: holdsFloor ? SPEAKING_RING : undefined }}
                >
                  {speakerName ? (
                    <span className="font-display text-[44px] font-bold leading-none">
                      {getInitials(speakerName)}
                    </span>
                  ) : (
                    <User className="h-[58px] w-[58px] text-primary-200" />
                  )}
                </div>
                <p className="mt-[22px] text-center font-display text-[25px] font-bold leading-[1.15] tracking-[-0.02em]">
                  {speakerName ?? groupName ?? "Appel"}
                </p>
                <p className="mt-1.5 text-center text-body-sm leading-normal text-primary-200">
                  {speakerName
                    ? `${groupName ?? "Appel"} · ${holdsFloor ? "parle" : "Appel audio"}`
                    : `Un membre · ${holdsFloor ? "parle" : "Appel audio"}`}
                </p>

                {showStrip && (
                  <div className="mt-6 flex justify-center gap-1">
                    {visibleOthers.map((p) => {
                      const n = nameOf(p);
                      const isBeneficiary = beneficiaryId !== null && p.identity === beneficiaryId;
                      return (
                        <div key={p.identity} className="flex w-[60px] flex-col items-center gap-[7px]">
                          <div
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-full",
                              n ? "bg-primary" : "bg-primary-800",
                            )}
                            style={{ boxShadow: isBeneficiary ? BENEFICIARY_RING : undefined }}
                          >
                            {n ? (
                              <span className="font-display text-base font-bold">{getInitials(n)}</span>
                            ) : (
                              <User className="h-5 w-5 text-primary-200" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "max-w-[60px] truncate text-[11.5px] text-primary-200",
                              isBeneficiary && "font-semibold text-accent",
                            )}
                          >
                            {p.identity === localParticipant?.identity ? "Vous" : firstName(n) ?? "Un membre"}
                          </span>
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <div className="flex w-[60px] flex-col items-center gap-[7px]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-800 shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.10)]">
                          <span className="num font-display text-body-sm font-bold text-primary-200">
                            +{hiddenCount}
                          </span>
                        </div>
                        <span className="text-[11.5px]">{"\u00A0"}</span>
                      </div>
                    )}
                  </div>
                )}

                {beneficiaryFirstName && turn?.payout_amount != null ? (
                  <>
                    <div className="mt-6 text-center text-body-sm text-primary-200">
                      <TurnFacts name={beneficiaryFirstName} amount={turn.payout_amount} />
                    </div>
                    <p className="num mt-[7px] text-center text-caption text-primary-200/75">{stateLine}</p>
                  </>
                ) : (
                  <p className="num mt-6 text-center text-caption text-primary-200/75">{stateLine}</p>
                )}

                <div className="mt-7">
                  <DesktopDock
                    speakerOn={speakerOn}
                    speakerSupported={audioOutSupported}
                    onSpeaker={() => void toggleSpeaker()}
                    camEnabled={camEnabled}
                    onCam={() => void localParticipant?.setCameraEnabled(!camEnabled)}
                    micEnabled={micEnabled}
                    onMic={toggleMic}
                    sharing={selfSharing}
                    onShare={toggleShare}
                    onMinimize={onMinimize}
                    onHangup={onHangupClick}
                    confirming={confirming}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}

/** Combiné de raccrochage, tracé lucide « phone » rempli, grille 24. */
function HangupGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("rotate-[135deg]", className)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92" />
    </svg>
  );
}

function TurnFacts({ name, amount }: { name: string | null; amount: number | null }) {
  if (!name || amount == null) return null;
  return (
    <p className="leading-normal">
      {turnPrefix(name)}
      <span className="font-semibold text-accent">{name}</span>
      {" · "}cagnotte{" "}
      <span className="num font-semibold text-primary-foreground">
        {formatGNF(amount, { withCurrency: true })}
      </span>
    </p>
  );
}

function MiniButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/[0.07] text-primary-200"
    >
      {children}
    </button>
  );
}

function ParticipantsChip({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`Participants : ${count}`}
      className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-[11px] py-1.5 text-[12.5px] text-primary-200"
    >
      <Users className="h-3.5 w-3.5" />
      <span className="num">{count}</span>
    </button>
  );
}

function MembersList({ participants, localId }: { participants: Participant[]; localId?: string }) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-primary-800 p-2 text-left">
      {participants.map((p) => {
        const micMuted = p.getTrackPublication(Track.Source.Microphone)?.isMuted ?? false;
        return (
          <div key={p.identity} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
            <span className="truncate text-body-sm text-primary-foreground">
              {p.identity === localId ? "Vous" : displayName(p)}
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
  );
}

function DeskKey({
  label,
  onClick,
  state = "normal",
  disabled = false,
  size = "md",
  children,
}: {
  label: string;
  onClick: () => void;
  state?: "normal" | "on" | "off";
  disabled?: boolean;
  size?: "md" | "sm";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={state === "on"}
      title={label}
      className={cn(
        "flex flex-none items-center justify-center rounded-full disabled:opacity-40",
        size === "md" ? "h-[50px] w-[50px] [&_svg]:h-5 [&_svg]:w-5" : "h-11 w-11 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        state === "on" ? "bg-call-active text-primary-900" : "bg-white/[0.07]",
        state === "off" && "text-primary-foreground/55",
        state === "normal" && "text-primary-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DesktopDock(props: {
  speakerOn: boolean;
  speakerSupported: boolean;
  onSpeaker: () => void;
  camEnabled: boolean;
  onCam: () => void;
  micEnabled: boolean;
  onMic: () => void;
  sharing: boolean;
  onShare: () => void;
  onMinimize: () => void;
  onHangup: () => void;
  confirming: boolean;
}) {
  return (
    <div className="flex flex-none items-center gap-3.5 rounded-[27px] border border-white/10 bg-primary-800 px-[17px] py-[13px]">
      <DeskKey label="Haut-parleur" state={props.speakerOn ? "on" : "normal"} disabled={!props.speakerSupported} onClick={props.onSpeaker}>
        <Volume2 />
      </DeskKey>
      <DeskKey label={props.camEnabled ? "Couper la caméra" : "Activer la caméra"} state={props.camEnabled ? "normal" : "off"} onClick={props.onCam}>
        {props.camEnabled ? <Video /> : <VideoOff />}
      </DeskKey>
      <DeskKey label={props.micEnabled ? "Couper le micro" : "Activer le micro"} state={props.micEnabled ? "normal" : "on"} onClick={props.onMic}>
        {props.micEnabled ? <Mic /> : <MicOff />}
      </DeskKey>
      <DeskKey label={props.sharing ? "Arrêter le partage" : "Partager l'écran"} state={props.sharing ? "on" : "normal"} onClick={props.onShare}>
        <ScreenShare />
      </DeskKey>
      <DeskKey label="Réduire" onClick={props.onMinimize}>
        <Minimize2 />
      </DeskKey>
      <button
        type="button"
        onClick={props.onHangup}
        aria-label={props.confirming ? "Confirmer le raccrochage" : "Raccrocher"}
        title={props.confirming ? "Confirmer le raccrochage" : "Raccrocher"}
        className="ml-[5px] flex h-[50px] w-14 flex-none items-center justify-center rounded-[25px] bg-destructive text-destructive-foreground"
      >
        <HangupGlyph className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * Je partage mon écran : le panneau s'efface, l'application reste lisible et
 * utilisable. Aucun cadre dans la page — il serait vu par tous.
 */
function SelfShareBar({
  micEnabled,
  onToggleMic,
  onStop,
  membersOpen,
  onToggleMembers,
  members,
  onHangup,
  confirming,
}: {
  micEnabled: boolean;
  onToggleMic: () => void;
  onStop: () => void;
  membersOpen: boolean;
  onToggleMembers: () => void;
  members: ReactNode;
  onHangup: () => void;
  confirming: boolean;
}) {
  return (
    <div className="pointer-events-none hidden h-full md:block">
      <div className="pointer-events-auto absolute bottom-[26px] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[17px] bg-primary-900 py-[11px] pl-[19px] pr-[13px] text-primary-foreground shadow-call-bar">
        {membersOpen && <div className="absolute bottom-full right-0 mb-2 w-64">{members}</div>}
        <span className="flex items-center gap-[9px] whitespace-nowrap text-body-sm">
          <span className="block h-[9px] w-[9px] rounded-full bg-primary-300 shadow-[0_0_0_4px_hsl(var(--primary-300)/0.20)]" />
          Vous partagez votre écran
        </span>
        <button
          type="button"
          onClick={onStop}
          className="flex items-center gap-2 rounded-[12px] bg-call-active px-[15px] py-2.5 text-[13.5px] font-semibold text-primary-900"
        >
          <ScreenShareOff className="h-4 w-4" />
          Arrêter
        </button>
        <span className="mx-0.5 h-[26px] w-px bg-white/[0.14]" />
        <DeskKey size="sm" label={micEnabled ? "Couper le micro" : "Activer le micro"} state={micEnabled ? "normal" : "on"} onClick={onToggleMic}>
          {micEnabled ? <Mic /> : <MicOff />}
        </DeskKey>
        <DeskKey size="sm" label="Participants" state={membersOpen ? "on" : "normal"} onClick={onToggleMembers}>
          <Users />
        </DeskKey>
        <button
          type="button"
          onClick={onHangup}
          aria-label={confirming ? "Confirmer le raccrochage" : "Raccrocher"}
          title={confirming ? "Confirmer le raccrochage" : "Raccrocher"}
          className="flex h-11 w-[50px] flex-none items-center justify-center rounded-[22px] bg-destructive text-destructive-foreground"
        >
          <HangupGlyph className="h-[18px] w-[18px]" />
        </button>
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
