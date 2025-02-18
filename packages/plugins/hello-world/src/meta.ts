import { type PluginMeta } from '@dxos/app-framework';

export const HELLO_WORLD_PLUGIN = 'example.com/plugin/hello-world';

export const meta = {
  id: HELLO_WORLD_PLUGIN,
  name: 'Hello World',
  description: 'Says Hello.',
  icon: 'ph--table--regular',
  source: 'https://github.com/DevResults/dxos/tree/hello-world/packages/plugins/hello-world',
} satisfies PluginMeta;
