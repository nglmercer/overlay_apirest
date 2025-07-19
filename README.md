# 📘 API Rest – Documentación Oficial

> Servidor monolítico basado en **Bun + Hono** que expone endpoints para:
> - Gestión de tareas tipadas (`overlay`, `minecraft`, `keypress`, `timer`)
> - Servicio de archivos estáticos (`/media/*`)
> - Generador de códigos QR (`/qr`)
> - Proxy inverso dinámico (vía header `X-Proxy-Target`)
> - Configuración remota del puerto de escucha

---

## 🚀 Puesta en marcha

| Variable / Flag | Uso |
|-----------------|-----|
| `--vitehost=<url>` | *Opcional.* URL del servidor Vite para inyectar con Buntralino. Ej: `--vitehost=http://localhost:5173` |
| `NODE_ENV` | No requerido. El servidor arranca siempre en modo “producción” salvo que se comente el bloque de desarrollo. |

```bash
bun run index.ts --vitehost=http://localhost:5173
```

---

## 🔐 Autenticación

No existe autenticación global.  
Para el **modo proxy**, se puede enviar el header `Proxy-Authorization: Basic …`; el servidor lo re-enviará al destino como `Authorization`.

---

## 📡 Endpoints

### 1️⃣ Tareas (`/tasks`)

Prefijo base: `/tasks`

| Método | Ruta | Descripción | Body / Parámetros | Respuestas |
|--------|------|-------------|-------------------|------------|
| `POST` | `/save/:type` | Crear tarea | `type` ∈ `overlay,minecraft,keypress,timer`<br>Body: objeto tarea | `201` `{message, task}`<br>`400` |
| `GET` | `/get/:type` | Listar tareas del tipo | `type` | `200` `[task, …]` |
| `GET` | `/get/:type/:taskId` | Obtener tarea única | `taskId` | `200` `task`<br>`404` |
| `DELETE` | `/remove/:type/:taskId` | Borrar tarea | `taskId` | `200` `{message}`<br>`404` |
| `PUT` | `/complete/:type/:taskId` | Marcar completa | `taskId` | `200` `{message, task}`<br>`404` |
| `PUT` | `/uncomplete/:type/:taskId` | Marcar incompleta | `taskId` | `200` `{message, task}`<br>`404` |
| `PUT` | `/update/:type/:taskId` | Actualizar datos | `taskId`<br>Body: campos a modificar (excepto `id,completed,createdAt,updatedAt`) | `200` `{message, task}`<br>`404` |

---

### 2️⃣ Media (`/media/*`)

Sirve archivos del sistema de archivos relativo al directorio de trabajo.

| Método | Ruta | Descripción | Ejemplo |
|--------|------|-------------|---------|
| `GET` | `/media/**` | Stream del archivo | `GET /media/imagenes/logo.png` |

- **ETag** y **Cache-Control** de 24 h.
- Tipos MIME soportados: `jpg,jpeg,png,gif,webp,svg,bmp,ico,tiff,avif,apng,mp3,wav,mp4,webm`.
- Códigos: `200, 304, 404, 415`.

---

### 3️⃣ QR (`/qr`)

> El archivo importa `QRrouter`, por lo tanto los endpoints exactos dependen del código en `./routes/qr.ts`.  
> Documentación pendiente – placeholder.

---

### 4️⃣ Configuración (`/config`)

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| `GET` | `/config` | — | `{port, hostname}` |
| `POST` | `/config/port` | `{port: <number 1-65535>}` | `{message, newPort}` |

> Requiere reiniciar el servidor para aplicar el cambio de puerto.

---

### 5️⃣ Proxy inverso dinámico

**Activación**: enviar el header `X-Proxy-Target: <url absoluta>` en cualquier petición al servidor.

| Header adicional | Propósito |
|------------------|-----------|
| `X-Proxy-Timeout` | Tiempo máx. en ms (por defecto `30000`). |
| `Proxy-Authorization` | Credenciales Basic que se re-envían como `Authorization`. |

Ejemplo:

```bash
curl -H "X-Proxy-Target: https://jsonplaceholder.typicode.com/todos/1" \
     -H "Proxy-Authorization: Basic dXNlcjpwYXNz" \
     http://localhost:3001/anything
```

---

## 🧠 Esquema de Tarea

```ts
interface Task {
  id: string;
  type: 'overlay' | 'minecraft' | 'keypress' | 'timer';
  completed: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  [key: string]: any; // resto de campos libres
}
```

---

## 📁 Estructura de archivos (relevante)

```
.
├── index.ts          # Servidor principal
├── routes/
│   ├── tasks.ts      # CRUD de tareas
│   ├── media.ts      # Servicio de archivos
│   └── qr.ts         # Generador QR
├── server/
│   └── config.ts     # Lógica de lock-file y configuración
└── data/
    └── tasks.json    # Persistencia automática (StorageManager)
```

---

## 🔒 Lock-file y alta disponibilidad

- Antes de arrancar se crea `server.lock`.
- Si ya existe y el PID sigue vivo, el proceso se cierra.
- Al terminar (`SIGINT`, `SIGTERM`, cierre de ventana Buntralino) se borra.

---

## 🌐 URLs de acceso tras arrancar

```
🚀 Servidor iniciado exitosamente!
📡 Puerto: 3001
🌐 Local: http://localhost:3001
🌍 Red:   http://192.168.x.x:3001
⚙️  Configuración: /abs/path/server-config.json
📝 PID: 12345
```

---

## 🧪 Errores comunes

| Código | Significado |
|--------|-------------|
| `400` | Parámetro `type` inválido, body vacío o puerto fuera de rango. |
| `404` | Tarea o archivo no encontrado. |
| `415` | Tipo de archivo no soportado en `/media`. |
| `502` | Error de red al usar el proxy. |
| `504` | Timeout del proxy. |

---

## 📜 Licencia

No especificada – uso interno.
