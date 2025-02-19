//
// Copyright 2022 DXOS.org
//

import '@dxos-theme';

import { Tag } from './Tag';
import { withTheme } from '../../testing';

export default {
  title: 'ui/react-ui-core/Tag',
  component: Tag,
  decorators: [withTheme],
  parameters: { chromatic: { disableSnapshot: false } },
  argTypes: {
    palette: {
      control: 'select',
      options: [
        'neutral',
        'success',
        'info',
        'warning',
        'error',
        'red',
        'orange',
        'amber',
        'yellow',
        'lime',
        'green',
        'emerald',
        'teal',
        'cyan',
        'sky',
        'blue',
        'indigo',
        'violet',
        'purple',
        'fuchsia',
        'pink',
        'rose',
      ],
    },
  },
} as any;

export const Default = { args: { children: 'Hello', palette: 'success' } };
