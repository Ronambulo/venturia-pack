// Recetas de mods que vienen en formato antiguo (1.20) y no cargan en 1.21.1.
// Se rehacen con el mismo id para que sustituyan a la rota.
ServerEvents.recipes(e => {
  // Farmer's Respite sobrescribe minecraft:red_dye (amapola -> tinte rojo) con un JSON roto:
  // se pierden las dos. Restauramos la vanilla y añadimos la de bayas de café aparte.
  e.shapeless('minecraft:red_dye', ['minecraft:poppy']).id('minecraft:red_dye')
  e.shapeless('minecraft:red_dye', ['farmersrespite:coffee_berries']).id('venturia:red_dye_from_coffee_berries')

  // Ender's Delight: cortar tarta de chorus con cuchillo -> 4 porciones
  e.custom({
    type: 'farmersdelight:cutting',
    ingredients: [{ item: 'endersdelight:chorus_pie' }],
    tool: { tag: 'c:tools/knife' },
    result: [{ item: { id: 'endersdelight:chorus_pie_slice', count: 4 } }]
  }).id('endersdelight:chorus_pie_slice')

  // Cook's Collection + Brewin' and Chewin': pizza en el horno (farmersdelight:dough no existe)
  e.custom({
    type: 'cookscollection:baking',
    ingredients: [
      { tag: 'c:foods/dough/wheat' },
      { item: 'farmersdelight:tomato_sauce' },
      { item: 'farmersdelight:beef_patty' },
      { item: 'minecraft:brown_mushroom' },
      { item: 'brewinandchewin:flaxen_cheese_wedge' }
    ],
    result: { id: 'brewinandchewin:pizza', count: 1 },
    cookingtime: 600
  }).id('brewinandchewin:pizza_from_dough')
})
