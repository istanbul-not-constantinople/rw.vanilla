import { execute, MCFunction, MultipleEntitiesArgument, Predicate, PredicateInstance, Range } from 'sandstone';
import { NumberProvider } from 'sandstone/arguments/resources/criteria';
import { BASIC_CONFLICT_STRATEGIES } from 'sandstone/generalTypes';

export interface BinaryNode<T> {
  value: T;
  children?: [BinaryNode<T>, BinaryNode<T>];
}

//const recursiveBind = <T, R>(initial: (arg: T) => R, next: (result: R) => (arg: T) => R, args: T[]): void => args.length > 1 ? recursiveBind(next(initial(args[0])), next, args.slice(1)) : void 0;

export class BinaryChoiceInstance {
  callbackfn: () => void | Promise<void>;
  predicate: PredicateInstance;
  selector: MultipleEntitiesArgument | undefined;

  constructor(condition: PredicateInstance, callbackfn: () => void | Promise<void>, selector?: MultipleEntitiesArgument) {
    this.callbackfn = callbackfn;
    this.predicate = condition;
    this.selector = selector;
  }

  run = () => (this.selector !== undefined ? execute.as(this.selector) : execute).if(this.predicate).run(() => this.callbackfn());
}

export const BinaryChoice = (condition: PredicateInstance, callbackfn: () => void | Promise<void>, selector?: MultipleEntitiesArgument) => new BinaryChoiceInstance(condition, callbackfn, selector);

export type NodeMerger = (name: string, choices: [BinaryChoiceInstance, BinaryChoiceInstance], enclosed: boolean) => PredicateInstance;

const unarray = <T>(node: T | T[]) => Array.isArray(node) ? node[0] : node;
type InnerFilterUnion<U, F> = { [K in U as K extends F ? 0 : never]: K };

type FilterUnion<U, F> = InnerFilterUnion<U, F>[keyof InnerFilterUnion<U, F>];

const simplifyRange = (first: Range | null | undefined, second: Range | null | undefined): Range | null => {
  if (first === null || second === null) { return null; } 

  const fb = first === undefined;
  const sb = second === undefined;
  if (fb) {
    if (sb) {
      return null;
    } else {
      return second;
    }
  } else {
    if (sb) {
      return first;
    } else {
      const f = typeof first === 'number' ? [first, first] : first;
      const s = typeof second === 'number' ? [second, second] : second;

      const fb = f[1] !== undefined || f[1] !== null;
      const sb = s[0] !== undefined || s[0] !== null;

      const r = fb && !sb ? [null, s[1]] : !fb && sb ? [f[0], null] : fb && sb && f[1]! >= (s[0]! - 1) ? [f[0], s[1]] : null;

      return r as Range | null;
    }
  }
};

type Nup = FilterUnion<NumberProvider, { type: string }>;

const providerToRange = (p: NumberProvider): Range | null => {
  if (typeof p === 'number') {
    return p;
  } else if ('min' in p || 'max' in p) {
    const min = p.min !== undefined ? providerToRange(p.min!) : undefined;
    const max = p.max !== undefined ? providerToRange(p.max!) : undefined;
    return simplifyRange(min, max);
  } else {
    const pr = p as Nup;

    if (pr.type === 'minecraft:constant') {
      return pr.value;
    }
  }

  return null;
};

const mergeProviders = (f: NumberProvider, s: NumberProvider): NumberProvider | null => {
  const simp = simplifyRange(providerToRange(f) ?? null, providerToRange(s) ?? null);
  if (simp !== null) {
    const pimp = typeof simp === 'number' ? [simp, simp] : simp;
    return {
      type: 'minecraft:uniform',
      min: pimp[0]!,
      max: pimp[0]!,
    };
  } else if (typeof f !== 'number' && typeof s !== 'number') {
    if ('min' in f || 'max' in f) {
      f;
      const g = simplifyRange(
        f.min !== undefined ? providerToRange(f.min!) : undefined,
        f.max !== undefined ? providerToRange(f.max!) : undefined,
      );

      if ('min' in s || 'max' in s) {
        const h = simplifyRange(g, simplifyRange(
          s.min !== undefined ? providerToRange(s.min!) : undefined,
          s.max !== undefined ? providerToRange(s.max!) : undefined,
        ));

        if (typeof h === 'number') {
          return h;
        } else if (h === null) {
          return null;
        } else {
          return {
            type: 'minecraft:uniform',
            min: h[0]!,
            max: h[1]!,
          };
        }
      }
    } 
    // does this auto...
    // else if ('type' in f && f.type === 'minecraft:score') {
    //   if (typeof s !== 'number' && 'type' in s && s.type === 'minecraft:score'
    //     && f.score === s.score) {
    //     if (typeof f.target !== 'string' && 'name' in f.target
    //       && typeof s.target !== 'string' && 'name' in s.target) {
    //       const fn = parseFloat(f.target.name) / f.scale;
    //       const sn = parseFloat(s.target.name) / s.scale;

    //       fn + 1 === sn || fn - 1 === sn;
    //     } else {
          
    //     }
    //   }
    // }
  }
  return null;
};

export const mergeNodes: NodeMerger = (name, choices, _enclosed) => {
  const c0 = unarray(choices[0].predicate.predicateJSON);
  const c1 = unarray(choices[1].predicate.predicateJSON);

  if (c0 === c1) {
    return choices[0].predicate;
  }

  if (c0.condition === 'minecraft:entity_scores' && c1.condition === 'minecraft:entity_scores' && c0.entity === c1.entity) {
    const scores = Object.fromEntries(Object.entries(c0.scores));

    Object.entries(c1.scores).forEach(([score, value]) => {
      if (scores[score] !== undefined) {
        const merged = mergeProviders(scores[score], value);
        if (merged !== null) {
          scores[score] = merged;
        } else {
          return Predicate(name, {
            condition: 'minecraft:alternative',
            terms: choices.map((choice) => ({ condition: 'minecraft:reference', name: choice.predicate.name })),
          });
        }
      }
    });

    return Predicate(name, {
      condition: 'minecraft:entity_scores',
      entity: c0.entity,
      scores,
    });
  }

  return Predicate(name, {
    condition: 'minecraft:alternative',
    terms: choices.map((choice) => ({ condition: 'minecraft:reference', name: choice.predicate.name })),
  });
};

// type DynaicallySizedTuple<T, N extends number> = N extends N ? number extends N ? T[] : NumberMatchingTuple<T, N, []> : never;
// type NumberMatchingTuple<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : NumberMatchingTuple<T, N, [T, ...R]>; // thanks to this (https://stackoverflow.com/questions/52489261/typescript-can-i-define-an-n-length-tuple-type/52490977)

// type MaximumSizedTuple<T, N extends number, S extends number = 0> = N extends N ? number extends N ? T[] : MaximumSizedTupleBuilder<T, N, [DynaicallySizedTuple<T, S>], 0> : never;
// type NextInteger = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
// type ValidIntegers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15][number];
// type MaximumSizedTupleBuilder<T, N extends number, R extends [unknown[], ...unknown[][]], I extends ValidIntegers> = R[0]['length'] extends N ? R[number] : NextInteger[I] extends ValidIntegers ? MaximumSizedTupleBuilder<T, N, [DynaicallySizedTuple<T, NextInteger[I]>, ...R], NextInteger[I]> : R[number];

const chunker = <T>(size: number, ...elements: T[]): T[][] => elements.reduce((result, element, i) => i % size === 0 ? [...result, [element]] : [...result.slice(0, -1), [...result.slice(-1)[0], element]], [] as any[]) as any;


export type BinaryTreeOptions = Partial<{
  onConflict: BASIC_CONFLICT_STRATEGIES;
  merger: NodeMerger;
  header: () => void | Promise<void>;
  enclosed: boolean;
}>;

export const BinaryTree = (name: string, choices: BinaryChoiceInstance[], options?: BinaryTreeOptions) => {
  const merger = options?.merger ?? mergeNodes;
  const enclosed = options?.enclosed ?? false;
  let nodes: BinaryChoiceInstance[] = choices;
  for (let i = 0; nodes.length > 1; i++) {
    nodes = chunker(2, ...nodes).map((nodes, j) => nodes.length === 1 ? nodes[0] : BinaryChoice(merger(`${name}/${i}/${j}`, nodes as any, enclosed), MCFunction(`${name}/${i}/${j}`, () => void choices.map((choice) => choice.run()))));
  }
  const f = MCFunction(`${name}/root`, () => {
    options?.header?.();
    enclosed ? nodes[0].callbackfn() : execute.if(nodes[0].predicate).run(() => nodes[0].callbackfn());
  });
  return f;
};