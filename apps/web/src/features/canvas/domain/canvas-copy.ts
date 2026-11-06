import type { BlockFamily, BlockKind } from "@donordesk/domain/contexts/canvas/index.js";
import type { MessageKey } from "@/features/i18n/messages/en.ts";

/** The message keys for a block and a group of blocks. The catalogue is typed, so a block with no name in every language does not compile. */
export const blockLabelKey = (kind: BlockKind): MessageKey => `canvas.block.${kind}` as MessageKey;
export const familyLabelKey = (family: BlockFamily): MessageKey => `canvas.family.${family}` as MessageKey;
