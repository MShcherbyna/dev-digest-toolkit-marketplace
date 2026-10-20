import { canGoBack, homeHref } from '../router';

/** Returns to the previous in-app page (search keeps its query); a deep link has none, so it goes home. */
export function BackButton({ label }: { label: string }) {
  const onClick = (ev: MouseEvent) => {
    if (canGoBack()) {
      ev.preventDefault();
      history.back();
    }
  };
  return (
    <a class="back" href={homeHref()} onClick={onClick}>
      {label}
    </a>
  );
}
