# CuadroConfig — tu versión de EcoSet Config

## Qué es EcoSet Config (análisis)
Software web de **Schneider Electric** para **diseñar, verificar y presupuestar cuadros eléctricos de baja tensión**.
Va dirigido a cuadristas, instaladores e ingenierías. Según la información pública:

- Dos versiones: **400** (residencial / pequeño terciario) y **4000** (terciario / industrial, hasta ~3.200–4.000 A; las fuentes no coinciden).
- Flujo: crear **proyecto** → elegir **lista de precios** → crear uno o varios **cuadros** → arrastrar y soltar aparatos para
  formar la **jerarquía de la red** → revisar el **esquema unifilar** → obtener **presupuesto e informes**.
- Esquemas predefinidos, selección automática de envolvente, trazabilidad y validación continua, actualización automática de catálogo y precios.

## Qué incluye tu versión (mismo funcionamiento)
| Función de EcoSet | En CuadroConfig |
|---|---|
| Proyectos con varios cuadros | Pestaña de proyectos, añadir/duplicar/eliminar cuadros |
| Lista de precios por proyecto | 3 tarifas, descuento, margen, IVA, mano de obra |
| Arrastrar y soltar para crear la jerarquía | Árbol con drag & drop (paleta → árbol, mover nodos, doble clic) |
| Esquema unifilar | SVG automático, clic para editar, imprimible |
| Esquemas predefinidos | Plantillas: vivienda y local trifásico |
| Validación continua | Calibre vs. intensidad, poder de corte vs. Icc, calibres hijo/padre, diferencial en finales, selectividad, tri/monofásico, límite 400/4000 A |
| Selección de envolvente | Automática (con % de reserva) o manual + vista de distribución por filas |
| Presupuesto e informes | BOM agrupada, totales, CSV, informe imprimible/PDF |
| Catálogo | Totalmente editable (precios, aparatos propios, envolventes) |
| Extras | Cable orientativo por circuito, import/export JSON, guardado automático local |

## Uso
Abre `index.html` en Chrome/Edge (no necesita instalación ni servidor). Los datos se guardan en tu navegador; usa **Exportar** para copias de seguridad.

## Importante
- Catálogo y precios son **genéricos de ejemplo**: sustitúyelos por los de tu proveedor en la pestaña «Catálogo».
- No usa marcas ni datos de Schneider Electric; es una herramienta independiente.
- Cálculos orientativos: validar por técnico competente (REBT / IEC 61439) antes de fabricar o instalar.

## Novedades
- **Instalaciones y receptores:** plantillas (vivienda, vivienda con VE y FV, local, oficina, taller, garaje, piscina, bombeo) y catálogo de receptores: alumbrado, tomas, cocina, aire acondicionado, calefacción, recarga de vehículo eléctrico, fotovoltaica, soldadura y motores.
- **Motores:** guardamotores, relés térmicos, contactores AC-3, arrancadores suaves y variadores. Arranque directo, estrella-triángulo, suave y variador.
- **Convalidación:** veredicto «válida / válida con avisos / no válida» con comprobaciones tipo REBT (ITC-BT-25 vivienda, ITC-BT-47 motores, ITC-BT-52 recarga VE, ITC-BT-40 fotovoltaica): protecciones, secciones, caída de tensión, corrientes de arranque, selectividad y poder de corte.
- **Montaje 3D:** cuadro con carriles, canaletas, bornas, puerta y sombras; vista de **instalación completa** con motores, lámparas, cargas y cables animados; fallos (cortocircuito, sobrecarga, fuga, rotor bloqueado, falta de fase) con indicación de dónde y qué protección actúa.

## Casa completa (todas las instalaciones)
Pestaña **Casa (plano)**: dibujas las estancias en un plano 2D, colocas elementos de **eléctrica, telecomunicaciones y domótica, climatización y agua caliente, fontanería y gas**, y el sistema:
- traza las rutas (cables por circuito, datos, tuberías de agua fría/caliente y gas) y calcula longitudes y diámetros;
- valida la normativa de cada instalación (puntos mínimos por estancia ITC-BT-25, volúmenes de baño, circuitos C1–C12 y sus límites, ICT, splits, ACS, aparatos de gas, ventilación, humos…);
- **genera el cuadro eléctrico desde la casa** y lo valida;
- muestra la casa en **3D** (vista «Casa 3D» de Montaje 3D) con luces, aparatos, cables y tuberías, y permite provocar fallos en cualquier circuito.
Plantillas: piso de 3 dormitorios, estudio y piso con climatización y gas. «Equipar según normativa» añade los elementos que faltan.

## Simulación de la casa
En «Casa (plano)» pulsa **▶ Simular funcionamiento**: pulsa interruptores (se encienden las luces del circuito C1), enchufa aparatos en las tomas (suben los amperios y puede saltar C2), abre grifos, enciende la cocina de gas o el termo. Hay 6 ejemplos guiados (luz, sobrecarga, cortocircuito, fuga a tierra, ducha con termo apagado, cocina de gas) y se ve qué protección salta y qué circuitos se quedan sin tensión. La misma simulación funciona en «Casa 3D».

## Mecanismos y domótica con autómata (tipo LOGO!)
- **Poner y quitar mecanismos en plena demostración:** interruptor, conmutador (luz desde 2 puntos), conmutador de cruce (3 o más puntos), pulsador con telerruptor, regulador de luz, detector de presencia, timbre, enchufes, luces y focos. Si quitas el último interruptor, la luz queda siempre encendida.
- **Pestaña «Domótica (autómata)»:** editor de esquema de funciones (Y, O, NO, SR, telerruptor, temporizadores, intermitente, contador, comparador analógico, reloj semanal), simulador en vivo, pantalla del autómata, entradas pulsables y escena de la casa (luces, persiana con enclavamiento, calefactor, riego, sirena, cerradura). Incluye 8 programas de ejemplo y validación de relés/contactores y materiales en el presupuesto.

## Instala lo que quieras y el programa te dice si está bien
- **Plano de la casa, cableado manual:** elige «Manual (dibujo mis cables)», pulsa «⚡ Dibujar cables» y une el cuadro con luces, interruptores y tomas (o parte de «Cablear automáticamente» y modifica). Cada cable se puede cambiar de sección o quitar de tierra. La tarjeta **«¿Está bien conectado?»** avisa de elementos sin cable, circuitos puenteados, elementos en el circuito equivocado, luces sin interruptor, conmutadores sin unir, lazos, secciones insuficientes y cables sin tierra, además de toda la normativa. En la simulación, lo que está sin cable no funciona.
- **Autómata:** además de la validación en vivo, el botón **«🔍 Comprobar ahora»** prueba todas las combinaciones de entradas, pulsaciones repetidas y las horas de los relojes semanales, y dice qué salidas nunca se activan, cuáles están siempre activas, cuáles oscilan y si la persiana puede subir y bajar a la vez. Detecta lazos sin memoria, señales analógicas en entradas digitales y bloques que no llegan a ninguna salida.

## Autómata vinculado a la casa
En «Domótica (autómata)», toca una entrada I o una salida Q y elige **«Vinculado a la casa»**: las entradas son mecanismos del plano (pulsadores, interruptores, detectores, sensores) y las salidas gobiernan luces, radiadores, splits, termos… («Todas las luces de una estancia» o un elemento concreto). En la simulación de la casa, el pulsador ya no enciende la luz directamente: la señal pasa por tu programa. El botón **«🏠 Demo: casa domotizada»** lo monta solo (telerruptor en el salón, luz de pasillo temporizada y «apagar todo»). Los elementos vinculados llevan una etiqueta I1, Q1… en el plano y el autómata entra en la tarjeta «¿Está bien conectado?».

## Persianas, riego y sensores en el plano
Nuevos elementos (pestaña «Casa (plano)»): **persiana motorizada**, **electroválvula de riego**, **sensor de luz** y **sensor de temperatura**. Se vinculan al autómata: los sensores alimentan las entradas analógicas AI1/AI2, y las salidas Q gobiernan «Persiana · SUBIR/BAJAR» y la electroválvula. Pulsa un sensor (o usa su deslizador) para cambiar el valor y ver cómo reacciona la casa; la persiana se mueve en 2D y en 3D, con aviso si se activan subir y bajar a la vez. El botón **«🌿 Demo: persiana, riego y clima»** monta un ejemplo completo (anochecer, calefactor por debajo de 19 °C y riego programado).

## Más sensores e informe completo
- **Sensores nuevos:** lluvia, anemómetro (viento) y contacto de ventana. El anemómetro es la entrada analógica AI3 del autómata; lluvia y ventana son entradas digitales vinculables. Demo **«🌦 Demo: estación meteorológica»**: con viento fuerte la persiana sube sola, la lluvia anula el riego y una ventana abierta con lluvia hace parpadear la luz de aviso.
- **Informe completo (pestaña «Informe»):** portada con totales, **plano de la casa**, tarjeta «¿Está bien conectado?», validaciones de todas las instalaciones, circuitos, cuadros, **esquema del autómata** con sus entradas/salidas vinculadas, comprobación automática de combinaciones y resumen económico. En la versión de Netlify, «Imprimir / guardar PDF» genera el PDF (A4, con saltos de página).

## Varias plantas, asistente y cuadro en el informe
- **Varias plantas:** en «Casa (plano)» hay pestañas de planta (+ Planta / − Quitar la última), un tipo de estancia «Escalera» y la plantilla «Dúplex de 2 plantas». Los cables y tuberías entre plantas suman 350 cm por planta, los circuitos de las plantas superiores pasan a los circuitos adicionales (C6, C7, C12) para acortar recorridos y la vista **Casa 3D** apila las plantas.
- **Cargador de vehículo eléctrico** como elemento del plano (circuito propio C13 con diferencial de 30 mA).
- **Asistente de proyecto (pestaña «Asistente»):** das las estancias (tipo, medidas y planta) y eliges calefacción (radiadores, aerotermia o caldera de gas), aire acondicionado, domótica con autómata, riego, recarga de vehículo eléctrico y cocina de gas. Genera el plano, coloca los elementos según la normativa, calcula circuitos y cables, crea el cuadro (pasa a trifásico si hace falta), programa el autómata y devuelve circuitos, material, presupuesto y comprobaciones.
- **Informe:** ahora incluye un plano por planta, el esquema unifilar y la distribución en la envolvente de cada cuadro.
