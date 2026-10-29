// /tps para todos (y para DiscoPanel por RCON). NeoForge ya trae /neoforge tps, pero solo para admins.
// Formato "Overall: 20.000 TPS", que es el que DiscoPanel lee primero.
const TpsComponent = Java.loadClass('net.minecraft.network.chat.Component')

ServerEvents.commandRegistry(event => {
  const Commands = event.commands
  event.register(Commands.literal('tps').executes(ctx => {
    let ms = ctx.source.server.getAverageTickTimeNanos() / 1e6
    let tps = Math.min(20, 1000 / Math.max(ms, 0.001))
    ctx.source.sendSystemMessage(TpsComponent.literal('Overall: ' + tps.toFixed(3) + ' TPS (' + ms.toFixed(2) + ' ms por tick)'))
    return 1
  }))
})
