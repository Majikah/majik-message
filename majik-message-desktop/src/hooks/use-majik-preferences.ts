import {
  addPreference,
  clearPreferences,
  ReduxSystemRootState,
  removePreference,
  setPreferences,
} from "@/redux/slices/system";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

export function useMajikPreferences() {
  const dispatch = useDispatch();

  const preferences = useSelector(
    (state: ReduxSystemRootState) => state.system?.preferences || [],
  );
  /**
   * Checker: Returns true if the specific preference exists.
   * O(n) lookup via .includes(), which is perfectly fine for UI flag arrays.
   */
  const hasPreference = useCallback(
    (pref: string): boolean => {
      return preferences.includes(pref);
    },
    [preferences],
  );

  /**
   * Adds a single preference if it doesn't exist.
   */
  const add = useCallback(
    (pref: string) => {
      dispatch(addPreference(pref));
    },
    [dispatch],
  );

  /**
   * Removes a single preference.
   */
  const remove = useCallback(
    (pref: string) => {
      dispatch(removePreference(pref));
    },
    [dispatch],
  );

  /**
   * Toggles a preference on or off automatically.
   */
  const toggle = useCallback(
    (pref: string) => {
      if (preferences.includes(pref)) {
        dispatch(removePreference(pref));
      } else {
        dispatch(addPreference(pref));
      }
    },
    [dispatch, preferences],
  );

  /**
   * Bulk overrides/merges an array of preferences.
   */
  const setAll = useCallback(
    (prefs: string[]) => {
      dispatch(setPreferences(prefs));
    },
    [dispatch],
  );

  /**
   * Wipes all volatile preferences.
   */
  const clearAll = useCallback(() => {
    dispatch(clearPreferences());
  }, [dispatch]);

  // Return the raw array, the checker, and all mutation methods
  return {
    items: preferences,
    hasPreference,
    add,
    remove,
    toggle,
    setAll,
    clearAll,
  };
}
