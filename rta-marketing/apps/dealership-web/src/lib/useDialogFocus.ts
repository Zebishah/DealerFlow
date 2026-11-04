import { useEffect, useRef, type RefObject } from "react";

const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus(
  ref: RefObject<HTMLElement>,
  open: boolean,
  { onClose, dismissible = true, initialFocusRef, returnFocusRef }: {
    onClose(): void;
    dismissible?: boolean;
    initialFocusRef?: RefObject<HTMLElement>;
    returnFocusRef?: RefObject<HTMLElement>;
  },
) {
  const options = useRef({ onClose, dismissible, initialFocusRef, returnFocusRef });
  useEffect(() => { options.current = { onClose, dismissible, initialFocusRef, returnFocusRef }; }, [onClose, dismissible, initialFocusRef, returnFocusRef]);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const background: Array<{ element: HTMLElement; inert: boolean }> = [];
    // Make everything outside this dialog unavailable to pointer and keyboard users.
    let branch: HTMLElement = dialog.closest<HTMLElement>(".modal-layer") ?? dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch && !sibling.contains(dialog) && !sibling.hasAttribute("data-dialog-backdrop")) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      (options.current.initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(focusableSelector) ?? dialog).focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && options.current.dismissible) {
        event.preventDefault();
        event.stopPropagation();
        options.current.onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog!.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog!.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog!.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog!.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      for (const { element, inert } of background) element.inert = inert;
      document.body.style.overflow = previousOverflow;
      const returnFocus = options.current.returnFocusRef?.current ?? previousFocus;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [open, ref]);
}
