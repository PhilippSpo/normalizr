/* eslint-env jest */
import { fromJS, Record } from 'immutable';
import { denormalize, normalize, schema } from '../../';

describe(`${schema.Entity.name} normalization`, () => {
  it('normalizes an entity', () => {
    const entity = new schema.Entity('item');
    expect(normalize({ id: 1 }, entity)).toMatchSnapshot();
  });

  describe('key', () => {
    it('must be created with a key name', () => {
      expect(() => new schema.Entity()).toThrow();
    });

    it('key name must be a string', () => {
      expect(() => new schema.Entity(42)).toThrow();
    });

    it('key getter should return key passed to constructor', () => {
      const user = new schema.Entity('users');
      expect(user.key === 'users');
    });
  });

  describe('idAttribute', () => {
    it('can use a custom idAttribute string', () => {
      const user = new schema.Entity('users', {}, { idAttribute: 'id_str' });
      expect(normalize({ id_str: '134351', name: 'Kathy' }, user)).toMatchSnapshot();
    });

    it('can normalize entity IDs based on their object key', () => {
      const user = new schema.Entity('users', {}, { idAttribute: (entity, parent, key) => key });
      const inputSchema = new schema.Values({ users: user }, () => 'users');

      expect(normalize({ 4: { name: 'taco' }, 56: { name: 'burrito' } }, inputSchema)).toMatchSnapshot();
    });

    it('can build the entity\'s ID from the parent object', () => {
      const user = new schema.Entity('users', {}, {
        idAttribute: (entity, parent, key) => `${parent.name}-${key}-${entity.id}`
      });
      const inputSchema = new schema.Object({ user });

      expect(normalize({ name: 'tacos', user: { id: '4', name: 'Jimmy' } }, inputSchema)).toMatchSnapshot();
    });
  });

  describe('mergeStrategy', () => {
    it('defaults to plain merging', () => {
      const mySchema = new schema.Entity('tacos');
      expect(normalize([
        { id: 1, name: 'foo' },
        { id: 1, name: 'bar', alias: 'bar' }
      ], [ mySchema ])).toMatchSnapshot();
    });

    it('can use a custom merging strategy', () => {
      const mergeStrategy = (entityA, entityB) => {
        return { ...entityA, ...entityB, name: entityA.name };
      };
      const mySchema = new schema.Entity('tacos', {}, { mergeStrategy });

      expect(normalize([
        { id: 1, name: 'foo' },
        { id: 1, name: 'bar', alias: 'bar' }
      ], [ mySchema ])).toMatchSnapshot();
    });
  });

  describe('processStrategy', () => {
    it('can use a custom processing strategy', () => {
      const processStrategy = (entity) => {
        return { ...entity, slug: `thing-${entity.id}` };
      };
      const mySchema = new schema.Entity('tacos', {}, { processStrategy });

      expect(normalize({ id: 1, name: 'foo' }, mySchema)).toMatchSnapshot();
    });

    it('can use information from the parent in the process strategy', () => {
      const processStrategy = (entity, parent, key) => {
        return { ...entity, parentId: parent.id, parentKey: key };
      };
      const childEntity = new schema.Entity('children', {}, { processStrategy });
      const parentEntity = new schema.Entity('parents', {
        child: childEntity
      });

      expect(normalize({
        id: 1, content: 'parent', child: { id: 4, content: 'child' }
      }, parentEntity)).toMatchSnapshot();
    });

    it('is run before and passed to the schema normalization', () => {
      const processStrategy = (input) => ({ ...Object.values(input)[0], type: Object.keys(input)[0] });
      const attachmentEntity = new schema.Entity('attachments');
      // If not run before, this schema would require a parent object with key "message"
      const myEntity = new schema.Entity('entries', {
        data: { attachment: attachmentEntity }
      }, { idAttribute: (input) => Object.values(input)[0].id, processStrategy });

      expect(normalize({ message: { id: '123', data: { attachment: { id: '456' } } } }, myEntity)).toMatchSnapshot();
    });
  });
});

describe(`${schema.Entity.name} denormalization`, () => {
  it('denormalizes an entity', () => {
    const mySchema = new schema.Entity('tacos');
    const entities = {
      tacos: {
        1: { id: 1, type: 'foo' }
      }
    };
    expect(denormalize(1, mySchema, entities)).toMatchSnapshot();
    expect(denormalize(1, mySchema, fromJS(entities))).toMatchSnapshot();
  });

  it('denormalizes deep entities', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema
    });

    const entities = {
      menus: {
        1: { id: 1, food: 1 },
        2: { id: 2 }
      },
      foods: {
        1: { id: 1 }
      }
    };

    expect(denormalize(1, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(1, menuSchema, fromJS(entities))).toMatchSnapshot();

    expect(denormalize(2, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(2, menuSchema, fromJS(entities))).toMatchSnapshot();
  });

  it('denormalizes to undefined for missing data', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema
    });

    const entities = {
      menus: {
        1: { id: 1, food: 2 }
      },
      foods: {
        1: { id: 1 }
      }
    };

    expect(denormalize(1, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(1, menuSchema, fromJS(entities))).toMatchSnapshot();

    expect(denormalize(2, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(2, menuSchema, fromJS(entities))).toMatchSnapshot();
  });

  it('denormalizes deep entities with records', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema
    });

    const Food = new Record({ id: null });
    const Menu = new Record({ id: null, food: null });

    const entities = {
      menus: {
        1: new Menu({ id: 1, food: 1 }),
        2: new Menu({ id: 2 })
      },
      foods: {
        1: new Food({ id: 1 })
      }
    };

    expect(denormalize(1, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(1, menuSchema, fromJS(entities))).toMatchSnapshot();

    expect(denormalize(2, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(2, menuSchema, fromJS(entities))).toMatchSnapshot();
  });

  it('can denormalize already partially denormalized data', () => {
    const foodSchema = new schema.Entity('foods');
    const menuSchema = new schema.Entity('menus', {
      food: foodSchema
    });

    const entities = {
      menus: {
        1: { id: 1, food: { id: 1 } }
      },
      foods: {
        1: { id: 1 }
      }
    };

    expect(denormalize(1, menuSchema, entities)).toMatchSnapshot();
    expect(denormalize(1, menuSchema, fromJS(entities))).toMatchSnapshot();
  });

  it('denormalizes recursive dependencies', () => {
    const user = new schema.Entity('users');
    const report = new schema.Entity('reports');

    user.define({
      reports: [ report ]
    });
    report.define({
      draftedBy: user,
      publishedBy: user
    });

    const entities = {
      reports: {
        '123': {
          id: '123',
          title: 'Weekly report',
          draftedBy: '456',
          publishedBy: '456'
        }
      },
      users: {
        '456': {
          id: '456',
          role: 'manager',
          reports: [ '123' ]
        }
      }
    };
    expect(denormalize('123', report, entities)).toMatchSnapshot();
    expect(denormalize('123', report, fromJS(entities))).toMatchSnapshot();

    expect(denormalize('456', user, entities)).toMatchSnapshot();
    expect(denormalize('456', user, fromJS(entities))).toMatchSnapshot();
  });

  it('denormalizes recursive dependencies per subtree', () => {
    // test from issue https://github.com/paularmstrong/normalizr/issues/233
    const mentor = new schema.Entity('mentors');
    const user = new schema.Entity('users', {
      mentor: mentor
    });

    const objectSchema = { users: [ user ] };
    const entities = {
      users: {
        '1': {
          id: 1,
          mentor: 3
        },
        '2': {
          id: 2,
          mentor: 3
        }
      },
      mentors: {
        '3': {
          id: 3,
          name: 'John'
        }
      }
    };
    expect(denormalize({ users: [ 1, 2 ] }, objectSchema, entities)).toEqual({ 
      users: [
        { id: 1, mentor: { id: 3, name: 'John' } },
        { id: 2, mentor: { id: 3, name: 'John' } }
      ]
    });
  });
});
