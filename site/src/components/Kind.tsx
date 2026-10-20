import type { Kind } from '../types';
import { useT } from '../i18n';

export const KindBadge = ({ kind }: { kind: Kind }) => <span class={`badge kind-${kind}`}>{useT().kindBadge[kind]}</span>;

export const KindDot = ({ kind }: { kind: Kind }) => <span class={`dot kind-${kind}`} aria-hidden="true" />;
