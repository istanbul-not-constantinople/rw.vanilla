import { Recipe, Tag } from 'sandstone';
import RecipeTree from './recipe-tree';

const main = RecipeTree('main', [
  Recipe('some_recipe', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:iron_ingot' } },
    pattern: [
      'XXX',
      'X X',
    ],
    result: {
      item: 'minecraft:golden_leggings',
      count: 1,
    },
  }),
  Recipe('some_recipe3', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:iron_ingot' }, 'T': { item: 'minecraft:diamond' } },
    pattern: [
      'XTT',
      'T T',
    ],
    result: {
      item: 'minecraft:bedrock',
      count: 9,
    },
  }),
  Recipe('a', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:dirt' } },
    pattern: [
      'X',
    ],
    result: {
      item: 'minecraft:coarse_dirt',
      count: 28,
    },
  }),
  Recipe('b', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:stone' } },
    pattern: [
      'X',
    ],
    result: {
      item: 'minecraft:deepslate',
      count: 43,
    },
  }),
  Recipe('c', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:emerald' } },
    pattern: [
      'X',
    ],
    result: {
      item: 'minecraft:acacia_boat',
      count: 1,
    },
  }),
  Recipe('d', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:gold_ingot' } },
    pattern: [
      'X',
    ],
    result: {
      item: 'minecraft:gold_block',
      count: 10,
    },
  }),
  Recipe('some_recipe2', {
    type: 'crafting_shaped',
    key: { 'X': { item: 'minecraft:gold_ingot' } },
    pattern: [
      'XXX',
      'X X',
    ],
    result: {
      item: 'minecraft:iron_helmet',
      count: 1,
    },
  }),
], { defaultSlot: 15 });

Tag('functions', 'rw:crafting_table/recipes', [main]);