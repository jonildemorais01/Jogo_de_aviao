# Skyforce — Jogo de Avião

Jogo arcade independente para navegador, feito com **HTML, CSS e JavaScript puro** (sem dependências,
sem build). Roda offline depois de baixado.

🎮 **Jogue online:** https://jogodeaviao.vercel.app

## O que tem no jogo

- **3 chefões** com nomes, fases e padrões de ataque próprios: *Cruzador Ferro*, *Ceifador Sombrio* e
  *Fortaleza Órbita*. O chefão aparece a cada 3 níveis, com barra de vida, mudança de fase e bônus de pontos.
- **Tiro principal em 3 níveis:** 1 canhão → 2 canhões → 3 canhões em leque, com cadência e dano crescendo.
- **Artilharia de apoio:** **mísseis teleguiados**, **laser perfurante**, **drones de escolta** (até 2, atiram sozinhos),
  **sobrecarga** (cadência e dano turbinados por alguns segundos) e **bombas** que limpam a tela.
- **5 tipos de inimigo:** batedor, zigue-zague, tanque, mergulhador e franco-atirador.
- **Níveis infinitos** com dificuldade crescente (velocidade, cadência e vida dos inimigos).
- **Combos** até ×9, recordes por dificuldade salvos no navegador.
- **Visual em camadas:** planetas, nebulosas, 3 níveis de estrelas em paralaxe, partículas, rastros,
  explosões com onda de choque, screen shake e vinheta.
- **Trilha sonora adaptativa** sintetizada em tempo real: **calma** no início, **suspense** quando a coisa aperta
  e **intensa** no chefão e nos níveis finais (tempo, timbre e harmonia mudam junto).
- **Responsivo de verdade:** o campo de jogo recalcula a resolução conforme a tela, sem esticar o desenho.

## Controles

| Ação | Teclado | Toque |
| --- | --- | --- |
| Pilotar | `WASD` ou setas | arraste o dedo na tela |
| Tiro principal | automático | automático |
| Mísseis | automático (quando equipado) | automático |
| Bomba | `B` ou `X` | botão da bomba no topo |
| Som (efeitos + trilha) | botão de som no topo | botão de som no topo |
| Pausar / continuar | `P` ou `Esc` | botão de pausa |
| Iniciar / reiniciar | `Espaço` | botão |

## Itens que caem dos inimigos

| Item | Efeito |
| --- | --- |
| `+` verde | vida extra (até 7) |
| `◇` azul | escudo (absorve um acerto) |
| `W` roxo | tiro +1 nível (até o nível 3) |
| `M` laranja | 9 mísseis teleguiados |
| `L` rosa | laser perfurante por alguns segundos |
| `B` amarelo | +1 bomba (até 6) |
| `D` verde-água | drone de escolta (até 2) |
| `⚡` laranja | sobrecarga: cadência e dano turbinados |

Itens caem bem mais dos inimigos **tanque** e chefões derrotados soltam um kit completo
(bomba, tiro, drone, vida e sobrecarga).

## Estrutura

```
index.html   estrutura da interface
style.css    visual, HUD do chefão, arsenal e responsividade
game.js      motor do jogo: entidades, chefões, colisões, níveis e renderização
```

## Rodar localmente

Abra `index.html` no navegador — não precisa instalar nada nem subir servidor.

## Deploy

Site estático. A Vercel está conectada ao repositório: **todo push na branch `main` publica em produção**.

## Depuração

No console do navegador existe o objeto `SkyforceDebug` para testar sem jogar até lá:

```js
SkyforceDebug.spawnBoss()          // chama o próximo chefão
SkyforceDebug.giveWeapons()        // tiro Nv.3 + mísseis + laser + drones + sobrecarga
SkyforceDebug.givePickup('bomb')   // solta um item (life, weapon, drone, overdrive, laser, missile, shield)
SkyforceDebug.damageBoss(99999)    // derruba o chefão
SkyforceDebug.setLives(5)
SkyforceDebug.game                 // estado interno
```
