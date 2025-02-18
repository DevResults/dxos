//
// Copyright 2025 DXOS.org
//

import { contributes, Capabilities, type PluginsContext } from '@dxos/app-framework';
import { createExtension, type Node } from '@dxos/plugin-graph';

import { HELLO_WORLD_PLUGIN } from '../meta';

export default (context: PluginsContext) => {
  return contributes(Capabilities.AppGraphBuilder, [
    // trying to make a button in the layout
    createExtension({
      id: HELLO_WORLD_PLUGIN,
      filter: (node): node is Node<null> => node.id === 'root',
      connector: () => [
        {
          id: 'example.com.plugin.hello-world',
          data: { greeting: 'Hello', subject: 'World' },
          type: HELLO_WORLD_PLUGIN,
          properties: {
            label: ['hello label', { ns: HELLO_WORLD_PLUGIN }],
            disposition: 'navigation',
            icon: 'ph--envelope--regular',
          },
        },
      ],
    }),
  ]);
};
