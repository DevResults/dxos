//
// Copyright 2022 DXOS.org
//

import { describe, expect, test } from 'vitest';

import { Client } from '@dxos/client';
import { Expando } from '@dxos/echo-schema';
import { create } from '@dxos/live-object';
import { faker } from '@dxos/random';

import { filterObjectsSync } from './search-sync';

faker.seed(1);

// TODO(burdon): Reconcile with agent/minisearch.

describe('Search', () => {
  test('Prefix text search', async () => {
    const client = new Client();
    await client.initialize();
    await client.halo.createIdentity();

    const match = 'xxx';
    const space = await client.spaces.create();
    Array.from({ length: 20 }).map((_, i) => {
      const content =
        i === 10 ? faker.lorem.sentence() + ` ${match}}. ` + faker.lorem.sentence() : faker.lorem.sentences();
      return space.db.add(create(Expando, { title: faker.lorem.sentence(), content }));
    });

    const { objects } = await space.db.query().run();
    const results = filterObjectsSync(objects, new RegExp(match, 'i'));
    expect(results).to.have.length(1);
  });
});
