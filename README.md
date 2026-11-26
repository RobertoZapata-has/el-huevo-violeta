# El Huevo Violeta

Aventura de plataformas con Chispa y Bichi, en la Mendoza del 2189. La Princesa del Enjambre nació de un huevo violeta y Chispa tiene que devolver a los bichos gigantes a su tamaño, sin lastimar a nadie.

**Jugar:** https://robertozapata-has.github.io/el-huevo-violeta/

## Niveles

1. Vagones del Trasandino — la Langosta Maquinista
2. La bodega subterránea — la Polilla de la Cava
3. Las acequias — la Libélula de las Acequias
4. El Cerro de la Gloria — el Avispón del Cerro
5. Las termas de Cacheuta — el Escarabajo de las Termas
6. La colmena del glaciar — la Princesa del Enjambre

## Controles

- **Cel:** deslizá el dedo a la izquierda para moverte (abajo para agacharte, arriba para trepar). A la derecha: SALTAR, TIRAR y BICHI.
- **Compu:** flechas para moverte, espacio para saltar, X para tirar, C para Bichi, Esc para pausa.

## Cómo está hecho

- Canvas 2D y JavaScript sin librerías. `game.js` tiene el juego y `meta.js` los datos de los dibujos (cuadros de cada tira y el mapa de alturas de cada plataforma, para pararse justo arriba del dibujo).
- Las imágenes las hizo Gemini con fondo verde, recortadas y pasadas a WebP en `a/`.
- La música y los sonidos se sintetizan en el momento con WebAudio.
- Se instala en el cel (PWA) y funciona sin conexión.

Parte de la saga de [Puelche](https://github.com/RobertoZapata-has/puelche).
