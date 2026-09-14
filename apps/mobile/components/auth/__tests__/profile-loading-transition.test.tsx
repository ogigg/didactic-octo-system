import { act, render } from "@testing-library/react-native";
import { useAuthStore } from "@/stores/auth-store";
import { ProfileLoadingTransition } from "../profile-loading-transition";

jest.mock("@/stores/auth-store", () => ({ useAuthStore: jest.fn() }));
jest.mock("../profile-gate", () => ({ ProfileGate: () => null }));

function setStatus(profileStatus: string) {
  (useAuthStore as unknown as jest.Mock).mockImplementation((select) =>
    select({
      profileStatus,
      session: { user: { id: "user-a" } },
      isPasswordRecovery: false,
    })
  );
}

it("briefly overlays the destination after loading, then removes the overlay", () => {
  jest.useFakeTimers();
  setStatus("loading");
  const view = render(<ProfileLoadingTransition />);
  expect(view.toJSON()).toBeNull();
  setStatus("ready");
  view.rerender(<ProfileLoadingTransition />);
  expect(view.toJSON()).not.toBeNull();
  act(() => jest.advanceTimersByTime(220));
  expect(view.toJSON()).toBeNull();
  view.unmount();
  jest.useRealTimers();
});
