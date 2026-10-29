// Tótem del vacío (mod Void Totem): no se fabrica ni sale en las End Cities.
// Solo se consigue en la Caja del apostador de la tienda y en la subasta (/retos subasta).
ServerEvents.recipes(event => {
  event.remove({ output: 'voidtotem:totem_of_void_undying' })
})
