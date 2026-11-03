// Zona segura del spawn (la isla inicial). La protección de bloques la da FTB Chunks con un equipo de servidor;
// esto añade lo que FTB Chunks no hace: sin mobs hostiles dentro de la zona y aldeanos invulnerables.
// PvP y matar animales siguen permitidos.
// Admin: /zonaspawn set <radio>  (centro = donde estás)  |  /zonaspawn quitar  |  /zonaspawn
const ZsComponent = Java.loadClass('net.minecraft.network.chat.Component')
const ZsInt = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
const ZsAABB = Java.loadClass('net.minecraft.world.phys.AABB')
const ZsVillager = Java.loadClass('net.minecraft.world.entity.npc.AbstractVillager')
const ZsEnemy = Java.loadClass('net.minecraft.world.entity.monster.Enemy')
const ZS_TAG = 'venturia_zona_spawn'
let ZONA = null // {dim, x, z, r}

function zsLoad(server) {
  let s = String(server.persistentData.getString(ZS_TAG))
  ZONA = s ? JSON.parse(s) : null
}

// en KubeJS level.dimension es una propiedad (el id de la dimensión), no el método dimension() de Minecraft
function zsDim(level) {
  let d = level.dimension
  if (typeof d == 'function') d = level.dimension()
  return String(d && d.location ? d.location() : d)
}

function zsNum(o, k) { return Number(typeof o[k] == 'function' ? o[k]() : o[k]) }

function zsInside(entity) {
  if (!ZONA || zsDim(entity.level) != ZONA.dim) return false
  return Math.abs(entity.x - ZONA.x) <= ZONA.r && Math.abs(entity.z - ZONA.z) <= ZONA.r
}

// en KubeJS entity.getType() devuelve el id como texto, no el EntityType: se usa la interfaz Enemy de los mobs hostiles
function zsHostile(entity) {
  return entity instanceof ZsEnemy
}

ServerEvents.loaded(event => zsLoad(event.server))

// mobs hostiles: no aparecen dentro (spawn natural, spawners, huevos...)
EntityEvents.spawned(event => {
  let e = event.entity
  if (ZONA && zsHostile(e) && zsInside(e)) event.cancel()
})

// cada 2 s: quita hostiles que hayan entrado y marca a los aldeanos de la zona como invulnerables
// (los jugadores en creativo pueden seguir quitándolos)
function zsSweep(server, z) {
  let level = null
  server.getAllLevels().forEach(l => { if (zsDim(l) == z.dim) level = l })
  if (!level) return
  let r = Math.max(z.r, 0) + 16
  let box = new ZsAABB(z.x - r, level.getMinBuildHeight(), z.z - r, z.x + r + 1, level.getMaxBuildHeight(), z.z + r + 1)
  level.getEntities(null, box).forEach(e => {
    if (e instanceof ZsVillager) {
      let dentro = zsInside(e)
      if (dentro && !e.isInvulnerable()) { e.setInvulnerable(true); e.addTag(ZS_TAG) }
      else if (!dentro && e.getTags().contains(ZS_TAG)) { e.setInvulnerable(false); e.removeTag(ZS_TAG) }
    } else if (zsHostile(e) && zsInside(e)) {
      e.discard()
    }
  })
}

ServerEvents.tick(event => {
  if (ZONA && event.server.getTickCount() % 40 == 0) zsSweep(event.server, ZONA)
})

// decoración que se coge o se come con clic derecho (bebidas, jarras, posavasos, vinos, comida en plato, tartas, macetas...):
// con block_interact_mode público FTB Chunks deja cogerla, pero block_edit_mode privado no deja volver a ponerla.
// Dentro de la zona solo se puede en creativo (también los OP en supervivencia quedan bloqueados).
// Añade aquí otros bloques que se cojan o se coman al usarlos.
const ZS_NO_COGER = new RegExp('^(' + [
  'brewery:(beer_|whiskey_|dumplings|fried_chicken|half_chicken|mashed_potatoes|pork_knuckle|potato_salad|gingerbread)',
  'brewinandchewin:(?!keg|heating_cask|ice_crate|fiery_fondue_pot)', // todo menos las estaciones de trabajo
  'farmersdelight:(.*_pie$|.*_block$|sweet_berry_cheesecake)',
  // Let's Do: vinos y botelleros, tartas y expositores, platos, cócteles, tés, sacos y estantes
  'vinery:(.*_wine_rack_|.*_wine$|wine_bottle|wine_box|eiswein|mead|.*cider|.*juice|creepers_crush|villagers_fright|jo_special_mixture|bottle_mojang_noir|.*_bag$|.*_shelf$)',
  'bakery:(.*_block$|.*_cake$|.*_tart$|.*_jam$|apple_pie|chocolate_gateau|pudding|.*display$|cake_stand|tray|breadbox|bread_crate|jar|chocolate_box)',
  'candlelight:(.*_block$|.*_shelf$|table_set|wine_glass|chocolate_box)',
  'beachparty:(.*_cocktail$|message_in_a_bottle)',
  'farm_and_charm:(.*_block$|.*_tea$|.*_bag$|tool_rack|window_sill|cutting_board)',
  'wildernature:truffle_bag',
  '[a-z0-9_]+:potted_', // macetas de cualquier mod: se saca la planta
  'minecraft:flower_pot$', // maceta vacía: la planta que se meta ya no se podría sacar
  'minecraft:(cake|.*candle_cake|chiseled_bookshelf|jukebox|decorated_pot)'
].join('|') + ')')

BlockEvents.rightClicked(event => {
  if (!ZONA || !ZS_NO_COGER.test(String(event.block.id))) return
  let p = event.player
  if (p.isCreative()) return
  let b = event.block
  if (zsDim(event.level) != ZONA.dim || Math.abs(b.x + 0.5 - ZONA.x) > ZONA.r || Math.abs(b.z + 0.5 - ZONA.z) > ZONA.r) return
  p.setStatusMessage(Text.red('Esto es decoración del spawn: no se puede coger.'))
  event.cancel()
})

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  let msg = (ctx, t) => ctx.source.sendSystemMessage(ZsComponent.literal(t))
  event.register(Commands.literal('zonaspawn').requires(s => s.hasPermission(2))
    .executes(ctx => {
      msg(ctx, ZONA ? 'Zona del spawn: ' + ZONA.dim + ' centro ' + Math.floor(ZONA.x) + ', ' + Math.floor(ZONA.z) +
        ' radio ' + ZONA.r + ' bloques' : 'No hay zona del spawn definida. Usa /zonaspawn set <radio>')
      return 1
    })
    .then(Commands.literal('set').then(Commands.argument('radio', ZsInt.integer(1, 2000)).executes(ctx => {
      let pos = ctx.source.getPosition()
      if (ZONA) { let old = ZONA; ZONA = { dim: old.dim, x: old.x, z: old.z, r: -1 }; zsSweep(ctx.source.server, old) }
      ZONA = { dim: zsDim(ctx.source.getLevel()), x: zsNum(pos, 'x'), z: zsNum(pos, 'z'), r: ZsInt.getInteger(ctx, 'radio') }
      ctx.source.server.persistentData.putString(ZS_TAG, JSON.stringify(ZONA))
      msg(ctx, 'Zona del spawn: centro ' + Math.floor(ZONA.x) + ', ' + Math.floor(ZONA.z) + ', radio ' + ZONA.r +
        ' bloques. Sin mobs hostiles y con aldeanos invulnerables.')
      return 1
    })))
    .then(Commands.literal('quitar').executes(ctx => {
      if (ZONA) { let old = ZONA; ZONA = { dim: old.dim, x: old.x, z: old.z, r: -1 }; zsSweep(ctx.source.server, old) }
      ZONA = null
      ctx.source.server.persistentData.remove(ZS_TAG)
      msg(ctx, 'Zona del spawn quitada.')
      return 1
    })))
})
