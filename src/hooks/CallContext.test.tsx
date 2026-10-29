import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CallProvider, useCall } from "./CallContext";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ error: null }),
  invoke: vi.fn().mockResolvedValue({ data: { token: "test", wsUrl: "wss://test.invalid", isHost: false } }),
  roomProps: null as null | { onConnected: () => void; audio: boolean },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "recipient", user_metadata: {} } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc, functions: { invoke: mocks.invoke },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { requested_by: "caller", status: "pending" } }) }) }) }),
} }));
vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: (props: { children: React.ReactNode; onConnected: () => void; audio: boolean }) => { mocks.roomProps = props; return props.children; },
  RoomAudioRenderer: () => null, useParticipants: () => [], useConnectionState: () => "disconnected",
}));
vi.mock("@/components/messages/CallOverlay", () => ({ CallStage: () => null, usePictureInPicture: () => ({ toggle: async () => false, active: false, supported: false }) }));
vi.mock("@/components/messages/AudioCallStage", () => ({ AudioCallStage: () => <div>Test room</div> }));
vi.mock("@/components/messages/CallMiniPlayer", () => ({ CallMiniPlayer: () => null }));
vi.mock("@/components/messages/AudioOutputControl", () => ({ AudioOutputControl: () => null }));
vi.mock("@/components/messages/CallDiagnosticProbe", () => ({ CallDiagnosticProbe: () => null }));

function Driver() {
  const { startCall, hangup } = useCall();
  return <><button onClick={() => startCall({ callId: "real-call", manageLifecycle: true, prefs: { micMuted: true, camOff: true, screenShare: false } })}>Join test</button><button onClick={hangup}>End test</button></>;
}

describe("managed incoming call", () => {
  it("joins without requesting the denied mic, acknowledges connection and ends on hangup", async () => {
    render(<CallProvider><Driver /></CallProvider>);
    act(() => screen.getByText("Join test").click());
    await waitFor(() => expect(screen.getByText("Test room")).toBeTruthy());
    const props = mocks.roomProps;
    if (!props) throw new Error("room not mounted");
    expect(props.audio).toBe(false);
    act(() => props.onConnected());
    expect(mocks.rpc).toHaveBeenCalledWith("respond_call_request", { p_id: "real-call", p_status: "accepted" });
    act(() => screen.getByText("End test").click());
    expect(mocks.rpc).toHaveBeenCalledWith("respond_call_request", { p_id: "real-call", p_status: "ended" });
    expect(screen.queryByText("Test room")).toBeNull();
  });
});