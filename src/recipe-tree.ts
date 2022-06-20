import { data, MCFunction, Predicate, PredicateCondition, PredicateInstance, PredicateJSON, RecipeInstance, tag, Tag, TagInstance, NBT } from 'sandstone';
import { BinaryChoice, BinaryTree, mergeNodes, NodeMerger } from './binary-tree';

const hasKey = (json?: PredicateJSON): json is PredicateJSON => {
  if (!Array.isArray(json) && json !== undefined) {
    if (json.condition === 'minecraft:entity_properties' && json.predicate.equipment?.mainhand) {
      const mainhand = json.predicate.equipment.mainhand;
      return !('count' in mainhand || 'durability' in mainhand || 'enchantments' in mainhand || 'nbt' in mainhand || 'potion' in mainhand || 'stored_enchantments' in mainhand) && ('items' in mainhand || 'tag' in mainhand);
    }
  }
  return false;
};

const advancedMerge: NodeMerger = (name, choices, enclosed) => {
  const json1 = choices[0].predicate.predicateJSON;
  const json2 = choices[1].predicate.predicateJSON;
  if (hasKey(json1) && hasKey(json2)) {
    const mainhand1 = (json1 as any).predicate.equipment.mainhand;
    const mainhand2 = (json2 as any).predicate.equipment.mainhand;
    const i1 = 'items' in mainhand1;
    const i2 = 'items' in mainhand2;

    return Predicate(name, {
        condition: 'minecraft:entity_properties',
        entity: 'this',
        predicate: {
          equipment: {
            mainhand: (i1 && i2) ? {
              items: [...mainhand1.items, ...mainhand2.items],
            } : {
              tag: Tag('items', name, [...i1 ? mainhand1.items : [mainhand1.tag], ...i2 ? mainhand2.items : [mainhand2.tag]]),
            },
          },
        },
      } as any);
  }

  return mergeNodes(name, choices, enclosed);
};

type ItemOrTag = { item: string; } | { tag: string | TagInstance<'items'>; };

const getKey = (item: ItemOrTag): string => 'item' in item ? item.item : typeof item.tag === 'string' ? item.tag : item.tag.name;

const sanitize = (input: string) => input.replace(/[#]/gm, '--').replace(/[^a-z0-9._-]/gm, '.');

const tagIfNeeded = (name: string, object: ItemOrTag | ItemOrTag[]): ItemOrTag => {
  if (Array.isArray(object)) {
    const keys = object.map((sub) => getKey(tagIfNeeded('', sub)));
    return { tag: Tag('items', `${name}/${keys.map(sanitize).join('_or_')}`, keys, false, { onConflict: 'ignore' }) };
  }
  return object;
};

type Ingredient = ItemOrTag | undefined;

type RecipePattern = Ingredient[][];

type RecipeResult = { item: string, count?: number };

type RecipeData = { ingredients: RecipePattern, result: RecipeResult }

const recipeInfo = (name: string, recipe: RecipeInstance): { size: [number, number], items: RecipePattern, result: RecipeResult } | undefined => {
  if (recipe.recipeJSON.type === 'crafting_shaped') {
    const ingredients = Object.fromEntries(Object.entries(recipe.recipeJSON.key as { [K: string]: ItemOrTag | ItemOrTag[], }).map(([key, value]) => [key, tagIfNeeded(name, value)]));

    const size = [recipe.recipeJSON.pattern[0].length, recipe.recipeJSON.pattern.length] as [number, number];

    const items: (ItemOrTag | undefined)[][] = recipe.recipeJSON.pattern.map((row) => row!.split('').map((key) => ingredients[key] ?? undefined));

    return { size, items, result: recipe.recipeJSON.result as any };
  }
};

const slotOf = ([width, height]: [number, number], index: number): [number, number] | undefined => Array(height).fill(Array(width).fill(null)).reduce((n, row: null[], y) => n !== undefined ? n : row.reduce<[number, number] | undefined>((n, _, x) => n !== undefined ? n : (y * width + x) === index ? [x, y] : undefined, undefined), undefined);

//const predicate

type CompiledRecipePattern = PredicateInstance[][];

type CompiledRecipeData = { ingredients: CompiledRecipePattern, result: RecipeResult };

const alphabet = 'abcdefghijklmnopqrstuvwxyz';

const SubTree = (root: string, name: string, recipes: CompiledRecipeData[], size: [number, number], index: number, hash: number, resultSlot: number | undefined): () => void | Promise<void> => {
  const compiled = `${root}/${alphabet[hash]}/slot_${index}`;
  const [x, y] = slotOf(size, index) ?? [-1, -1];

  if (x === -1 && y === -1) {
    console.log(recipes[0].result);
    return MCFunction(`${root}/results/${hash}`, () => {
      data.modify.storage('rw:io', 'out').set.value({ id: recipes[0].result.item, Count: NBT.byte(recipes[0].result.count ?? 1), ...(resultSlot ? { Slot: NBT.byte(resultSlot) } : {}) });
      tag('@s').add('flux.ui.offering');
    });
  }
  const byIndex = recipes.reduce((map, recipe) => {
    const index = recipe.ingredients[y][x];
    map.set(index, [...map.get(index) ?? [], recipe]);
    return map;
  }, new Map<PredicateInstance, CompiledRecipeData[]>());

  return BinaryTree(compiled, [...byIndex.entries()].map(([one, recipes]) => BinaryChoice(one, SubTree(root, name, recipes, size, index + 1, hash++, resultSlot))), {
    header: () => {
      data.modify.entity('@s', 'HandItems[0]').set.from.storage('rw:io', `shaped[${y}][${x}]`);
      //say(compiled);
      //tellraw('@a', { storage: 'rw:io', nbt: `shaped[${y}][${x}].id` });
    },
    merger: advancedMerge,
  });
};

const predicateOf = (name: string, ingredient: ItemOrTag) => {
  return Predicate(name, {
    condition: 'minecraft:entity_properties', entity: 'this', predicate: { equipment: {
      mainhand: 'item' in ingredient ? { items: [ingredient.item] } : { tag: ingredient.tag },
    } },
  } as any, { onConflict: 'ignore' });
};

interface RecipeTreeOptions {
  defaultSlot: number;
}

const RecipeTree = (name: string, recipes: RecipeInstance[], options?: Partial<RecipeTreeOptions>) => {
  const sizes = recipes.map((recipe) => recipeInfo(name, recipe)).reduce((result, info) => {
    if (info !== undefined) {
      const index = result.findIndex((size) => size.size[0] === info.size[0] && size.size[1] === info.size[1]);
      if (index === -1) {
        result.push({ size: info.size, recipes: [{ ingredients: info.items, result: info.result }] });
      } else {
        result[index].recipes.push({ ingredients: info.items, result: info.result });
      }
    }
    return result;
  }, [] as { size: [number, number], recipes: RecipeData[] }[]);

  return BinaryTree(name, sizes.map((size, _i) => {
    const root = `${name}/${size.size[0]}x${size.size[1]}`;
    const sub = SubTree(root, root, size.recipes.map((recipe) => ({ ingredients: recipe.ingredients.map((row) => row.map((i) => predicateOf(`${root}/${sanitize(i !== undefined ? getKey(i) : 'minecraft.air')}`, i ?? { item: 'minecraft:air' }))), result: recipe.result })), size.size, 0, 0, options?.defaultSlot);
    return BinaryChoice(Predicate(`${root}/root`, {
      condition: 'minecraft:entity_scores',
      entity: 'this',
      scores: {
        'rw.crafting.x': { min: size.size[0], max: size.size[0] },
        'rw.crafting.y': { min: size.size[1], max: size.size[1] },
      },
    } as PredicateCondition), () => sub());
  }), { enclosed: true });
};

export default RecipeTree;