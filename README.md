# Novedades Equipamiento

Pizarra web para gestionar tareas generadas desde novedades de equipamiento.

## Estructura esperada en Google Sheets

Crear una hoja llamada `PIZARRA` con estos encabezados exactos:

```text
ID	FECHA_ALTA	ORIGEN	UBICACION	ELEMENTO	TAREA	PRIORIDAD	TIEMPO_ESTIMADO_DIAS	FECHA_VENCIMIENTO	ESTADO	ASIGNADO_A	FECHA_ASIGNACION	FECHA_FINALIZACION	OBSERVACIONES	FOTOS	CREADO_POR	ULTIMA_ACTUALIZACION	ULTIMO_ASIGNADO
```

## Desplegables recomendados

### ESTADO
- Disponible
- Asignada
- Finalizada

### PRIORIDAD
- Baja
- Media
- Alta

## Instalación de Apps Script

1. Abrir el Google Sheet.
2. Ir a `Extensiones > Apps Script`.
3. Pegar el contenido de `Code.gs`.
4. Cambiar estas constantes:

```js
const SPREADSHEET_ID = 'PEGAR_ID_DE_TU_GOOGLE_SHEET';
const ADMIN_PASS = 'CAMBIAR_CLAVE_ADMIN';
```

El `SPREADSHEET_ID` está en la URL del Sheet:

```text
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
```

5. Implementar como aplicación web:
   - Ejecutar como: `Yo`
   - Quién tiene acceso: `Cualquier persona con el enlace`
6. Copiar la URL terminada en `/exec`.
7. Abrir `index.html` publicado en GitHub Pages y pegar la URL del Apps Script en la configuración inicial.

## Funciones incluidas

- Ver tareas disponibles, asignadas y finalizadas recientes.
- Tomar/autoasignar tarea.
- Finalizar tarea.
- Modo administrador para editar prioridad, días estimados, vencimiento y observaciones.
- Liberación automática de tareas vencidas al actualizar la pizarra.
- Ocultamiento visual de tareas finalizadas con más de 7 días.
- Creación automática de tareas desde novedades mediante endpoint `createFromNovedad`.

## Endpoint para crear tarea automática desde otro repo

Desde el repo de checklist/control, cuando se envía una novedad, se puede llamar a:

```js
const url = APPS_SCRIPT_URL
  + '?action=createFromNovedad'
  + '&ubicacion=' + encodeURIComponent(ubicacion)
  + '&elemento=' + encodeURIComponent(elemento)
  + '&tarea=' + encodeURIComponent(novedad)
  + '&usuario=' + encodeURIComponent(usuario)
  + '&origen=' + encodeURIComponent('Novedad equipamiento')
  + '&prioridad=' + encodeURIComponent('Media');

fetch(url)
  .then(r => r.json())
  .then(data => console.log(data));
```

La tarea se crea automáticamente como `Disponible`.

## Archivos

- `index.html`: estructura de la app.
- `styles.css`: estilos visuales.
- `app.js`: lógica de frontend.
- `Code.gs`: backend para Google Apps Script.
