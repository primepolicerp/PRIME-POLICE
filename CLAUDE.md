# PRIME POLICE — instrucciones para Claude

## Proyecto y arquitectura

- Repositorio: `primepolicerp/PRIME-POLICE`, rama publicada: `main`.
- Producción: https://primepolice.link/.
- Frontend: JavaScript sin framework; `index.html`, `app.js` y módulos `*-ui.js`. Mantener sus controles y permisos existentes.
- `scripts/build-site.mjs` genera únicamente archivos públicos en `dist/`, con recursos compactados, hashes, SRI y CSP. No publicar la carpeta raíz ni funciones, migraciones o documentos internos como archivos de la web.
- GitHub Pages: `.github/workflows/pages.yml`. El despliegue utiliza nombres de artefacto únicos por ejecución/intento.
- Supabase: proyecto `ngkmylqsdeevdtrjrgfn`. Funciones `prime-police-panel` (API y permisos), `prime-police-discord` (RH Police e interacciones) y `prime-police-notifications` (avisos). Sus despliegues son independientes de Pages.
- SQL versionado en `supabase/migrations/`. No borrar ni reparar el historial de migraciones para ocultar diferencias; recuperar cualquier migración que falte.

## Preparación y comprobaciones

Usar Node.js 22 o posterior y las dependencias fijadas en package-lock.json:

```sh
npm ci --ignore-scripts
node --check app.js
node --check evidence-ui.js
node scripts/check-session-persistence.mjs
node --experimental-strip-types scripts/check-evidence-form.mjs
node --experimental-strip-types scripts/check-evidence-records.mjs
node --experimental-strip-types scripts/check-evidence-modal-response.mjs
npm run build
node scripts/check-public-build.mjs
```

Revisar `.github/workflows/pages.yml` para las comprobaciones adicionales del módulo modificado y el comando de TypeScript. Las pruebas no necesitan tokens reales. No crear evidencias, mensajes, sanciones o bajas de producción para probar interfaces.

## Evidencias: estado actual

- Registro desde Discord DESACTIVADO a petición del propietario. No republicar el panel ni reactivar sus comandos o interacciones sin una nueva petición. Conservar la tabla, los registros, las fotografías y mensajes históricos y el apartado Evidencias de la web. El código de formularios archivado no está conectado al bot. Las notas de funcionamiento siguientes describen el flujo anterior.

- Discord → `public.police_evidence_records` → endpoint autenticado `evidence-records` → `evidence-ui.js`.
- Las fotografías permanecen en Discord. No copiar imágenes a Storage, al repositorio o a los datos del panel. La API de lectura no devuelve photo_url.
- Operativo, policías participantes (1–25), locker, objetos, H-50 y fotografía son obligatorios. Los participantes se añaden primero con un buscador por nombre, usuario o placa: hasta tres coincidencias se muestran como botones; al añadir desaparecen los resultados y queda la lista con «Añadir otro», «Continuar» y «Corregir lista». El equipo se conserva entre búsquedas mediante enlaces de nombres/IDs en el mensaje privado firmado de Discord, sin un segundo desplegable permanente; «Ver plantilla» ofrece la lista paginada como alternativa. Tanto los resultados como la lista se filtran por ficha activa y rol Policía consultado en Discord (no usar User Select, que muestra a todo el servidor). El equipo se conserva al cambiar de página dentro del mensaje privado firmado de Discord, sin borradores en base de datos. La lista y el equipo se revalidan al navegar; al continuar, el modal ofrece únicamente el equipo elegido. Al guardar se revalidan contra ficha activa y roles actuales; no se aceptan bots, expulsados ni vetados. Se guardan sus IDs, nombres, placas y usuarios como metadatos en `participants`; `operation` guarda el operativo. Los contadores siguen atribuidos al autor que sube la evidencia. Los registros anteriores conservan su historial y muestran «No registrado» para los datos nuevos.
- El formulario conserva el H-50 elegido en el custom_id firmado de la interacción para dejar espacio a los cinco campos de Discord. El H-50 se vuelve a validar antes de guardar.
- Locker, objetos, H-50 y fotografía son obligatorios. La fotografía puede adjuntarse o recuperarse de una captura reciente (máximo 10 minutos) enviada por el autor al canal de evidencias mencionando al bot. Se puede pegar con Ctrl+V o compartir a Discord desde móvil, sin guardar primero un archivo en el PC.
- El H-50 se elige de `police_personnel` activo. Validar de nuevo su ficha y rol Policía al guardar; bloquear bots, expulsados y vetados.
- El botón «Buscar en plantilla» ofrece grupos por iniciales A–F, G–L, M–R y S–Z/Otros. `police_evidence_h50_initials` consulta la plantilla actual en cada petición; no mantener listas manuales. Paginación si un grupo supera las 25 opciones permitidas por Discord.
- Guardar ID y usuario del H-50; el mensaje de Discord menciona únicamente al H-50 seleccionado mediante allowed_mentions explícito.
- El historial de cada agente se abre en una ventana propia. Los enlaces principales intentan abrir la aplicación de Discord y conservan «Ver en web» como alternativa.
- Los campos de texto de los formularios de Discord no tienen autocompletado en tiempo real. No prometer esa función; el usuario eligió mantener la búsqueda por nombre o placa al enviar el formulario.
- Canal del panel/bot y capturas pegadas: `1539970136050499672`. Destino de las evidencias registradas: `1539970136050499671`. No publicar el panel en el destino. Los enlaces de cada registro usan su canal guardado, sin reescribir históricos automáticamente. Servidor: `1539970134469378068`.

## Horas H-50

- Canal de control: `1539970136302288948`. Botones `prime_h50_start` y `prime_h50_end`; respuestas privadas.
- Tabla independiente `police_h50_shifts`, RLS activa y acceso exclusivo por servicio. Máximo dos personas con H-50 abierto al mismo tiempo, con comprobación serializada en base de datos. Un turno abierto por policía; RPC atómica e idempotente `police_h50_event`. No sumar ni copiar estas horas a `police_duty_shifts`.
- Web: apartado «Horas H-50», `h50-ui.js`, endpoint privado `h50-records`; filtros en hora Europa/París, historial, paginación y agregados completos por policía. Cierre `h50-close` solo para Directiva/UCOP autorizado, con control de concurrencia y auditoría atómica en `adjustments`.
- El registro de evidencias de Discord continúa desactivado.

## Reglas del proyecto

- Conservar los registros e historiales. No borrar datos de producción para resolver errores.
- Aplicar permisos en el servidor, no solo ocultar botones. Mantener RLS y acceso privado por servicio; no conceder lecturas públicas a tablas administrativas.
- Personal activo lleva Policía, con su rama UCOP/CIC y Directiva cuando corresponda. Preseleccionados y traslados son etapas independientes; no tratarlos como miembros de la plantilla.
- Los avisos de posible IA son orientativos: nunca aceptar, rechazar ni sancionar automáticamente por un detector.
- La sesión se guarda de forma persistente en el navegador; cerrar sesión borra el almacenamiento y revoca la sesión del servidor. No anular caducidad, revocaciones ni validaciones de roles.
- No incluir claves o tokens en el código, en chats ni en commits. No copiar sesiones del navegador o del ordenador original. Configurar credenciales propias mediante los mecanismos privados del entorno cuando sean necesarias.
- Antes de editar, revisar git status y conservar cambios ajenos. Trabajar en una rama para cambios nuevos y abrir una revisión cuando corresponda.
- Publicar solo si la petición lo incluye. Después, comprobar GitHub Actions y los archivos servidos por el dominio; desplegar las funciones afectadas si hubo cambios del backend. Informar qué se verificó y qué sigue pendiente.
- Responder en español y explicar de forma breve qué cambió. No afirmar que algo está publicado o corregido en producción sin comprobarlo.

## Vista previa conservada

`docs/previews/prime-police-h50-formatos.html` conserva las propuestas interactivas del selector H-50 («Por iniciales» y «Lista única»). Es un fragmento de vista previa para revisar diseños; no forma parte de los archivos públicos compilados. El selector real del bot está en `supabase/functions/prime-police-discord/evidence.ts` y usa la opción por iniciales elegida por el usuario.

## Bitácoras: diseño propio sin H-50

- `shifts.js` y `shift-workspace.css` contienen un espacio propio de PRIME POLICE: indicadores del período completo, historial ordenable, calendario individual por mes y detalle diario. Mantener los cuatro apartados y los controles administrativos existentes.
- `shift-overview` es una lectura autenticada con los mismos permisos de gestión que `shifts`; usa `police_shift_overview`, definida en la migración `20261107142456_shift_workspace_overview.sql`. No publica lecturas a anon/authenticated.
- Las horas del calendario se reparten por día en Europe/Paris, incluidos cambios de horario y turnos que cruzan medianoche. Los totales no se calculan a partir de las 50 filas de una página. «Turnos breves» significa completados de menos de 30 minutos y es solo un indicador.
- La columna «Rango actual» usa la ficha actual disponible; no inventar un rango histórico. No existe aún registro de horas/aprobación H-50: no mostrar aprobaciones o tiempos simulados en producción. Cierre forzado y eliminación mantienen sus permisos, peticiones de Directiva y auditoría.
- `docs/previews/prime-police-bitacoras.html` es una vista previa interactiva con datos ficticios, sin acceso a producción. Se conserva fuera de los archivos públicos. Al publicar cambios, coordinar la migración y el despliegue de prime-police-panel con el frontend. El propietario ha elegido mantener esta versión sin H-50.
