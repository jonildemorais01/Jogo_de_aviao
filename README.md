# Skyforce — Jogo de Avião

Jogo arcade independente para navegador, feito com HTML, CSS e JavaScript puro (sem dependências).

## Jogar online

Abra a URL publicada na Vercel.

## Como jogar localmente

1. Baixe a pasta do projeto.
2. Abra `index.html` no navegador.
3. Escolha **Fácil**, **Médio** ou **Difícil** e clique em **Iniciar missão**.

Não precisa instalar dependências nem iniciar servidor. A internet é usada apenas para carregar as fontes externas; sem ela, o jogo usa as fontes do sistema.

## Controles

- **WASD ou setas:** pilotar.
- **Celular ou tablet:** arraste o dedo sobre a área do jogo.
- **Tiro:** automático.
- **P ou Esc:** pausar e continuar.
- **Espaço:** iniciar ou reiniciar quando um botão não estiver selecionado.
- **Botão de som:** ativar ou silenciar os efeitos.

## Recursos

- Três dificuldades com quantidade de vidas e velocidade diferentes.
- Três tipos de inimigos e níveis progressivos.
- Vidas, escudos, tiro triplo, combos e recordes por dificuldade.
- Interface responsiva, efeitos sonoros e pausa automática ao trocar de janela.
- Recordes armazenados no navegador com `localStorage`.

## Estrutura

- `index.html`: estrutura da interface.
- `style.css`: visual e adaptação para celulares.
- `game.js`: controles, animações, inimigos, colisões e pontuação.

## Deploy

Site estático: basta publicar a raiz do repositório na Vercel (framework preset **Other**, sem build command).
