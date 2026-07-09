/*
 * Tontine Digitale — Landing page
 * Fidèle à la maquette Figma (couleurs, tailles, textes exacts).
 * Styles inline volontairement conservés pour rester 1:1 avec la source.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Link } from "react-router-dom";

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const C = {
  teal: "rgb(13,115,119)",
  tealDark: "rgb(8,84,86)",
  tealGrad: "linear-gradient(105.73deg, rgb(13,115,119) -6.78%, rgb(8,84,86) 97.67%)",
  ink: "rgb(0,0,0)",
  slate900: "rgb(30,41,59)",
  slate600: "rgb(71,85,105)",
  slate500: "rgb(100,116,139)",
  slate50: "rgb(248,250,252)",
  border: "rgb(226,232,240)",
  amberText: "rgb(180,83,9)",
  amberBg: "rgb(254,249,231)",
  greenText: "rgb(22,163,74)",
  white: "rgb(255,255,255)",
  footer: "rgb(15,23,42)",
  footerGray: "rgb(147,162,183)",
  footerCard: "rgb(30,41,59)",
};

function useVW() {
  const [w, setW] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1440);
  React.useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

const Ico = {
  users: (c = "#F8FAFC") => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  wallet: (c = "#F8FAFC") => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
  refresh: (c = "#F8FAFC") => (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  bell: (c = "#fff") => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  award: (c = "#fff") => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  chart: (c = "#fff") => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 15 3-4 3 3 4-6" />
    </svg>
  ),
  shieldGreen: (c: string = C.greenText) => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  lock: (c = "rgb(10,90,93)") => (
    <svg width="30" height="34" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  eyeOff: (c: string = C.amberText) => (
    <svg width="36" height="30" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ),
  badgeCheck: (c = "#fff") => (
    <svg width="44" height="54" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  check: (c: string = C.teal, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2L6.6 12l1.4-1.4 2.8 2.8 5.2-5.2L17.4 9.6l-6.6 6.6Z" />
    </svg>
  ),
  star: (c = "rgb(255,204,2)", s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2Z" />
    </svg>
  ),
  play: (c: string = C.teal) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" fill={c} stroke="none" />
    </svg>
  ),
  arrow: (c = "#fff") => (
    <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  phone: (c = "rgb(10,90,93)") => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  ),
  member: (c = "#000") => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  shieldMini: (c = "#000") => (
    <svg width="15" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  checkCircleWhite: (c = "#0D7377") => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={c}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.2L6.6 12l1.4-1.4 2.8 2.8 5.2-5.2L17.4 9.6l-6.6 6.6Z" />
    </svg>
  ),
};

const Social = {
  facebook: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#F8FAFC">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  x: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#F8FAFC">
      <path d="M18.9 2h3.68l-8.04 9.19L24 22h-7.41l-5.8-7.58L4.15 22H.46l8.6-9.83L0 2h7.6l5.24 6.93L18.9 2Zm-1.29 17.79h2.04L6.48 4.11H4.29L17.61 19.79Z" />
    </svg>
  ),
  instagram: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F8FAFC" strokeWidth="1.7">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="#F8FAFC" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#F8FAFC">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06C20.6 8.58 22 10.3 22 13.6V21h-4v-6.4c0-1.53-.03-3.5-2.13-3.5-2.13 0-2.46 1.66-2.46 3.38V21H9V9Z" />
    </svg>
  ),
};

function Badge({ text, bg, color }: any) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: 52, padding: "20px 32px", background: bg,
    }}>
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20, lineHeight: 1, color }}>{text}</span>
    </div>
  );
}

function Logo({ size = 49, radius = 12, shadow = false }: any) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: C.tealGrad,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      boxShadow: shadow ? "0px 4px 12px 0px rgba(13,115,119,0.25)" : "none",
    }}>
      <div style={{
        width: size * 0.8, height: size * 0.8, borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
        </svg>
      </div>
    </div>
  );
}

function PayBadge({ label, bg, color = "#000", w = 72 }: any) {
  return (
    <div style={{
      width: w, height: 72, borderRadius: 12, background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color, letterSpacing: label === "VISA" ? 1 : 0 }}>{label}</span>
    </div>
  );
}

function Header() {
  const vw = useVW();
  const m = vw <= 860;
  const nav = ["Fonctionnalités", "Comment ça marche", "Sécurité", "FAQ"];
  return (
    <header style={{
      height: 83, borderBottom: `1px solid rgb(241,245,249)`, background: C.white,
      display: "flex", alignItems: "center", padding: m ? "0 20px" : "0 70px", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 48, width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Logo size={m ? 42 : 49} />
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: m ? 20 : 24, color: C.ink }}>Tontine Digitale</span>
        </div>
        <nav style={{ display: m ? "none" : "flex", alignItems: "center", gap: 48 }}>
          {nav.map((n) => (
            <a key={n} href="#" style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, color: C.slate600, textDecoration: "none", whiteSpace: "nowrap" }}>{n}</a>
          ))}
          <Link to="/auth" style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, color: C.slate600, textDecoration: "none", whiteSpace: "nowrap" }}>Se connecter</Link>
        </nav>
        <Link to="/auth" style={{
          textDecoration: "none",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer", borderRadius: 16, padding: m ? "8px 18px" : "8px 24px", height: 50,
          background: "linear-gradient(102.83deg, rgb(13,115,119) -27.08%, rgb(8,84,86) 147.38%)",
          fontFamily: FONT, fontWeight: 700, fontSize: m ? 16 : 20, color: "#fff", flexShrink: 0,
        }}>Commencer</Link>
      </div>
    </header>
  );
}

function PhoneMock() {
  return (
    <div style={{ position: "relative", width: 583, height: 681, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 419, top: -50, width: 180, height: 180, borderRadius: "50%", background: "rgb(20,145,155)", opacity: 0.9 }} />
      <div style={{
        position: "absolute", left: 157, top: 38, width: 323, height: 608, borderRadius: 40,
        background: "#fff", boxShadow: "0 0 0 14px #000", overflow: "hidden",
      }}>
        <div style={{ height: 130, background: C.tealGrad, position: "relative", padding: "27px 22px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: "#fff", marginBottom: 8 }}>Bienvenue 👋</div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#fff" }}>Elhadj Mamadou</div>
            </div>
            <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 600, fontSize: 20, color: "#F8FAFC" }}>ED</div>
          </div>
        </div>
        <div style={{ margin: "-35px 20px 0", borderRadius: 16, background: "#fff", boxShadow: "0px 4px 14px 0px rgba(0,0,0,0.12)", padding: "19px 24px 16px", boxSizing: "border-box" }}>
          <div style={{ fontFamily: FONT, fontSize: 14, color: "#000" }}>Solde total des tontines</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.slate600, margin: "10px 0 14px" }}>GNF 26 500 000</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ borderRadius: 8, background: C.slate900, padding: "8px 20px", fontFamily: FONT, fontSize: 14, color: "#fff" }}>Cotiser</div>
            <div style={{ borderRadius: 8, background: "linear-gradient(94.9deg, rgb(13,115,119) -12%, rgb(8,84,86) 110%)", padding: "8px 20px", fontFamily: FONT, fontSize: 14, color: "#fff" }}>Historique</div>
          </div>
        </div>
        <div style={{ padding: "24px 22px 0" }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: "#000", marginBottom: 14 }}>Mes Tontines</div>
          <div style={{ borderRadius: 12, background: C.slate50, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.member("#000")}</div>
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#000" }}>Famille Diallo</div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.slate500 }}>12 membres · Mensuelle</div>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: "rgba(13,115,119,0.18)", marginTop: 12 }}>
              <div style={{ width: "70%", height: 6, borderRadius: 100, background: C.teal }} />
            </div>
          </div>
          <div style={{ borderRadius: 12, background: C.slate50, border: `0.5px solid ${C.border}`, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.member("#fff")}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#000" }}>Commerçants Madina</div>
                  <div style={{ borderRadius: 50, background: "rgb(254,243,199)", padding: "5px 9px", fontFamily: FONT, fontSize: 8, color: C.amberText }}>Votre tour</div>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.slate500, marginTop: 6 }}>20 membres · Hebdomadaire</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 106, width: 173, borderRadius: 12, background: "linear-gradient(90deg, rgb(13,115,119) -16.62%, rgb(20,145,155) 74.39%)", padding: 15, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, boxShadow: "0px 8px 24px rgba(13,115,119,0.3)" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgb(220,252,231)", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.checkCircleWhite("#0D7377")}</div>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#fff" }}>Paiement reçu</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: "rgba(255,255,255,0.9)" }}>+6 000 000 GNF</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 410, top: 566, width: 173, borderRadius: 12, background: C.slate50, padding: 15, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, boxShadow: "0px 4px 12px 0px rgba(13,115,119,0.25)" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgb(204,242,244)", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.shieldMini("#0D7377")}</div>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: C.slate900 }}>100% Sécurisé</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.slate500 }}>Transactions cryptées</div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const vw = useVW();
  const t = vw <= 980;
  const m = vw <= 620;
  const scale = m ? 0.56 : t ? 0.78 : 1;
  return (
    <section style={{
      position: "relative", padding: t ? "40px 20px 0" : "64px 63px 0", boxSizing: "border-box", overflow: "hidden",
      backgroundImage: "linear-gradient(rgba(226,232,240,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.5) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: t ? "center" : "flex-start", flexDirection: t ? "column" : "row", gap: t ? 24 : 0 }}>
        <div style={{ width: t ? "100%" : 614, maxWidth: 614, paddingTop: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 39, background: "rgb(230,243,243)", padding: "16px 24px" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.teal, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: m ? 14 : 16, color: C.ink }}>🇬🇳 Première plateforme de tontine digitale en Guinée</span>
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: m ? 34 : t ? 46 : 60, lineHeight: 1.1, color: C.ink, margin: "36px 0 0", maxWidth: 583 }}>
            Digitalisez vos<br />tontines en toute confiance
          </h1>
          <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, lineHeight: 1.4, color: C.slate600, margin: "28px 0 0", maxWidth: 583 }}>
            Gérez vos groupes d'épargne rotative facilement et en toute sécurité. Cotisez via Orange Money ou MTN Mobile Money, suivez vos tours et recevez votre cagnotte automatiquement.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 34, flexWrap: "wrap" }}>
            <Link to="/auth" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", border: "none", cursor: "pointer", borderRadius: 16, padding: "20px 30px", background: "linear-gradient(90deg, rgb(13,115,119) -16.34%, rgb(8,84,86) 84.48%)", fontFamily: FONT, fontWeight: 600, fontSize: 18, color: "#fff", boxShadow: "0px 2px 8px rgba(16,185,129,0.19)" }}>Créer mon compte gratuit</Link>
            <button style={{ cursor: "pointer", borderRadius: 16, padding: "20px 30px", background: "#fff", border: "2px solid rgb(100,116,139)", fontFamily: FONT, fontWeight: 600, fontSize: 20, color: C.slate900, display: "flex", alignItems: "center", gap: 10 }}>
              {Ico.play(C.teal)} Voir comment ça marche
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40 }}>
            <div style={{ display: "flex" }}>
              {[{ t: "MB", c: "rgb(249,155,91)" }, { t: "AK", c: "rgb(33,193,92)" }, { t: "FD", c: C.teal }, { t: "+2K", c: C.slate900 }].map((a, i) => (
                <div key={i} style={{ width: 44, height: 44, borderRadius: "50%", background: a.c, border: "3px solid #fff", marginLeft: i ? -14 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#fff" }}>{a.t}</div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: "rgb(51,65,85)" }}>2,500+ utilisateurs</div>
              <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 16, color: "rgb(51,65,85)" }}>nous font confiance</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
            <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i}>{Ico.star()}</span>)}</div>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>4.9/5</span>
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 16, color: C.ink }}>(500+ avis)</span>
          </div>
        </div>
        <div style={{ width: 583 * scale, height: 681 * scale, flexShrink: 0, position: "relative" }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <PhoneMock />
          </div>
        </div>
      </div>
      <div style={{ display: t ? "none" : "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 40, paddingBottom: 40 }}>
        <span style={{ fontFamily: FONT, fontSize: 18, color: "rgb(51,65,85)" }}>Défiler</span>
        <div style={{ width: 30, height: 48, borderRadius: 28, border: "2px solid #000", display: "flex", justifyContent: "center", paddingTop: 8, boxSizing: "border-box" }}>
          <div style={{ width: 4, height: 8, borderRadius: 12, background: "#000" }} />
        </div>
      </div>
    </section>
  );
}

function Partners() {
  const vw = useVW();
  const m = vw <= 720;
  const items = [
    { label: "OM", bg: "rgb(249,155,91)", name: "Orange Money", color: "#000", w: 72 },
    { label: "M", bg: "rgb(255,204,2)", name: "MTN MoMo", color: "#000", w: 72 },
    { label: "VISA", bg: "rgb(199,210,254)", name: "Visa", color: "rgb(30,41,59)", w: 88 },
  ];
  return (
    <section style={{ background: C.slate50, padding: "68px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: C.ink, marginBottom: 48 }}>Paiements sécurisés via nos partenaires</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: m ? 24 : 68, flexDirection: m ? "column" : "row" }}>
        {items.map((p) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <PayBadge label={p.label} bg={p.bg} color={p.color} w={p.w} />
            <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: C.slate500 }}>{p.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ icon, iconBg, iconShadow, title, text }: any) {
  return (
    <div style={{
      flex: 1, borderRadius: 32, background: "#fff", border: `1px solid ${C.border}`,
      boxShadow: "0px 2px 8px 0px rgba(13,115,119,0.08)", padding: 32, boxSizing: "border-box", minHeight: 312,
    }}>
      <div style={{ width: 72, height: 72, borderRadius: 12, background: iconBg, boxShadow: iconShadow || "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.slate900, margin: "24px 0 12px" }}>{title}</div>
      <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, lineHeight: 1.45, color: C.slate600 }}>{text}</div>
    </div>
  );
}

function Features() {
  const vw = useVW();
  const t = vw <= 980;
  const row1 = [
    { icon: Ico.users("#fff"), iconBg: "rgb(249,155,91)", title: "Gestion de groupes", text: "Créez et gérez vos groupes de tontine facilement. Invitez des membres, définissez les règles et suivez la progression." },
    { icon: Ico.wallet("#fff"), iconBg: C.tealGrad, title: "Paiement Mobile Money", text: "Cotisez instantanément via Orange Money ou MTN Mobile Money. Recevez votre cagnotte directement sur votre compte." },
    { icon: Ico.refresh("#fff"), iconBg: "linear-gradient(135deg, rgb(33,193,92), rgb(22,163,74))", title: "Rotation automatique", text: "Le système gère automatiquement l'ordre des tours. Vous pouvez aussi échanger votre position avec un autre membre." },
  ];
  const row2 = [
    { icon: Ico.bell("#fff"), iconBg: "linear-gradient(90deg, rgb(154,62,238), rgb(136,66,201))", iconShadow: "0px 8px 20px rgba(154,62,238,0.25)", title: "Rappels automatiques", text: "Recevez des notifications SMS et push pour les échéances, les paiements reçus et les événements importants." },
    { icon: Ico.award("#fff"), iconBg: "linear-gradient(135deg, rgb(244,63,94), rgb(220,38,38))", iconShadow: "0px 8px 20px rgba(244,63,94,0.25)", title: "Score de fiabilité", text: "Chaque membre a un score basé sur son historique de paiement. Construisez votre réputation et rejoignez des groupes premium." },
    { icon: Ico.chart("#fff"), iconBg: C.slate900, title: "Tableau de bord", text: "Visualisez vos statistiques, l'historique des transactions et la progression de tous vos groupes en un coup d'œil." },
  ];
  return (
    <section style={{ padding: t ? "60px 20px" : "80px 64px", background: "#fff", textAlign: "center" }}>
      <Badge text="Fonctionnalités" bg="transparent" color={C.ink} />
      <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: t ? 32 : 44, lineHeight: 1.15, color: C.ink, margin: "16px auto 24px", maxWidth: 729 }}>Tout ce dont vous avez besoin pour gérer vos tontines</h2>
      <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: t ? 18 : 24, lineHeight: 1.35, color: C.slate900, margin: "0 auto 56px", maxWidth: 995 }}>Une plateforme complète qui modernise la tradition tout en préservant les valeurs de confiance et de solidarité.</p>
      <div style={{ display: "flex", flexDirection: t ? "column" : "row", gap: 20, maxWidth: 1312, margin: "0 auto 20px" }}>{row1.map((c) => <FeatureCard key={c.title} {...c} />)}</div>
      <div style={{ display: "flex", flexDirection: t ? "column" : "row", gap: 20, maxWidth: 1312, margin: "0 auto" }}>{row2.map((c) => <FeatureCard key={c.title} {...c} />)}</div>
    </section>
  );
}

function Step({ num, title, text, checks }: any) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ width: 72, height: 72, borderRadius: 12, background: C.tealGrad, boxShadow: "0px 8px 20px rgba(13,115,119,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 700, fontSize: 24, color: "#fff" }}>{num}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.slate900, margin: "20px 0 12px" }}>{title}</div>
      <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 20, lineHeight: 1.4, color: C.slate600, marginBottom: 20 }}>{text}</div>
      {checks.map((c: string) => (
        <div key={c} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          {Ico.check(C.teal, 22)}
          <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, color: C.slate600 }}>{c}</span>
        </div>
      ))}
    </div>
  );
}

function HowItWorks() {
  const vw = useVW();
  const t = vw <= 980;
  const steps = [
    { num: "1", title: "Créez votre groupe", text: "Inscrivez-vous gratuitement, créez votre groupe et définissez les paramètres : montant de cotisation, fréquence et nombre de membres.", checks: ["Inscription gratuite en 2 minutes", "Personnalisez les règles du groupe"] },
    { num: "2", title: "Invitez vos membres", text: "Partagez le lien d'invitation ou ajoutez les membres directement via leur numéro de téléphone. Ils recevront une notification.", checks: ["Invitation par SMS ou WhatsApp", "Validation par l'administrateur"] },
    { num: "3", title: "Cotisez et recevez", text: "Les membres cotisent via Mobile Money. À chaque tour, le bénéficiaire reçoit la cagnotte automatiquement sur son compte.", checks: ["Paiements instantanés", "Historique complet des transactions"] },
  ];
  return (
    <section style={{ background: C.slate50, padding: t ? "60px 20px" : "84px 69px", textAlign: "center" }}>
      <Badge text="Comment ça marche" bg={C.amberBg} color={C.amberText} />
      <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: t ? 32 : 48, lineHeight: 1.15, color: C.slate900, margin: "24px auto", maxWidth: 729 }}>Lancez votre tontine en 3 étapes simples</h2>
      <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: t ? 18 : 24, color: C.slate600, margin: "0 auto 56px", maxWidth: 995 }}>Pas besoin d'être un expert en technologie. Notre plateforme est conçue pour être simple et intuitive.</p>
      <div style={{ display: "flex", flexDirection: t ? "column" : "row", gap: 36, maxWidth: 1302, margin: "0 auto", textAlign: "left" }}>{steps.map((s) => <Step key={s.num} {...s} />)}</div>
      <Link to="/auth" style={{ textDecoration: "none", marginTop: 56, border: "none", cursor: "pointer", borderRadius: 20, padding: "22px 32px", background: C.tealGrad, fontFamily: FONT, fontWeight: 600, fontSize: 18, color: "#fff", display: "inline-flex", alignItems: "center", gap: 12 }}>
        Créer mon premier groupe {Ico.arrow()}
      </Link>
    </section>
  );
}

function StatBox({ big, small }: any) {
  return (
    <div style={{ flex: 1, borderRadius: 12, background: "rgb(48,167,110)", padding: "20px 0", textAlign: "center" }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: big.length > 4 ? 30 : 36, color: "#fff" }}>{big}</div>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: "rgb(211,239,224)", marginTop: 8 }}>{small}</div>
    </div>
  );
}

function Security() {
  const vw = useVW();
  const t = vw <= 980;
  const points = [
    { icon: Ico.shieldGreen(), bg: "rgb(220,252,231)", title: "Cryptage de bout en bout", text: "Toutes vos transactions sont cryptées avec les protocoles SSL/TLS les plus récents." },
    { icon: Ico.lock(), bg: "rgb(204,242,244)", title: "Authentification à deux facteurs", text: "Protégez votre compte avec un code SMS en plus de votre mot de passe." },
    { icon: Ico.eyeOff(), bg: "rgb(254,243,199)", title: "Protection des données", text: "Vos informations personnelles ne sont jamais partagées avec des tiers." },
  ];
  return (
    <section style={{ background: "#fff", padding: t ? "60px 20px" : "84px 62px" }}>
      <div style={{ display: "flex", flexDirection: t ? "column" : "row", gap: 56, maxWidth: 1316, margin: "0 auto", alignItems: t ? "stretch" : "center" }}>
        <div style={{ flex: 1 }}>
          <Badge text="Sécurité & Confiance" bg="rgb(240,253,244)" color={C.greenText} />
          <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 48, lineHeight: 1.15, color: C.slate900, margin: "24px 0 16px", maxWidth: 530 }}>Vos fonds sont en sécurité avec nous</h2>
          <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 24, lineHeight: 1.35, color: C.slate600, maxWidth: 707, marginBottom: 40 }}>Nous utilisons les mêmes standards de sécurité que les banques pour protéger vos transactions et vos données personnelles.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {points.map((p) => (
              <div key={p.title} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, background: p.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.icon}</div>
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: C.slate900, marginBottom: 12 }}>{p.title}</div>
                  <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 24, lineHeight: 1.3, color: C.slate600 }}>{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: t ? "100%" : 617, maxWidth: 617, borderRadius: 32, background: "linear-gradient(136.87deg, rgb(33,192,94) -3.91%, rgb(11,94,94) 100.55%)", boxShadow: "0px 4px 12px rgba(33,192,94,0.25)", padding: 42, boxSizing: "border-box" }}>
          <div style={{ width: 93, height: 93, borderRadius: 20, background: "rgb(77,194,128)", boxShadow: "0px 20px 30px rgba(77,194,128,0.19)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>{Ico.badgeCheck("#fff")}</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: "#fff", marginBottom: 20 }}>Certifié conforme</div>
          <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 24, lineHeight: 1.3, color: "rgb(211,239,224)", marginBottom: 28, maxWidth: 483 }}>Notre plateforme respecte les normes de sécurité les plus strictes et est conforme aux réglementations locales.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", gap: 28 }}>
              <StatBox big="256-bit" small="Encryption SSL" />
              <StatBox big="99.9%" small="Disponibilité" />
            </div>
            <div style={{ display: "flex", gap: 28 }}>
              <StatBox big="24/7" small="Surveillance" />
              <StatBox big="0" small="Fraudes signalées" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ quote, initials, name, role, avatarBg }: any) {
  return (
    <div style={{ flex: 1, borderRadius: 12, background: "#fff", boxShadow: "0px 2px 8px 0px rgba(13,115,119,0.19)", padding: 27, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i}>{Ico.star("rgb(255,204,2)", 18)}</span>)}</div>
      <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 20, lineHeight: 1.4, color: C.slate600, marginBottom: 16 }}>{quote}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 600, fontSize: 18, color: "#fff", flexShrink: 0 }}>{initials}</div>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20, color: C.slate900 }}>{name}</div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 16, color: C.slate600 }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  const vw = useVW();
  const t = vw <= 980;
  const items = [
    { quote: "\"Avant, on gérait notre tontine avec un cahier et c'était compliqué de suivre qui avait payé. Maintenant tout est automatique et transparent !\"", initials: "FB", name: "Fatoumata Barry", role: "Commerçante, Madina", avatarBg: "rgb(249,155,91)" },
    { quote: "\"J'ai pu financer les travaux de ma maison grâce à la cagnotte. Le système de rappel par SMS est vraiment pratique pour ne pas oublier les échéances.\"", initials: "MD", name: "Mamadou Diallo", role: "Fonctionnaire, Conakry", avatarBg: C.teal },
    { quote: "\"On a créé une tontine entre collègues du bureau. L'application est simple à utiliser et le paiement par Orange Money est instantané. Je recommande !\"", initials: "AC", name: "Aissatou Camara", role: "Comptable, Kaloum", avatarBg: "rgb(33,193,92)" },
  ];
  return (
    <section style={{ background: C.slate50, padding: t ? "60px 20px" : "84px 64px", textAlign: "center" }}>
      <Badge text="Témoignages" bg="rgb(230,243,243)" color={C.amberText} />
      <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: t ? 32 : 48, color: C.slate900, margin: "24px 0 48px" }}>Ce que disent nos utilisateurs</h2>
      <div style={{ display: "flex", flexDirection: t ? "column" : "row", gap: 28, maxWidth: 1310, margin: "0 auto", textAlign: "left" }}>{items.map((it) => <TestimonialCard key={it.name} {...it} />)}</div>
    </section>
  );
}

function CTA() {
  const vw = useVW();
  const t = vw <= 720;
  return (
    <section style={{ background: "#fff", padding: t ? "60px 16px" : "114px 65px" }}>
      <div style={{ maxWidth: 1310, margin: "0 auto", borderRadius: t ? 32 : 56, background: C.tealGrad, padding: t ? "48px 24px" : "68px 40px", textAlign: "center" }}>
        <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: t ? 28 : 40, color: "#fff", marginBottom: 20 }}>Prêt à digitaliser vos tontines ?</h2>
        <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 22, lineHeight: 1.4, color: "rgb(204,242,244)", maxWidth: 900, margin: "0 auto 32px" }}>Rejoignez des milliers d'utilisateurs qui font déjà confiance à Tontine Digital pour gérer leurs épargnes collectives en toute sécurité.</p>
        <div style={{ display: "flex", gap: 31, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/auth" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", border: "none", cursor: "pointer", borderRadius: 16, padding: "20px 30px", background: "#fff", fontFamily: FONT, fontWeight: 600, fontSize: 20, color: C.slate500 }}>Créer mon compte gratuit</Link>
          <a href="tel:+224" style={{ textDecoration: "none", cursor: "pointer", borderRadius: 16, padding: "20px 30px", background: "rgb(43,106,108)", border: "0.5px solid rgb(148,163,184)", fontFamily: FONT, fontWeight: 600, fontSize: 20, color: "rgb(230,243,243)", display: "inline-flex", alignItems: "center", gap: 10 }}>
            {Ico.phone("#e6f3f3")} Nous contacter
          </a>
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 20, color: "rgb(152,227,231)", marginTop: 25 }}>✓ Gratuit pour commencer&nbsp;&nbsp;&nbsp;&nbsp;✓ Aucune carte bancaire requise&nbsp;&nbsp;&nbsp;&nbsp;✓ Support 24/7</div>
      </div>
    </section>
  );
}

function Footer() {
  const vw = useVW();
  const t = vw <= 860;
  const cols = [
    { title: "Produit", links: ["Fonctionnalités", "Tarifs", "Sécurité", "Application mobile"] },
    { title: "Support", links: ["Centre d'aide", "FAQ", "Nous contacter", "Tutoriels"] },
    { title: "Légal", links: ["Conditions d'utilisation", "Politique de confidentialité", "Mentions légales"] },
  ];
  return (
    <footer style={{ background: C.footer, padding: t ? "46px 20px" : "46px 66px" }}>
      <div style={{ maxWidth: 1309, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 48, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ width: t ? "100%" : 476 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Logo shadow />
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: "#fff" }}>Tontine Digitale</span>
            </div>
            <p style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, lineHeight: 1.4, color: C.footerGray, marginBottom: 24, maxWidth: 420 }}>La première plateforme de gestion de tontines digitales en Guinée. Sécurisée, transparente et accessible à tous.</p>
            <div style={{ display: "flex", gap: 20 }}>
              {[Social.facebook, Social.x, Social.instagram, Social.linkedin].map((s, i) => (
                <div key={i} style={{ width: 70, height: 70, borderRadius: 12, background: C.footerCard, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{s}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {cols.map((col) => (
              <div key={col.title} style={{ width: 209 }}>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20, color: C.slate50, marginBottom: 32 }}>{col.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {col.links.map((l) => (
                    <a key={l} href="#" style={{ fontFamily: FONT, fontWeight: 400, fontSize: 18, color: C.footerGray, textDecoration: "none" }}>{l}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 1, background: C.footerCard, margin: "60px 0 40px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
          <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: C.slate500 }}>© 2024 Tontine Digital. Tous droits réservés.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: C.slate500 }}>Paiements sécurisés via</span>
            <PayBadge label="OM" bg="rgb(249,155,91)" color="#000" />
            <PayBadge label="M" bg="rgb(255,204,2)" color="#000" />
            <PayBadge label="VISA" bg="rgb(199,210,254)" color="rgb(30,41,59)" w={88} />
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Index() {
  return (
    <div style={{ width: "100%", background: "#fff", fontFamily: FONT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');`}</style>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <Header />
        <Hero />
        <Partners />
        <Features />
        <HowItWorks />
        <Security />
        <Testimonials />
        <CTA />
        <Footer />
      </div>
    </div>
  );
}
