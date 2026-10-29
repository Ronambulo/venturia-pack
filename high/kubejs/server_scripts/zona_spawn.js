// Zona segura del spawn (la isla inicial). La protección de bloques la da FTB Chunks con un equipo de servidor;
// esto añade lo que FTB Chunks no hace: sin mobs hostiles dentro de la zona y aldeanos invulnerables.
// PvP y matar animales siguen permitidos.
// Admin: /zonaspawn set <radio>  (centro = donde estás)  |  /zonaspawn quitar  |  /zonaspawn
const ZsComponent = Java.loadClass('net.minecraft.network.chat.Component')
const ZsInt = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType')
const ZsAABB = Java.loadClass('net.minecraft.world.phys.AABB')
const ZsVillager = Java.loadClass('net.minecraft.world.entity.npc.AbstractVillager')
const ZS_TAG = 'venturia_zona_spawn'
let ZONA = null // {dim, x, z, r}

function zsLoad(server) {
  let s = String(server.persistentData.getString(ZS_TAG))
  ZONA = s ? JSON.parse(s) : null
}

function zsDim(level) { return String(level.dimension().location()) }

function zsInside(entity) {
  if (!ZONA || zsDim(entity.level) != ZONA.dim) return false
  return Math.abs(entity.x - ZONA.x) <= ZONA.r && Math.abs(entity.z - ZONA.z) <= ZONA.r
}

function zsHostile(entity) {
  return entity.isLiving() && !entity.isPlayer() && !entity.getType().getCategory().isFriendly()
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
      ZONA = { dim: zsDim(ctx.source.getLevel()), x: pos.x(), z: pos.z(), r: ZsInt.getInteger(ctx, 'radio') }
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
