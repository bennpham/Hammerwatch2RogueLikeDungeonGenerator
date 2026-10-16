import type { Tier } from './depth'

/**
 * Town stalls: one per category, each opening a STOCK shop
 * (`tweak/shop/shops.sval:<id>`) picked by the highest tier the party has
 * unlocked. Stock is the shop's own: its `loot` tables roll the equipment, its
 * `items` are fixed goods; restocking (`restock-time`) is the game's.
 *
 * Picked from the scanned shop list by what their loot tables sell
 * (`shop_equipment_<slot>_<tier>`, `shop_food_<tier>`, `shop_general_<tier>`)
 * — see `npm run scan` → `HW2_SHOPS`. Tests check every id exists.
 */
export interface TownShopCategory {
  id: string
  title: string
  description: string
  byTier: Record<Tier, string>
}

export const TOWN_SHOPS: readonly TownShopCategory[] = [
  {
    id: 'armory',
    title: 'Armory',
    description: 'Armor and weapons',
    byTier: { apprentice: 'donnie_shop', adept: 'donnie_shop2', expert: 'lannern_shop', master: 'axiana_shop2' }
  },
  {
    id: 'weapons',
    title: 'Weaponsmith',
    description: 'Main-hand and off-hand weapons',
    byTier: { apprentice: 'riley_shop', adept: 'falken_shop', expert: 'riley_shop2', master: 'rion_shop' }
  },
  {
    id: 'jeweler',
    title: 'Jeweler',
    description: 'Rings, amulets and gems',
    byTier: { apprentice: 'gabriella_shop', adept: 'gabriella_shop', expert: 'gon_shop', master: 'gon_shop' }
  },
  {
    id: 'alchemist',
    title: 'Alchemist',
    description: 'Potions and flasks',
    byTier: { apprentice: 'madeleine_shop', adept: 'madeleine_shop', expert: 'madeleine_shop2', master: 'madeleine_shop2' }
  },
  {
    id: 'provisions',
    title: 'Provisions',
    description: 'Food for the road',
    byTier: { apprentice: 'quinn_shop', adept: 'quade_shop_normal', expert: 'quade_shop_high1', master: 'jeanette_shop' }
  },
  {
    id: 'general',
    title: 'General Store',
    description: 'Tools, keys and sundries',
    byTier: { apprentice: 'zydar_shop', adept: 'arene_shop', expert: 'sean_shop', master: 'axiana_shop' }
  }
]
