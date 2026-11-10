// Claims de jugadores: cualquiera puede poner y quitar bloques en ellos (FTB Chunks "Editar bloques" = público).
// Los claims siguen sirviendo para cargar chunks, verlos en el mapa y proteger la interacción (cofres, puertas,
// máquinas), las entidades y las explosiones. El equipo de servidor del spawn no se toca: sigue privado.
// Se aplica al arrancar, cuando alguien entra y cada 5 minutos, así que vale para equipos viejos y nuevos y
// aunque alguien lo vuelva a cambiar en sus ajustes.
const CpFTBTeams = Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI')
const CpProps = Java.loadClass('dev.ftb.mods.ftbchunks.api.FTBChunksProperties')
const CpPrivacy = Java.loadClass('dev.ftb.mods.ftbteams.api.property.PrivacyMode')
const CP_EVERY = 20 * 60 * 5
let cpTick = 0

function cpApply() {
  let n = 0
  try {
    let mgr = CpFTBTeams.api().getManager()
    mgr.getTeams().forEach(t => {
      if (t.isServerTeam()) return
      if (t.getProperty(CpProps.BLOCK_EDIT_MODE) == CpPrivacy.PUBLIC) return
      t.setProperty(CpProps.BLOCK_EDIT_MODE, CpPrivacy.PUBLIC)
      try { t.markDirty(); mgr.syncToAll(t) } catch (e) { }
      n++
    })
  } catch (e) { console.warn('[claims] no se pudo ajustar: ' + e) }
  if (n > 0) console.info('[claims] editar bloques en público para ' + n + ' equipo(s)')
}

ServerEvents.loaded(event => cpApply())
PlayerEvents.loggedIn(event => cpApply())
ServerEvents.tick(event => { if (++cpTick >= CP_EVERY) { cpTick = 0; cpApply() } })
