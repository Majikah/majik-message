import {
  clearSession,
  setSession,
  setUserData,
} from "../../redux/slices/user-data";
import { store } from "../../redux/store";
import { MajikUser, type MajikUserJSON } from "@thezelijah/majik-user";
import type {
  AuthChangeEvent,
  Session,
  Subscription,
} from "@supabase/supabase-js";
import axios, { type AxiosInstance, type AxiosError } from "axios";
import type {
  API_SUPABASE_SIGN_IN_BODY,
  API_SUPABASE_SIGN_UP_BODY,
  API_SUPABASE_GOOGLE_SIGN_IN_BODY,
  API_SUPABASE_VERIFY_OTP_BODY,
  API_RESPONSE_SIGN_IN,
  API_RESPONSE_SIGN_UP,
  API_RESPONSE_GOOGLE_SIGN_IN,
  API_RESPONSE_VERIFY_OTP,
  API_RESPONSE_SIGN_IN_ERROR_EMAIL_NOT_CONFIRMED,
  API_RESPONSE_UPDATE_USER,
  API_ERROR_CODE,
  API_RESPONSE_RESEND_OTP,
  API_RESPONSE_RESET_PASSWORD,
  API_RESPONSE_IDENTITY_EXIST,
  API_RESPONSE_CREATE_IDENTITY,
  API_CREATE_IDENTITY_BODY,
  API_RESPONSE_SUCCESS,
} from "./api-types";
import { createSupabaseBrowserClient } from "../../lib/supabase/supabase";
import type {
  MajikContact,
  MajikMessageAccountID,
} from "@majikah/majik-message";
import { APIKeyManager } from "../../utils/api-manager";

/* ================================
 * Custom Error Types
 * ================================ */
export class MajikahAuthError extends Error {
  code: API_ERROR_CODE;
  statusCode?: number;

  constructor(message: string, code: API_ERROR_CODE, statusCode?: number) {
    super(message);
    this.name = "MajikahAuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class EmailNotConfirmedError extends MajikahAuthError {
  email: string;
  requiresOTP: true;

  constructor(message: string, email: string) {
    super(message, "EMAIL_NOT_CONFIRMED", 403);
    this.name = "EmailNotConfirmedError";
    this.email = email;
    this.requiresOTP = true;
  }
}

export class MajikMessageError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = "MajikMessageError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/* ================================
 * Session Class
 * ================================ */
export class MajikahSession {
  private user_data: MajikUser | null = null;
  private is_authenticated: boolean = false;
  private user_session: Session | null = null;

  private api_endpoint: AxiosInstance;

  private autosaveTimer: number | null = null;
  private autosaveIntervalMs = 15000;
  private autosaveDebounceMs = 500;
  private autosaveIntervalId: number | null = null;

  private supabase = createSupabaseBrowserClient();
  private authSubscription: Subscription | null = null;

  private refreshPromise: Promise<MajikUser> | null = null;
  private abortController: AbortController | null = null;

  private lastRefresh: number | null = null; // timestamp in ms
  private userUpdatedSinceRefresh: boolean = false;

  /* ================================
   * Handlers / UI Hooks (Optional)
   * ================================ */
  private passwordRecoveryHandler?: (email: string) => Promise<string | null>;
  private notifyHandler?: (message: string, type?: "success" | "error") => void;

  constructor(user?: MajikUserJSON, session?: Session) {
    this.user_data = user ? MajikUser.fromJSON(user) : null;
    this.user_session = session || null;
    this.is_authenticated = !!session;

    this.api_endpoint = axios.create({
      baseURL: `https://api.majikah.solutions`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    this.setupAxiosInterceptors();

    this.attachSupabaseAuthListener();
  }

  /* ================================
   * Getters
   * ================================ */
  get isAuthenticated(): boolean {
    return this.is_authenticated;
  }

  get user(): MajikUser | null {
    return this.user_data;
  }

  get session(): Session | null {
    return this.user_session;
  }

  get apiClient(): AxiosInstance {
    return this.api_endpoint;
  }

  /* ================================
   * Axios Setup
   * ================================ */
  private setupAxiosInterceptors(): void {
    // Request interceptor
    this.api_endpoint.interceptors.request.use(async (config) => {
      const { data } = await this.supabase.auth.getSession();

      if (data.session?.access_token) {
        config.headers.Authorization = `Bearer ${data.session.access_token}`;
      }

      const manager = APIKeyManager.initialize(import.meta.env.VITE_API_KEY!);
      const securedAPIKey = manager.encodeAPI();

      if (import.meta.env.VITE_API_KEY) {
        config.headers["X-API-KEY"] = securedAPIKey;
      }

      return config;
    });

    // Response interceptor for handling errors
    this.api_endpoint.interceptors.response.use(
      (response) => response,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (axiosError: AxiosError<any>) => {
        const data = axiosError.response?.data;

        if (data?.error) {
          throw {
            code: data.code,
            message: data.message,
            requiresOTP: data.requiresOTP,
            email: data.email,
            status: axiosError.response?.status,
          };
        }

        throw axiosError;
      },
    );
  }

  private require(value: unknown, name: string): void {
    if (!value || (typeof value === "string" && !value.trim())) {
      throw new MajikMessageError(`${name} is required`, "MISSING_FIELDS", 400);
    }
  }

  /**
   * Refresh the currently authenticated user's data from the API
   * GET /api/users/:id
   */
  async refreshUserData(): Promise<MajikUser> {
    if (!this.isAuthenticated) {
      throw new MajikahAuthError(
        "User must be authenticated to refresh profile",
        "INVALID_CREDENTIALS",
        401,
      );
    }

    const id = this.user_data?.id;

    if (!id?.trim()) {
      throw new MajikahAuthError(
        "User ID is required to refresh user data",
        "USER_NOT_FOUND",
        400,
      );
    }

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    // Skip refresh if last refresh was <5min ago AND user hasn't been updated
    if (
      this.lastRefresh &&
      now - this.lastRefresh < fiveMinutes &&
      !this.userUpdatedSinceRefresh
    ) {
      return this.user_data!;
    }

    // Return existing promise if refresh is in progress
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        // Abort previous request if any
        if (this.abortController) {
          this.abortController.abort();
        }
        this.abortController = new AbortController();

        const response = await this.api_endpoint.get<MajikUserJSON>(
          `/users/${id}`,
          {
            signal: this.abortController.signal,
          },
        );

        const freshUser = MajikUser.fromJSON(response.data);
        this.user_data = freshUser;
        this.lastRefresh = Date.now();
        this.userUpdatedSinceRefresh = false;
        await this.saveState();

        return freshUser;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        // Ignore abort errors (they are expected if a new refresh starts)
        if (err.name === "AbortError") {
          console.warn("Refresh request aborted, returning last user data.");
          return this.user_data!;
        }
        console.error("Failed to refresh user data:", err);
        throw err;
      } finally {
        this.refreshPromise = null;
        this.abortController = null;
      }
    })();

    return this.refreshPromise;
  }

  /* ================================
   * Authentication Methods
   * ================================ */

  /**
   * Sign in with email and password
   * POST /api/users/signin
   * @throws {EmailNotConfirmedError} If email confirmation is required
   * @throws {MajikahAuthError} On other authentication errors
   */
  async signIn(
    credentials: API_SUPABASE_SIGN_IN_BODY,
  ): Promise<API_RESPONSE_SIGN_IN> {
    try {
      console.log("Signing in...");
      const response = await this.api_endpoint.post<
        API_RESPONSE_SIGN_IN | API_RESPONSE_SIGN_IN_ERROR_EMAIL_NOT_CONFIRMED
      >("/users/signin", credentials);

      // Check if email confirmation is required
      if ("requiresOTP" in response.data && response.data.requiresOTP) {
        // Automatically resend OTP
        await this.resendOTP(response.data.email);

        throw new EmailNotConfirmedError(
          response.data.message,
          response.data.email,
        );
      }

      const authResponse = response.data as API_RESPONSE_SIGN_IN;

      if (!authResponse.session) {
        throw new MajikahAuthError(
          "No session returned from sign in",
          "SIGN_IN_FAILED",
          500,
        );
      }

      await this.setAuthData(authResponse.user, authResponse.session);
      return authResponse;
    } catch (error) {
      console.error("Sign in failed:", error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   * POST /api/users
   */
  async signUp(
    credentials: API_SUPABASE_SIGN_UP_BODY,
  ): Promise<API_RESPONSE_SIGN_UP> {
    try {
      const response = await this.api_endpoint.post<API_RESPONSE_SIGN_UP>(
        "/users",
        credentials,
      );

      // If session exists, user is immediately authenticated
      if (response.data.session) {
        await this.setAuthData(response.data.user, response.data.session);
      }

      return response.data;
    } catch (error) {
      console.error("Sign up failed:", error);
      throw error;
    }
  }

  /**
   * Sign in with Google OAuth
   * POST /api/users/signin/google
   */
  async signInWithGoogle(
    body: API_SUPABASE_GOOGLE_SIGN_IN_BODY,
  ): Promise<API_RESPONSE_GOOGLE_SIGN_IN> {
    try {
      const response =
        await this.api_endpoint.post<API_RESPONSE_GOOGLE_SIGN_IN>(
          "/users/signin/google",
          body,
        );

      if (!response.data.session) {
        throw new MajikahAuthError(
          "No session returned from Google sign in",
          "GOOGLE_SIGN_IN_FAILED",
          500,
        );
      }

      await this.setAuthData(response.data.user, response.data.session);
      return response.data;
    } catch (error) {
      console.error("Google sign in failed:", error);
      throw error;
    }
  }

  /**
   * Verify OTP code for email confirmation
   * POST /api/users/verify-otp
   */
  async verifyOTP(
    body: API_SUPABASE_VERIFY_OTP_BODY,
  ): Promise<API_RESPONSE_VERIFY_OTP> {
    try {
      const response = await this.api_endpoint.post<API_RESPONSE_VERIFY_OTP>(
        "/users/verify-otp",
        body,
      );

      if (!response.data.session) {
        throw new MajikahAuthError(
          "No session returned from OTP verification",
          "OTP_VERIFICATION_FAILED",
          500,
        );
      }

      await this.setAuthData(response.data.user, response.data.session);
      return response.data;
    } catch (error) {
      console.error("OTP verification failed:", error);
      throw error;
    }
  }

  /* ================================
   * Resend OTP
   * POST /api/users/otp
   * ================================ */
  async resendOTP(email: string): Promise<string> {
    if (!email?.trim()) {
      throw new MajikahAuthError(
        "Email is required to resend OTP",
        "MISSING_FIELDS",
        400,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new MajikahAuthError("Invalid email address", "INVALID_EMAIL", 400);
    }

    try {
      const response = await this.api_endpoint.post<API_RESPONSE_RESEND_OTP>(
        "/users/otp",
        {
          email,
        },
      );
      return response.data.message;
    } catch (err) {
      console.error("Resend OTP failed:", err);
      throw new MajikahAuthError(
        "Failed to resend OTP. Please try again.",
        "RESEND_OTP_FAILED",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.status || 500,
      );
    }
  }

  /**
   * Trigger a password reset email
   * POST /api/users/reset-password
   */
  async resetPassword(email: string): Promise<string> {
    if (!email?.trim()) {
      throw new MajikahAuthError(
        "Email is required to reset password",
        "MISSING_FIELDS",
        400,
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new MajikahAuthError("Invalid email address", "INVALID_EMAIL", 400);
    }

    try {
      const response =
        await this.api_endpoint.post<API_RESPONSE_RESET_PASSWORD>(
          "/users/reset-password",
          { email },
        );
      return response.data.message;
    } catch (err) {
      console.error("Reset password failed:", err);
      throw new MajikahAuthError(
        "Failed to send password reset email. Please try again.",
        "RESET_PASSWORD_FAILED",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.status || 500,
      );
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      // Supabase handles signout via the client SDK
      await this.supabase.auth.signOut();
    } catch (error) {
      console.warn("Backend signout failed:", error);
    } finally {
      console.warn("Signing out. Clearing Session");
      this.is_authenticated = false;
      this.clearAuthData();
      store.dispatch(clearSession());
    }
  }

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  async deleteUserData(): Promise<API_RESPONSE_SUCCESS> {
    if (!this.is_authenticated) {
      throw new MajikahAuthError(
        "User must be authenticated to delete profile",
        "INVALID_CREDENTIALS",
        401,
      );
    }
    this.require(this.user?.id, "User ID");
    try {
      const response = await this.api_endpoint.delete<API_RESPONSE_SUCCESS>(
        `/users/${this.user!.id}`,
      );

      if (!response.data.success) {
        throw new MajikahAuthError(
          "Failed to delete user. Please try again.",
          "INTERNAL_ERROR",
          500,
        );
      }

      await this.signOut();
      return response.data;
    } catch (error) {
      console.error("User Data Deletion failed:", error);
      throw error;
    }
  }

  /* ================================
   * User Data Management
   * ================================ */

  /**
   * Load user profile by ID
   * GET /api/users/:id
   */
  async loadUserProfile(userId?: string): Promise<MajikUser | null> {
    const id = userId || this.user_data?.id;

    if (!id) {
      throw new MajikahAuthError(
        "User ID is required to load profile",
        "USER_NOT_FOUND",
        400,
      );
    }

    try {
      const response = await this.api_endpoint.get<MajikUserJSON>(
        `/users/${id}`,
      );

      // Only update current user if loading own profile
      if (id === this.user_data?.id) {
        this.user_data = MajikUser.fromJSON(response.data);
        await this.saveState();
      }

      return MajikUser.fromJSON(response.data);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      throw error;
    }
  }

  /**
   * Update user profile by ID
   * PUT /api/users/:id
   */
  async updateUserProfile(
    updates: Partial<MajikUserJSON>,
  ): Promise<API_RESPONSE_UPDATE_USER> {
    if (!this.is_authenticated || !this.user) {
      throw new MajikahAuthError(
        "User must be authenticated to update profile",
        "INVALID_CREDENTIALS",
        401,
      );
    }

    const id = this.user_data?.id;

    if (!id?.trim()) {
      throw new MajikahAuthError(
        "User ID is required to update profile",
        "USER_NOT_FOUND",
        400,
      );
    }

    try {
      // Merge updates with existing user data
      const updatedData: MajikUserJSON = { ...this.user.toJSON(), ...updates };

      const response = await this.api_endpoint.put<API_RESPONSE_UPDATE_USER>(
        `/users/${id}`,
        updatedData,
      );

      // Only update current user if updating own profile
      if (id === this.user_data?.id) {
        this.user_data = MajikUser.fromJSON(response.data.data);
        this.userUpdatedSinceRefresh = true;
        this.lastRefresh = null;

        await this.saveState();
      }

      return response.data;
    } catch (error) {
      console.error("Failed to update user profile:", error);
      throw error;
    }
  }

  /* ================================
   * Internal Auth Data Management
   * ================================ */
  private async setAuthData(
    user: MajikUserJSON,
    session: Session,
  ): Promise<void> {
    const { error } = await this.supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (error) throw error;

    this.user_data = MajikUser.fromJSON(user);
    this.user_session = session;
    this.is_authenticated = true;

    await this.supabase.auth.getSession();

    await this.saveState();
    this.attachAutosaveHandlers();
  }

  private clearAuthData(): void {
    this.user_data = null;
    this.user_session = null;
    this.is_authenticated = false;

    this.stopAutosave();
  }

  private attachSupabaseAuthListener(): void {
    if (this.authSubscription) return;

    const { data } = this.supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!session) {
          console.warn("No session found in auth listener");
          this.clearAuthData();
          store.dispatch(clearSession());
          return;
        }

        this.user_session = session;

        const email = this.user_data?.email ?? session.user?.email;

        // Handle password recovery
        if (
          event === "PASSWORD_RECOVERY" &&
          this.passwordRecoveryHandler &&
          email
        ) {
          try {
            // Call external handler to get new password
            const newPassword = await this.passwordRecoveryHandler(email);
            if (newPassword?.trim()) {
              const { error } = await this.supabase.auth.updateUser({
                password: newPassword,
              });
              if (error) {
                this.notifyHandler?.(
                  `Failed to update password: ${error.message}`,
                  "error",
                );
              } else {
                this.notifyHandler?.(
                  "Password updated successfully!",
                  "success",
                );
              }
            } else {
              this.notifyHandler?.("Password reset canceled.", "error");
            }
          } catch (err) {
            console.error("Password recovery failed:", err);
            this.notifyHandler?.(
              "Password recovery failed. Please try again.",
              "error",
            );
          }
        }

        await this.saveState();
      },
    );

    this.authSubscription = data.subscription;
  }

  /**
   * Set external handlers for UI interactions
   */
  setPasswordRecoveryHandler(
    handler: (email: string) => Promise<string | null>,
  ): void {
    this.passwordRecoveryHandler = handler;
  }

  setNotifyHandler(
    handler: (message: string, type?: "success" | "error") => void,
  ): void {
    this.notifyHandler = handler;
  }

  /* ================================
   * Identity
   * ================================ */

  async identityExists(accountId: MajikMessageAccountID): Promise<boolean> {
    this.require(accountId, "Account ID");

    try {
      const res = await this.api_endpoint.get<API_RESPONSE_IDENTITY_EXIST>(
        `/identities/exists/${accountId}`,
      );
      return res.data.exists;
    } catch (err) {
      console.error("[GET] identityExists failed:", err);
      throw err;
    }
  }

  async createIdentity(
    account: MajikContact,
  ): Promise<API_RESPONSE_CREATE_IDENTITY> {
    const user = this.user;

    if (!user) {
      throw new MajikMessageError(
        "You must be authenticated to create an identity",
        "INVALID_USER_DATA",
        400,
      );
    }

    this.require(user?.id, "User ID");

    const validation = user.validate();
    if (!validation.isValid) {
      throw new MajikMessageError(
        validation.errors.join(", "),
        "INVALID_USER_DATA",
        400,
      );
    }

    try {
      const accountJSON = await account.toJSON();

      const body: API_CREATE_IDENTITY_BODY = {
        user_id: user.id,
        account: accountJSON,
      };

      const res = await this.api_endpoint.post<API_RESPONSE_CREATE_IDENTITY>(
        "/identities",
        body,
      );

      return res.data;
    } catch (err) {
      console.error("[POST] createIdentity failed:", err);
      throw err;
    }
  }

  /* ================================
   * Persistence
   * ================================ */
  private attachAutosaveHandlers(): void {
    if (typeof window !== "undefined") {
      try {
        window.addEventListener("beforeunload", () => {
          void this.saveState();
        });
      } catch (error) {
        console.warn("Failed to attach beforeunload handler:", error);
      }
      this.startAutosave();
    }
  }

  startAutosave(): void {
    if (this.autosaveIntervalId) return;
    if (typeof window === "undefined") return;

    this.autosaveIntervalId = window.setInterval(() => {
      void this.saveState();
    }, this.autosaveIntervalMs) as unknown as number;
  }

  stopAutosave(): void {
    if (!this.autosaveIntervalId) return;
    if (typeof window !== "undefined") {
      window.clearInterval(this.autosaveIntervalId);
    }
    this.autosaveIntervalId = null;
  }

  private scheduleAutosave(): void {
    try {
      if (this.autosaveTimer) {
        if (typeof window !== "undefined")
          window.clearTimeout(this.autosaveTimer);
        this.autosaveTimer = null;
      }
      if (typeof window !== "undefined") {
        this.autosaveTimer = window.setTimeout(() => {
          void this.saveState();
          this.autosaveTimer = null;
        }, this.autosaveDebounceMs) as unknown as number;
      }
    } catch (error) {
      console.warn("Failed to schedule autosave:", error);
    }
  }

  async saveState(): Promise<void> {
    try {
      if (!this.user || !this.session) return;

      store.dispatch(setUserData(this.user.toJSON()));
      store.dispatch(setSession(this.session));
    } catch (err) {
      console.error("Failed to save MajikahSession state:", err);
    }
  }

  async loadState(): Promise<void> {
    try {
      const state = store.getState();
      const userData = state.userData.user;
      const sessionData = state.userData.session;

      if (!userData || !sessionData) {
        return;
      }

      this.user_data = MajikUser.fromJSON(userData);
      this.user_session = sessionData;
      this.is_authenticated = !!sessionData;

      this.scheduleAutosave();
    } catch (err) {
      console.error("Failed to load MajikahSession state:", err);
    }
  }

  /**
   * Initialize session from persisted state or create new
   */
  static async initialize(): Promise<MajikahSession> {
    try {
      const state = store.getState();
      const userData = state.userData.user;
      const sessionData = state.userData.session;

      if (!!userData && !!sessionData) {
        const restored = new MajikahSession(userData, sessionData);
        console.log("Account loaded successfully");
        restored.attachAutosaveHandlers();
        return restored;
      }
    } catch (err) {
      console.warn("Error trying to load saved MajikahSession state:", err);
    }

    const created = new MajikahSession();
    return created;
  }

  /* ================================
   * Cleanup
   * ================================ */
  destroy(): void {
    this.stopAutosave();

    if (this.autosaveTimer && typeof window !== "undefined") {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
  }
}
