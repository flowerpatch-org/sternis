// -------------------------------------------------------
// Shop catalogue
// To add a new item: add an entry to the array below.
// To change a price: update the `cost` field.
// -------------------------------------------------------

const SHOP_ITEMS = [
  // Small (5–8 stars)
  { id: 'movie-theater', name: 'Movie Theater',        emoji: '🎬', cost: 6,  category: 'small' },
  { id: 'fancy-snack',   name: 'Fancy snack / dessert',emoji: '🍰', cost: 4,  category: 'small' },

  // Medium (15–20 stars)
  { id: 'restaurant',    name: 'Restaurant dinner',    emoji: '🍽️', cost: 15, category: 'medium' },
  { id: 'day-trip',      name: 'Day trip',             emoji: '🚗', cost: 18, category: 'medium' },
  { id: 'hobby-gear',    name: 'New hobby gear',        emoji: '🛒', cost: 20, category: 'medium' },

  // Big (35–50 stars)
  { id: 'spa',           name: 'Spa day',              emoji: '🧖', cost: 35, category: 'big' },
  { id: 'weekend-trip',  name: 'Weekend trip',         emoji: '✈️', cost: 50, category: 'big' },
];

module.exports = SHOP_ITEMS;
