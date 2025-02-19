//
// Copyright 2023 DXOS.org
//

import { AST, EchoSchema, ReferenceAnnotationId, type S, SchemaValidator, StoredSchema } from '@dxos/echo-schema';
import { type GraphData, type GraphLink, GraphModel } from '@dxos/gem-spore';
import { log } from '@dxos/log';
import { CollectionType } from '@dxos/plugin-space/types';
import { type ReactiveEchoObject, type Space, type Subscription, getSchema, getType } from '@dxos/react-client/echo';

export type SpaceGraphModelOptions = {
  schema?: boolean;
};

export type EchoGraphNode = SchemaGraphNode | EchoObjectGraphNode;

type EchoObjectGraphNode = {
  id: string;
  type: 'echo-object';
  object: ReactiveEchoObject<any>;
};

type SchemaGraphNode = {
  id: string;
  type: 'schema';
  schema: S.Schema<any>;
};

/**
 * Converts ECHO objects to a graph.
 */
export class SpaceGraphModel extends GraphModel<EchoGraphNode> {
  private readonly _graph: GraphData<EchoGraphNode> = {
    nodes: [],
    links: [],
  };

  private _subscription?: Subscription;
  private _objects?: ReactiveEchoObject<any>[];

  constructor(private readonly _options: SpaceGraphModelOptions = {}) {
    super();
  }

  override get graph(): GraphData<EchoGraphNode> {
    return this._graph;
  }

  get objects(): ReactiveEchoObject<any>[] {
    return this._objects ?? [];
  }

  open(space: Space, objectId?: string) {
    if (!this._subscription) {
      // TODO(burdon): Filter.
      const query = space.db.query((object: ReactiveEchoObject<any>) => !(object instanceof CollectionType));

      this._subscription = query.subscribe(
        ({ objects }) => {
          this._objects = objects;
          this._graph.nodes = objects.map((object) => {
            if (object instanceof StoredSchema) {
              const effectSchema = space.db.schemaRegistry.getSchemaById(object.id)!;
              return { type: 'schema', id: object.id, schema: effectSchema.schema };
            }
            return { type: 'echo-object', id: object.id, object };
          });
          this._graph.links = objects.reduce<GraphLink[]>((links, object) => {
            const objectSchema = getSchema(object);
            const typename = getType(object)?.objectId;
            if (objectSchema == null || typename == null) {
              log.info('no schema for object:', { id: object.id.slice(0, 8) });
              return links;
            }

            if (!(objectSchema instanceof EchoSchema)) {
              const idx = objects.findIndex((obj) => obj.id === typename);
              if (idx === -1) {
                this._graph.nodes.push({
                  id: typename,
                  type: 'schema',
                  schema: objectSchema,
                });
              }
            }

            // Link to schema.
            if (this._options.schema) {
              links.push({
                id: `${object.id}-${typename}`,
                source: object.id,
                target: typename,
              });
            }

            // Parse schema to follow referenced objects.
            AST.getPropertySignatures(objectSchema.ast).forEach((prop) => {
              if (!SchemaValidator.hasTypeAnnotation(objectSchema, prop.name.toString(), ReferenceAnnotationId)) {
                return;
              }
              const value = object[String(prop.name)];
              if (value) {
                const refs = Array.isArray(value) ? value : [value];
                for (const ref of refs) {
                  if (objects.findIndex((obj) => obj.id === ref.id) !== -1) {
                    links.push({
                      id: `${object.id}-${String(prop.name)}-${ref.id}`,
                      source: object.id,
                      target: ref.id,
                    });
                  }
                }
              }
            });

            return links;
          }, []);

          this.triggerUpdate();
        },
        { fire: true },
      );
    }

    this.setSelected(objectId);
    return this;
  }

  close() {
    if (this._subscription) {
      this._subscription();
      this._subscription = undefined;
    }

    return this;
  }
}
