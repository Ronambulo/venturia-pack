// Tumbas (Gravestone) al morir en el vacío: sin esto la tumba aparece en el fondo del mundo.
// Guardamos el último sitio donde cada jugador pisó suelo y, si muere por caer al vacío,
// lo movemos ahí antes de que se cree la tumba (la tumba se pone al soltar los objetos).
const LAST_GROUND = {}

PlayerEvents.tick(event => {
  let p = event.player
  if (p.age % 20 != 0 || !p.onGround() || p.isPassenger() || p.isSpectator()) return
  LAST_GROUND[String(p.uuid)] = { x: p.x, y: p.y, z: p.z, dim: String(p.level.dimension) }
})

EntityEvents.death(event => {
  let p = event.entity
  if (!p.isPlayer()) return
  let msg = ''
  try { msg = String(event.source.getMsgId()) } catch (e) { }
  if (msg != 'outOfWorld' && p.y >= p.level.getMinBuildHeight()) return
  let g = LAST_GROUND[String(p.uuid)]
  if (!g || g.dim != String(p.level.dimension)) return
  p.setPos(g.x, g.y, g.z)
})
