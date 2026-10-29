# Venturia — auto-actualización

Packs [packwiz](https://packwiz.infra.link/) generados con `config/ftbquests_build/mk_packwiz.py` a partir de los `.mrpack`.
Se sirven desde raw.githubusercontent (GitHub Pages no vale: el dominio de Ronambulo.github.io apunta a Vercel): `https://raw.githubusercontent.com/Ronambulo/venturia-pack/main/<tier>/pack.toml` (`high`, `mid`, `low`, `server`).

## Jugadores (Modrinth App, una sola vez)

1. Importa el `.mrpack` de tu versión (High / Mid / Low).
2. En la instancia: **Ajustes → Launch hooks → Pre-launch** escribe:

   ```
   cmd /c venturia-update.bat
   ```

3. Listo: cada vez que le des a Jugar se descargan solo los cambios. Sin conexión se juega igual.

## Servidor (DiscoPanel / itzg)

```
TYPE=NEOFORGE
VERSION=1.21.1
NEOFORGE_VERSION=21.1.256
PACKWIZ_URL=https://raw.githubusercontent.com/Ronambulo/venturia-pack/main/server/pack.toml
```

Se actualiza al reiniciar. Si cambia la versión de NeoForge hay que cambiarla a mano (packwiz no instala el loader),
y los jugadores también tendrían que cambiarla en la instancia.

## Publicar una versión

```
python mk_mrpack.py <perfil> <perfil>/Venturia-<ver>-<tier>.mrpack <ver> <full|high|mid|low>   # los 4 tiers
python mk_packwiz.py <perfil> <este repo> <ver>
git add -A && git commit -m "<ver>" && git push
```
