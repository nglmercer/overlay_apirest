// tasks.ts
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import StorageManager from '../modules/StorageManager.ts';

const taskStorage = new StorageManager('tasks.json', './data', true);
const taskTypes = ['overlay', 'minecraft', 'keypress', 'timer'];

const tasks = new Hono();

/* ---------- Middlewares ---------- */
const validateTaskType = validator('param', (value, c) => {
  const type = value['type'];
  if (!taskTypes.includes(type)) {
    return c.json({ error: 'Invalid task type' }, 400);
  }
  return type;
});

const validateTaskId = validator('param', (value, c) => {
  const taskId = value['taskId'];
  if (!taskId) {
    return c.json({ error: 'Task ID is required' }, 400);
  }
  return taskId;
});

/* ---------- Rutas ---------- */

// Guardar nueva tarea
tasks.post(
  '/save/:type',
  validateTaskType,
  validator('json', (body, c) => {
    if (!body || Object.keys(body).length === 0) {
      return c.json({ error: 'Task data cannot be empty' }, 400);
    }
    return body;
  }),
  (c) => {
    const type = c.req.param('type');
    const taskData = c.req.valid('json');
    const newTask = taskStorage.addTask(type, taskData);
    return c.json({ message: 'Task added successfully', task: newTask }, 201);
  }
);

// Obtener todas las tareas de un tipo
tasks.get('/get/:type', validateTaskType, (c) => {
  const type = c.req.param('type');
  const tasks = taskStorage.getTasksByType(type);
  return c.json(tasks);
});

// Obtener una tarea específica por ID
tasks.get('/get/:type/:taskId', validateTaskType, validateTaskId, (c) => {
  const type = c.req.param('type');
  const taskId = c.req.param('taskId');
  const task = taskStorage.getTaskById(type, taskId);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  return c.json(task);
});

// Eliminar una tarea
tasks.delete('/remove/:type/:taskId', validateTaskType, validateTaskId, (c) => {
  const type = c.req.param('type');
  const taskId = c.req.param('taskId');
  const removed = taskStorage.removeTask(type, taskId);
  if (!removed) return c.json({ error: 'Task not found or already removed' }, 404);
  return c.json({ message: 'Task removed successfully' });
});

// Marcar como completada
tasks.put('/complete/:type/:taskId', validateTaskType, validateTaskId, (c) => {
  const type = c.req.param('type');
  const taskId = c.req.param('taskId');
  const updated = taskStorage.updateTaskCompletion(type, taskId, true);
  if (!updated) return c.json({ error: 'Task not found' }, 404);
  return c.json({ message: 'Task marked as complete', task: updated });
});

// Marcar como incompleta
tasks.put('/uncomplete/:type/:taskId', validateTaskType, validateTaskId, (c) => {
  const type = c.req.param('type');
  const taskId = c.req.param('taskId');
  const updated = taskStorage.updateTaskCompletion(type, taskId, false);
  if (!updated) return c.json({ error: 'Task not found' }, 404);
  return c.json({ message: 'Task marked as incomplete', task: updated });
});

// Actualizar datos de una tarea
tasks.put(
  '/update/:type/:taskId',
  validateTaskType,
  validateTaskId,
  validator('json', (body, c) => {
    if (!body || Object.keys(body).length === 0) {
      return c.json({ error: 'Update data cannot be empty' }, 400);
    }
    // Filtrar campos prohibidos
    delete body.id;
    delete body.completed;
    delete body.createdAt;
    delete body.updatedAt;
    return body;
  }),
  (c) => {
    const type = c.req.param('type');
    const taskId = c.req.param('taskId');
    const updates = c.req.valid('json');
    const updated = taskStorage.updateTaskData(type, taskId, updates);
    if (!updated) return c.json({ error: 'Task not found' }, 404);
    return c.json({ message: 'Task data updated successfully', task: updated });
  }
);

export default tasks;