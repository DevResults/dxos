//
// Copyright 2024 DXOS.org
//

import '@dxos-theme';

import { type StoryObj, type Meta } from '@storybook/react';
import React, { useCallback, useEffect, useState } from 'react';

import { type EchoSchema } from '@dxos/echo-schema';
import { invariant } from '@dxos/invariant';
import { useGlobalFilteredObjects } from '@dxos/plugin-search';
import { faker } from '@dxos/random';
import { Filter, useSpaces, useQuery, create } from '@dxos/react-client/echo';
import { withClientProvider } from '@dxos/react-client/testing';
import { ViewEditor } from '@dxos/react-ui-form';
import { SyntaxHighlighter } from '@dxos/react-ui-syntax-highlighter';
import { ViewType } from '@dxos/schema';
import { withLayout, withTheme } from '@dxos/storybook-utils';

import { Kanban } from './Kanban';
import { KanbanType, useKanbanModel } from '../defs';
import { initializeKanban } from '../testing';
import translations from '../translations';

faker.seed(0);

//
// Story components.
//

const StorybookKanban = () => {
  const spaces = useSpaces();
  const space = spaces[spaces.length - 1];
  const kanbans = useQuery(space, Filter.schema(KanbanType));
  const [kanban, setKanban] = useState<KanbanType>();
  const [cardSchema, setCardSchema] = useState<EchoSchema>();
  useEffect(() => {
    if (kanbans.length && !kanban) {
      const kanban = kanbans[0];
      invariant(kanban.cardView);
      setKanban(kanban);
      setCardSchema(space.db.schemaRegistry.getSchema(kanban.cardView.target!.query.type));
    }
  }, [kanbans]);

  const objects = useQuery(space, cardSchema ? Filter.schema(cardSchema) : Filter.nothing());
  const filteredObjects = useGlobalFilteredObjects(objects);

  const model = useKanbanModel({
    kanban,
    cardSchema,
    items: filteredObjects,
  });

  const handleAddColumn = useCallback((columnValue: string) => model?.addEmptyColumn(columnValue), [model]);

  const handleAddCard = useCallback(
    (columnValue: string) => {
      if (space && cardSchema) {
        space.db.add(
          create(cardSchema, {
            title: faker.commerce.productName(),
            description: faker.lorem.paragraph(),
            state: columnValue,
          }),
        );
      }
    },
    [space, cardSchema],
  );

  const handleRemoveCard = useCallback(
    (card: { id: string }) => {
      space.db.remove(card);
    },
    [space],
  );

  const onTypenameChanged = useCallback(
    (typename: string) => {
      if (kanban?.cardView?.target) {
        cardSchema?.updateTypename(typename);
        kanban.cardView.target.query.type = typename;
      }
    },
    [kanban?.cardView?.target, cardSchema],
  );

  const handleRemoveEmptyColumn = useCallback(
    (columnValue: string) => {
      model?.removeColumnFromArrangement(columnValue);
    },
    [model],
  );

  if (!cardSchema || !kanban) {
    return null;
  }

  return (
    <div className='grow grid grid-cols-[1fr_350px]'>
      {model ? (
        <Kanban
          model={model}
          onAddCard={handleAddCard}
          onAddColumn={handleAddColumn}
          onRemoveCard={handleRemoveCard}
          onRemoveEmptyColumn={handleRemoveEmptyColumn}
        />
      ) : (
        <div />
      )}
      <div className='flex flex-col bs-full border-is border-separator overflow-y-auto'>
        {kanban.cardView && (
          <ViewEditor
            registry={space?.db.schemaRegistry}
            schema={cardSchema}
            view={kanban.cardView.target!}
            onTypenameChanged={onTypenameChanged}
            onDelete={(fieldId: string) => {
              console.log('[ViewEditor]', 'onDelete', fieldId);
            }}
          />
        )}
        <SyntaxHighlighter language='json' className='w-full text-xs'>
          {JSON.stringify({ view: kanban.cardView, cardSchema }, null, 2)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

type StoryProps = {
  rows?: number;
};

//
// Story definitions.
//

const meta: Meta<StoryProps> = {
  title: 'ui/react-ui-kanban/Kanban',
  component: StorybookKanban,
  render: () => <StorybookKanban />,
  parameters: { translations },
  decorators: [
    withClientProvider({
      types: [KanbanType, ViewType],
      createIdentity: true,
      createSpace: true,
      onSpaceCreated: async ({ space }) => {
        const { taskSchema } = await initializeKanban({ space });
        // TODO(burdon): Replace with sdk/schema/testing.
        Array.from({ length: 24 }).map(() => {
          return space.db.add(
            create(taskSchema, {
              title: faker.commerce.productName(),
              description: faker.lorem.paragraph(),
              state: ['Pending', 'Active', 'Done'][faker.number.int(2)],
            }),
          );
        });
      },
    }),
    withTheme,
    withLayout({ fullscreen: true, tooltips: true }),
  ],
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Default: Story = {};
