import { TitleText } from '../components/TitleText';
import { DiscoveredSimulatorCards } from '../components/DiscoveredSimulatorCards';
import { ManualKitchenControls } from '../components/ManualKitchenControls';
import { VirtualTime } from '../components/VirtualTime';
import { defineComponent, defineView, defineViewSlot } from '../core/component-system';
import { timeJumps } from '../domain/time';
import { createAlignedContentView } from './layout/aligned-content.view';
import { createCardGridView } from './layout/card-grid.view';
import { createThreeSegmentRowView } from './layout/three-segment-row.view';

const titleSlot = defineComponent({
  id: 'page-layout.header.title',
  component: TitleText,
  inject: () => ({
    text: 'Simulator'
  })
});

const headerLeftView = createAlignedContentView({
  id: 'page-layout.header.left-content',
  align: 'left',
  ariaLabel: 'Header title',
  slots: [titleSlot]
});

const headerRowView = createThreeSegmentRowView({
  id: 'page-layout.header.row',
  ariaLabel: 'Header layout',
  left: [
    defineViewSlot({
      id: 'page-layout.header.left-view-slot',
      view: headerLeftView
    })
  ],
  center: [],
  right: []
});

const headerRowSlot = defineViewSlot({
  id: 'page-layout.header.row-slot',
  view: headerRowView
});

const discoveredSimulatorCardsSlot = defineComponent({
  id: 'page-layout.cards.discovered',
  component: DiscoveredSimulatorCards,
  inject: ({ bus, virtualTime, virtualDevices }) => ({
    bus,
    time: virtualTime,
    virtualDevices
  })
});

const manualKitchenControlsSlot = defineComponent({
  id: 'page-layout.cards.manual-kitchen-controls',
  component: ManualKitchenControls,
  inject: ({ virtualDevices }) => ({
    virtualDevices
  })
});

const virtualTimeSlot = defineComponent({
  id: 'page-layout.cards.virtual-time',
  component: VirtualTime,
  inject: ({ virtualTime }) => ({
    id: 'virtual-time',
    title: 'Virtual time',
    time: virtualTime,
    jumps: timeJumps
  })
});

const cardGridView = createCardGridView({
  id: 'page-layout.cards',
  ariaLabel: 'Simulator cards',
  slots: [
    discoveredSimulatorCardsSlot,
    virtualTimeSlot,
    manualKitchenControlsSlot
  ]
});

const cardGridSlot = defineViewSlot({
  id: 'page-layout.cards.slot',
  view: cardGridView
});

export const pageLayoutView = defineView({
  id: 'page-layout',
  className: 'page-layout',
  ariaLabel: 'Mini service simulator',
  regions: [
    {
      id: 'header',
      element: 'header',
      className: 'page-layout__header',
      innerClassName: 'workspace',
      ariaLabel: 'Page header',
      slots: [headerRowSlot]
    },
    {
      id: 'content',
      element: 'main',
      className: 'page-layout__content',
      innerClassName: 'workspace',
      ariaLabel: 'Page content',
      slots: [cardGridSlot]
    }
  ]
});
