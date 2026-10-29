// Retos globales del servidor: compiten los equipos de FTB Teams.
//  - Carreras «El primero en...»: los 3 primeros equipos en lograr un hito ganan premio (1.º, trofeo).
//  - Metas cooperativas: contadores de todo el servidor por niveles; cada nivel paga a quien aportó.
//  - Reto semanal: al azar sin repetir hasta agotar la lista (cambia el lunes a las 00:00 UTC). Al cerrar
//    se premia el top 3; quien llega al mínimo del reto cobra un premio de participación al momento.
//  - Subasta semanal (cierra el sábado 20:00, hora de España) y tablón diario de encargos.
//  - Cazarrecompensas: 3 recompensas diarias por equipo (se renuevan con los encargos).
//  - Los contratos entre equipos están en la tienda (mod venturiatienda, F10); aquí solo se devuelven los antiguos.
//  - Funciones: el admin activa o desactiva cada parte (pestaña Admin · Funciones). Carreras empieza desactivada.
//  - HUD y avisos: cada 5 s se manda un resumen al mod para el HUD; toasts al superarte en la subasta y al cumplir
//    tu equipo una recompensa o un encargo.
//  - Equipos: la pestaña Equipo del mod crea y administra equipos de FTB Teams (/retos ui equipo ...).
//  - Interfaz: el mod venturiaretos (tecla F9, botón del inventario, tablón de retos) pide /retos ui y recibe el
//    estado en JSON; sin el mod todo sigue funcionando por chat (/retos texto).
//  - Eventos manuales (sin ninguno predefinido): los crea un admin en las pestañas de abajo de la interfaz; los
//    jugadores se apuntan (/retos eventos, /retos evento apuntar <id>) y el admin reparte trofeos y monedas.
//    Panel de admin (pestañas inferiores, solo op): eventos, subasta a mano y servidor (anuncios, trofeos, etc.).
// Comando: /retos [texto|eventos|evento apuntar|salir <id>|carreras|cooperativos|semanal|subasta|pujar <spurs>|encargos|entregar <n>|recompensas].
// Admin (op): /retos admin cerrarsemana | cerrarsubasta | nuevosencargos | reiniciar | funcion <clave>; /retos ui admin <acción> [texto]
// El estado se guarda como JSON en la persistentData del servidor; los premios a jugadores
// desconectados se entregan al entrar.

const FTBTeamsAPI = Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI')
const JavaUUID = Java.loadClass('java.util.UUID')
const KEY = 'venturia_retos'
const WEEK_MS = 604800000
const MONDAY0 = 345600000 // lunes 5-1-1970 00:00 UTC

// --- Carreras: adv (logro), dim (dimensión) o kill (entidad)
const RACES = [
  { id: 'globo', name: 'Primer vuelo', desc: 'Volar en una nave', adv: 'aeronautics:head_in_the_clouds' },
  { id: 'helice', name: 'Hélices', desc: 'Propulsar una nave', adv: 'aeronautics:in_thrust_we_trust' },
  { id: 'levitita', name: 'Objeto volador', desc: 'Nave de levitita', adv: 'aeronautics:unidentified_floating_object' },
  { id: 'nether', name: 'Al Nether', desc: 'Entrar en el Nether', dim: 'minecraft:the_nether' },
  { id: 'wither', name: 'Matawither', desc: 'Matar al Wither', kill: 'minecraft:wither' },
  { id: 'end', name: 'Al End', desc: 'Entrar en el End', dim: 'minecraft:the_end' },
  { id: 'dragon', name: 'Matadragones', desc: 'Matar al dragón del End', adv: 'minecraft:end/kill_dragon' },
  { id: 'warp', name: 'Salto warp', desc: 'Primer salto warp', adv: 'aerowarptics:first_warp' },
  { id: 'aether', name: 'Al Aether', desc: 'Entrar en el Aether', dim: 'aether:the_aether' },
  { id: 'orbita', name: 'En órbita', desc: 'Llegar a la órbita', dim: 'creatingspace:earth_orbit' },
  { id: 'luna', name: 'A la Luna', desc: 'Pisar la Luna', dim: 'creatingspace:the_moon' },
  { id: 'marte', name: 'A Marte', desc: 'Pisar Marte', dim: 'creatingspace:mars' },
  { id: 'venus', name: 'A Venus', desc: 'Pisar Venus', dim: 'creatingspace:venus' },
  { id: 'jefes', name: 'Cazajefes', desc: 'Todos los jefes de Block Factory', adv: 'block_factorys_bosses:kill_all_bosses' }
]
const RACE_PRIZES = [
  ['numismatics:cog 2'],     // 1.º (+ trofeo)
  ['numismatics:sprocket 2'], // 2.º
  ['numismatics:bevel 2']     // 3.º
]
const PLACE = ['§61.º', '§72.º', '§c3.º']

// --- Metas cooperativas
const BOSSES = ['minecraft:wither', 'minecraft:ender_dragon', 'minecraft:elder_guardian', 'minecraft:warden',
  'mowziesmobs:ferrous_wroughtnaut', 'mowziesmobs:frostmaw', 'mowziesmobs:umvuthi', 'mowziesmobs:sculptor',
  'undergarden:forgotten_guardian', 'eternal_starlight:lunar_monstrosity', 'eternal_starlight:starlight_golem',
  'eternal_starlight:the_gatekeeper', 'aether:slider', 'aether:valkyrie_queen', 'aether:sun_spirit',
  'cataclysm:netherite_monstrosity', 'cataclysm:ender_guardian', 'cataclysm:ignis', 'cataclysm:the_harbinger',
  'cataclysm:the_leviathan', 'cataclysm:ancient_remnant', 'cataclysm:maledictus', 'cataclysm:scylla']
const COOP = [
  { id: 'monstruos', name: 'Limpieza del cielo', unit: 'monstruos', tiers: [1000, 5000, 20000, 50000] },
  { id: 'bloques', name: 'Ciudad en las nubes', unit: 'bloques colocados', tiers: [10000, 50000, 200000, 500000] },
  { id: 'platos', name: 'Gran banquete', unit: 'platos de Delight', tiers: [200, 1000, 5000, 15000] },
  { id: 'jefes', name: 'Caída de los titanes', unit: 'jefes', tiers: [10, 50, 150, 400] },
  { id: 'logros', name: 'Saber colectivo', unit: 'logros', tiers: [500, 2000, 6000, 15000] }
]
const COOP_PRIZES = ['numismatics:bevel 2', 'numismatics:sprocket 2', 'numismatics:cog 1', 'numismatics:cog 2']

// --- Retos semanales (uno por semana, al azar sin repetir). min = mínimo por jugador para el premio de participación.
const WEEKLY = [
  { id: 'monstruos', name: 'Semana de caza', desc: 'Matar monstruos', min: 100 },
  { id: 'bloques', name: 'Semana de obras', desc: 'Colocar bloques', min: 1000 },
  { id: 'menas', name: 'Semana minera', desc: 'Picar menas', min: 64 },
  { id: 'troncos', name: 'Semana leñadora', desc: 'Talar troncos', min: 128 },
  { id: 'platos', name: 'Semana gourmet', desc: 'Comer platos de Delight', min: 20 },
  { id: 'logros', name: 'Semana de descubrimientos', desc: 'Conseguir logros', min: 10 },
  { id: 'nether', name: 'Semana infernal', desc: 'Matar monstruos en el Nether', min: 50 },
  { id: 'pesca', name: 'Semana de pesca', desc: 'Pescar peces', min: 20 },
  { id: 'jefes', name: 'Semana de jefes', desc: 'Matar jefes', min: 1 }
]
const WEEK_PRIZES = [['numismatics:cog 1'], ['numismatics:sprocket 2'], ['numismatics:sprocket 1']]
const PARTICIPATION_PRIZE = 'numismatics:bevel 2'
const LEADER_MSG_MS = 600000 // como mucho un aviso de cambio de líder cada 10 min
const DAY_MS = 86400000

// ---------------------------------------------------------------- estado
let S = null
function emptyState() { return { races: {}, coop: {}, week: null, pending: {}, aucs: [null, null, null], aucN: 0 } }

// Partes que el admin puede apagar. Lo que no está en S.feat usa el valor por defecto.
const FEATS = [
  { id: 'semanal', name: 'Reto semanal', desc: 'Un reto por semana con premios al top 3.', def: true },
  { id: 'subasta', name: 'Subasta', desc: 'Tres subastas por semana (cierran miércoles, viernes y sábado a las 20:00).', def: true },
  { id: 'encargos', name: 'Encargos del día', desc: 'Tablón diario de encargos por equipo.', def: true },
  { id: 'recompensas', name: 'Recompensas del día', desc: '3 recompensas diarias por equipo.', def: true },
  { id: 'carreras', name: 'Carreras', desc: 'Los 3 primeros equipos en lograr un hito.', def: false },
  { id: 'metas', name: 'Metas cooperativas', desc: 'Contadores de todo el servidor por niveles.', def: true },
  { id: 'eventos', name: 'Eventos', desc: 'Eventos que crea el admin a mano.', def: true }]
function feat(id) {
  let f = FEATS.find(x => x.id == id)
  let v = S && S.feat ? S.feat[id] : undefined
  return v === undefined || v === null ? (f ? f.def : true) : !!v
}
function featMap() { let o = {}; FEATS.forEach(f => { o[f.id] = feat(f.id) }); return o }
function featOff(id) { let f = FEATS.find(x => x.id == id); return ['§c' + (f ? f.name : id) + ' está desactivado en este servidor.'] }
function featToggle(server, id) {
  let f = FEATS.find(x => x.id == id)
  if (!f) return ['§cNo existe la función «' + id + '». Usa: ' + FEATS.map(x => x.id).join(', ')]
  if (!S.feat) S.feat = {}
  S.feat[id] = !feat(id)
  save(server)
  return ['§a' + f.name + (S.feat[id] ? ' activado.' : ' desactivado.')]
}
// KubeJS carga el script dos veces y eventos y comandos pueden quedar en copias distintas, así que
// no se guarda nada en memoria: cada evento relee el JSON de la persistentData, lo cambia y lo guarda.
function load(server) {
  try {
    let raw = String(server.persistentData.getString(KEY) || '')
    S = raw.length ? JSON.parse(raw) : emptyState()
  } catch (e) { console.warn('[retos] estado ilegible, se reinicia: ' + e); S = emptyState() }
  if (!S.races) S.races = {}
  if (!S.coop) S.coop = {}
  if (!S.pending) S.pending = {}
  // estado antiguo (rotación fija por índice)
  if (S.week && !S.week.id) S.week.id = WEEKLY[(S.week.idx || 0) % 7].id
  // subasta única antigua -> tres subastas (barata / media / lujo)
  if (!S.aucs) {
    S.aucs = [null, null, null]
    if (S.auc) { S.auc.tier = 2; S.aucs[2] = S.auc }
    S.aucN = S.auc ? S.auc.n : 0
    delete S.auc
  }
  return S
}
function save(server) { server.persistentData.putString(KEY, JSON.stringify(S)) }
function changed(server) { save(server) }

function weekNow() { return Math.floor((Date.now() - MONDAY0) / WEEK_MS) }
function weeklyFor(id) { return WEEKLY.find(w => w.id == id) || WEEKLY[0] }
// Bolsa barajada: no se repite ningún reto hasta que salen todos.
function drawWeekly(avoid) {
  if (!S.bag || !S.bag.length) S.bag = WEEKLY.map(w => w.id).filter(id => id != avoid)
  return S.bag.splice(Math.floor(Math.random() * S.bag.length), 1)[0]
}

function teamOf(player) {
  try {
    let opt = FTBTeamsAPI.api().getManager().getTeamForPlayer(player)
    if (opt.isPresent()) {
      let t = opt.get()
      return { id: String(t.getId()), name: String(t.getName().getString()) }
    }
  } catch (e) { }
  return { id: 'p:' + player.username, name: String(player.username) }
}

// ---------------------------------------------------------------- premios y avisos
function onlinePlayer(server, name) {
  let found = null
  server.players.forEach(p => { if (String(p.username) == name) found = p })
  return found
}
function giveCmds(server, name, cmds) {
  if (onlinePlayer(server, name)) {
    cmds.forEach(c => server.runCommandSilent(c.split('@P').join(name)))
  } else {
    if (!S.pending[name]) S.pending[name] = []
    cmds.forEach(c => S.pending[name].push(c))
  }
}
function coinCmd(spec) { return 'give @P ' + spec }
// Estadísticas para la pestaña Datos del admin: spurs que crea el servidor (premios) y que desaparecen (subastas, comisiones).
function eco(kind, spurs) {
  if (!(spurs > 0)) return
  if (!S.eco) S.eco = {}
  S.eco[kind] = (S.eco[kind] || 0) + spurs
}
function clean(t) { return String(t).replace(/["'\\]/g, '') }
// Trofeo de Advancement Trophies Reforged (su reparto por logros lo anula el mod venturiaretos).
// tier: diamond/gold/iron/netherite; icon: objeto que flota encima; achiever = el jugador (@P).
const TROPHY_TIER = ['diamond', 'gold', 'iron']
const PLACE_TXT = ['1.er puesto', '2.º puesto', '3.er puesto']
function trophyCmd(tier, icon, title, lore) {
  title = clean(title); lore = clean(lore)
  let d = new Date()
  return 'give @P advancementtrophies:' + tier + '_trophy[advancementtrophies:trophy_data={achiever:"@P",date:{year:' + d.getFullYear() +
    ',month:' + (d.getMonth() + 1) + ',day:' + d.getDate() + ',hour:' + d.getHours() + ',minute:' + d.getMinutes() + ',second:' + d.getSeconds() +
    '},advancement_title_json:\'{"text":"' + title + '"}\',advancement_mod:"Retos Venturia",icon:{id:"' + (icon || 'minecraft:nether_star') +
    '",count:1}},lore=[\'{"text":"' + lore + '","color":"gray","italic":false}\']]'
}
// Líneas de chat: texto o componente. line('a', teamText(...), 'b') une trozos.
function comp(l) { return typeof l == 'string' ? Text.of(l) : l }
function line() {
  let c = Text.of('')
  for (let i = 0; i < arguments.length; i++) c.append(comp(arguments[i]))
  return c
}
// Nombre del equipo en verde; al pasar el ratón enseña sus integrantes.
function membersOf(teamId) {
  if (teamId.indexOf('p:') == 0) return [teamId.substring(2)]
  try {
    let mgr = FTBTeamsAPI.api().getManager()
    let opt = mgr.getTeamByID(JavaUUID.fromString(teamId))
    if (!opt.isPresent()) return []
    let names = []
    opt.get().getMembers().forEach(u => {
      let n = null
      try { let pt = mgr.getPlayerTeamForPlayerID(u); if (pt.isPresent()) n = String(pt.get().getName().getString()) } catch (e) { }
      names.push(n || String(u))
    })
    return names.sort()
  } catch (e) { return [] }
}
function teamText(teamId, name) {
  let m = membersOf(teamId)
  let hover = '§6' + name + '\n§7' + (m.length ? m.join('\n') : 'Integrantes desconocidos')
  return Text.of('§a' + name).hover(Text.of(hover))
}
function announce(server, lines, sound) {
  lines.forEach(l => { server.tell(comp(l)); logAnn(String(comp(l).getString())) })
  if (sound) server.runCommandSilent('execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s')
}
// Registro para la pestaña Admin · Registro: todo lo que se anuncia más lo que hace el staff.
const LOG_MAX = 400
function logAdd(kind, text) {
  if (!S.log) S.log = []
  S.log.push({ t: Date.now(), k: kind, s: String(text).substring(0, 240) })
  let old = Date.now() - 30 * DAY_MS
  while (S.log.length && (S.log.length > LOG_MAX || S.log[0].t < old)) S.log.shift()
}
function logAnn(t) {
  let k = t.indexOf('[Eventos]') >= 0 ? 'ev' : t.indexOf('[Anuncio]') >= 0 ? 'staff' : t.indexOf('[Equipos]') >= 0 ? 'eq'
    : t.indexOf('ubasta') >= 0 || t.indexOf(' puja ') >= 0 ? 'sub' : t.indexOf('contrato') >= 0 || t.indexOf(' pide ') >= 0 ? 'ctr' : 'pre'
  logAdd(k, t.replace(/^§e\[(Retos|Eventos|Equipos)\] /, '').replace(/^§6\[Anuncio\] /, '§6Anuncio: '))
}
function dateStr() { let d = new Date(); return d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() }

// ---------------------------------------------------------------- carreras
function raceWin(server, race, player) {
  if (!feat('carreras')) return
  let list = S.races[race.id] || (S.races[race.id] = [])
  if (list.length >= 3) return
  let team = teamOf(player)
  if (list.some(w => w.team == team.id)) return
  let place = list.length
  let name = String(player.username)
  list.push({ team: team.id, teamName: team.name, player: name, date: dateStr() })
  let cmds = RACE_PRIZES[place].map(coinCmd)
  eco('carreras', RACE_PRIZES[place].reduce((a, sp) => a + specSpurs(sp), 0))
  cmds.push(trophyCmd(TROPHY_TIER[place], RACE_ICON[race.id], race.name, PLACE_TXT[place] + ': ' + race.desc + ' (equipo ' + team.name + ')'))
  giveCmds(server, name, cmds)
  announce(server, [line('§e[Retos] ' + PLACE[place] + ' §bpuesto en §f' + race.name + '§b: equipo ', teamText(team.id, team.name), ' §7(' + name + ')')], place == 0)
  save(server)
}
function checkRaces(server) {
  server.players.forEach(p => {
    let dim = String(p.level.getDimension())
    RACES.forEach(r => {
      if (r.kill) return
      let list = S.races[r.id]
      if (list && list.length >= 3) return
      let ok = false
      if (r.dim) ok = dim == r.dim
      else { try { ok = p.isAdvancementDone(r.adv) } catch (e) { ok = false } }
      if (ok) raceWin(server, r, p)
    })
  })
}

// ---------------------------------------------------------------- cooperativos
function coopAdd(server, id, player, n) {
  if (!feat('metas')) return
  let def = COOP.find(c => c.id == id)
  let st = S.coop[id] || (S.coop[id] = { total: 0, tier: 0, by: {} })
  let name = String(player.username)
  st.total += n
  st.by[name] = (st.by[name] || 0) + n
  changed(server)
  while (st.tier < def.tiers.length && st.total >= def.tiers[st.tier]) {
    let tier = st.tier
    st.tier++
    Object.keys(st.by).forEach(pn => giveCmds(server, pn, [coinCmd(COOP_PRIZES[tier])]))
    eco('metas', Object.keys(st.by).length * specSpurs(COOP_PRIZES[tier]))
    let lines = ['§e[Retos] §bMeta cooperativa §f' + def.name + ' §bnivel ' + (tier + 1) + ' (' + def.tiers[tier] + ' ' + def.unit + ')!',
      '§7Todos los que aportaron (' + Object.keys(st.by).length + ') reciben su premio.']
    if (st.tier == def.tiers.length) {
      let best = Object.keys(st.by).sort((a, b) => st.by[b] - st.by[a])[0]
      giveCmds(server, best, [trophyCmd('netherite', COOP_ICON[def.id], def.name, 'Mayor aporte a la meta cooperativa (' + st.by[best] + ' ' + def.unit + ')')])
      lines.push('§6Trofeo para §a' + best + '§6, el que más aportó.')
    }
    announce(server, lines, true)
  }
}

// ---------------------------------------------------------------- semanal
function weekRanking() {
  return Object.keys(S.week.by).map(k => { S.week.by[k].id = k; return S.week.by[k] }).filter(t => t.score > 0).sort((a, b) => b.score - a.score)
}
function weekAdd(server, metric, player, n) {
  if (!feat('semanal')) return
  if (!S.week || S.week.id != metric) return
  let def = weeklyFor(metric)
  let team = teamOf(player)
  let name = String(player.username)
  let t = S.week.by[team.id] || (S.week.by[team.id] = { name: team.name, score: 0, players: {} })
  t.name = team.name
  t.score += n
  t.players[name] = (t.players[name] || 0) + n
  // premio de participación
  if (!S.week.paid) S.week.paid = {}
  if (!S.week.paid[name] && t.players[name] >= def.min) {
    S.week.paid[name] = true
    giveCmds(server, name, [coinCmd(PARTICIPATION_PRIZE)])
    eco('semanal', specSpurs(PARTICIPATION_PRIZE))
    player.tell(Text.of('§e[Retos] §bHas llegado al mínimo del reto semanal (' + def.min + '): §f2 bevel§b de premio. ¡Sigue sumando para el top 3!'))
  }
  // cambio de líder
  let top = weekRanking()[0]
  if (top && top.id == team.id && S.week.leader != team.id) {
    S.week.leader = team.id
    if (Date.now() - (S.week.leaderMsg || 0) > LEADER_MSG_MS) {
      S.week.leaderMsg = Date.now()
      announce(server, [line('§e[Retos] §bEl equipo ', teamText(team.id, team.name), ' §bva 1.º en la §f' + def.name + ' §7(' + t.score + ')')], false)
    }
  }
  changed(server)
}
function closeWeek(server) {
  let def = weeklyFor(S.week.id)
  let ranking = weekRanking().slice(0, 3)
  let lines = ['§e[Retos] §bFin de la §f' + def.name + '§b.']
  if (!ranking.length) lines.push('§7Nadie participó esta semana.')
  ranking.forEach((t, i) => {
    let names = Object.keys(t.players)
    names.forEach(pn => giveCmds(server, pn, WEEK_PRIZES[i].map(coinCmd)))
    eco('semanal', names.length * WEEK_PRIZES[i].reduce((a, sp) => a + specSpurs(sp), 0))
    // trofeo para el que más aportó de cada equipo del podio
    let best = names.sort((a, b) => t.players[b] - t.players[a])[0]
    giveCmds(server, best, [trophyCmd(TROPHY_TIER[i], WEEK_ICON[def.id], def.name, PLACE_TXT[i] + ': equipo ' + t.name + ', ' + t.score + ' puntos')])
    lines.push(line(PLACE[i] + ' ', teamText(t.id, t.name), ' §7- ' + t.score + ' (' + def.desc.toLowerCase() + ')'))
  })
  announce(server, lines, ranking.length > 0)
}
function nextMonday() { return (weekNow() + 1) * WEEK_MS + MONDAY0 }
function startWeek(server) {
  let prev = S.week ? S.week.id : null
  let id = S.next && S.next != prev ? S.next : drawWeekly(prev)
  S.next = drawWeekly(id)
  S.week = { id: id, end: nextMonday(), by: {}, paid: {}, base: {} }
  let def = weeklyFor(id)
  announce(server, ['§e[Retos] §bNuevo reto semanal: §f' + def.name + ' §7(' + def.desc + '; ' + def.min + ' para el premio de participación). Mira /retos semanal'], false)
}
function checkWeek(server) {
  if (!S.week) { startWeek(server); save(server); return }
  if (Date.now() >= (S.week.end || 0)) { closeWeek(server); startWeek(server); save(server); return }
  if (!S.week.warned && S.week.end - Date.now() <= DAY_MS) {
    S.week.warned = true
    let def = weeklyFor(S.week.id)
    let lines = ['§e[Retos] §bQueda menos de 1 día de la §f' + def.name + '§b.']
    weekRanking().slice(0, 3).forEach((t, i) => lines.push(line(PLACE[i] + ' ', teamText(t.id, t.name), ' §7- §f' + t.score)))
    if (lines.length == 1) lines.push('§7Nadie ha puntuado aún: hay premio para quien se anime.')
    announce(server, lines, false)
    save(server)
  }
}
// Retos medidos con estadísticas del juego: se suma lo que sube la estadística desde la última lectura.
const STAT_WEEKLY = { pesca: p => p.stats.fishCaught }
function checkStats(server) {
  let read = S.week && STAT_WEEKLY[S.week.id]
  if (!read) return
  if (!S.week.base) S.week.base = {}
  server.players.forEach(p => {
    let name = String(p.username), cur
    try { cur = Number(read(p)) } catch (e) { return }
    let last = S.week.base[name]
    S.week.base[name] = cur
    if (last == null) { changed(server); return }
    if (cur > last) weekAdd(server, S.week.id, p, cur - last)
  })
}

// ---------------------------------------------------------------- HUD y avisos (mod venturiaretos)
// Cada 5 s se manda a cada jugador un resumen pequeño (reto semanal, recompensas del día y subasta) que el mod
// pinta en pantalla; el jugador elige qué partes ve. Los toasts avisan de que te superan en la subasta y de
// recompensas o encargos cumplidos por tu equipo.
function hudState(p) {
  let now = Date.now(), name = String(p.username), team = teamOf(p), h = {}
  if (S.week && feat('semanal')) {
    let def = weeklyFor(S.week.id), mine = 0, rank = weekRanking(), pos = -1
    Object.keys(S.week.by).forEach(k => { mine += S.week.by[k].players[name] || 0 })
    for (let i = 0; i < rank.length; i++) if (rank[i].id == team.id) { pos = i; break }
    h.week = { name: def.name, icon: WEEK_ICON[def.id] || 'minecraft:clock', left: S.week.end - now, min: def.min, mine: mine,
      paid: !!(S.week.paid && S.week.paid[name]), pos: pos + 1, score: pos >= 0 ? rank[pos].score : 0, teams: rank.length }
  }
  if (S.bnt && feat('recompensas')) {
    let prog = S.bnt.prog[team.id] || [0, 0, 0], done = S.bnt.done[team.id] || []
    h.bnt = { left: nextMidnight() - now, list: S.bnt.list.map((id, i) => {
      let b = bountyFor(id) || { name: id, icon: 'minecraft:barrier', goal: 1 }
      return { name: b.name, icon: b.icon, prog: prog[i] || 0, goal: b.goal, done: !!done[i], tier: BOUNTY_TIERS[i] }
    }) }
  }
  let soon = feat('subasta') ? soonestAuction() : null
  if (soon) {
    let a = soon, lot = a.lot, crate = lot.crate ? (CRATES[lot.crate] || { name: lot.crate }) : null
    h.auc = { tier: AUC_TIERS[a.tier].name, item: crate ? 'minecraft:chest' : lot.item, count: crate ? (lot.rolls || 1) : (lot.count || 1), name: crate ? crate.name : '',
      left: a.end - now, bid: a.bid ? a.bid.amount : 0, bidder: a.bid ? a.bid.player : '', mine: !!(a.bid && a.bid.player == name), min: minBid(a) }
  }
  return h
}
function sendHud(p) {
  let rn = retosNet()
  if (!rn || !p) return
  try { rn.hud(p, JSON.stringify(hudState(p))) } catch (e) { }
}
function toast(p, title, desc, icon) {
  let rn = retosNet()
  if (!rn || !p) return
  try { rn.toast(p, title, desc, icon || 'minecraft:paper') } catch (e) { }
}
function toastTeam(server, teamId, title, desc, icon) {
  server.players.forEach(q => { if (teamOf(q).id == teamId) toast(q, title, desc, icon) })
}
function coinShort(spurs) { let b = coinBreakdown(spurs); return b.length ? b.map(x => x[1] + ' ' + COIN_NAMES[x[0]]).join(' ') : '0' }
function specShort(spec) { let s = spec.replace('numismatics:', '').split(' '); return (s[1] || 1) + ' ' + s[0] }
function aucIcon(a) { return a && a.lot.crate ? 'minecraft:chest' : a ? a.lot.item : 'numismatics:crown' }
function soonestAuction() { return S.aucs.filter(a => a).sort((x, y) => x.end - y.end)[0] || null }

// ---------------------------------------------------------------- eventos
let ticks = 0
ServerEvents.tick(event => {
  ticks++
  if (ticks % 100 != 0) return
  let server = event.server
  load(server)
  if (feat('carreras')) checkRaces(server)
  if (feat('semanal') && (ticks % 1200 == 0 || ticks == 100)) checkWeek(server)
  if (feat('semanal')) checkStats(server)
  if (ticks % 1200 == 0 || ticks == 100) {
    if (feat('subasta')) checkAuction(server)
    if (feat('encargos')) checkOrders(server)
    if (feat('recompensas')) checkBounties(server)
    refundOldContracts(server)
  }
  if (feat('recompensas')) checkBountyPlayers(server)
  if (feat('eventos')) evCheck(server)
  server.players.forEach(p => sendHud(p))
})

// En KubeJS 7 el DamageSource se ve como `actual` (quien causa el daño) y `player`.
function killerOf(event) {
  let src = event.source
  let tries = [() => src.actual, () => src.player, () => src.getEntity(), () => event.entity.getKillCredit()]
  for (let i = 0; i < tries.length; i++) {
    try { let k = tries[i](); if (k && k.isPlayer()) return k } catch (e) { }
  }
  return null
}
EntityEvents.death(event => {
  let p = killerOf(event)
  let e = event.entity
  let type = String(e.type)
  if (!p) return
  let server = p.server
  load(server)
  RACES.forEach(r => { if (r.kill == type) raceWin(server, r, p) })
  if (BOSSES.indexOf(type) >= 0 || type.indexOf('block_factorys_bosses:') == 0) {
    coopAdd(server, 'jefes', p, 1)
    weekAdd(server, 'jefes', p, 1)
  }
  if (e.isMonster()) {
    coopAdd(server, 'monstruos', p, 1)
    weekAdd(server, 'monstruos', p, 1)
    if (String(p.level.getDimension()) == 'minecraft:the_nether') weekAdd(server, 'nether', p, 1)
  }
  bountyKill(server, p, e, event)
})

BlockEvents.placed(event => {
  let p = event.entity
  if (!p || !p.isPlayer()) return
  load(p.server)
  coopAdd(p.server, 'bloques', p, 1)
  weekAdd(p.server, 'bloques', p, 1)
})

BlockEvents.broken(event => {
  let p = event.player
  if (!p) return
  let id = String(event.block.id)
  load(p.server)
  if (id.indexOf('_ore') >= 0) weekAdd(p.server, 'menas', p, 1)
  else if (/(_log|_stem|_wood|_hyphae)$/.test(id) && id.indexOf('stripped_') < 0) weekAdd(p.server, 'troncos', p, 1)
})

ItemEvents.foodEaten(event => {
  let p = event.entity
  if (!p || !p.isPlayer()) return
  let id = String(event.item.id)
  if (id.split(':')[0].indexOf('delight') < 0) return
  load(p.server)
  coopAdd(p.server, 'platos', p, 1)
  weekAdd(p.server, 'platos', p, 1)
})

function advId(a) {
  try { return String(a.id) } catch (e) { }
  try { return String(a.holder().id()) } catch (e) { }
  return ''
}
PlayerEvents.advancement(event => {
  let p = event.entity
  let id = advId(event.advancement)
  if (!p || !id || id.indexOf(':recipes/') >= 0) return
  load(p.server)
  coopAdd(p.server, 'logros', p, 1)
  weekAdd(p.server, 'logros', p, 1)
})

PlayerEvents.loggedIn(event => {
  let p = event.player
  let server = p.server
  load(server)
  let name = String(p.username)
  markSeen(p, true)
  let pend = S.pending[name]
  if (pend && pend.length) {
    delete S.pending[name]
    pend.forEach(c => server.runCommandSilent(c.split('@P').join(name)))
    p.tell(Text.of('§e[Retos] §bHas recibido ' + pend.length + ' premio(s) de retos mientras no estabas.'))
    save(server)
  }
  p.tell(Text.of('§6[Venturia] §fF9 §bRetos' + (S.week && feat('semanal') ? ' §7(reto semanal: §f' + weeklyFor(S.week.id).name + '§7)' : '')
    + ' §8· §fF10 §bTienda §7(comprar, vender, cajas, mercado y contratos entre equipos)'))
  evNotify(p)
  save(server)
})
PlayerEvents.loggedOut(event => {
  let p = event.player
  load(p.server)
  markSeen(p, false)
  save(p.server)
})
// Registro de jugadores para el panel de admin: primera y última conexión, tiempo jugado, equipo y días activos.
function playMins(p) { try { return Math.floor(Number(p.stats.playTime) / 1200) } catch (e) { return 0 } }
function markSeen(p, login) {
  let name = String(p.username), now = Date.now()
  if (!S.seen) S.seen = {}
  let s = S.seen[name] || (S.seen[name] = { first: now, n: 0 })
  s.last = now
  s.team = teamOf(p).name
  let m = playMins(p)
  if (m > 0) s.play = m
  if (!login) return
  s.n++
  if (!S.act) S.act = {}
  let d = String(madridDay(now))
  let l = S.act[d] || (S.act[d] = [])
  if (l.indexOf(name) < 0) l.push(name)
  Object.keys(S.act).forEach(k => { if (Number(k) < Number(d) - 20) delete S.act[k] })
}

// ================================================================ subasta y encargos
// Subasta semanal: un lote (objeto raro o caja de la tienda); se puja con /retos pujar <spurs>, el dinero se
// cobra al pujar (de todas las monedas del inventario, con cambio) y se devuelve si te superan. Cierra el
// sábado a las 20:00 (hora de España). El dinero ganador desaparece.
// Encargos: tablón diario (00:00 hora de España) con 2 fáciles, 2 medios y 1 difícil. Cada equipo puede
// cumplir cada encargo una vez al día con /retos entregar <n>. Lo farmeable (farm: true) pide más cada semana.

// <cajas> (lo genera config/ftbquests_build/book.py a partir de reward_tables: no editar a mano)
const CRATES = {"create_base_tier_1": {"name": "Caja de Create básica", "size": 1, "rows": [["minecraft:andesite", 8, 0, 1.0], ["minecraft:andesite", 16, 0, 1.0], ["create:andesite_alloy", 4, 0, 1.0], ["create:andesite_alloy", 8, 0, 1.0], ["create:andesite_alloy", 32, 0, 0.75], ["create:shaft", 4, 0, 1.0], ["create:shaft", 8, 0, 1.0], ["create:cogwheel", 2, 0, 1.0], ["create:cogwheel", 4, 0, 1.0], ["create:large_cogwheel", 2, 0, 1.0], ["create:large_cogwheel", 4, 0, 1.0], ["create:andesite_casing", 1, 0, 1.0], ["create:andesite_casing", 4, 0, 1.0]]}, "create_tier_1": {"name": "Caja de Create I", "size": 1, "rows": [["create:iron_sheet", 4, 0, 1.0], ["create:golden_sheet", 4, 0, 1.0], ["create:copper_sheet", 4, 0, 1.0], ["create:iron_sheet", 8, 0, 1.0], ["create:golden_sheet", 8, 0, 1.0], ["create:copper_sheet", 8, 0, 1.0], ["create:clutch", 1, 0, 1.0], ["create:clutch", 2, 0, 1.0], ["create:gearshift", 1, 0, 1.0], ["create:gearshift", 2, 0, 1.0], ["create:andesite_funnel", 4, 0, 1.0], ["create:andesite_tunnel", 4, 0, 1.0], ["minecraft:copper_block", 2, 0, 1.0], ["minecraft:copper_block", 4, 0, 0.75], ["minecraft:copper_block", 16, 0, 0.05], ["create:fluid_pipe", 4, 0, 0.825], ["create:fluid_pipe", 8, 0, 1.0], ["create:fluid_pipe", 16, 0, 0.825], ["create:fluid_tank", 1, 0, 1.0], ["create:redstone_link", 2, 0, 1.0], ["create:speedometer", 1, 0, 1.0], ["create:stressometer", 1, 0, 1.0], ["create:chain_conveyor", 1, 0, 1.0], ["create:cardboard", 16, 0, 1.0], ["createaddition:spool", 4, 0, 1.0], ["createaddition:copper_spool", 1, 0, 1.0], ["create:copper_backtank", 4, 0, 1.0], ["createbigcannons:casting_sand", 2, 0, 1.0], ["create:andesite_alloy", 16, 0, 1.0]]}, "create_tier_2": {"name": "Caja de Create II", "size": 1, "rows": [["create:brass_ingot", 4, 0, 1.0], ["create:brass_ingot", 8, 0, 0.825], ["create:brass_ingot", 64, 0, 0.125], ["create:brass_casing", 4, 0, 1.0], ["create:brass_casing", 8, 0, 0.825], ["create:andesite_alloy", 16, 0, 1.0], ["create:super_glue", 4, 0, 1.0], ["create:andesite_funnel", 4, 0, 1.0], ["create:andesite_tunnel", 4, 0, 1.0], ["create:brass_funnel", 2, 0, 1.0], ["create:brass_tunnel", 2, 0, 1.0], ["create:pulse_repeater", 2, 0, 1.0], ["create:pulse_extender", 2, 0, 1.0], ["create:pulse_timer", 2, 0, 1.0], ["create:item_vault", 8, 0, 1.0], ["create:stock_link", 1, 0, 1.0], ["create:packager", 1, 0, 1.0], ["create:blaze_cake", 2, 0, 1.0], ["createbigcannons:casting_sand", 4, 0, 1.0], ["createbigcannons:big_cartridge", 1, 0, 1.0], ["createbigcannons:solid_shot", 2, 0, 1.0], ["createbigcannons:powder_charge", 4, 0, 1.0], ["createaddition:alternator", 1, 0, 1.0]]}, "create_tier_3": {"name": "Caja de Create III", "size": 1, "rows": [["createaddition:alternator", 1, 0, 1.0], ["createaddition:electric_motor", 1, 0, 1.0], ["minecraft:netherite_ingot", 4, 0, 1.0]]}, "aero1": {"name": "Caja de aeronáutica", "size": 1, "rows": [["simulated:physics_assembler", 1, 0, 1.0], ["simulated:contraption_diagram", 1, 0, 1.0], ["simulated:honey_glue", 1, 0, 1.0], ["aeronautics:white_envelope", 2, 2, 1.0], ["aeronautics:white_envelope", 4, 4, 0.65], ["aeronautics:adjustable_burner", 1, 0, 0.75], ["simulated:white_symmetric_sail", 4, 4, 1.0], ["aeronautics:levitite_blend_bucket", 1, 1, 0.6], ["simulated:red_portable_engine", 1, 0, 0.5]]}, "aero2": {"name": "Caja de aeronáutica rara", "size": 1, "rows": [["offroad:tire", 2, 2, 1.0], ["simulated:physics_assembler", 2, 0, 1.0], ["simulated:honey_glue", 2, 0, 1.0], ["aeronautics:levitite", 2, 4, 1.0], ["aeronautics:white_envelope", 8, 4, 1.0], ["createpropulsion:copycat_wing", 8, 0, 1.0], ["simulated:rope_coupling", 8, 0, 1.0], ["simulated:redstone_magnet", 2, 0, 1.0], ["simulated:red_portable_engine", 1, 0, 1.0], ["simulated:laser_pointer", 1, 0, 1.0], ["simulated:laser_sensor", 1, 0, 1.0]]}, "create_cannon_cartidge": {"name": "Caja de munición", "size": 1, "rows": [["createbigcannons:filled_autocannon_cartridge", 1, 0, 1.0], ["createbigcannons:machine_gun_round", 1, 0, 1.0], ["createbigcannons:autocannon_ammo_container", 1, 0, 1.25], ["createbigcannons:solid_shot", 1, 0, 1.0], ["createbigcannons:ap_shot", 1, 0, 1.0], ["createbigcannons:bag_of_grapeshot", 1, 0, 1.0], ["createbigcannons:he_shell", 1, 0, 1.0], ["createbigcannons:ap_shell", 1, 0, 1.0], ["createbigcannons:shrapnel_shell", 1, 0, 1.0], ["createbigcannons:fluid_shell", 1, 0, 1.0], ["createbigcannons:smoke_shell", 1, 0, 1.0], ["createbigcannons:drop_mortar_shell", 1, 0, 1.0], ["createbigcannons:mortar_stone", 1, 0, 1.0], ["createbigcannons:powder_charge", 2, 0, 1.75], ["createbigcannons:powder_charge", 1, 0, 2.5]]}}
// </cajas>

const COINS = [['numismatics:sun', 4096], ['numismatics:crown', 512], ['numismatics:cog', 64],
  ['numismatics:sprocket', 16], ['numismatics:bevel', 8], ['numismatics:spur', 1]]
const COIN_NAMES = { 'numismatics:sun': 'sun', 'numismatics:crown': 'crown', 'numismatics:cog': 'cog',
  'numismatics:sprocket': 'sprocket', 'numismatics:bevel': 'bevel', 'numismatics:spur': 'spur' }

// Lotes de subasta: tier 0 barata (cierra el miércoles), 1 media (viernes), 2 lujo (sábado). price = puja inicial en spurs. crate = caja de la tienda (rolls = veces que se abre).
const LOTS = [
  { item: 'minecraft:elytra', count: 1, price: 512, tier: 2 },
  { item: 'minecraft:beacon', count: 1, price: 512, tier: 2 },
  { item: 'minecraft:netherite_ingot', count: 2, price: 256, tier: 2 },
  { item: 'minecraft:nether_star', count: 1, price: 256, tier: 2 },
  { item: 'minecraft:enchanted_golden_apple', count: 1, price: 192, tier: 2 },
  { item: 'voidtotem:totem_of_void_undying', count: 2, price: 128, tier: 1 },
  { item: 'minecraft:totem_of_undying', count: 2, price: 96, tier: 0 },
  { item: 'minecraft:trident', count: 1, price: 128, tier: 1 },
  { item: 'minecraft:shulker_shell', count: 4, price: 128, tier: 1 },
  { item: 'aeronautics:levitite', count: 64, price: 128, tier: 1 },
  { item: 'create:precision_mechanism', count: 16, price: 128, tier: 1 },
  { item: 'minecraft:diamond', count: 16, price: 96, tier: 0 },
  { item: 'cataclysm:essence_of_the_storm', count: 2, price: 384, tier: 2 },
  { item: 'cataclysm:ignitium_ingot', count: 2, price: 256, tier: 2 },
  { item: 'cataclysm:void_core', count: 1, price: 192, tier: 2 },
  { item: 'cataclysm:cursium_ingot', count: 2, price: 192, tier: 1 },
  { item: 'cataclysm:witherite_ingot', count: 4, price: 192, tier: 1 },
  { item: 'cataclysm:lava_power_cell', count: 16, price: 96, tier: 0 },
  { item: 'farmersdelight:honey_glazed_ham_block', count: 2, price: 64, tier: 0 },
  { item: 'candlelight:beef_wellington', count: 16, price: 64, tier: 0 },
  { item: 'bakery:chocolate_gateau', count: 4, price: 64, tier: 0 },
  { item: 'brewinandchewin:flaxen_cheese_wheel', count: 4, price: 64, tier: 0 },
  { item: 'brewery:whiskey_jojannik', count: 4, price: 96, tier: 0 },
  { crate: 'create_tier_3', rolls: 3, price: 128, tier: 1 },
  { crate: 'aero2', rolls: 3, price: 128, tier: 1 },
  { crate: 'create_tier_2', rolls: 3, price: 64, tier: 0 },
  { crate: 'aero1', rolls: 3, price: 64, tier: 0 },
  { crate: 'create_cannon_cartidge', rolls: 3, price: 64, tier: 0 }
]
const AUC_TIERS = [{ name: 'Barata', dow: 3, day: 'miércoles' }, { name: 'Media', dow: 5, day: 'viernes' }, { name: 'Lujo', dow: 6, day: 'sábado' }]
const BID_STEP = 0.10 // cada puja supera la anterior en al menos un 10 %

// Encargos. qty = cantidad base; farm = la cantidad sube cada semana (+25 %/semana, hasta x4).
const ORDERS = {
  facil: [
    { item: 'minecraft:wheat', qty: 64, farm: true }, { item: 'minecraft:carrot', qty: 64, farm: true },
    { item: 'minecraft:potato', qty: 64, farm: true }, { item: 'minecraft:sugar_cane', qty: 64, farm: true },
    { item: 'minecraft:pumpkin', qty: 16, farm: true }, { item: 'minecraft:melon_slice', qty: 64, farm: true },
    { item: 'minecraft:kelp', qty: 64, farm: true }, { item: 'minecraft:bamboo', qty: 64, farm: true },
    { item: 'minecraft:cobblestone', qty: 256, farm: true }, { item: 'minecraft:egg', qty: 32, farm: true },
    { item: 'minecraft:leather', qty: 16, farm: true }, { item: 'minecraft:white_wool', qty: 32, farm: true },
    { item: 'farmersdelight:tomato', qty: 32, farm: true }, { item: 'farmersdelight:cabbage', qty: 32, farm: true },
    { item: 'farmersdelight:onion', qty: 32, farm: true }, { item: 'farmersdelight:rice', qty: 32, farm: true },
    { item: 'minecraft:rotten_flesh', qty: 64, farm: true }, { item: 'minecraft:bone', qty: 32, farm: true },
    { item: 'minecraft:string', qty: 32, farm: true },
    { item: 'create:andesite_alloy', qty: 32 }, { item: 'create:shaft', qty: 32 }, { item: 'create:cogwheel', qty: 16 },
    { item: 'create:andesite_casing', qty: 16 }, { item: 'create:belt_connector', qty: 8 },
    { item: 'minecraft:bread', qty: 32 }, { item: 'farmersdelight:mixed_salad', qty: 4 },
    { item: 'farmersdelight:fruit_salad', qty: 4 }, { item: 'farmersdelight:barbecue_stick', qty: 8 },
    { item: 'minecraft:spider_eye', qty: 16, farm: true }, { item: 'minecraft:gunpowder', qty: 16, farm: true },
    { item: 'minecraft:arrow', qty: 64 },
    { item: 'farm_and_charm:barley', qty: 32, farm: true }, { item: 'farm_and_charm:oat', qty: 32, farm: true },
    { item: 'farm_and_charm:lettuce', qty: 32, farm: true }, { item: 'farm_and_charm:strawberry', qty: 32, farm: true },
    { item: 'farm_and_charm:corn', qty: 32, farm: true }, { item: 'brewery:hops', qty: 32, farm: true },
    { item: 'culturaldelights:cucumber', qty: 32, farm: true }, { item: 'culturaldelights:eggplant', qty: 32, farm: true },
    { item: 'cookscollection:lemon', qty: 16, farm: true }, { item: 'farmersrespite:coffee_beans', qty: 32, farm: true },
    { item: 'bakery:croissant', qty: 8 }, { item: 'bakery:donut', qty: 8 }, { item: 'brewery:pretzel', qty: 8 },
    { item: 'culturaldelights:popcorn', qty: 16 }, { item: 'oceansdelight:honey_fried_kelp', qty: 8 },
    { item: 'minecraft:oak_log', qty: 64, farm: true }, { item: 'minecraft:spruce_log', qty: 64, farm: true },
    { item: 'minecraft:coal', qty: 64, farm: true }, { item: 'minecraft:copper_ingot', qty: 32, farm: true },
    { item: 'minecraft:sand', qty: 128, farm: true }, { item: 'minecraft:gravel', qty: 128, farm: true },
    { item: 'minecraft:clay_ball', qty: 32, farm: true }, { item: 'minecraft:redstone', qty: 32, farm: true },
    { item: 'minecraft:flint', qty: 16, farm: true }, { item: 'minecraft:feather', qty: 16, farm: true },
    { item: 'minecraft:ink_sac', qty: 16, farm: true }, { item: 'minecraft:lapis_lazuli', qty: 32, farm: true },
    { item: 'minecraft:glass', qty: 64 }, { item: 'minecraft:torch', qty: 64 }, { item: 'minecraft:ladder', qty: 32 },
    { item: 'minecraft:bricks', qty: 32 }, { item: 'minecraft:stone_bricks', qty: 64 }, { item: 'minecraft:terracotta', qty: 64 },
    { item: 'create:zinc_ingot', qty: 16 }, { item: 'create:copper_sheet', qty: 16 }, { item: 'create:iron_sheet', qty: 16 },
    { item: 'create:large_cogwheel', qty: 8 }, { item: 'create:chute', qty: 8 }, { item: 'create:andesite_funnel', qty: 8 }
  ],
  medio: [
    { item: 'minecraft:iron_ingot', qty: 64, farm: true }, { item: 'minecraft:honey_bottle', qty: 16, farm: true },
    { item: 'minecraft:slime_ball', qty: 16, farm: true }, { item: 'minecraft:ender_pearl', qty: 16, farm: true },
    { item: 'minecraft:blaze_rod', qty: 16, farm: true }, { item: 'minecraft:quartz', qty: 64, farm: true },
    { item: 'minecraft:glowstone_dust', qty: 64, farm: true }, { item: 'minecraft:magma_cream', qty: 16, farm: true },
    { item: 'minecraft:prismarine_shard', qty: 32, farm: true },
    { item: 'create:brass_ingot', qty: 32 }, { item: 'create:electron_tube', qty: 16 }, { item: 'create:brass_casing', qty: 16 },
    { item: 'create:mechanical_press', qty: 2 }, { item: 'create:encased_fan', qty: 4 },
    { item: 'aeronautics:propeller_bearing', qty: 2 },
    { item: 'farmersdelight:beef_stew', qty: 8 }, { item: 'farmersdelight:vegetable_soup', qty: 8 },
    { item: 'farmersdelight:fried_rice', qty: 8 }, { item: 'farmersdelight:pasta_with_meatballs', qty: 4 },
    { item: 'farmersdelight:steak_and_potatoes', qty: 4 },
    { item: 'minecraft:ghast_tear', qty: 4 }, { item: 'minecraft:phantom_membrane', qty: 8 },
    { item: 'farm_and_charm:bacon_with_eggs', qty: 4 }, { item: 'farm_and_charm:beef_patty_with_vegetables', qty: 4 },
    { item: 'brewery:fried_chicken', qty: 4 }, { item: 'brewery:pork_knuckle', qty: 4 }, { item: 'brewery:beer_wheat', qty: 4 },
    { item: 'bakery:grilled_bacon_sandwich', qty: 4 }, { item: 'cookscollection:fish_and_chips', qty: 4 },
    { item: 'brewinandchewin:jerky', qty: 8 }, { item: 'brewinandchewin:kimchi', qty: 4 },
    { item: 'brewinandchewin:vegetable_omelet', qty: 4 }, { item: 'brewinandchewin:mead', qty: 4 },
    { item: 'culturaldelights:chicken_taco', qty: 4 }, { item: 'culturaldelights:beef_burrito', qty: 4 },
    { item: 'culturaldelights:spicy_curry', qty: 4 }, { item: 'rusticdelight:calamari_soup', qty: 4 },
    { item: 'oceansdelight:squid_rings', qty: 4 }, { item: 'farmersrespite:coffee', qty: 4 }, { item: 'farmersrespite:green_tea', qty: 4 },
    { item: 'cataclysm:koboleton_bone', qty: 8 }, { item: 'cataclysm:burning_ashes', qty: 4 },
    { item: 'cataclysm:amethyst_crab_shell', qty: 2 }, { item: 'cataclysm:crystallized_coral_fragments', qty: 4 },
    { item: 'minecraft:gold_ingot', qty: 32, farm: true }, { item: 'minecraft:amethyst_shard', qty: 32, farm: true },
    { item: 'minecraft:nether_wart', qty: 32, farm: true }, { item: 'minecraft:rabbit_hide', qty: 16, farm: true },
    { item: 'minecraft:diamond', qty: 4 }, { item: 'minecraft:emerald', qty: 8 }, { item: 'minecraft:obsidian', qty: 32 },
    { item: 'minecraft:book', qty: 16 }, { item: 'minecraft:tnt', qty: 8 }, { item: 'minecraft:name_tag', qty: 2 },
    { item: 'create:mechanical_drill', qty: 2 }, { item: 'create:mechanical_saw', qty: 2 }, { item: 'create:deployer', qty: 2 },
    { item: 'create:mechanical_pump', qty: 4 }, { item: 'create:fluid_tank', qty: 8 }, { item: 'create:item_vault', qty: 4 },
    { item: 'create:water_wheel', qty: 4 }, { item: 'create:windmill_bearing', qty: 1 }, { item: 'create:smart_chute', qty: 4 },
    { item: 'create:copper_casing', qty: 16 }, { item: 'create:track', qty: 32 }, { item: 'create:polished_rose_quartz', qty: 8 }
  ],
  dificil: [
    { item: 'create:precision_mechanism', qty: 8 }, { item: 'create:blaze_burner', qty: 2 },
    { item: 'create:sturdy_sheet', qty: 16 }, { item: 'aeronautics:levitite', qty: 32 },
    { item: 'farmersdelight:roast_chicken_block', qty: 2 }, { item: 'farmersdelight:honey_glazed_ham_block', qty: 2 },
    { item: 'farmersdelight:shepherds_pie_block', qty: 2 }, { item: 'farmersdelight:stuffed_pumpkin_block', qty: 2 },
    { item: 'minecraft:wither_skeleton_skull', qty: 3 }, { item: 'minecraft:shulker_shell', qty: 8 },
    { item: 'minecraft:nether_star', qty: 1 }, { item: 'minecraft:dragon_breath', qty: 8 },
    { item: 'minecraft:echo_shard', qty: 8 }, { item: 'minecraft:totem_of_undying', qty: 2 },
    { item: 'minecraft:netherite_scrap', qty: 4, farm: true },
    { item: 'bakery:chocolate_gateau', qty: 2 }, { item: 'bakery:strawberry_cake', qty: 2 },
    { item: 'brewinandchewin:pizza', qty: 2 }, { item: 'brewinandchewin:fiery_fondue_pot', qty: 1 },
    { item: 'brewinandchewin:scarlet_cheese_wheel', qty: 2 }, { item: 'oceansdelight:cabbage_wrapped_elder_guardian', qty: 1 },
    { item: 'cataclysm:monstrous_horn', qty: 1 }, { item: 'cataclysm:lava_power_cell', qty: 1 },
    { item: 'cataclysm:void_core', qty: 1 }, { item: 'cataclysm:ignitium_ingot', qty: 2 },
    { item: 'cataclysm:witherite_ingot', qty: 2 }, { item: 'cataclysm:essence_of_the_storm', qty: 1 },
    { item: 'cataclysm:cursium_ingot', qty: 2 }, { item: 'cataclysm:ancient_metal_ingot', qty: 4 },
    { item: 'minecraft:diamond_block', qty: 2 }, { item: 'minecraft:heart_of_the_sea', qty: 1 },
    { item: 'minecraft:trident', qty: 1 }, { item: 'minecraft:sculk_catalyst', qty: 2 }, { item: 'minecraft:beacon', qty: 1 },
    { item: 'create:mechanical_crafter', qty: 8 }, { item: 'create:rotation_speed_controller', qty: 2 },
    { item: 'create:mechanical_arm', qty: 4 }, { item: 'create:track_station', qty: 2 }, { item: 'create:steam_engine', qty: 4 },
    { item: 'create:clockwork_bearing', qty: 1 }
  ]
}
// Encargos de temporada (Serene Seasons): cada día uno (fácil o medio) sale de la estación
// actual del Overworld y pagan el doble.
const SEASON_ORDERS = {
  SPRING: {
    facil: [{ item: 'farmersdelight:cabbage', qty: 32 }, { item: 'farm_and_charm:lettuce', qty: 32 },
      { item: 'farm_and_charm:strawberry', qty: 32 }, { item: 'minecraft:honey_bottle', qty: 8 }],
    medio: [{ item: 'farm_and_charm:oatmeal_with_strawberries', qty: 4 }, { item: 'candlelight:fresh_garden_salad', qty: 4 },
      { item: 'farmersrespite:dandelion_tea', qty: 4 }, { item: 'bakery:strawberry_cupcake', qty: 8 }]
  },
  SUMMER: {
    facil: [{ item: 'minecraft:melon_slice', qty: 64 }, { item: 'farmersdelight:tomato', qty: 32 },
      { item: 'culturaldelights:corn_cob', qty: 32 }, { item: 'farmersdelight:melon_popsicle', qty: 8 }],
    medio: [{ item: 'cookscollection:lemonade', qty: 4 }, { item: 'candlelight:tomato_mozzarella_salad', qty: 4 },
      { item: 'brewery:beer_hops', qty: 4 }, { item: 'farm_and_charm:strawberry_tea', qty: 4 }]
  },
  AUTUMN: {
    facil: [{ item: 'minecraft:pumpkin', qty: 16 }, { item: 'minecraft:apple', qty: 16 },
      { item: 'farmersdelight:pumpkin_slice', qty: 32 }, { item: 'minecraft:carrot', qty: 64 }],
    medio: [{ item: 'farmersdelight:pumpkin_soup', qty: 4 }, { item: 'bakery:apple_pie', qty: 2 },
      { item: 'farm_and_charm:goulash', qty: 4 }, { item: 'rusticdelight:pumpkin_pancakes', qty: 2 }]
  },
  WINTER: {
    facil: [{ item: 'minecraft:sweet_berries', qty: 32 }, { item: 'farmersdelight:hot_cocoa', qty: 4 },
      { item: 'bakery:sweetberry_jam', qty: 4 }, { item: 'minecraft:snowball', qty: 64 }],
    medio: [{ item: 'farm_and_charm:potato_soup', qty: 4 }, { item: 'brewinandchewin:egg_grog', qty: 4 },
      { item: 'farmersrespite:black_tea', qty: 4 }, { item: 'farmersdelight:baked_cod_stew', qty: 4 }]
  }
}
const SEASON_NAME = { SPRING: '§aPrimavera', SUMMER: '§eVerano', AUTUMN: '§6Otoño', WINTER: '§bInvierno' }
function currentSeason(server) {
  try {
    let SH = Java.loadClass('sereneseasons.api.season.SeasonHelper')
    return String(SH.getSeasonState(server.overworld()).getSeason().name())
  } catch (e) { return null }
}
const ORDER_SLOTS = ['facil', 'facil', 'medio', 'medio', 'dificil']
const ORDER_PAY = { facil: 'numismatics:bevel 2', medio: 'numismatics:sprocket 2', dificil: 'numismatics:cog 1' }
function orderPay(o) {
  if (!o.season) return ORDER_PAY[o.tier]
  let s = ORDER_PAY[o.tier].split(' ')
  return s[0] + ' ' + (Number(s[1] || 1) * 2)
}
function orderLabel(o) { return ORDER_LABEL[o.tier] + (o.season ? ' §6(' + (SEASON_NAME[o.season] || o.season) + '§6)' : '') }
const ORDER_LABEL = { facil: '§aFácil', medio: '§eMedio', dificil: '§cDifícil' }

// --- hora de España (CET/CEST: verano del último domingo de marzo al último de octubre, a la 01:00 UTC)
function lastSunday(y, m) { let d = Date.UTC(y, m + 1, 0); return d - new Date(d).getUTCDay() * DAY_MS + 3600000 }
function madridOffset(ms) {
  let y = new Date(ms).getUTCFullYear()
  return ms >= lastSunday(y, 2) && ms < lastSunday(y, 9) ? 7200000 : 3600000
}
function madridDay(ms) { return Math.floor((ms + madridOffset(ms)) / DAY_MS) }
function nextSaturday20(ms) { return nextWeekday20(ms, 6) }
function nextWeekday20(ms, wd) { // wd: 0 = domingo ... 6 = sábado
  let local = ms + madridOffset(ms)
  let day = Math.floor(local / DAY_MS)
  let dow = (day + 4) % 7 // 1-1-1970 fue jueves; 0 = domingo
  let t = (day + (wd - dow + 7) % 7) * DAY_MS + 20 * 3600000
  if (t <= local) t += WEEK_MS
  return t - madridOffset(t)
}
function timeLeft(ms) {
  ms = Math.max(0, ms)
  let d = Math.floor(ms / DAY_MS), h = Math.floor((ms % DAY_MS) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return d ? d + 'd ' + h + 'h' : h + 'h ' + m + 'min'
}

// --- monedas e inventario
function coinBreakdown(spurs) {
  let out = []
  COINS.forEach(c => { let n = Math.floor(spurs / c[1]); if (n > 0) { out.push([c[0], n]); spurs -= n * c[1] } })
  return out
}
function fmtCoins(spurs) {
  let b = coinBreakdown(spurs)
  return (b.length ? b.map(x => x[1] + ' ' + COIN_NAMES[x[0]]).join(', ') : '0') + ' §8(' + spurs + ' spurs)'
}
function coinCmds(spurs) { return coinBreakdown(spurs).map(x => 'give @P ' + x[0] + ' ' + x[1]) }
function coinValue(id) { let c = COINS.find(x => x[0] == id); return c ? c[1] : 0 }
function invSlots(p, fn) {
  let inv = p.inventory
  for (let i = 0; i < inv.getContainerSize(); i++) {
    let st = inv.getItem(i)
    if (st && !st.isEmpty()) fn(st, String(st.id))
  }
}
function walletOf(p) { let t = 0; invSlots(p, (st, id) => { t += coinValue(id) * st.count }); return t }
// Cobra `spurs` de las monedas del inventario: las quita todas y devuelve el cambio.
function takeCoins(p, spurs) {
  let total = walletOf(p)
  if (total < spurs) return false
  invSlots(p, (st, id) => { if (coinValue(id)) st.shrink(st.count) })
  p.inventory.setChanged()
  let name = String(p.username)
  coinCmds(total - spurs).forEach(c => p.server.runCommandSilent(c.split('@P').join(name)))
  return true
}
function countItem(p, item) { let n = 0; invSlots(p, (st, id) => { if (id == item) n += st.count }); return n }
function takeItem(p, item, qty) {
  invSlots(p, (st, id) => { if (qty > 0 && id == item) { let k = Math.min(qty, st.count); st.shrink(k); qty -= k } })
  p.inventory.setChanged()
}
function itemName(id, count) {
  let c
  try { c = Item.of(id).getHoverName().copy() } catch (e) { c = Text.of(id) }
  return count ? Text.of('§f' + count + 'x ').append(c) : c
}

// --- subasta
function lotText(lot) {
  if (lot.crate) return Text.of('§f' + lot.rolls + 'x ' + ((CRATES[lot.crate] || {}).name || lot.crate) + ' §7(se abren al ganar)')
  return itemName(lot.item, lot.count)
}
function lotCmds(lot) {
  if (!lot.crate) return giveItemCmds(lot.item, lot.count)
  let c = CRATES[lot.crate], cmds = []
  if (!c || !c.rows.length) return cmds
  let total = c.rows.reduce((a, r) => a + r[3], 0)
  for (let k = 0; k < lot.rolls * c.size; k++) {
    let x = Math.random() * total, r = c.rows[c.rows.length - 1]
    for (let i = 0; i < c.rows.length; i++) { x -= c.rows[i][3]; if (x < 0) { r = c.rows[i]; break } }
    cmds.push('give @P ' + r[0] + ' ' + (r[1] + Math.floor(Math.random() * (r[2] + 1))))
  }
  return cmds
}
function minBid(a) {
  return a.bid ? Math.max(a.bid.amount + 1, Math.ceil(a.bid.amount * (1 + BID_STEP))) : a.lot.price
}
function startAuction(server, t) {
  let prev = S.aucs[t] ? S.aucs[t].lotIdx : -1
  let pool = []
  LOTS.forEach((l, i) => { if (l.tier == t && i != prev) pool.push(i) })
  let idx = pool[Math.floor(Math.random() * pool.length)]
  S.aucN = (S.aucN || 0) + 1
  let a = S.aucs[t] = { n: S.aucN, tier: t, lotIdx: idx, lot: LOTS[idx], end: nextWeekday20(Date.now(), AUC_TIERS[t].dow), bid: null }
  announce(server, [line('§e[Retos] §bSubasta ' + AUC_TIERS[t].name.toLowerCase() + ' n.º ' + a.n + ': ', lotText(a.lot),
    ' §7- puja inicial §f' + fmtCoins(a.lot.price) + '§7. Cierra el ' + AUC_TIERS[t].day + ' a las 20:00. §8/retos subasta')], false)
}
function closeAuction(server, t) {
  let a = S.aucs[t]
  if (!a) return
  if (a.bid) {
    giveCmds(server, a.bid.player, lotCmds(a.lot))
    eco('subastas', a.bid.amount)
    announce(server, [line('§e[Retos] §bSubasta n.º ' + a.n + ' para §a' + a.bid.player + '§b por §f' + fmtCoins(a.bid.amount) + '§b: ', lotText(a.lot))], true)
  } else announce(server, ['§e[Retos] §7La subasta n.º ' + a.n + ' se cierra sin pujas.'], false)
}
function checkAuction(server) {
  let dirty = false
  for (let t = 0; t < AUC_TIERS.length; t++) {
    if (!S.aucs[t]) { startAuction(server, t); dirty = true }
    else if (Date.now() >= S.aucs[t].end) { closeAuction(server, t); startAuction(server, t); dirty = true }
  }
  if (dirty) save(server)
}
function bid(p, lote, amount) {
  let server = p.server
  load(server)
  if (!feat('subasta')) return featOff('subasta')
  let t = lote - 1, a = S.aucs[t]
  if (!a) return ['§cEse lote no existe: usa 1 (barata), 2 (media) o 3 (lujo).']
  let name = String(p.username)
  let need = minBid(a)
  if (amount < need) return ['§cLa puja mínima ahora es §f' + fmtCoins(need) + '§c.']
  let prev = a.bid
  let wallet = walletOf(p) + (prev && prev.player == name ? prev.amount : 0)
  if (wallet < amount) return ['§cNo llevas suficientes monedas encima: tienes §f' + fmtCoins(walletOf(p)) + '§c.']
  // devolver la puja anterior (si es tuya, se te devuelve antes de cobrarte la nueva)
  if (prev) {
    giveCmds(server, prev.player, coinCmds(prev.amount))
    if (prev.player != name) {
      let op = onlinePlayer(server, prev.player)
      if (op) op.tell(Text.of('§e[Retos] §cTe han superado en la subasta§7; se te devuelve tu puja (' + fmtCoins(prev.amount) + '§7).'))
      if (op) toast(op, '§cTe han superado en la subasta', '§f' + name + ' §7puja §f' + coinShort(amount), aucIcon(a))
    }
  }
  if (!takeCoins(p, amount)) { a.bid = null; save(server); return ['§cNo se pudo cobrar la puja.'] }
  a.bid = { player: name, amount: amount }
  save(server)
  server.players.forEach(q => sendHud(q))
  announce(server, [line('§e[Retos] §a' + name + ' §bpuja §f' + fmtCoins(amount) + ' §bpor ', lotText(a.lot))], false)
  return ['§aPuja hecha. Si alguien te supera, se te devuelve el dinero.']
}
function linesSubasta() {
  let out = []
  S.aucs.forEach((a, t) => {
    if (!a) return
    out.push('§6=== Subasta ' + AUC_TIERS[t].name.toLowerCase() + ' (lote ' + (t + 1) + ', n.º ' + a.n + ') ===', line('§7Lote: ', lotText(a.lot)),
      '§7Puja actual: ' + (a.bid ? '§f' + fmtCoins(a.bid.amount) + ' §7de §a' + a.bid.player : '§fninguna'),
      '§7Puja mínima: §f' + fmtCoins(minBid(a)) + '§7. Cierra en §f' + timeLeft(a.end - Date.now()) + ' §7(' + AUC_TIERS[t].day + ' 20:00).')
  })
  if (!out.length) return ['§7Todavía no hay subasta.']
  out.push('§8/retos pujar <lote 1-3> <spurs>: se cobra de tus monedas con cambio. 1 bevel = 8, sprocket = 16, cog = 64, crown = 512.')
  return out
}

// --- encargos
function farmFactor() { let w = Math.floor((Date.now() - (S.encStart || Date.now())) / WEEK_MS); return Math.min(1 + 0.25 * w, 4) }
// Como mucho FOOD_MAX encargos de comida al día (contando el de temporada): hay muchos mods de cocina y
// sin límite el tablón se llena de platos. Solo uno de temporada al día (fácil o medio, al azar).
const FOOD_NS = ['farmersdelight', 'farm_and_charm', 'brewery', 'bakery', 'culturaldelights', 'cookscollection',
  'farmersrespite', 'brewinandchewin', 'oceansdelight', 'rusticdelight', 'candlelight']
const FOOD_VANILLA = ['wheat', 'carrot', 'potato', 'sugar_cane', 'pumpkin', 'melon_slice', 'kelp', 'bamboo', 'egg', 'bread',
  'apple', 'sweet_berries', 'honey_bottle']
const FOOD_MAX = 2
function isFood(item) {
  let s = String(item).split(':')
  return FOOD_NS.indexOf(s[0]) >= 0 || (s[0] == 'minecraft' && FOOD_VANILLA.indexOf(s[1]) >= 0)
}
function newBoard(server, day) {
  if (!S.encStart) S.encStart = Date.now()
  let f = farmFactor(), used = {}, list = [], season = currentSeason(server), food = 0
  let seasonTiers = season && SEASON_ORDERS[season] ? Object.keys(SEASON_ORDERS[season]) : []
  let seasonTier = seasonTiers.length ? seasonTiers[Math.floor(Math.random() * seasonTiers.length)] : null
  ORDER_SLOTS.forEach(tier => {
    if (tier == seasonTier) {
      let sp = SEASON_ORDERS[season][tier].filter(o => !used[o.item])
      if (sp.length) {
        let o = sp[Math.floor(Math.random() * sp.length)]
        used[o.item] = true
        seasonTier = null
        if (isFood(o.item)) food++
        list.push({ tier: tier, item: o.item, qty: o.qty, season: season })
        return
      }
    }
    let pool = ORDERS[tier].filter(o => !used[o.item])
    if (food >= FOOD_MAX) {
      let noFood = pool.filter(o => !isFood(o.item))
      if (noFood.length) pool = noFood
    }
    let o = pool[Math.floor(Math.random() * pool.length)]
    used[o.item] = true
    if (isFood(o.item)) food++
    list.push({ tier: tier, item: o.item, qty: o.farm ? Math.round(o.qty * f) : o.qty })
  })
  S.enc = { day: day, list: list, done: {} }
  announce(server, ['§e[Retos] §bNuevos encargos y recompensas del día. §8(F9 o /retos)'], false)
}
function checkOrders(server) {
  let day = madridDay(Date.now())
  if (!S.enc || S.enc.day != day) { newBoard(server, day); save(server) }
}
function deliver(p, n) {
  let server = p.server
  load(server)
  if (!feat('encargos')) return featOff('encargos')
  checkOrders(server)
  let o = S.enc.list[n - 1]
  if (!o) return ['§cEse encargo no existe: usa un número del 1 al ' + S.enc.list.length + '.']
  let team = teamOf(p), name = String(p.username)
  let done = S.enc.done[n - 1] || (S.enc.done[n - 1] = [])
  if (done.indexOf(team.id) >= 0) return ['§cTu equipo ya ha cumplido este encargo hoy.']
  let have = countItem(p, o.item)
  if (have < o.qty) return [line('§cTe faltan §f' + (o.qty - have) + '§c de ', itemName(o.item), '§c (llevas ' + have + '/' + o.qty + ').')]
  takeItem(p, o.item, o.qty)
  done.push(team.id)
  giveCmds(server, name, [coinCmd(orderPay(o))])
  eco('encargos', specSpurs(orderPay(o)))
  save(server)
  toastTeam(server, team.id, '§aEncargo cumplido', '§f' + o.qty + 'x {item} §7· ' + name + ' cobra ' + specShort(orderPay(o)), o.item)
  if (o.tier == 'dificil') announce(server, [line('§e[Retos] §bEl equipo ', teamText(team.id, team.name), ' §bha cumplido el encargo difícil del día: ', itemName(o.item, o.qty))], false)
  return [line('§aEncargo cumplido: ', itemName(o.item, o.qty), '§a. Cobras §f' + orderPay(o).replace('numismatics:', '') + '§a.')]
}
function linesEncargos(p) {
  let team = p ? teamOf(p) : null
  let next = (madridDay(Date.now()) + 1) * DAY_MS
  let out = ['§6=== Encargos del día ===', '§7Se renuevan en §f' + timeLeft(next - madridOffset(next) - Date.now()) + '§7. Cada equipo puede cumplir cada uno una vez.']
  S.enc.list.forEach((o, i) => {
    let mine = team && (S.enc.done[i] || []).indexOf(team.id) >= 0
    let have = p ? countItem(p, o.item) : 0
    out.push(line('§f' + (i + 1) + '. ' + orderLabel(o) + ' ', itemName(o.item, o.qty),
      ' §7→ §f' + orderPay(o).replace('numismatics:', '') + (mine ? ' §a(hecho)' : p ? ' §8(llevas ' + have + ')' : '')))
  })
  out.push('§8/retos entregar <n> con los objetos en el inventario. Lo farmeable pide más cada semana.')
  return out
}

// ================================================================ cazarrecompensas
// 3 recompensas al día (fácil, media, difícil) que se renuevan con los encargos. El progreso es por equipo y
// cobra quien la termina. Tipos: kill (entidad, '*' = cualquier monstruo, 'boss' = jefe) con condición opcional
// (arco, noche, elytra, nether), fish (peces pescados), dim (entrar en una dimensión) y struct (estar dentro de
// una estructura o etiqueta de estructuras; lo comprueba el mod venturiaretos).
const BOUNTIES = {
  facil: [
    { id: 'zombi', name: 'Plaga zombi', desc: 'Mata 20 zombis', icon: 'minecraft:zombie_spawn_egg', kill: 'minecraft:zombie', goal: 20 },
    { id: 'esqueleto', name: 'Huesos sueltos', desc: 'Mata 15 esqueletos', icon: 'minecraft:skeleton_spawn_egg', kill: 'minecraft:skeleton', goal: 15 },
    { id: 'arana', name: 'Telarañas', desc: 'Mata 15 arañas', icon: 'minecraft:spider_spawn_egg', kill: 'minecraft:spider', goal: 15 },
    { id: 'creeper', name: 'Desactivador', desc: 'Mata 10 creepers', icon: 'minecraft:creeper_spawn_egg', kill: 'minecraft:creeper', goal: 10 },
    { id: 'pesca', name: 'Día de pesca', desc: 'Pesca 10 peces', icon: 'minecraft:fishing_rod', fish: true, goal: 10 },
    { id: 'arquero', name: 'Buen pulso', desc: 'Mata 10 monstruos con arco o ballesta', icon: 'minecraft:bow', kill: '*', cond: 'arco', goal: 10 },
    { id: 'nether', name: 'Visita al infierno', desc: 'Entra en el Nether', icon: 'minecraft:netherrack', dim: 'minecraft:the_nether', goal: 1 }
  ],
  medio: [
    { id: 'enderman', name: 'Mirada fija', desc: 'Mata 8 endermans', icon: 'minecraft:enderman_spawn_egg', kill: 'minecraft:enderman', goal: 8 },
    { id: 'bruja', name: 'Caza de brujas', desc: 'Mata 3 brujas', icon: 'minecraft:witch_spawn_egg', kill: 'minecraft:witch', goal: 3 },
    { id: 'blaze', name: 'Apagafuegos', desc: 'Mata 10 blazes', icon: 'minecraft:blaze_spawn_egg', kill: 'minecraft:blaze', goal: 10 },
    { id: 'magma', name: 'Lava saltarina', desc: 'Mata 8 cubos de magma', icon: 'minecraft:magma_cube_spawn_egg', kill: 'minecraft:magma_cube', goal: 8 },
    { id: 'ghast', name: 'Lágrimas', desc: 'Mata 3 ghasts', icon: 'minecraft:ghast_spawn_egg', kill: 'minecraft:ghast', goal: 3 },
    { id: 'phantom', name: 'Insomnio', desc: 'Mata 5 phantoms', icon: 'minecraft:phantom_spawn_egg', kill: 'minecraft:phantom', goal: 5 },
    { id: 'noche', name: 'Turno de noche', desc: 'Mata 25 monstruos de noche', icon: 'minecraft:clock', kill: '*', cond: 'noche', goal: 25 },
    { id: 'pesca2', name: 'Gran captura', desc: 'Pesca 25 peces', icon: 'minecraft:cod', fish: true, goal: 25 },
    { id: 'infierno', name: 'Limpieza infernal', desc: 'Mata 20 monstruos en el Nether', icon: 'minecraft:nether_bricks', kill: '*', cond: 'nether', goal: 20 },
    { id: 'aldea', name: 'Turismo celeste', desc: 'Visita una aldea del cielo', icon: 'minecraft:bell', struct: '#venturia:sky_villages', goal: 1 },
    { id: 'fortaleza', name: 'Muros negros', desc: 'Entra en una fortaleza del Nether', icon: 'minecraft:nether_brick_fence', struct: 'minecraft:fortress', goal: 1 }
  ],
  dificil: [
    { id: 'wither_esq', name: 'Cráneos negros', desc: 'Mata 10 esqueletos wither', icon: 'minecraft:wither_skeleton_skull', kill: 'minecraft:wither_skeleton', goal: 10 },
    { id: 'hoglin', name: 'Caza mayor', desc: 'Mata 5 hoglins', icon: 'minecraft:hoglin_spawn_egg', kill: 'minecraft:hoglin', goal: 5 },
    { id: 'bruto', name: 'Sin piedad', desc: 'Mata 2 piglins brutos', icon: 'minecraft:piglin_brute_spawn_egg', kill: 'minecraft:piglin_brute', goal: 2 },
    { id: 'shulker', name: 'Conchas', desc: 'Mata 5 shulkers', icon: 'minecraft:shulker_shell', kill: 'minecraft:shulker', goal: 5 },
    { id: 'planeo', name: 'As del aire', desc: 'Mata 5 monstruos mientras planeas con élitros', icon: 'minecraft:elytra', kill: '*', cond: 'elytra', goal: 5 },
    { id: 'jefe', name: 'Cazador de titanes', desc: 'Mata a un jefe', icon: 'minecraft:nether_star', kill: 'boss', goal: 1 },
    { id: 'castillo', name: 'Torres en las nubes', desc: 'Entra en un castillo del cielo', icon: 'minecraft:stone_bricks', struct: '#venturia:sky_castles', goal: 1 },
    { id: 'dirigible', name: 'Polizón', desc: 'Sube a un dirigible o globo abandonado', icon: 'aeronautics:white_envelope', struct: '#venturia:airships', goal: 1 },
    { id: 'ballena', name: 'Ballenero', desc: 'Encuentra una ballena del cielo', icon: 'minecraft:heart_of_the_sea', struct: '#venturia:sky_whales', goal: 1 },
    { id: 'ciudad_end', name: 'Ciudad púrpura', desc: 'Entra en una ciudad del End', icon: 'minecraft:purpur_block', struct: 'minecraft:end_city', goal: 1 },
    { id: 'aether', name: 'Paraíso', desc: 'Entra en el Aether', icon: 'aether:ambrosium_shard', dim: 'aether:the_aether', goal: 1 }
  ]
}
const BOUNTY_TIERS = ['facil', 'medio', 'dificil']
const BOUNTY_PAY = ORDER_PAY
const COND_NAME = { arco: 'con arco', noche: 'de noche', elytra: 'planeando', nether: 'en el Nether' }

function bountyFor(id) {
  let f = null
  BOUNTY_TIERS.forEach(t => BOUNTIES[t].forEach(b => { if (b.id == id) f = b }))
  return f
}
function newBounties(day) {
  let prev = S.bnt ? S.bnt.list : []
  let list = BOUNTY_TIERS.map(t => {
    let pool = BOUNTIES[t].filter(b => prev.indexOf(b.id) < 0)
    if (!pool.length) pool = BOUNTIES[t]
    return pool[Math.floor(Math.random() * pool.length)].id
  })
  S.bnt = { day: day, list: list, prog: {}, done: {}, base: (S.bnt && S.bnt.base) || {} }
}
function checkBounties(server) {
  let day = madridDay(Date.now())
  if (!S.bnt || S.bnt.day != day) { newBounties(day); save(server) }
}
// Suma n a la recompensa i del equipo del jugador; si llega a la meta, paga al jugador y lo anuncia.
function bountyAdd(server, p, i, n) {
  if (!feat('recompensas')) return
  let b = bountyFor(S.bnt.list[i])
  if (!b) return
  let team = teamOf(p), name = String(p.username)
  let done = S.bnt.done[team.id] || (S.bnt.done[team.id] = [false, false, false])
  if (done[i]) return
  let prog = S.bnt.prog[team.id] || (S.bnt.prog[team.id] = [0, 0, 0])
  prog[i] = Math.min(b.goal, prog[i] + n)
  if (prog[i] >= b.goal) {
    done[i] = true
    let tier = BOUNTY_TIERS[i]
    giveCmds(server, name, [coinCmd(BOUNTY_PAY[tier])])
    eco('recompensas', specSpurs(BOUNTY_PAY[tier]))
    toastTeam(server, team.id, '§aRecompensa cumplida', '§f' + b.name + ' §7· ' + name + ' cobra ' + specShort(BOUNTY_PAY[tier]), b.icon)
    announce(server, [line('§e[Retos] §a' + name + ' §b(', teamText(team.id, team.name), '§b) cumple la recompensa ' + ORDER_LABEL[tier] +
      ' §f' + b.name + '§b y cobra §f' + BOUNTY_PAY[tier].replace('numismatics:', '') + '§b.')], tier == 'dificil')
  }
  changed(server)
  sendHud(p)
}
function isBoss(type) { return BOSSES.indexOf(type) >= 0 || type.indexOf('block_factorys_bosses:') == 0 }
function condOk(cond, p, event) {
  if (!cond) return true
  try {
    if (cond == 'nether') return String(p.level.getDimension()) == 'minecraft:the_nether'
    if (cond == 'elytra') return !!p.isFallFlying()
    if (cond == 'noche') { let t = Number(p.level.getDayTime()) % 24000; return t >= 13000 && t < 23000 }
    if (cond == 'arco') {
      let d = null
      try { d = event.source.immediate } catch (e) { }
      if (!d) try { d = event.source.getDirectEntity() } catch (e) { }
      if (!d) return false
      let t = String(d.type)
      return t.indexOf('arrow') >= 0 || t.indexOf('bolt') >= 0 || t.indexOf('trident') >= 0
    }
  } catch (e) { }
  return false
}
function bountyKill(server, p, entity, event) {
  if (!S.bnt) return
  let type = String(entity.type), monster = false
  try { monster = !!entity.isMonster() } catch (e) { }
  S.bnt.list.forEach((id, i) => {
    let b = bountyFor(id)
    if (!b || !b.kill) return
    let ok = b.kill == '*' ? monster : b.kill == 'boss' ? isBoss(type) : b.kill == type
    if (ok && condOk(b.cond, p, event)) bountyAdd(server, p, i, 1)
  })
}
let RetosNetClass = undefined
function retosNet() {
  if (RetosNetClass === undefined) {
    try { RetosNetClass = Java.loadClass('es.venturia.retos.RetosNet') } catch (e) { RetosNetClass = null; console.warn('[retos] mod venturiaretos no encontrado: sin interfaz ni recompensas de estructura') }
  }
  return RetosNetClass
}
// Pesca, dimensiones y estructuras se miran cada 5 s.
function checkBountyPlayers(server) {
  if (!S.bnt) return
  let defs = S.bnt.list.map(bountyFor)
  server.players.forEach(p => {
    let name = String(p.username)
    defs.forEach((b, i) => {
      if (!b) return
      if (b.fish) {
        let cur
        try { cur = Number(p.stats.fishCaught) } catch (e) { return }
        let key = name
        let last = S.bnt.base[key]
        S.bnt.base[key] = cur
        if (last == null) changed(server)
        else if (cur > last) bountyAdd(server, p, i, cur - last)
        return
      }
      let team = teamOf(p)
      if ((S.bnt.done[team.id] || [])[i]) return
      if (b.dim && String(p.level.getDimension()) == b.dim) bountyAdd(server, p, i, 1)
      if (b.struct) {
        let rn = retosNet()
        let inside = false
        try { inside = rn && rn.inStructure(p, b.struct) } catch (e) { }
        if (inside) bountyAdd(server, p, i, 1)
      }
    })
    // sin recompensa de pesca hoy: seguir la estadística para no sumar lo pescado antes
    if (!defs.some(b => b && b.fish)) S.bnt.base[name] = Number(p.stats.fishCaught)
  })
}
function nextMidnight() { let next = (madridDay(Date.now()) + 1) * DAY_MS; return next - madridOffset(next) }
function linesRecompensas(p) {
  let team = p ? teamOf(p) : null
  let out = ['§6=== Recompensas del día ===', '§7Para tu equipo; cobra quien la termina. Se renuevan en §f' + timeLeft(nextMidnight() - Date.now()) + '§7.']
  S.bnt.list.forEach((id, i) => {
    let b = bountyFor(id)
    if (!b) return
    let prog = team ? (S.bnt.prog[team.id] || [0, 0, 0])[i] : 0
    let done = team && (S.bnt.done[team.id] || [])[i]
    out.push('§f' + (i + 1) + '. ' + ORDER_LABEL[BOUNTY_TIERS[i]] + ' §f' + b.name + ' §7- ' + b.desc + ' §7→ §f' +
      BOUNTY_PAY[BOUNTY_TIERS[i]].replace('numismatics:', '') + (done ? ' §a(hecha)' : ' §8(' + prog + '/' + b.goal + ')'))
  })
  return out
}

// ================================================================ eventos manuales y panel de admin
// Los eventos los crea a mano un admin (op) desde las pestañas de abajo de la interfaz (/retos ui admin ...); no hay
// ninguno predefinido. Inscripción por jugador. Estados: abierto (inscripción abierta), curso (en marcha, sin
// inscripción) y cerrado. Al terminar, el admin elige 1.º, 2.º y 3.º entre los apuntados: trofeo de diamante, oro o
// hierro con el icono del evento, más las monedas que se fijaron al crearlo (pueden ser 0). Avisos: chat al crear,
// al empezar, a la hora prevista y al dar premios; y al entrar, una vez, a quien no hubiera visto un evento nuevo.
const EV_STATE = { abierto: '§aInscripción abierta', curso: '§eEn curso', cerrado: '§7Terminado' }
const EV_KEEP_MS = 7 * DAY_MS // los terminados se siguen viendo una semana
const EV_MAX_PRIZE = 4096 * 16
const EV_WARN_MS = 300000 // aviso a los apuntados 5 min antes
const TROPHY_NAME = { diamond: 'diamante', gold: 'oro', iron: 'hierro', netherite: 'netherita' }

function evState() {
  if (!S.ev) S.ev = { seq: 0, list: [] }
  if (!S.ev.seen) S.ev.seen = {}
  return S.ev
}
function evFind(id) { return evState().list.find(e => e.id == id) }
function evName(e) { return '§f' + e.name + '§b' }
function evPrizeText(e) {
  return [0, 1, 2].map(i => PLACE[i] + ' §7trofeo de ' + TROPHY_NAME[TROPHY_TIER[i]] + (e.prizes[i] > 0 ? ' + ' + coinShort(e.prizes[i]) : '')).join('§7, ')
}
function clickText(txt, cmd, hover) {
  let t = Text.of(txt)
  try { t = t.clickRunCommand(cmd) } catch (e) { }
  try { if (hover) t = t.hover(Text.of(hover)) } catch (e) { }
  return t
}
function joinButton(e) { return clickText('§a[Apuntarme]', '/retos evento apuntar ' + e.id, '§7Clic para apuntarte a ' + e.name) }
function evToastPlayers(server, e, title, desc) {
  e.players.forEach(n => { let q = onlinePlayer(server, n); if (q) toast(q, title, desc, e.icon) })
}
function isAdmin(p) {
  try { return !!p.hasPermissions(2) } catch (e) { }
  try { return !!p.createCommandSourceStack().hasPermission(2) } catch (e) { }
  return false
}

function evCreate(server, by, icon, prizes, mins, name, desc) {
  name = String(name || '').replace(/§/g, '').trim(); desc = String(desc || '').replace(/§/g, '').trim()
  if (!validItem(icon)) return ['§cElige un icono válido (arrástralo desde JEI o clic con el objeto en la mano).']
  if (name.length < 3 || name.length > 40) return ['§cEl nombre debe tener entre 3 y 40 letras.']
  if (desc.length > 120) return ['§cLa descripción es demasiado larga (máximo 120).']
  if (prizes.some(x => !(x >= 0) || x > EV_MAX_PRIZE)) return ['§cLos premios van de 0 a ' + EV_MAX_PRIZE + ' spurs.']
  if (!(mins >= 0) || mins > 60 * 24 * 60) return ['§cLa hora de inicio va de 0 a 60 días (en minutos).']
  let st = evState(), now = Date.now()
  let e = { id: ++st.seq, name: name, desc: desc, icon: icon, start: mins > 0 ? now + mins * 60000 : 0, state: 'abierto',
    players: [], prizes: prizes.map(x => Math.floor(x)), winners: [], created: now, by: by }
  st.list.push(e)
  let lines = ['§e[Eventos] §bNuevo evento: ' + evName(e) + (e.desc ? ' §7- ' + e.desc : ''),
    '§7Premios: ' + evPrizeText(e) + (e.start ? '§7. Empieza en §f' + timeLeft(e.start - now) : ''),
    line(joinButton(e), ' §8o F9 → Eventos')]
  announce(server, lines, true)
  server.players.forEach(q => { st.seen[String(q.username)] = e.id }) // los conectados ya lo han visto
  save(server)
  return ['§aEvento #' + e.id + ' creado y anunciado.']
}
function evJoin(p, id) {
  if (!feat('eventos')) return featOff('eventos')
  let server = p.server
  load(server)
  let e = evFind(id), name = String(p.username)
  if (!e || e.state == 'cerrado') return ['§cEse evento no existe o ya ha terminado.']
  if (e.players.indexOf(name) >= 0) return ['§7Ya estás apuntado a §f' + e.name + '§7.']
  if (e.state != 'abierto') return ['§cLa inscripción de §f' + e.name + ' §cestá cerrada.']
  e.players.push(name)
  save(server)
  return ['§aTe has apuntado a §f' + e.name + '§a.' + (e.start && e.start > Date.now() ? ' Empieza en ' + timeLeft(e.start - Date.now()) + '.' : '')]
}
function evLeave(p, id) {
  let server = p.server
  load(server)
  let e = evFind(id), name = String(p.username)
  if (!e || e.state == 'cerrado' || e.players.indexOf(name) < 0) return ['§cNo estás apuntado a ese evento.']
  e.players = e.players.filter(n => n != name)
  save(server)
  return ['§7Te has borrado de §f' + e.name + '§7.']
}
function evSetState(server, id, to) {
  let e = evFind(id)
  if (!e || e.state == 'cerrado') return ['§cEse evento no existe o ya ha terminado.']
  if (to != 'abierto' && to != 'curso') return ['§cEstado no válido.']
  if (e.state == to) return ['§7El evento ya estaba así.']
  e.state = to
  if (to == 'curso') {
    e.rung = true
    announce(server, ['§e[Eventos] §b¡Empieza ' + evName(e) + '! §7(' + e.players.length + ' apuntados)'], true)
    evToastPlayers(server, e, '§e¡Empieza el evento!', '§f' + e.name)
  } else announce(server, [line('§e[Eventos] §bSe abre de nuevo la inscripción de ' + evName(e) + '. ', joinButton(e))], false)
  save(server)
  return ['§aEvento #' + e.id + ': ' + EV_STATE[to] + '§a.']
}
function evFinish(server, id, winners) {
  let e = evFind(id)
  if (!e || e.state == 'cerrado') return ['§cEse evento no existe o ya ha terminado.']
  winners = winners.map(w => w && w != '-' ? w : '')
  let named = winners.filter(w => w)
  if (named.some(w => e.players.indexOf(w) < 0)) return ['§cLos ganadores tienen que estar apuntados al evento.']
  if (named.some((w, i) => named.indexOf(w) != i)) return ['§cUn jugador no puede tener dos puestos.']
  let lines = ['§e[Eventos] §bFin de ' + evName(e) + '.']
  winners.forEach((w, i) => {
    if (!w) return
    giveCmds(server, w, [trophyCmd(TROPHY_TIER[i], e.icon, e.name, PLACE_TXT[i] + ': ' + (e.desc || 'evento del servidor'))].concat(coinCmds(e.prizes[i] || 0)))
    eco('eventos', e.prizes[i] || 0)
    lines.push(PLACE[i] + ' §a' + w + (e.prizes[i] > 0 ? ' §7(+ ' + coinShort(e.prizes[i]) + ')' : ''))
  })
  if (!named.length) lines.push('§7Sin ganadores.')
  else lines.push('§7¡Enhorabuena! Los trofeos ya están en el inventario (o al entrar).')
  e.state = 'cerrado'; e.closed = Date.now(); e.winners = winners
  announce(server, lines, named.length > 0)
  save(server)
  return ['§aPremios entregados y evento cerrado.']
}
function evDelete(server, id) {
  let e = evFind(id)
  if (!e) return ['§cEse evento no existe.']
  evState().list = evState().list.filter(x => x.id != id)
  if (e.state != 'cerrado') announce(server, ['§e[Eventos] §7Se cancela el evento §f' + e.name + '§7.'], false)
  save(server)
  return ['§7Evento #' + id + ' borrado.']
}
function evKick(server, id, name) {
  let e = evFind(id)
  if (!e || e.players.indexOf(name) < 0) return ['§cEse jugador no está apuntado.']
  e.players = e.players.filter(n => n != name)
  let q = onlinePlayer(server, name)
  if (q) q.tell(Text.of('§e[Eventos] §7Un admin te ha quitado de §f' + e.name + '§7.'))
  save(server)
  return ['§7' + name + ' quitado del evento.']
}
// Cada 5 s: aviso 5 min antes a los apuntados, anuncio a la hora prevista y limpieza de terminados viejos.
function evCheck(server) {
  if (!S.ev) return
  let now = Date.now(), dirty = false
  S.ev.list.forEach(e => {
    if (e.state == 'cerrado' || !e.start) return
    if (!e.warned && e.start - now <= EV_WARN_MS && e.start > now) {
      e.warned = true; dirty = true
      evToastPlayers(server, e, '§eEvento en 5 minutos', '§f' + e.name)
      e.players.forEach(n => { let q = onlinePlayer(server, n); if (q) q.tell(Text.of('§e[Eventos] §f' + e.name + ' §bempieza en 5 minutos.')) })
    }
    if (!e.rung && now >= e.start) {
      e.rung = true; dirty = true
      announce(server, [line('§e[Eventos] §b¡Es la hora de ' + evName(e) + '! §7(' + e.players.length + ' apuntados) ', e.state == 'abierto' ? joinButton(e) : '')], true)
      evToastPlayers(server, e, '§e¡Es la hora!', '§f' + e.name)
    }
  })
  let keep = S.ev.list.filter(e => e.state != 'cerrado' || now - (e.closed || now) < EV_KEEP_MS)
  if (keep.length != S.ev.list.length) { S.ev.list = keep; dirty = true }
  if (dirty) save(server)
}
// Al entrar: un aviso con los eventos creados desde la última vez que los vio. Devuelve true si hay que guardar.
function evNotify(p) {
  let st = evState(), name = String(p.username), seen = st.seen[name] || 0
  if (seen == st.seq) return false
  st.seen[name] = st.seq
  let fresh = st.list.filter(e => e.id > seen && e.state != 'cerrado')
  if (!fresh.length) return true
  p.tell(Text.of('§e[Eventos] §bHay ' + (fresh.length == 1 ? 'un evento nuevo' : fresh.length + ' eventos nuevos') + ' desde tu última visita:'))
  fresh.forEach(e => p.tell(line('§8• ' + evName(e) + ' §7' + EV_STATE[e.state] + (e.start && e.start > Date.now() ? '§7, empieza en §f' + timeLeft(e.start - Date.now()) : '') + ' ',
    e.state == 'abierto' && e.players.indexOf(name) < 0 ? joinButton(e) : '')))
  toast(p, '§eEventos nuevos', '§f' + fresh[0].name + (fresh.length > 1 ? ' §7y ' + (fresh.length - 1) + ' más' : ''), fresh[0].icon)
  return true
}
function linesEventos(viewer) {
  let list = evState().list.filter(e => e.state != 'cerrado')
  if (!list.length) return ['§7No hay eventos abiertos ahora mismo.']
  let out = ['§6=== Eventos ===']
  list.forEach(e => {
    out.push(line('§f#' + e.id + ' ' + e.name + ' §7- ' + EV_STATE[e.state] + (e.start && e.start > Date.now() ? '§7, empieza en §f' + timeLeft(e.start - Date.now()) : '') + ' ',
      e.state == 'abierto' && e.players.indexOf(viewer) < 0 ? joinButton(e) : ''))
    if (e.desc) out.push('§7  ' + e.desc)
    out.push('§7  Premios: ' + evPrizeText(e) + '§7. Apuntados: §f' + e.players.length)
  })
  return out
}
function evUi(name) {
  let now = Date.now()
  return evState().list.filter(e => e.state != 'cerrado' || now - (e.closed || now) < EV_KEEP_MS)
    .sort((a, b) => ((a.state == 'cerrado') - (b.state == 'cerrado')) || b.id - a.id)
    .map(e => ({ id: e.id, name: e.name, desc: e.desc, icon: e.icon, state: e.state, start: e.start ? e.start - now : 0, timed: !!e.start,
      players: e.players, joined: e.players.indexOf(name) >= 0, prizes: e.prizes, winners: e.winners || [], by: e.by || '' }))
}

// --- subasta a mano: sustituye a la del lote indicado (si había puja, se devuelve). Al cerrar, vuelve la rotación normal.
function aucRefund(server, t, why) {
  let a = S.aucs[t]
  if (!a || !a.bid) return
  let b = a.bid
  giveCmds(server, b.player, coinCmds(b.amount))
  let q = onlinePlayer(server, b.player)
  if (q) q.tell(Text.of('§e[Retos] §7La subasta ' + why + ': se te devuelve tu puja (' + fmtCoins(b.amount) + '§7).'))
  a.bid = null
}
function aucManual(server, lote, item, count, price, hours) {
  let t = lote - 1
  if (!(t >= 0 && t < AUC_TIERS.length)) return ['§cLote entre 1 y 3.']
  if (!validItem(item)) return ['§cElige el objeto del lote (arrástralo desde JEI o clic con él en la mano).']
  if (!(count >= 1) || count > CTR_MAX_QTY) return ['§cCantidad entre 1 y ' + CTR_MAX_QTY + '.']
  if (!(price >= 1) || price > EV_MAX_PRIZE * 4) return ['§cPuja inicial entre 1 y ' + (EV_MAX_PRIZE * 4) + ' spurs.']
  if (!(hours >= 0) || hours > 24 * 30) return ['§cDuración entre 0 (hasta el cierre habitual) y 720 horas.']
  aucRefund(server, t, 'se ha sustituido por otra')
  let now = Date.now()
  S.aucN = (S.aucN || 0) + 1
  let a = S.aucs[t] = { n: S.aucN, tier: t, lotIdx: -1, lot: { item: item, count: Math.floor(count), price: Math.floor(price) },
    end: hours > 0 ? now + hours * 3600000 : nextWeekday20(now, AUC_TIERS[t].dow), bid: null, manual: true }
  announce(server, [line('§e[Retos] §bSubasta especial n.º ' + a.n + ': ', lotText(a.lot),
    ' §7- puja inicial §f' + fmtCoins(a.lot.price) + '§7. Cierra en §f' + timeLeft(a.end - now) + '§7. §8(F9)')], true)
  save(server)
  return ['§aSubasta lanzada.']
}

// Acciones de las pestañas de admin: /retos ui admin <acción> [texto]. Devuelve líneas para el pie de la interfaz.
function adminAction(p, action, text) {
  let server = p.server
  load(server)
  let a = text.split(' ').filter(x => x.length), name = String(p.username)
  switch (action) {
    case 'funcion': return featToggle(server, a[0] || '')
    case 'evcrear': { // <icono> <p1> <p2> <p3> <minutos> <nombre>|<descripción>
      if (a.length < 6) return ['§cFaltan datos del evento.']
      let rest = a.slice(5).join(' '), cut = rest.indexOf('|')
      return evCreate(server, name, a[0], [Number(a[1]), Number(a[2]), Number(a[3])], Number(a[4]),
        cut >= 0 ? rest.substring(0, cut) : rest, cut >= 0 ? rest.substring(cut + 1) : '')
    }
    case 'evestado': return evSetState(server, Number(a[0]), a[1])
    case 'evpremiar': return evFinish(server, Number(a[0]), [a[1], a[2], a[3]])
    case 'evborrar': return evDelete(server, Number(a[0]))
    case 'evquitar': return evKick(server, Number(a[0]), a[1] || '')
    case 'subasta': return aucManual(server, Number(a[0]), a[1] || '', Number(a[2]), Number(a[3]), Number(a[4] || 0))
    case 'subastacerrar': {
      let t = Number(a[0]) - 1
      if (!S.aucs[t]) return ['§cEse lote no existe.']
      closeAuction(server, t)
      startAuction(server, t); save(server)
      return ['§aSubasta adjudicada; se abre otra de la rotación.']
    }
    case 'subastacancelar': {
      let t = Number(a[0]) - 1
      if (!S.aucs[t]) return ['§cEse lote no existe.']
      aucRefund(server, t, 'se ha cancelado')
      announce(server, ['§e[Retos] §7Se cancela la subasta n.º ' + S.aucs[t].n + '.'], false)
      startAuction(server, t); save(server)
      return ['§7Subasta cancelada; se abre otra de la rotación.']
    }
    case 'semana':
      if (S.week) closeWeek(server)
      startWeek(server); save(server)
      return ['§aSemana cerrada y siguiente reto iniciado.']
    case 'encargos':
      newBoard(server, madridDay(Date.now())); newBounties(madridDay(Date.now())); save(server)
      return ['§aEncargos y recompensas del día renovados.']
    case 'anuncio': {
      let msg = text.replace(/§/g, '').trim()
      if (!msg) return ['§cEscribe el anuncio.']
      announce(server, ['§6[Anuncio] §f' + msg], true)
      server.players.forEach(q => toast(q, '§6Anuncio', '§f' + msg.substring(0, 60), 'minecraft:bell'))
      return ['§aAnuncio enviado.']
    }
    case 'trofeo': { // <material> <jugador> <icono> <título>
      let tier = a[0], who = a[1], icon = a[2], title = a.slice(3).join(' ').replace(/§/g, '').trim()
      if (!TROPHY_NAME[tier]) return ['§cMaterial no válido.']
      if (!who || !onlinePlayer(server, who)) return ['§cEse jugador no está conectado.']
      if (!validItem(icon)) return ['§cElige el icono del trofeo.']
      if (title.length < 3 || title.length > 40) return ['§cEl título debe tener entre 3 y 40 letras.']
      giveCmds(server, who, [trophyCmd(tier, icon, title, 'Entregado por el staff')])
      announce(server, ['§e[Retos] §a' + who + ' §brecibe el trofeo §f' + title + '§b.'], false)
      return ['§aTrofeo entregado a ' + who + '.']
    }
    case 'monedas': { // <jugador> <spurs>
      let who = a[0] || '', n = Math.floor(Number(a[1]))
      if (!onlinePlayer(server, who) && !(S.seen && S.seen[who])) return ['§cNo conozco a ese jugador.']
      if (!(n > 0) || n > 1000000) return ['§cCantidad no válida.']
      giveCmds(server, who, coinCmds(n))
      eco('staff', n)
      let q = onlinePlayer(server, who)
      if (q) { q.tell(Text.of('§e[Retos] §bEl staff te da §f' + fmtCoins(n) + '§b.')); toast(q, '§6Regalo del staff', '§f' + coinShort(n), 'numismatics:cog') }
      save(server)
      return ['§aDados ' + coinShort(n) + ' a ' + who + (q ? '.' : ' (los recibe al entrar).')]
    }
    case 'ir': case 'traer': {
      let q = onlinePlayer(server, a[0] || '')
      if (!q) return ['§cEse jugador no está conectado.']
      if (String(q.username) == name) return ['§cEse eres tú.']
      server.runCommandSilent(action == 'ir' ? 'tp ' + name + ' ' + q.username : 'tp ' + q.username + ' ' + name)
      return [action == 'ir' ? '§aTe has teletransportado a ' + q.username + '.' : '§a' + q.username + ' está ahora contigo.']
    }
    case 'pendientesborrar':
      if (!a[0] || !S.pending[a[0]]) return ['§cEse jugador no tiene premios pendientes.']
      delete S.pending[a[0]]; save(server)
      return ['§7Premios pendientes de ' + a[0] + ' borrados.']
  }
  return ['§cAcción desconocida: ' + action]
}
function admUi(server) {
  let online = [], now = Date.now(), seenAll = S.seen || {}, live = {}
  server.players.forEach(q => {
    let n = String(q.username)
    online.push(n)
    let dim = String(q.level.dimension), pos = Math.floor(q.x) + ' ' + Math.floor(q.y) + ' ' + Math.floor(q.z)
    live[n] = { dim: dim.substring(dim.lastIndexOf(':') + 1).replace(']', '').trim(), pos: pos, hp: Math.ceil(Number(q.health)), wallet: walletOf(q), play: playMins(q),
      team: teamOf(q).name }
  })
  let names = Object.keys(seenAll)
  online.forEach(n => { if (names.indexOf(n) < 0) names.push(n) })
  let players = names.map(n => {
    let s = seenAll[n] || {}, l = live[n]
    let o = { name: n, on: !!l, team: l ? l.team : s.team || '', last: s.last ? now - s.last : 0, first: s.first ? now - s.first : 0,
      play: l && l.play ? l.play : s.play || 0, joins: s.n || 0, pend: (S.pending[n] || []).length }
    if (l) { o.dim = l.dim; o.pos = l.pos; o.hp = l.hp; o.wallet = l.wallet }
    return o
  }).sort((x, y) => (y.on - x.on) || (x.last - y.last)).slice(0, 150)
  // datos
  let today = madridDay(now), days = []
  for (let d = today - 13; d <= today; d++) days.push(((S.act || {})[String(d)] || []).length)
  let held = S.aucs.reduce((x, a) => x + (a && a.bid ? a.bid.amount : 0), 0)
  let enc = 0, bnt = 0
  if (S.enc) Object.keys(S.enc.done || {}).forEach(k => { enc += (S.enc.done[k] || []).length })
  if (S.bnt) Object.keys(S.bnt.done || {}).forEach(t => { let d = S.bnt.done[t] || []; for (let i = 0; i < 3; i++) if (d[i]) bnt++ })
  let active7 = 0, new7 = 0
  names.forEach(n => {
    let s = seenAll[n] || {}
    if (live[n] || (s.last && now - s.last < 7 * DAY_MS)) active7++
    if (s.first && now - s.first < 7 * DAY_MS) new7++
  })
  let top = players.slice().sort((x, y) => y.play - x.play).slice(0, 5).map(x => ({ name: x.name, play: x.play }))
  return { online: online.sort(), pending: Object.keys(S.pending).filter(n => S.pending[n].length).map(n => ({ name: n, n: S.pending[n].length })),
    aucManual: S.aucs.some(a => a && a.manual), players: players, log: (S.log || []).slice(-200).reverse().map(e => ({ ago: now - e.t, k: e.k, s: e.s })),
    data: { eco: S.eco || {}, held: held, known: names.length, active7: active7, new7: new7, days: days, top: top, enc: enc, bnt: bnt,
      ctr: 0, ev: evState().list.filter(e => e.state != 'cerrado').length,
      pend: Object.keys(S.pending).reduce((a, k) => a + S.pending[k].length, 0) } }
}
function adminCmd(ctx, withText) {
  let p = playerOf(ctx)
  if (!p) return 0
  let SAT = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  let action = String(SAT.getString(ctx, 'accion')), text = withText ? String(getStr(ctx, 'texto')) : ''
  let r = adminAction(p, action, text)
  if (String(r[0]).indexOf('§a') == 0 && action != 'anuncio') {
    let who = text.split(' ')[0], done = action == 'ir' ? 'fue hasta ' + who : action == 'traer' ? 'trajo a ' + who : String(r[0]).substring(2)
    logAdd('staff', '§f' + p.username + '§7: ' + done)
    save(p.server)
  }
  if (!sendUI(p, false, r)) send(ctx, r)
  return 1
}
function eventCmd(ctx, join) {
  let p = playerOf(ctx)
  if (!p) return 0
  let r = join ? evJoin(p, getInt(ctx, 'id')) : evLeave(p, getInt(ctx, 'id'))
  if (!sendUI(p, false, r)) send(ctx, r)
  return 1
}

// ================================================================ interfaz (mod venturiaretos)
const RACE_ICON = { globo: 'aeronautics:white_envelope', helice: 'aeronautics:propeller_bearing', levitita: 'aeronautics:levitite',
  nether: 'minecraft:netherrack', wither: 'minecraft:wither_skeleton_skull', end: 'minecraft:end_stone', dragon: 'minecraft:dragon_head',
  warp: 'aerowarptics:rift_drive_mk_i', aether: 'aether:ambrosium_shard', orbita: 'creatingspace:rocket_engine',
  luna: 'creatingspace:moon_stone', marte: 'creatingspace:mars_stone', venus: 'minecraft:magma_block', jefes: 'minecraft:nether_star' }
const COOP_ICON = { monstruos: 'minecraft:iron_sword', bloques: 'minecraft:bricks', platos: 'farmersdelight:cooking_pot',
  jefes: 'minecraft:nether_star', logros: 'minecraft:book' }
const WEEK_ICON = { monstruos: 'minecraft:iron_sword', bloques: 'minecraft:bricks', menas: 'minecraft:iron_ore', troncos: 'minecraft:oak_log',
  platos: 'farmersdelight:cooking_pot', logros: 'minecraft:knowledge_book', nether: 'minecraft:netherrack', pesca: 'minecraft:fishing_rod',
  jefes: 'minecraft:nether_star' }

function specSpurs(spec) { let s = spec.split(' '); return coinValue(s[0]) * Number(s[1] || 1) }
function msgString(l) {
  if (typeof l == 'string') return l
  try { return String(l.getString()) } catch (e) { return String(l) }
}
function uiState(p, msgLines) {
  let now = Date.now(), name = String(p.username), team = teamOf(p)
  let st = { player: name, team: team.name, msg: (msgLines || []).map(msgString) }
  if (S.week) {
    let def = weeklyFor(S.week.id), mine = 0
    Object.keys(S.week.by).forEach(k => { mine += S.week.by[k].players[name] || 0 })
    st.week = { name: def.name, desc: def.desc, icon: WEEK_ICON[def.id] || 'minecraft:clock', left: S.week.end - now, min: def.min, mine: mine,
      paid: !!(S.week.paid && S.week.paid[name]), prize: specSpurs(PARTICIPATION_PRIZE),
      ranking: weekRanking().slice(0, 5).map(t => ({ name: t.name, score: t.score, me: t.id == team.id })),
      prizes: WEEK_PRIZES.map(l => l.reduce((a, s) => a + specSpurs(s), 0)), next: S.next ? weeklyFor(S.next).name : '' }
  }
  st.aucs = S.aucs.map((a, t) => {
    if (!a) return null
    let lot = a.lot, crate = lot.crate ? (CRATES[lot.crate] || { name: lot.crate, rows: [] }) : null
    let preview = []
    if (crate) crate.rows.forEach(r => { if (preview.indexOf(r[0]) < 0 && preview.length < 14) preview.push(r[0]) })
    return { t: t + 1, tier: AUC_TIERS[t].name, day: AUC_TIERS[t].day, n: a.n, item: crate ? 'minecraft:chest' : lot.item, count: lot.count || 1,
      crate: !!crate, name: crate ? crate.name : '', rolls: lot.rolls || 0, preview: preview, left: a.end - now,
      bid: a.bid ? a.bid.amount : 0, bidder: a.bid ? a.bid.player : '', mine: !!(a.bid && a.bid.player == name), min: minBid(a),
      price: lot.price, manual: !!a.manual }
  })
  if (S.enc) st.enc = { left: nextMidnight() - now, list: S.enc.list.map((o, i) => ({ tier: o.tier, item: o.item, qty: o.qty,
    pay: specSpurs(orderPay(o)), season: o.season || null, done: (S.enc.done[i] || []).indexOf(team.id) >= 0 })) }
  if (S.bnt) {
    let prog = S.bnt.prog[team.id] || [0, 0, 0], done = S.bnt.done[team.id] || []
    st.bnt = { left: nextMidnight() - now, list: S.bnt.list.map((id, i) => {
      let b = bountyFor(id) || { name: id, desc: '', icon: 'minecraft:barrier', goal: 1 }
      return { name: b.name, desc: b.desc, icon: b.icon, prog: prog[i] || 0, goal: b.goal, pay: specSpurs(BOUNTY_PAY[BOUNTY_TIERS[i]]),
        done: !!done[i], tier: BOUNTY_TIERS[i] }
    }) }
  }
  st.ev = evUi(name)
  if (isAdmin(p)) { st.admin = true; st.adm = admUi(p.server) }
  st.feat = featMap()
  st.feats = FEATS.map(f => ({ id: f.id, name: f.name, desc: f.desc, on: feat(f.id), def: f.def }))
  try { st.tm = uiTeams(p) } catch (e) { console.warn('[retos] equipos: ' + e) }
  st.races = RACES.map(r => ({ name: r.name, desc: r.desc, icon: RACE_ICON[r.id] || 'advancementtrophies:gold_trophy',
    win: (S.races[r.id] || []).map(w => ({ team: w.teamName, player: w.player, date: w.date, me: w.team == team.id })) }))
  st.coop = COOP.map(c => {
    let s = S.coop[c.id] || { total: 0, tier: 0, by: {} }
    return { name: c.name, unit: c.unit, icon: COOP_ICON[c.id] || 'create:cogwheel', total: s.total, tier: s.tier, tiers: c.tiers,
      mine: (s.by || {})[name] || 0 }
  })
  return st
}
// Envía el estado al cliente. Devuelve false si el jugador no tiene el mod (entonces se usa el chat).
function sendUI(p, open, msgLines) {
  let rn = retosNet()
  if (!rn) return false
  let server = p.server
  load(server); if (feat('encargos')) checkOrders(server); if (feat('recompensas')) checkBounties(server)
  try { return !!rn.send(p, open, JSON.stringify(uiState(p, msgLines))) } catch (e) { console.warn('[retos] no se pudo enviar la interfaz: ' + e); return false }
}

const CTR_MAX_QTY = 1728 // máximo de objetos de un lote de subasta a mano (27 stacks)

// ================================================================ contratos antiguos
// Los contratos entre equipos se han pasado a la tienda (F10 → Contratos). Los que quedaran abiertos aquí se
// devuelven a quien los publicó (pago completo; la comisión no, igual que al cancelar).
function refundOldContracts(server) {
  if (!S.ctr || !S.ctr.list || !S.ctr.list.length) return
  S.ctr.list.forEach(c => {
    giveCmds(server, c.by, coinCmds(c.pay))
    let op = onlinePlayer(server, c.by)
    if (op) op.tell(Text.of('§e[Retos] §7Los contratos se han movido a la tienda (§fF10§7). Se te devuelven §f' + fmtCoins(c.pay) + '§7 de tu contrato.'))
  })
  console.info('[retos] devueltos ' + S.ctr.list.length + ' contratos antiguos')
  delete S.ctr
  save(server)
}
function validItem(id) {
  if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id)) return false
  try { return !Item.of(id).isEmpty() } catch (e) { return false }
}
function giveItemCmds(item, qty) {
  let out = []
  while (qty > 0) { let k = Math.min(qty, 64); out.push('give @P ' + item + ' ' + k); qty -= k }
  return out
}

function strArg(event, name) {
  return event.commands.argument(name, Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType').greedyString())
}
function getStr(ctx, name) { return String(Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType').getString(ctx, name)).trim() }

// ================================================================ equipos (FTB Teams desde la interfaz)
// La pestaña «Equipo» del mod llama a /retos ui equipo <acción> [texto]. Todo pasa por la API de FTB Teams con el
// jugador como origen, así que valen sus mismos permisos (dueño / oficial / miembro). Los aliados de FTB son jugadores.
const TeamRank = Java.loadClass('dev.ftb.mods.ftbteams.api.TeamRank')
const TeamProps = Java.loadClass('dev.ftb.mods.ftbteams.api.property.TeamProperties')
const Color4I = Java.loadClass('dev.ftb.mods.ftblibrary.icon.Color4I')
const GameProfile = Java.loadClass('com.mojang.authlib.GameProfile')
const JList = Java.loadClass('java.util.List')
const TEAM_ERR = {
  'ftbteams.already_in_party': 'Ya estás en un equipo.',
  'ftbteams.player_already_in_party': 'Ese jugador ya está en otro equipo.',
  'ftbteams.not_in_party': 'No estás en ningún equipo.',
  'ftbteams.not_invited': 'No tienes invitación para ese equipo.',
  'ftbteams.name_too_short': 'El nombre es demasiado corto (mínimo 3 letras).',
  'ftbteams.team_already_exists': 'Ya existe un equipo con ese nombre.',
  'ftbteams.party_full': 'El equipo está lleno.',
  'ftbteams.owner_cant_leave': 'Eres el dueño: pasa la propiedad a otro antes de salir.',
  'ftbteams.cant_kick_owner': 'No se puede expulsar al dueño.',
  'ftbteams.server_permissions_prevent': 'Los permisos del servidor no lo permiten.',
  'ftbteams.out_of_lives': 'Tu equipo no tiene vidas: no puede invitar.'
}

// KubeJS no expone getUUID()/getGameProfile() en el jugador: se prueban las formas que sí existen.
function pUuid(p) {
  let tries = [() => p.uuid, () => p.getUuid(), () => p.getUUID(), () => JavaUUID.fromString(String(p.stringUuid))]
  for (let i = 0; i < tries.length; i++) { try { let u = tries[i](); if (u) return u } catch (e) { } }
  throw 'sin uuid'
}
function pProfile(p) {
  let tries = [() => p.gameProfile, () => p.getGameProfile(), () => new GameProfile(pUuid(p), String(p.username))]
  for (let i = 0; i < tries.length; i++) { try { let g = tries[i](); if (g) return g } catch (e) { } }
  throw 'sin perfil'
}
function tmMgr() { return FTBTeamsAPI.api().getManager() }
function tmName(u) { try { return String(tmMgr().getPlayerName(u).getString()) } catch (e) { return String(u) } }
function tmProfile(u) { return new GameProfile(u, tmName(u)) }
function tmParty(p) {
  try { let o = tmMgr().getTeamForPlayer(p); return o.isPresent() && o.get().isPartyTeam() ? o.get() : null } catch (e) { return null }
}
function tmById(id) {
  try { let o = tmMgr().getTeamByID(JavaUUID.fromString(id)); return o.isPresent() && o.get().isPartyTeam() ? o.get() : null } catch (e) { return null }
}
function tmUuid(s) { try { return JavaUUID.fromString(String(s)) } catch (e) { return null } }
function tmRank(t, u) { return String(t.getRankForPlayer(u).name()).toLowerCase() }
function tmColor(t) { try { return t.getColor() & 0xFFFFFF } catch (e) { return 0xFFFFFF } }
function tmIsOnline(server, u) { return server.getPlayerList().getPlayer(u) != null }
function tmErr(e) {
  let j = e && e.javaException ? e.javaException : e
  try {
    let msg = j.getRawMessage()
    let key = null
    try { key = String(msg.getContents().getKey()) } catch (x) { }
    if (key && TEAM_ERR[key]) return ['§c' + TEAM_ERR[key]]
    return ['§c' + String(msg.getString())]
  } catch (x) { }
  return ['§cNo se pudo hacer: ' + String(e && e.message ? e.message : e)]
}
function tmSync(t) { try { t.markDirty(); tmMgr().syncToAll(t) } catch (e) { } }
// Perfil de un jugador por nombre: conectado o conocido por el servidor.
function tmProfileByName(server, name) {
  let op = onlinePlayer(server, name)
  if (op) return pProfile(op)
  try { let o = server.getProfileCache().get(name); if (o.isPresent()) return o.get() } catch (e) { }
  return null
}
function cleanName(s) { return String(s || '').replace(/[§\u0000-\u001f]/g, '').trim() }

function teamAction(p, act, arg) {
  let server = p.server, mgr = tmMgr(), me = pUuid(p), t = tmParty(p), name = String(p.username)
  let src = p.createCommandSourceStack().withSuppressedOutput()
  arg = cleanName(arg)
  let rank = t ? t.getRankForPlayer(me) : null
  let officer = !!(rank && rank.isOfficerOrBetter()), owner = !!(t && t.isOwner(me))
  let tname = t ? String(t.getDisplayName()) : ''
  let needTeam = () => t ? null : ['§cNo estás en ningún equipo.']
  let needOfficer = () => needTeam() || (officer ? null : ['§cSolo el dueño o un oficial puede hacer eso.'])
  let needOwner = () => needTeam() || (owner ? null : ['§cSolo el dueño del equipo puede hacer eso.'])
  let member = () => {
    let u = tmUuid(arg)
    if (!u || !t.isMember(u)) return null
    return u
  }
  let r
  try {
    switch (act) {
      case 'crear': {
        if (t) return ['§cYa estás en un equipo. Sal de él antes de crear otro.']
        if (arg.length < 3 || arg.length > 32) return ['§cEl nombre tiene que tener entre 3 y 32 letras.']
        let taken = false
        mgr.getTeams().forEach(o => { if (o.isPartyTeam() && String(o.getDisplayName()).toLowerCase() == arg.toLowerCase()) taken = true })
        if (taken) return ['§cYa hay un equipo con ese nombre.']
        mgr.createParty(p, arg)
        announce(server, ['§e[Equipos] §f' + name + ' §bha fundado el equipo §a' + arg + '§b.'], false)
        return ['§aEquipo §f' + arg + '§a creado. Invita a tus compañeros desde esta pestaña.']
      }
      case 'salir':
        if ((r = needTeam())) return r
        if (owner && t.getMembers().size() > 1) return ['§cEres el dueño: pasa la propiedad a otro miembro o disuelve el equipo.']
        t.leave(me)
        return ['§aHas salido de §f' + tname + '§a.']
      case 'disolver': {
        if ((r = needOwner())) return r
        let others = []
        t.getMembers().forEach(u => { if (!u.equals(me)) others.push(u) })
        others.forEach(u => {
          t.kick(src, JList.of(tmProfile(u)))
          let op = server.getPlayerList().getPlayer(u)
          if (op) op.tell(Text.of('§e[Equipos] §c' + name + ' ha disuelto el equipo §f' + tname + '§c.'))
        })
        t.leave(me)
        return ['§aEquipo §f' + tname + '§a disuelto.']
      }
      case 'invitar': {
        if ((r = needOfficer())) return r
        let target = null
        server.players.forEach(o => { if (String(o.username).toLowerCase() == arg.toLowerCase()) target = o })
        if (!target) return ['§cNo hay ningún jugador conectado con ese nombre.']
        if (t.isMember(pUuid(target))) return ['§c' + target.username + ' ya está en tu equipo.']
        let other = tmParty(target)
        if (other) return ['§c' + target.username + ' ya está en el equipo §f' + other.getDisplayName() + '§c.']
        t.invite(p, JList.of(pProfile(target)))
        target.tell(Text.of('§e[Equipos] §f' + name + ' §bte invita a §a' + tname + '§b. Acepta en §fU → Equipo§b.'))
        return ['§aInvitación enviada a §f' + target.username + '§a.']
      }
      case 'aceptar':
      case 'unirse': {
        let tt = tmById(arg)
        if (!tt) return ['§cEse equipo ya no existe.']
        if (t) return ['§cYa estás en un equipo. Sal de él primero.']
        if (!tt.isInvited(me) && !tt.isFreeToJoin()) return ['§cNecesitas una invitación para entrar en ese equipo.']
        tt.join(p)
        return ['§aAhora eres de §f' + tt.getDisplayName() + '§a.']
      }
      case 'rechazar': {
        let tt = tmById(arg)
        if (!tt) return ['§cEse equipo ya no existe.']
        tt.declineInvitation(src)
        return ['§7Invitación de §f' + tt.getDisplayName() + ' §7rechazada.']
      }
      case 'expulsar': {
        if ((r = needOfficer())) return r
        let u = member()
        if (!u) return ['§cEse jugador no está en tu equipo.']
        if (u.equals(me)) return ['§cNo puedes expulsarte a ti mismo.']
        if (t.isOwner(u)) return ['§cNo se puede expulsar al dueño.']
        if (!owner && t.getRankForPlayer(u).isOfficerOrBetter()) return ['§cSolo el dueño puede expulsar a un oficial.']
        t.kick(src, JList.of(tmProfile(u)))
        let op = server.getPlayerList().getPlayer(u)
        if (op) op.tell(Text.of('§e[Equipos] §cTe han expulsado de §f' + tname + '§c.'))
        return ['§a' + tmName(u) + ' ya no está en el equipo.']
      }
      case 'ascender':
      case 'degradar': {
        if ((r = needOwner())) return r
        let u = member()
        if (!u || u.equals(me)) return ['§cEse jugador no está en tu equipo.']
        if (act == 'ascender') t.promote(p, JList.of(tmProfile(u)))
        else t.demote(p, JList.of(tmProfile(u)))
        return ['§a' + tmName(u) + ' ahora es §f' + (act == 'ascender' ? 'oficial' : 'miembro') + '§a.']
      }
      case 'dueno': {
        if ((r = needOwner())) return r
        let u = member()
        if (!u || u.equals(me)) return ['§cEse jugador no está en tu equipo.']
        t.transferOwnership(src, tmProfile(u))
        return ['§a' + tmName(u) + ' es ahora el dueño de §f' + tname + '§a.']
      }
      case 'nombre':
        if ((r = needOfficer())) return r
        if (arg.length < 3 || arg.length > 32) return ['§cEl nombre tiene que tener entre 3 y 32 letras.']
        t.setProperty(TeamProps.DISPLAY_NAME, arg); tmSync(t)
        return ['§aEl equipo ahora se llama §f' + arg + '§a.']
      case 'desc':
        if ((r = needOfficer())) return r
        if (arg.length > 120) return ['§cLa descripción es demasiado larga (máximo 120).']
        t.setProperty(TeamProps.DESCRIPTION, arg); tmSync(t)
        return ['§aDescripción guardada.']
      case 'color': {
        if ((r = needOfficer())) return r
        if (!/^[0-9a-fA-F]{6}$/.test(arg)) return ['§cColor no válido.']
        let rgb = parseInt(arg, 16); t.setProperty(TeamProps.COLOR, Color4I.rgb((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)); tmSync(t)
        return ['§aColor cambiado.']
      }
      case 'abierto':
        if ((r = needOfficer())) return r
        t.setProperty(TeamProps.FREE_TO_JOIN, arg == 'si'); tmSync(t)
        return [arg == 'si' ? '§aAhora cualquiera puede unirse a tu equipo desde la lista.' : '§aAhora solo se entra con invitación.']
      case 'aliado': {
        if ((r = needOfficer())) return r
        let prof = tmProfileByName(server, arg)
        if (!prof) return ['§cNo conozco a ningún jugador llamado §f' + arg + '§c.']
        if (t.isMember(prof.getId())) return ['§cEse jugador ya es de tu equipo.']
        t.addAlly(src, JList.of(prof))
        return ['§a' + prof.getName() + ' es ahora aliado de tu equipo.']
      }
      case 'quitaraliado': {
        if ((r = needOfficer())) return r
        let u = tmUuid(arg)
        if (!u) return ['§cJugador no válido.']
        t.removeAlly(src, JList.of(tmProfile(u)))
        return ['§a' + tmName(u) + ' ya no es aliado.']
      }
    }
  } catch (e) { return tmErr(e) }
  return ['§cAcción desconocida.']
}

const RANK_ORDER = { owner: 0, officer: 1, member: 2, invited: 3, ally: 4 }
function uiTeams(p) {
  let server = p.server, mgr = tmMgr(), me = pUuid(p), t = tmParty(p)
  let out = { party: !!t, teams: [], invites: [], online: [] }
  if (t) {
    out.id = String(t.getId()); out.name = String(t.getDisplayName()); out.desc = String(t.getDescription())
    out.color = tmColor(t); out.open = !!t.isFreeToJoin(); out.rank = tmRank(t, me)
    out.members = []; out.allies = []; out.invited = []
    t.getPlayersByRank(TeamRank.ALLY).keySet().forEach(u => {
      let rk = tmRank(t, u), o = { id: String(u), name: tmName(u), rank: rk, online: tmIsOnline(server, u), me: u.equals(me) }
      if (rk == 'ally') out.allies.push(o)
      else if (rk == 'invited') out.invited.push(o)
      else out.members.push(o)
    })
    out.members.sort((a, b) => (RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) || (a.name < b.name ? -1 : 1))
  }
  mgr.getTeams().forEach(o => {
    if (!o.isPartyTeam()) return
    let ms = []
    o.getMembers().forEach(u => ms.push({ name: tmName(u), rank: tmRank(o, u), online: tmIsOnline(server, u) }))
    ms.sort((a, b) => (RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) || (a.name < b.name ? -1 : 1))
    let e = { id: String(o.getId()), name: String(o.getDisplayName()), desc: String(o.getDescription()), color: tmColor(o),
      open: !!o.isFreeToJoin(), owner: tmName(o.getOwner()), members: ms, invited: !!o.isInvited(me), mine: !!(t && o.getId().equals(t.getId())) }
    out.teams.push(e)
    if (e.invited) out.invites.push(e)
  })
  out.teams.sort((a, b) => (b.mine - a.mine) || (b.members.length - a.members.length) || (a.name < b.name ? -1 : 1))
  server.players.forEach(o => {
    if (pUuid(o).equals(me) || (t && t.isMember(pUuid(o)))) return
    out.online.push({ name: String(o.username), party: !!tmParty(o) })
  })
  return out
}

// ---------------------------------------------------------------- /retos
function linesCarreras() {
  let out = ['§6=== Carreras: el primero en... ===']
  RACES.forEach(r => {
    let list = S.races[r.id] || []
    let parts = ['§f' + r.name + ' §7(' + r.desc + '): ']
    if (!list.length) parts.push('§7libre')
    list.forEach((w, i) => { if (i) parts.push(' §7| '); parts.push(PLACE[i] + ' '); parts.push(teamText(w.team, w.teamName)) })
    out.push(line.apply(null, parts))
  })
  return out
}
function linesCoop() {
  let out = ['§6=== Metas cooperativas ===']
  COOP.forEach(c => {
    let st = S.coop[c.id] || { total: 0, tier: 0 }
    let next = st.tier < c.tiers.length ? '§7siguiente nivel: §f' + c.tiers[st.tier] : '§acompletada'
    out.push('§f' + c.name + ' §7(nivel ' + st.tier + '/' + c.tiers.length + '): §e' + st.total + ' ' + c.unit + ' §7- ' + next)
  })
  out.push('§7Cada nivel premia con monedas a todos los que aportaron; el último da un trofeo al que más aportó.')
  return out
}
function linesSemanal(viewer) {
  if (!S.week) return ['§7Todavía no hay reto semanal.']
  let def = weeklyFor(S.week.id)
  let msLeft = Math.max(0, S.week.end - Date.now())
  let days = Math.floor(msLeft / DAY_MS), hours = Math.floor((msLeft % DAY_MS) / 3600000)
  let out = ['§6=== Reto semanal: ' + def.name + ' ===', '§7' + def.desc + '. Quedan §f' + days + 'd ' + hours + 'h§7.']
  let ranking = weekRanking().slice(0, 5)
  if (!ranking.length) out.push('§7Nadie ha puntuado aún.')
  ranking.forEach((t, i) => out.push(line((PLACE[i] || '§8' + (i + 1) + '.º') + ' ', teamText(t.id, t.name), ' §7- §f' + t.score)))
  if (viewer) {
    let mine = 0
    Object.keys(S.week.by).forEach(k => { mine += S.week.by[k].players[viewer] || 0 })
    out.push('§7Tú llevas §f' + mine + '§7; premio de participación (2 bevel) al llegar a §f' + def.min + (S.week.paid && S.week.paid[viewer] ? ' §a(cobrado)' : ''))
  }
  out.push('§7Premios: 1.º 1 cog para cada uno y trofeo al mejor; 2.º 2 sprocket; 3.º 1 sprocket.')
  if (S.next) out.push('§8Próxima semana: ' + weeklyFor(S.next).name)
  return out
}
function viewerName(ctx) { try { return String(ctx.source.player.username) } catch (e) { return null } }
function send(ctx, lines) {
  lines.forEach(l => ctx.source.sendSystemMessage(comp(l)))
  return 1
}

function intArg(event, name, min) {
  try { return event.commands.argument(name, event.arguments.INTEGER.create(event)) } catch (e) { }
  let IAT = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
  return event.commands.argument(name, IAT.integer(min))
}
function getInt(ctx, name) {
  try { return Number(ctx.getArgument(name, Java.loadClass('java.lang.Integer'))) } catch (e) { }
  return Number(Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType').getInteger(ctx, name))
}
function playerOf(ctx) { try { return ctx.source.player } catch (e) { return null } }

function summaryLines(server) {
  load(server)
  let done = RACES.filter(r => (S.races[r.id] || []).length > 0).length
  return ['§6=== Retos del servidor ===',
    '§fCarreras: §e' + done + '/' + RACES.length + ' §7con ganador  §8(/retos carreras)',
    '§fCooperativos: §e' + COOP.length + ' §7metas  §8(/retos cooperativos)',
    '§fSemanal: §e' + (S.week ? weeklyFor(S.week.id).name : '-') + '  §8(/retos semanal)',
    '§fSubastas: §e' + S.aucs.filter(a => a).map(a => AUC_TIERS[a.tier].name.toLowerCase() + ' ' + timeLeft(a.end - Date.now())).join(', ') + '  §8(/retos subasta)',
    '§fEncargos: §e' + (S.enc ? S.enc.list.length : 0) + ' §7hoy  §8(/retos encargos)',
    '§fRecompensas: §e' + (S.bnt ? S.bnt.list.length : 0) + ' §7hoy  §8(/retos recompensas)',
    '§fContratos entre equipos: §7ahora en la tienda §8(F10)']
}

function teamCmd(ctx, withText) {
  let p = playerOf(ctx)
  if (!p) return 0
  let SAT = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType')
  let r = teamAction(p, String(SAT.getString(ctx, 'accion')), withText ? getStr(ctx, 'texto') : '')
  if (!sendUI(p, false, r)) send(ctx, r)
  return 1
}

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  event.register(Commands.literal('retos')
    .executes(ctx => {
      let p = playerOf(ctx)
      if (p && sendUI(p, true, [])) return 1
      return send(ctx, summaryLines(ctx.source.server))
    })
    .then(Commands.literal('texto').executes(ctx => send(ctx, summaryLines(ctx.source.server))))
    .then(Commands.literal('recompensas').executes(ctx => {
      let server = ctx.source.server
      load(server); checkBounties(server)
      return send(ctx, linesRecompensas(playerOf(ctx)))
    }))
    .then(Commands.literal('ui')
      .executes(ctx => {
        let p = playerOf(ctx)
        if (!p) return 0
        if (!sendUI(p, true, [])) send(ctx, summaryLines(ctx.source.server))
        return 1
      })
      .then(Commands.literal('sync').executes(ctx => { let p = playerOf(ctx); if (p) sendUI(p, false, []); return 1 }))
      .then(Commands.literal('pujar').then(intArg(event, 'spurs', 1).executes(ctx => {
        let p = playerOf(ctx)
        if (!p) return 0
        let r = bid(p, getInt(ctx, 'spurs'))
        if (!sendUI(p, false, r)) send(ctx, r)
        return 1
      })))
      .then(Commands.literal('entregar').then(intArg(event, 'n', 1).executes(ctx => {
        let p = playerOf(ctx)
        if (!p) return 0
        let r = deliver(p, getInt(ctx, 'n'))
        if (!sendUI(p, false, r)) send(ctx, r)
        return 1
      })))
      .then(Commands.literal('equipo').then(event.commands.argument('accion', Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType').word())
        .executes(ctx => teamCmd(ctx, false))
        .then(strArg(event, 'texto').executes(ctx => teamCmd(ctx, true)))))
      .then(Commands.literal('evento')
        .then(Commands.literal('apuntar').then(intArg(event, 'id', 1).executes(ctx => eventCmd(ctx, true))))
        .then(Commands.literal('salir').then(intArg(event, 'id', 1).executes(ctx => eventCmd(ctx, false)))))
      .then(Commands.literal('admin').requires(src => src.hasPermission(2))
        .then(event.commands.argument('accion', Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType').word())
          .executes(ctx => adminCmd(ctx, false))
          .then(strArg(event, 'texto').executes(ctx => adminCmd(ctx, true)))))
    )
    .then(Commands.literal('eventos').executes(ctx => { load(ctx.source.server); return send(ctx, linesEventos(viewerName(ctx))) }))
    .then(Commands.literal('evento')
      .then(Commands.literal('apuntar').then(intArg(event, 'id', 1).executes(ctx => eventCmd(ctx, true))))
      .then(Commands.literal('salir').then(intArg(event, 'id', 1).executes(ctx => eventCmd(ctx, false)))))
    .then(Commands.literal('carreras').executes(ctx => { load(ctx.source.server); return send(ctx, linesCarreras()) }))
    .then(Commands.literal('cooperativos').executes(ctx => { load(ctx.source.server); return send(ctx, linesCoop()) }))
    .then(Commands.literal('semanal').executes(ctx => { load(ctx.source.server); return send(ctx, linesSemanal(viewerName(ctx))) }))
    .then(Commands.literal('subasta').executes(ctx => { load(ctx.source.server); return send(ctx, linesSubasta()) }))
    .then(Commands.literal('pujar').then(intArg(event, 'lote', 1).then(intArg(event, 'spurs', 1).executes(ctx => {
      let p = playerOf(ctx)
      if (!p) return send(ctx, ['§cSolo un jugador puede pujar.'])
      return send(ctx, bid(p, getInt(ctx, 'lote'), getInt(ctx, 'spurs')))
    }))))
    .then(Commands.literal('encargos').executes(ctx => {
      let server = ctx.source.server
      load(server); checkOrders(server)
      return send(ctx, linesEncargos(playerOf(ctx)))
    }))
    .then(Commands.literal('entregar').then(intArg(event, 'n', 1).executes(ctx => {
      let p = playerOf(ctx)
      if (!p) return send(ctx, ['§cSolo un jugador puede entregar.'])
      return send(ctx, deliver(p, getInt(ctx, 'n')))
    })))
    .then(Commands.literal('admin').requires(src => src.hasPermission(2))
      .then(Commands.literal('cerrarsubasta').executes(ctx => {
        let server = ctx.source.server
        load(server)
        for (let t = 0; t < AUC_TIERS.length; t++) { closeAuction(server, t); startAuction(server, t) }
        save(server)
        return send(ctx, ['§aSubastas cerradas y nuevas subastas abiertas.'])
      }))
      .then(Commands.literal('nuevosencargos').executes(ctx => {
        let server = ctx.source.server
        load(server)
        newBoard(server, madridDay(Date.now()))
        newBounties(madridDay(Date.now()))
        save(server)
        return send(ctx, ['§aEncargos y recompensas del día renovados.'])
      }))
      .then(Commands.literal('cerrarsemana').executes(ctx => {
        let server = ctx.source.server
        load(server)
        if (S.week) closeWeek(server)
        startWeek(server)
        save(server)
        return send(ctx, ['§aSemana cerrada y siguiente reto iniciado (termina el próximo lunes).'])
      }))
      .then(Commands.literal('funcion').then(strArg(event, 'clave').executes(ctx => {
        let server = ctx.source.server
        load(server)
        return send(ctx, featToggle(server, String(getStr(ctx, 'clave')).trim()))
      })))
      .then(Commands.literal('reiniciar').executes(ctx => {
        let server = ctx.source.server
        load(server)
        S.aucs.forEach(a => { if (a && a.bid) giveCmds(server, a.bid.player, coinCmds(a.bid.amount)) }) // devolver las pujas retenidas
        refundOldContracts(server)
        let pending = S.pending, feat0 = S.feat, ev = S.ev, seen0 = S.seen, act0 = S.act, eco0 = S.eco, log0 = S.log
        S = emptyState()
        S.pending = pending
        S.feat = feat0 // las funciones activadas las decide el admin
        S.ev = ev // los eventos los gestiona el admin a mano
        S.seen = seen0; S.act = act0; S.eco = eco0; S.log = log0 // datos del panel de admin
        startWeek(server)
        save(server)
        return send(ctx, ['§cRetos reiniciados: carreras, metas y semana a cero.'])
      }))))
})
