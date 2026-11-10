# Revisión de PRIME POLICE · 10 de noviembre de 2026

Revisión del código, compilación pública, dependencias fijadas, pruebas del proyecto, catálogo de permisos SQL, asesores y registros de las últimas 24 horas. No se crean operaciones de personal ni mensajes ficticios para probar.

| Área | Comprobación y resultado |
| --- | --- |
| Regresión | 76 comprobaciones de la configuración de CI correctas después de los cambios; TypeScript de las tres funciones y build público correctos. |
| Dependencias | npm audit: 0 vulnerabilidades registradas en el lockfile revisado. No se actualizan paquetes sin necesidad. |
| Acceso SQL | No se encontraron tablas públicas sin RLS ni tablas con SELECT concedido a anon/authenticated. Ninguna función SECURITY DEFINER pública ejecutable por esos roles. |
| API privada | Personal, NIE, Bonos y Evidencias respondieron 403 sin sesión. No se observaron respuestas 5xx en los eventos panel_request consultados de las últimas 24 horas. |
| Índices | Dos FK sin índice: Bonos/agente y borradores NIE/postulación. Índices añadidos mediante 20261110122929_web_review_indexes.sql; el asesor ya no señala esas incidencias. |
| HTML | Sin IDs duplicados ni destinos estáticos de label/ARIA inexistentes. |
| Artefacto | HTML y solo recursos públicos, minificados, con nombres hash, SRI y CSP. Sin SQL, funciones, claves de servicio ni mapas de fuentes en dist. |
| Transferencia | Medición inicial: HTML 16.298 bytes gzip, CSS 27.663, JS 71.080: unos 112 KiB en total. Los tiempos observados a través del proxy cloud no se presentan como tiempos de carga del usuario. |
| Navegador público | Página de acceso visible y API conectada; no se observaron errores propios de la aplicación en consola. El navegador cloud no tiene una sesión privada iniciada. |

## Correcciones incluidas

1. Aislamiento de tareas asíncronas al cambiar o cerrar sesión: directorio, panel principal, bandeja, configuración/historial de rangos y listado de sesiones. Una tarea antigua no puede reemplazar la de una cuenta nueva. Se limpian datos de registros al cerrar sesión.
2. Invalidación del directorio en curso al guardar cambios; paginación que avanza o se detiene con error, evitando bucles ante respuestas inconsistentes.
3. Bonos: cambiar la búsqueda limpia el agente seleccionado; evita conservar un destinatario anterior mientras se escribe otro. Se restaura Actualizar ante fechas inválidas y se deshabilita Guardar sin selección.
4. Respuestas HTTP inesperadas: aviso seguro con referencia y tratamiento correcto de sesión caducada, sin revelar mensajes técnicos ni reintentar escrituras automáticamente.
5. Sincronización de tarjetas de aceptados: omitir ediciones idénticas reduce llamadas innecesarias a Discord; las tarjetas modificadas siguen actualizándose y se conservan sus IDs.
6. Dos índices de claves externas sin cambiar datos ni permisos.

## Límites y seguimiento

- Los registros contienen pausas Discord 429 y denegaciones 403 en algunos recordatorios. La reducción de ediciones redundantes no elimina las cuotas de Discord ni demuestra la causa concreta de cada 403. No se fuerzan reenvíos ni se modifican permisos de miembros.
- Los avisos INFO de RLS sin políticas corresponden a tablas privadas por servicio; no se abren lecturas para quitarlos. Los índices sin uso observado se conservan: las estadísticas actuales no justifican eliminarlos.
- No se ha hecho una prueba completa de los formularios privados con una sesión real de usuario ni una prueba de carga contra producción. Las rutas privadas se revisan en código y con pruebas aisladas; las operaciones sobre agentes se mantienen sin cambios.
- La inspección visual previa de Bonos incluyó vista de 390 px. Esta revisión no rediseña interfaces ni afirma haber recorrido todas las pantallas privadas en móvil.
