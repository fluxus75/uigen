import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import * as anonTracker from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });

    test("returns signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("sets isLoading to true during sign in", async () => {
      let resolveSignIn: (value: { success: boolean }) => void;
      const signInPromise = new Promise<{ success: boolean }>((resolve) => {
        resolveSignIn = resolve;
      });
      vi.mocked(signInAction).mockReturnValue(signInPromise);
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "new-project-id",
        name: "New Design",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      let signInResultPromise: Promise<{ success: boolean; error?: string }>;
      act(() => {
        signInResultPromise = result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn!({ success: true });
        await signInResultPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns result from signInAction on success", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "new-project-id",
        name: "New Design",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: { success: boolean; error?: string };
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "password123");
      });

      expect(signInResult!.success).toBe(true);
      expect(signInAction).toHaveBeenCalledWith("test@example.com", "password123");
    });

    test("returns error result from signInAction on failure", async () => {
      vi.mocked(signInAction).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let signInResult: { success: boolean; error?: string };
      await act(async () => {
        signInResult = await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(signInResult!.success).toBe(false);
      expect(signInResult!.error).toBe("Invalid credentials");
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("redirects to project with anonymous work after successful sign in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "Create a button" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "test" } },
      });
      vi.mocked(createProject).mockResolvedValue({
        id: "anon-project-id",
        name: "Design from 10:00:00 AM",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: [{ id: "1", role: "user", content: "Create a button" }],
        data: { "/App.jsx": { type: "file", content: "test" } },
      });
      expect(anonTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("redirects to most recent project when no anonymous work", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([
        {
          id: "existing-project-1",
          name: "My Project",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "existing-project-2",
          name: "Older Project",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-project-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates new project when user has no projects", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "brand-new-project",
        name: "New Design #12345",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });

    test("sets isLoading to false even when sign in fails", async () => {
      vi.mocked(signInAction).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not redirect when anonymous work has empty messages", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      vi.mocked(getProjects).mockResolvedValue([
        {
          id: "existing-project",
          name: "My Project",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      // Should go to existing project, not create one from anon work
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
      expect(anonTracker.clearAnonWork).not.toHaveBeenCalled();
    });
  });

  describe("signUp", () => {
    test("sets isLoading to true during sign up", async () => {
      let resolveSignUp: (value: { success: boolean }) => void;
      const signUpPromise = new Promise<{ success: boolean }>((resolve) => {
        resolveSignUp = resolve;
      });
      vi.mocked(signUpAction).mockReturnValue(signUpPromise);
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "new-project-id",
        name: "New Design",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      let signUpResultPromise: Promise<{ success: boolean; error?: string }>;
      act(() => {
        signUpResultPromise = result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp!({ success: true });
        await signUpResultPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns result from signUpAction on success", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "new-project-id",
        name: "New Design",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      let signUpResult: { success: boolean; error?: string };
      await act(async () => {
        signUpResult = await result.current.signUp("new@example.com", "password123");
      });

      expect(signUpResult!.success).toBe(true);
      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
    });

    test("returns error result from signUpAction on failure", async () => {
      vi.mocked(signUpAction).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let signUpResult: { success: boolean; error?: string };
      await act(async () => {
        signUpResult = await result.current.signUp("existing@example.com", "password123");
      });

      expect(signUpResult!.success).toBe(false);
      expect(signUpResult!.error).toBe("Email already registered");
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("redirects to project with anonymous work after successful sign up", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "Create a form" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "form code" } },
      });
      vi.mocked(createProject).mockResolvedValue({
        id: "anon-signup-project",
        name: "Design from 11:00:00 AM",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: [{ id: "1", role: "user", content: "Create a form" }],
        data: { "/App.jsx": { type: "file", content: "form code" } },
      });
      expect(anonTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-signup-project");
    });

    test("creates new project when new user signs up with no anonymous work", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({
        id: "first-project",
        name: "New Design #54321",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });

    test("sets isLoading to false even when sign up fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({
        success: false,
        error: "Password too short",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "short");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns error when password validation fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({
        success: false,
        error: "Password must be at least 8 characters",
      });

      const { result } = renderHook(() => useAuth());

      let signUpResult: { success: boolean; error?: string };
      await act(async () => {
        signUpResult = await result.current.signUp("new@example.com", "short");
      });

      expect(signUpResult!.success).toBe(false);
      expect(signUpResult!.error).toBe("Password must be at least 8 characters");
    });
  });

  describe("error handling", () => {
    test("sets isLoading to false when signInAction throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false when signUpAction throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@example.com", "password123");
        })
      ).rejects.toThrow("Server error");

      expect(result.current.isLoading).toBe(false);
    });

    test("sets isLoading to false when handlePostSignIn throws", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(anonTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockRejectedValue(new Error("Failed to fetch projects"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Failed to fetch projects");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
