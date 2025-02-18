import React from 'react';

import { Capabilities, contributes, createSurface } from '@dxos/app-framework';

import { HELLO_WORLD_PLUGIN } from '../meta';

export default () =>
  contributes(Capabilities.ReactSurface, [
    createSurface({
      id: `${HELLO_WORLD_PLUGIN}/hello`,
      role: ['article', 'section', 'slide'],
      filter: (data): data is any => {
        console.log(data);
        return true;
      },
      component: ({ data, role }) => <>Hello World from {role}</>,
    }),
  ]);
