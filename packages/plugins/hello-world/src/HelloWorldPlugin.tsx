import { definePlugin, defineModule, Events } from '@dxos/app-framework';

import { IntentResolver, ReactSurface } from './capabilities';
import { meta } from './meta';

export const HelloWorldPlugin = () =>
  definePlugin(meta, [
    defineModule({
      id: `${meta.id}/module/react-surface`,
      activatesOn: Events.SetupSurfaces,
      activate: ReactSurface,
    }),
    defineModule({
      id: `${meta.id}/module/intent-resolver`,
      activatesOn: Events.SetupIntents,
      activate: IntentResolver,
    }),
  ]);
