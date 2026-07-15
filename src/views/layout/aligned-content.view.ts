import {
  defineView,
  type ComponentSlot,
  type ViewDefinition
} from '../../core/component-system';

export type ContentAlignment = 'left' | 'center' | 'right';

type AlignedContentViewInput = {
  id: string;
  align: ContentAlignment;
  slots: ComponentSlot[];
  ariaLabel?: string;
};

export function createAlignedContentView({
  id,
  align,
  slots,
  ariaLabel
}: AlignedContentViewInput): ViewDefinition {
  return defineView({
    id,
    className: `aligned-content aligned-content--${align}`,
    ariaLabel,
    slots
  });
}
