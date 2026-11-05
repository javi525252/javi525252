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
