# Archivo de investigación CIC

El apartado Investigación CIC reúne expedientes de bandas, personas, puntos de interés, solicitudes y grilletes. Cada expediente contiene resumen, personas, puntos, vehículos, evidencias, anotaciones e historial de actividad. La guía describe la organización del archivo, sin sustituir la normativa del servidor.

## Acceso

- Acceden los miembros con el rol CIC `1539970134519578772`, salvo quienes tengan un rol cuyo nombre contenga «pasante».
- Directiva, Alta Directiva y Gobierno mantienen acceso, incluso si también tienen un rol de pasante.
- UCOP y Staff no reciben acceso a investigación por sus roles.
- Una cuenta admitida únicamente por CIC solo puede utilizar `me`, `cic-records`, `cic-save` y sus propias sesiones. El filtro global bloquea el resto de la API administrativa.
- Los roles de Discord se verifican en el servidor; las escrituras fuerzan la comprobación del miembro. La lista de roles de pasante tiene una caché de 30 segundos.

## Datos y acciones

Tablas privadas: `police_cic_cases`, `police_cic_entries`, `police_cic_events`. RLS activa, sin acceso para `anon` ni `authenticated`. Los endpoints del panel llaman a RPC de servicio. No hay borrado desde el apartado.

La escritura `police_cic_write` bloquea el expediente y comprueba su versión antes de guardar. Cambios e historial se registran en la misma transacción. El actor se toma de la sesión; el cliente no puede elegirlo. Solo Directiva cierra o reabre expedientes. Los cerrados no admiten nuevas modificaciones hasta reabrirlos.

`police_cic_read` ofrece búsquedas literales, filtros y páginas de 50 expedientes o registros. Las búsquedas incluyen información vinculada. No se cargan todos los expedientes en el navegador.

Las fotografías permanecen en Discord. Para evidencias es obligatorio un enlace a un mensaje del servidor PRIME POLICE; la web conserva la descripción y ese enlace. No se cargan archivos ni imágenes en Supabase. El apartado no importa automáticamente los hilos de Discord ni publica mensajes allí.

## Verificación

`scripts/check-cic.mjs`: acceso por rol, exclusión de pasantes, aislamiento de RR. HH., validación y actor de la sesión.

`scripts/check-cic-sql.mjs`: RLS, paginación, búsqueda de información vinculada, versiones, auditoría y cierre/reapertura exclusivos de Directiva. Las pruebas usan una base aislada y no crean casos en producción.
