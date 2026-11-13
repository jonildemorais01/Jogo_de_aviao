# Skyforce — Jogo de Avião

Jogo arcade independente para navegador, feito com **HTML, CSS e JavaScript puro** (sem dependências,
sem build). Roda offline depois de baixado.

🎮 **Jogue online:** https://jogodeaviao.vercel.app

## O que tem no jogo

- **3 chefões** com nomes, fases e padrões de ataque próprios: *Cruzador Ferro*, *Ceifador Sombrio* e
  *Fortaleza Órbita*. O chefão aparece a cada 3 níveis, com barra de vida, mudança de fase e bônus de pontos.
- **Arsenal progressivo:** arma em 4 níveis (1 → 4 canhões), **mísseis teleguiados**, **laser perfurante**
  e **bombas** que limpam a tela.
- **5 tipos de inimigo:** batedor, zigue-zague, tanque, mergulhador e franco-atirador.
- **Níveis infinitos** com dificuldade crescente (velocidade, cadência e vida dos inimigos).
- **Combos** até ×9, recordes por dificuldade salvos no navegador.
- **Visual em camadas:** planetas, nebulosas, 3 níveis de estrelas em paralaxe, partículas, rastros,
  explosões com onda de choque, screen shake e vinheta.
- **Responsivo de verdade:** o campo de jogo recalcula a resolução conforme a tela, sem esticar o desenho.

## Controles

| Ação | Teclado | Toque |
| --- | --- | --- |
| Pilotar | `WASD` ou setas | arraste o dedo na tela |
| Tiro principal | automático | automático |
| Mísseis | automático (quando equipado) | automático |
| Bomba | `B` ou `X` | botão da bomba no topo |
| Pausar / continuar | `P` ou `Esc` | botão de pausa |
| Iniciar / reiniciar | `Espaço` | botão |

## Itens que caem dos inimigos

| Item | Efeito |
| --- | --- |
| `+` verde | vida extra |
| `◇` azul | escudo (absorve um acerto) |
| `W` roxo | arma +1 nível |
| `M` laranja | 9 mísseis teleguiados |
| `L` rosa | laser perfurante por alguns segundos |
| `B` amarelo | +1 bomba |

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

No console do navegador existe o objeto `SkyforceDebug` (`SkyforceDebug.spawnBoss()`,
`SkyforceDebug.giveWeapons()`, `SkyforceDebug.damageBoss(99999)`, `SkyforceDebug.game`) para testar
fases e chefões sem precisar jogar até lá.
