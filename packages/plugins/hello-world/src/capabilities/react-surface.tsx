import React from 'react';

import { Capabilities, contributes, createSurface } from '@dxos/app-framework';

import { HELLO_WORLD_PLUGIN } from '../meta';

export default () =>
  contributes(Capabilities.ReactSurface, [
    createSurface({
      id: `${HELLO_WORLD_PLUGIN}/hello`,
      role: ['article', 'section', 'slide'],
      filter: (data): data is any => true, // needs to filter better to only ever show greeting
      component: ({ data, role }) => {
        const { greeting, subject } = data.subject ?? {};
        return (
          <>
            <div>
              hello-world plugin showing with role: {role}
              <hr />
              data: {greeting && subject ? `${greeting} ${subject}!` : "I don't know what to show here"}
            </div>
          </>
        );
      },
    }),
  ]);
