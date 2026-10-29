// Economía sin bancos: solo monedas físicas.
// Quita las recetas de todo lo bancario de Numismatics y bloquea los bloques
// bancarios que ya existan o se consigan por otras vías (creativo, loot...).
// Se mantienen: monedas, Vendor y Depositors (funcionan con monedas en mano).

const BANK_BLOCKS = [
  'numismatics:bank_terminal',
  'numismatics:blaze_banker',
  'numismatics:salepoint'
]

ServerEvents.recipes(event => {
  BANK_BLOCKS.forEach(id => event.remove({ output: id }))
  event.remove({ output: 'numismatics:banking_guide' })
  // tarjetas: <color>_card, <color>_id_card, <color>_authorized_card
  event.remove({ output: /^numismatics:.*_card$/ })
})

BANK_BLOCKS.forEach(id => {
  BlockEvents.rightClicked(id, event => {
    event.player.setStatusMessage(Text.red('Los bancos están desactivados en este servidor: usa monedas físicas.'))
    event.cancel()
  })
  BlockEvents.placed(id, event => event.cancel())
})
