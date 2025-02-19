//
// Copyright 2022 DXOS.org
//

import '@dxos-theme';

import { Link } from './Link';
import { withTheme } from '../../testing';

export default {
  title: 'ui/react-ui-core/Link',
  component: Link,
  decorators: [withTheme],
  parameters: { chromatic: { disableSnapshot: false } },
} as any;

export const Default = { args: { children: 'Hello', href: '#' } };
