import {
  addTutorial,
  clearTutorial,
  ReduxSystemRootState,
  removeTutorial,
  setTutorials,
} from "@/redux/slices/system";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

export function useMajikTutorials() {
  const dispatch = useDispatch();

  const tutorials = useSelector(
    (state: ReduxSystemRootState) => state.system?.tutorials || [],
  );
  /**
   * Checker: Returns true if the specific tuterence exists.
   * O(n) lookup via .includes(), which is perfectly fine for UI flag arrays.
   */
  const hasTutorial = useCallback(
    (tut: string): boolean => {
      return tutorials.includes(tut);
    },
    [tutorials],
  );

  /**
   * Adds a single tuterence if it doesn't exist.
   */
  const add = useCallback(
    (tut: string) => {
      dispatch(addTutorial(tut));
    },
    [dispatch],
  );

  /**
   * Removes a single tuterence.
   */
  const remove = useCallback(
    (tut: string) => {
      dispatch(removeTutorial(tut));
    },
    [dispatch],
  );

  /**
   * Toggles a tuterence on or off automatically.
   */
  const toggle = useCallback(
    (tut: string) => {
      if (tutorials.includes(tut)) {
        dispatch(removeTutorial(tut));
      } else {
        dispatch(addTutorial(tut));
      }
    },
    [dispatch, tutorials],
  );

  /**
   * Bulk overrides/merges an array of tutorials.
   */
  const setAll = useCallback(
    (tuts: string[]) => {
      dispatch(setTutorials(tuts));
    },
    [dispatch],
  );

  /**
   * Wipes all volatile tutorials.
   */
  const clearAll = useCallback(() => {
    dispatch(clearTutorial());
  }, [dispatch]);

  // Return the raw array, the checker, and all mutation methods
  return {
    items: tutorials,
    hasTutorial,
    add,
    remove,
    toggle,
    setAll,
    clearAll,
  };
}
