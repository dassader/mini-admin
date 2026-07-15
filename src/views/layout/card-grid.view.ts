import {
  defineView,
  type ComponentSlot,
  type ViewDefinition
} from '../../core/component-system';

type CardGridViewInput = {
  id: string;
  slots: ComponentSlot[];
  ariaLabel?: string;
};

export function createCardGridView({
  id,
  slots,
  ariaLabel
}: CardGridViewInput): ViewDefinition {
  return defineView({
    id,
    className: 'card-grid',
    ariaLabel,
    slots
  });
}
