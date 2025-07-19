// tasksApi.ts
import BaseApi from './commons/fetchapi'; // Ajusta la ruta según tu proyecto
import apiConfig from './config/apiConfig'; // tu configuración actual

type TaskType = 'overlay' | 'minecraft' | 'keypress' | 'timer';

interface Task {
  id: string;
  type: TaskType;
  data: any;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

class TasksApi extends BaseApi {
  constructor() {
    super(apiConfig); // hereda host, token, headers, etc.
  }

  // ------------- Helpers -------------
  private endpoint(type: TaskType, taskId?: string) {
    return taskId ? `/tasks/get/${type}/${taskId}` : `/tasks/get/${type}`;
  }

  // ------------- CRUD -------------
  async getAll(type: TaskType): Promise<Task[]> {
    const endpoint = `/tasks/get/${type}`
    return this.getWithProxy(endpoint, {
      enabled: true,
      url: '',
    })
/*     return this.request(
      this.http.get<Task[]>(`${this.host}/tasks/get/${type}`, {
        headers: this._authHeaders()
      })
    ); */
  }

  async getById(type: TaskType, taskId: string): Promise<Task> {
    return this.request(
      this.http.get<Task>(`${this.host}/tasks/get/${type}/${taskId}`, {
        headers: this._authHeaders()
      })
    );
  }

  async save(type: TaskType, data: any): Promise<Task> {
    return this.request(
      this.http.post<Task>(`${this.host}/tasks/save/${type}`, data, {
        headers: this._authHeaders()
      })
    );
  }

  async update(type: TaskType, taskId: string, data: Partial<Task>): Promise<Task> {
    return this.request(
      this.http.put<Task>(`${this.host}/tasks/update/${type}/${taskId}`, data, {
        headers: this._authHeaders()
      })
    );
  }

  async remove(type: TaskType, taskId: string): Promise<void> {
    return this.request(
      this.http.delete<void>(`${this.host}/tasks/remove/${type}/${taskId}`, {
        headers: this._authHeaders()
      })
    );
  }

  async markComplete(type: TaskType, taskId: string): Promise<Task> {
    return this.request(
      this.http.put<Task>(`${this.host}/tasks/complete/${type}/${taskId}`, {}, {
        headers: this._authHeaders()
      })
    );
  }

  async markIncomplete(type: TaskType, taskId: string): Promise<Task> {
    return this.request(
      this.http.put<Task>(`${this.host}/tasks/uncomplete/${type}/${taskId}`, {}, {
        headers: this._authHeaders()
      })
    );
  }
}
const taskApi = new TasksApi()
export default TasksApi;
export { taskApi };