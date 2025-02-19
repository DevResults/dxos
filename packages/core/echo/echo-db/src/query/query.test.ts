//
// Copyright 2022 DXOS.org
//

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, onTestFinished, test } from 'vitest';

import { asyncTimeout, sleep, Trigger } from '@dxos/async';
import { type AutomergeUrl } from '@dxos/automerge/automerge-repo';
import { type SpaceDoc } from '@dxos/echo-protocol';
import { Expando, RelationSourceId, RelationTargetId, S, TypedObject, type Ref } from '@dxos/echo-schema';
import { Contact, HasManager } from '@dxos/echo-schema/testing';
import { PublicKey } from '@dxos/keys';
import { createTestLevel } from '@dxos/kv-store/testing';
import { create, getMeta, makeRef } from '@dxos/live-object';
import { QueryOptions } from '@dxos/protocols/proto/dxos/echo/filter';
import { openAndClose } from '@dxos/test-utils';
import { range } from '@dxos/util';

import { Filter } from './filter';
import { type ReactiveEchoObject, getObjectCore } from '../echo-handler';
import { type EchoDatabase } from '../proxy-db';
import { EchoTestBuilder, type EchoTestPeer } from '../testing';

const createTestObject = (idx: number, label?: string) => {
  return create(Expando, { idx, title: `Task ${idx}`, label });
};

describe('Queries', () => {
  let builder: EchoTestBuilder;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
  });

  afterEach(async () => {
    await builder.close();
  });

  describe('Query with different filters', () => {
    let db: EchoDatabase;

    beforeEach(async () => {
      const setup = await builder.createDatabase();
      db = setup.db;

      const objects = [createTestObject(9)]
        .concat(range(3).map((idx) => createTestObject(idx, 'red')))
        .concat(range(2).map((idx) => createTestObject(idx + 3, 'green')))
        .concat(range(4).map((idx) => createTestObject(idx + 5, 'blue')));

      for (const object of objects) {
        db.add(object);
      }

      await db.flush({ indexes: true });
    });

    test('filter properties', async () => {
      {
        const { objects } = await db.query().run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects, results } = await db.query({ label: undefined }).run();
        expect(objects).to.have.length(1);

        // TODO(dmaretskyi): 2 hits: one local one from index, we should dedup those.
        expect(results).to.have.length(2);
        expect(results.every((result) => result.id === objects[0].id)).to.be.true;

        expect(results[0].object).to.eq(objects[0]);
        expect(results[0].id).to.eq(objects[0].id);
        expect(results[0].spaceKey).to.eq(db.spaceKey);
      }

      {
        const { objects } = await db.query({ label: 'red' }).run();
        expect(objects).to.have.length(3);
      }

      {
        const { objects } = await db.query({ label: 'pink' }).run();
        expect(objects).to.have.length(0);
      }
    });

    test('filter expando', async () => {
      const { objects } = await db.query(Filter.schema(Expando, { label: 'red' })).run();
      expect(objects).to.have.length(3);
    });

    test('filter operators', async () => {
      {
        const { objects } = await db.query(() => false).run();
        expect(objects).to.have.length(0);
      }

      {
        const { objects } = await db.query(() => true).run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects } = await db
          .query((object: Expando) => object.label === 'red' || object.label === 'green')
          .run();
        expect(objects).to.have.length(5);
      }
    });

    test('filter by reference', async () => {
      const objA = db.add(create(Expando, { label: 'obj a' }));
      const objB = db.add(create(Expando, { label: 'obj b', ref: makeRef(objA) }));
      await db.flush({ indexes: true });

      const { objects } = await db.query(Filter.schema(Expando, { ref: objA })).run();
      expect(objects).toEqual([objB]);
    });

    test('filter by foreign keys', async () => {
      const obj = create(Expando, { label: 'has meta' });
      getMeta(obj).keys.push({ id: 'test-id', source: 'test-source' });
      db.add(obj);
      await db.flush({ indexes: true });

      const { objects } = await db.query(Filter.foreignKeys([{ id: 'test-id', source: 'test-source' }])).run();
      expect(objects).toEqual([obj]);
    });

    test('filter nothing', async () => {
      const { objects } = await db.query(Filter.nothing()).run();
      expect(objects).toHaveLength(0);
    });

    test('filter chaining', async () => {
      {
        // prettier-ignore
        const { objects } = await db.query([
        () => true,
        { label: 'blue' },
        (object: any) => object.idx > 6
      ]).run();
        expect(objects).to.have.length(2);
      }
    });

    test('options', async () => {
      {
        const { objects } = await db.query({ label: 'red' }).run();
        expect(objects).to.have.length(3);
        for (const object of objects) {
          db.remove(object);
        }
        await db.flush();
      }

      {
        const { objects } = await db.query().run();
        expect(objects).to.have.length(7);
      }

      {
        const { objects } = await db.query(undefined, { deleted: QueryOptions.ShowDeletedOption.HIDE_DELETED }).run();
        expect(objects).to.have.length(7);
      }

      {
        const { objects } = await db.query(undefined, { deleted: QueryOptions.ShowDeletedOption.SHOW_DELETED }).run();
        expect(objects).to.have.length(10);
      }

      {
        const { objects } = await db
          .query(undefined, { deleted: QueryOptions.ShowDeletedOption.SHOW_DELETED_ONLY })
          .run();
        expect(objects).to.have.length(3);
      }
    });
  });

  test('query.run() queries everything after restart', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    onTestFinished(async () => {
      await builder.close();
    });

    let root: AutomergeUrl;
    {
      const peer = await builder.createPeer(kv);
      const db = await peer.createDatabase(spaceKey);
      await createObjects(peer, db, { count: 3 });

      expect((await db.query().run()).objects.length).to.eq(3);
      root = db.coreDatabase._automergeDocLoader.getSpaceRootDocHandle().url;
    }

    {
      const peer = await builder.createPeer(kv);
      const db = await peer.openDatabase(spaceKey, root);
      expect((await db.query().run()).objects.length).to.eq(3);
    }
  });

  test('objects with incorrect document urls are ignored', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    onTestFinished(async () => {
      await builder.close();
    });

    let root: AutomergeUrl;
    let expectedObjectId: string;
    {
      const peer = await builder.createPeer(kv);
      const db = await peer.createDatabase(spaceKey);
      const [obj1, obj2] = await createObjects(peer, db, { count: 2 });

      expect((await db.query().run()).objects.length).to.eq(2);
      const rootDocHandle = db.coreDatabase._automergeDocLoader.getSpaceRootDocHandle();
      rootDocHandle.change((doc: SpaceDoc) => {
        doc.links![obj1.id] = 'automerge:4hjTgo9zLNsfRTJiLcpPY8P4smy';
      });
      await db.flush();
      root = rootDocHandle.url;
      expectedObjectId = obj2.id;
    }

    {
      const peer = await builder.createPeer(kv);
      const db = await peer.openDatabase(spaceKey, root);
      const queryResult = (await db.query().run()).objects;
      expect(queryResult.length).to.eq(1);
      expect(queryResult[0].id).to.eq(expectedObjectId);
    }
  });

  test('objects url changes, the latest document is loaded', async () => {
    const spaceKey = PublicKey.random();
    const builder = new EchoTestBuilder();
    onTestFinished(async () => {
      await builder.close();
    });

    const peer = await builder.createPeer();

    let root: AutomergeUrl;
    let assertion: { objectId: string; documentUrl: string };
    {
      const db = await peer.createDatabase(spaceKey);
      const [obj1, obj2] = await createObjects(peer, db, { count: 2 });

      expect((await db.query().run()).objects.length).to.eq(2);
      const rootDocHandle = db.coreDatabase._automergeDocLoader.getSpaceRootDocHandle();
      const anotherDocHandle = getObjectCore(obj2).docHandle!;
      anotherDocHandle.change((doc: SpaceDoc) => {
        doc.objects![obj1.id] = getObjectCore(obj1).docHandle!.docSync().objects![obj1.id];
      });
      rootDocHandle.change((doc: SpaceDoc) => {
        doc.links![obj1.id] = anotherDocHandle.url;
      });
      await db.flush();
      await peer.host.queryService.reindex();

      root = rootDocHandle.url;
      assertion = { objectId: obj2.id, documentUrl: anotherDocHandle.url };
    }

    await peer.reload();

    {
      const db = await peer.openDatabase(spaceKey, root);
      const queryResult = (await db.query().run()).objects;
      expect(queryResult.length).to.eq(2);
      const object = queryResult.find((o) => o.id === assertion.objectId)!;
      expect(getObjectCore(object).docHandle!.url).to.eq(assertion.documentUrl);
      expect(queryResult.find((o) => o.id !== assertion.objectId)).not.to.be.undefined;
    }
  });

  test('query immediately after delete works', async () => {
    const kv = createTestLevel();
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    onTestFinished(async () => {
      await builder.close();
    });

    const peer = await builder.createPeer(kv);
    const db = await peer.createDatabase(spaceKey);
    const [obj1, obj2] = await createObjects(peer, db, { count: 2 });

    db.remove(obj2);

    const queryResult = (await db.query().run()).objects;
    expect(queryResult.length).to.eq(1);
    expect(queryResult[0].id).to.eq(obj1.id);
  });

  test('query fails if one of the results fails to load', async () => {
    const spaceKey = PublicKey.random();

    const builder = new EchoTestBuilder();
    onTestFinished(async () => {
      await builder.close();
    });

    const peer = await builder.createPeer();
    const db = await peer.createDatabase(spaceKey);
    const [obj1] = await createObjects(peer, db, { count: 2 });

    const obj2Core = getObjectCore(obj1);
    obj2Core.docHandle!.delete(); // Deleted handle access throws an exception.

    await expect(db.query().run()).rejects.toBeInstanceOf(Error);
  });

  test('query objects with different versions', async () => {
    const { peer, db, graph } = await builder.createDatabase();

    class ContactV1 extends TypedObject({ typename: 'example.com/type/Contact', version: '0.1.0' })({
      firstName: S.String,
      lastName: S.String,
    }) {}

    class ContactV2 extends TypedObject({ typename: 'example.com/type/Contact', version: '0.2.0' })({
      name: S.String,
    }) {}

    graph.schemaRegistry.addSchema([ContactV1, ContactV2]);

    const contactV1 = db.add(create(ContactV1, { firstName: 'John', lastName: 'Doe' }));
    const contactV2 = db.add(create(ContactV2, { name: 'Brian Smith' }));
    await db.flush({ indexes: true });

    const assertQueries = async (db: EchoDatabase) => {
      await assertQuery(db, Filter.typename(ContactV1.typename), [contactV1, contactV2]);
      await assertQuery(db, Filter.schema(ContactV1), [contactV1]);
      await assertQuery(db, Filter.schema(ContactV2), [contactV2]);
      await assertQuery(db, Filter.typeDXN('dxn:type:example.com/type/Contact'), [contactV1, contactV2]);
      await assertQuery(db, Filter.typeDXN('dxn:type:example.com/type/Contact:0.1.0'), [contactV1]);
      await assertQuery(db, Filter.typeDXN('dxn:type:example.com/type/Contact:0.1.0'), [contactV1]);
      await assertQuery(db, Filter.typeDXN('dxn:type:example.com/type/Contact:0.2.0'), [contactV2]);
    };

    await assertQueries(db);

    await peer.reload();
    await assertQueries(await peer.openLastDatabase());
  });

  describe('Relations', () => {
    test('query by type', async () => {
      const { db, graph } = await builder.createDatabase();
      graph.schemaRegistry.addSchema([Contact, HasManager]);

      const alice = db.add(
        create(Contact, {
          name: 'Alice',
        }),
      );
      const bob = db.add(
        create(Contact, {
          name: 'Bob',
        }),
      );
      const hasManager = db.add(
        create(HasManager, {
          [RelationSourceId]: bob,
          [RelationTargetId]: alice,
          since: '2022',
        }),
      );

      const { objects } = await db.query(Filter.schema(HasManager)).run();
      expect(objects).toEqual([hasManager]);
    });
  });
});

// TODO(wittjosiah): 2/3 of these tests fail. They reproduce issues that we want to fix.
describe('Query reactivity', () => {
  let builder: EchoTestBuilder;
  let db: EchoDatabase;
  let objects: ReactiveEchoObject<any>[];

  beforeAll(async () => {
    builder = await new EchoTestBuilder().open();
    ({ db } = await builder.createDatabase());

    objects = range(3).map((idx) => createTestObject(idx, 'red'));
    for (const object of objects) {
      db.add(object);
    }

    await db.flush();
  });

  afterAll(async () => {
    await builder.close();
  });

  // TODO(dmaretskyi): Fires twice.
  test.skip('fires only once when new objects are added', async () => {
    const query = db.query({ label: 'red' });

    let count = 0;
    let lastResult;
    query.subscribe(() => {
      count++;
      lastResult = query.objects;
    });
    expect(count).to.equal(0);

    db.add(createTestObject(3, 'red'));
    await db.flush({ updates: true });
    expect(count).to.be.greaterThan(1);
    expect(lastResult).to.have.length(4);
  });

  test.skip('fires only once when objects are removed', async () => {
    const query = db.query({ label: 'red' });
    expect(query.objects).to.have.length(3);
    let count = 0;
    query.subscribe(() => {
      count++;
      expect(query.objects).to.have.length(2);
    });
    db.remove(objects[0]);
    await sleep(10);
    expect(count).to.equal(1);
  });

  test.skip('does not fire on object updates', async () => {
    const query = db.query({ label: 'red' });
    expect(query.objects).to.have.length(3);
    query.subscribe(() => {
      throw new Error('Should not be called.');
    });
    objects[0].title = 'Task 0a';
    await sleep(10);
  });

  test('can unsubscribe and resubscribe', async () => {
    const query = db.query({ label: 'red' });

    let count = 0;
    let lastCount = 0;
    let lastResult;
    const unsubscribe = query.subscribe(() => {
      count++;
      lastResult = query.objects;
    });
    expect(count, 'Does not fire updates immediately.').to.equal(0);

    {
      db.add(createTestObject(3, 'red'));
      await db.flush({ updates: true });
      expect(count).to.be.greaterThan(lastCount);
      lastCount = count;
      expect(lastResult).to.have.length(4);
    }

    unsubscribe();

    {
      db.add(createTestObject(4, 'red'));
      await db.flush({ updates: true });
      expect(count).to.be.equal(lastCount);
      lastCount = count;
    }

    query.subscribe(() => {
      count++;
      lastResult = query.objects;
    });

    {
      db.add(createTestObject(5, 'red'));
      await db.flush({ updates: true });
      expect(count).to.be.greaterThan(lastCount);
      lastCount = count;
      expect(lastResult).to.have.length(6);
    }
  });
});

describe('Queries with types', () => {
  test('query by typename receives updates', async () => {
    const testBuilder = new EchoTestBuilder();
    await openAndClose(testBuilder);
    const { graph, db } = await testBuilder.createDatabase();

    graph.schemaRegistry.addSchema([Contact]);
    const contact = db.add(create(Contact, {}));
    const name = 'DXOS User';

    const query = db.query(Filter.typename(Contact.typename));
    const result = await query.run();
    expect(result.objects).to.have.length(1);
    expect(result.objects[0]).to.eq(contact);

    const nameUpdate = new Trigger();
    const anotherContactAdded = new Trigger();
    const unsub = query.subscribe(({ objects }) => {
      if (objects.some((obj) => obj.name === name)) {
        nameUpdate.wake();
      }
      if (objects.length === 2) {
        anotherContactAdded.wake();
      }
    });
    onTestFinished(() => unsub());

    contact.name = name;
    db.add(create(Contact, {}));

    await asyncTimeout(nameUpdate.wait(), 1000);
    await asyncTimeout(anotherContactAdded.wait(), 1000);
  });

  test('query mutable schema objects', async () => {
    const testBuilder = new EchoTestBuilder();
    await openAndClose(testBuilder);
    const { db } = await testBuilder.createDatabase();

    const [schema] = await db.schemaRegistry.register([Contact]);
    const contact = db.add(create(schema, {}));

    // NOTE: Must use `Filter.schema` with EchoSchema instance since matching is done by the object ID of the mutable schema.
    const query = db.query(Filter.schema(schema));
    const result = await query.run();
    expect(result.objects).to.have.length(1);
    expect(result.objects[0]).to.eq(contact);
  });

  test('`instanceof` operator works', async () => {
    const testBuilder = new EchoTestBuilder();
    await openAndClose(testBuilder);
    const { graph, db } = await testBuilder.createDatabase();

    graph.schemaRegistry.addSchema([Contact]);
    const name = 'DXOS User';
    const contact = create(Contact, { name });
    db.add(contact);
    expect(contact instanceof Contact).to.be.true;

    // query
    {
      const contact = (await db.query(Filter.schema(Contact)).run()).objects[0];
      expect(contact.name).to.eq(name);
      expect(contact instanceof Contact).to.be.true;
    }
  });
});

test('map over refs in query result', async () => {
  const testBuilder = new EchoTestBuilder();
  const { db } = await testBuilder.createDatabase();
  const folder = db.add(create(Expando, { name: 'folder', objects: [] as any[] }));
  const objects = range(3).map((idx) => createTestObject(idx));
  for (const object of objects) {
    folder.objects.push(makeRef(object));
  }

  const queryResult = await db.query({ name: 'folder' }).run();
  const result = queryResult.objects.flatMap(({ objects }) => objects.map((o: Ref<any>) => o.target));

  for (const i in objects) {
    expect(result[i]).to.eq(objects[i]);
  }
});

const createObjects = async (peer: EchoTestPeer, db: EchoDatabase, options: { count: number }) => {
  const objects = range(options.count, (v) => db.add(createTestObject(v, String(v))));
  await db.flush({ indexes: true });
  return objects;
};

const assertQuery = async (db: EchoDatabase, filter: Filter, expected: any[]) => {
  const { objects } = await db.query(filter).run();
  expect(sortById(objects)).toEqual(expect.arrayContaining(sortById(expected)));
};

const sortById = (objects: any[]) => objects.sort((a, b) => a.id.localeCompare(b.id));
