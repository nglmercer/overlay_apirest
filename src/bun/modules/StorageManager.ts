import fs from 'fs';
import path from 'path';

const processdirname: string = process.cwd();

interface Task {
  id: string;
  completed: boolean;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any; // permite campos extra
}

class StorageManager {
  private fileName: string;
  private storePath: string;
  private filePath: string;
  private store: Record<string, any>;

  constructor(fileName: string = 'store.json', basePath: string = '.', isRelative: boolean = false) {
    const initBasepath = isRelative ? processdirname : __dirname;
    this.storePath = path.isAbsolute(basePath) ? basePath : path.join(initBasepath, basePath);

    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }

    this.fileName = fileName;
    this.filePath = path.join(this.storePath, this.fileName);

    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, { encoding: 'utf8' });
        this.store = JSON.parse(data);
      } catch (error) {
        this.store = {};
        this._saveStore();
      }
    } else {
      this.store = {};
      this._saveStore();
    }
  }

  private _saveStore(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), { encoding: 'utf8' });
  }

  set(key: string | number, value: any): void {
    const keyStr = String(key);
    const valueStr =
      value === undefined
        ? 'undefined'
        : typeof value === 'string'
        ? value
        : JSON.stringify(value);
    this.store[keyStr] = valueStr;
    this._saveStore();
  }

  get(key: string | number): any {
    const keyStr = String(key);
    return this.store[keyStr];
  }

  JSONget(key: string | number): any {
    const keyStr = String(key);
    const val = this.store[keyStr];
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        console.warn(
          `StorageManager: Value for key "${keyStr}" is not valid JSON. Returning as string.`
        );
        return val;
      }
    }
    return val;
  }

  JSONset(key: string | number, value: any): void {
    this.store[String(key)] = value;
    this._saveStore();
  }

  remove(key: string | number): void {
    const keyStr = String(key);
    if (Object.prototype.hasOwnProperty.call(this.store, keyStr)) {
      delete this.store[keyStr];
      this._saveStore();
    }
  }

  clear(): void {
    this.store = {};
    this._saveStore();
  }

  keys(): string[] {
    return Object.keys(this.store);
  }

  getAll(): Record<string, any> {
    return this.store;
  }

  setAll(store: Record<string, any>): void {
    this.store = store;
    this._saveStore();
  }

  getTasksByType(type: string): Task[] {
    const tasks = this.JSONget(type);
    return Array.isArray(tasks) ? tasks : [];
  }

  addTask(type: string, taskData: Omit<Task, 'id' | 'completed' | 'createdAt'>): Task {
    const tasks = this.getTasksByType(type);
    const newTask: Task = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9),
      ...taskData,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    this.JSONset(type, tasks);
    return newTask;
  }

  getTaskById(type: string, taskId: string): Task | null {
    const tasks = this.getTasksByType(type);
    return tasks.find((task) => task.id === taskId) || null;
  }

  removeTask(type: string, taskId: string): boolean {
    const tasks = this.getTasksByType(type);
    const filtered = tasks.filter((task) => task.id !== taskId);
    if (filtered.length < tasks.length) {
      this.JSONset(type, filtered);
      return true;
    }
    return false;
  }

  updateTaskCompletion(type: string, taskId: string, completedState: boolean = true): Task | null {
    const tasks = this.getTasksByType(type);
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex > -1) {
      tasks[taskIndex].completed = completedState;
      tasks[taskIndex].updatedAt = new Date().toISOString();
      this.JSONset(type, tasks);
      return tasks[taskIndex];
    }
    return null;
  }

  updateTaskData(type: string, taskId: string, updates: Partial<Omit<Task, 'id' | 'completed' | 'createdAt'>>): Task | null {
    const tasks = this.getTasksByType(type);
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex > -1) {
      const { id, completed, createdAt, ...allowedUpdates } = updates;
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        ...allowedUpdates,
        updatedAt: new Date().toISOString(),
      };
      this.JSONset(type, tasks);
      return tasks[taskIndex];
    }
    return null;
  }
}

export default StorageManager;