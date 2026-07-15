import {
  defineView,
  type ComponentSlot,
  type ViewDefinition
} from '../../core/component-system';

type ThreeSegmentRowViewInput = {
  id: string;
  left: ComponentSlot[];
  center: ComponentSlot[];
  right: ComponentSlot[];
  ariaLabel?: string;
};

export function createThreeSegmentRowView({
  id,
  left,
  center,
  right,
  ariaLabel
}: ThreeSegmentRowViewInput): ViewDefinition {
  return defineView({
    id,
    className: 'three-segment-row',
    ariaLabel,
    regions: [
      {
        id: `${id}.left`,
        className: 'three-segment-row__segment',
        slots: left
      },
      {
        id: `${id}.center`,
        className: 'three-segment-row__segment',
        slots: center
      },
      {
        id: `${id}.right`,
        className: 'three-segment-row__segment',
        slots: right
      }
    ]
  });
}
