class LocalStorageManager<T extends object> {
  private readonly key: string;

  constructor(key: string) {
    if (!key) {
      throw new Error("La clave no puede estar vacía.");
    }
    this.key = key;
  }

  /**
   * Guarda un objeto en localStorage.  Overload para poder agregar o crear
   * @param obj El objeto a guardar, la Key del objeto a agregar o actualizar, o null si no existe.
   * @param data El objeto a agregar o actualizar
   */
  set(obj: T): void;
  set<K extends keyof T>(key: K, data: T[K]): void; // Sobrecarga
  set<K extends keyof T>(objOrKey: T | K, data?: T[K]): void {
    if (typeof objOrKey === "string" || typeof objOrKey === "number" || typeof objOrKey === "symbol") {
      if (data === undefined) {
        throw new Error("Data is required when the first argument is a key.");
      }
      this.replaceItem(objOrKey, data);
      return;
    }

    try {
      const serialized = JSON.stringify(objOrKey);
      localStorage.setItem(this.key, serialized);
    } catch (error) {
      console.error(`Error al guardar objeto en localStorage (clave: ${this.key}):`, error);
      throw error;
    }
  }

  getAll(): T | null {
    try {
      const serialized = localStorage.getItem(this.key);
      if (serialized === null) {
        return null;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`Error al obtener objeto de localStorage (clave: ${this.key}):`, error);
      return null;
    }
  }

  remove(): void {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error(`Error al eliminar objeto de localStorage (clave: ${this.key}):`, error);
    }
  }

  has(): boolean {
    return localStorage.getItem(this.key) !== null;
  }

  /**
   * Agrega o actualiza un objeto dentro del objeto principal, usando una clave individual.
   * @param key La clave para identificar el objeto dentro del objeto principal.
   * @param item El objeto a agregar o actualizar.
   */
  add<K extends keyof T>(key: K, item: T[K]): void {
    try {
      let main = this.getAll();
      if (!main) {
        main = {} as T; // Inicializa el objeto principal si no existe.
      }
      main[key] = item; // Agrega o actualiza el objeto.
      this.set(main); // Guarda el objeto principal actualizado en localStorage.
    } catch (error) {
      console.error(`Error al agregar/actualizar objeto (clave: ${this.key}, key: ${String(key)}):`, error);
      throw error;
    }
  }

  /**
   * Reemplaza un objeto dentro del objeto principal, usando una clave individual.
   * @param key La clave para identificar el objeto dentro del objeto principal.
   * @param item El objeto a reemplazar.
   */
  replaceItem<K extends keyof T>(key: K, item: T[K]): void {
      try {
          let main = this.getAll();
          if (!main) {
              console.warn(`No existing object found in localStorage with key ${this.key}. Replacing will create a new object.`);
              main = {} as T;
          }
          main[key] = item;
          this.set(main);
      } catch (error) {
          console.error(`Error replacing object (key: ${this.key}, key: ${String(key)}):`, error);
          throw error;
      }
  }

  /**
   * Obtiene un objeto específico del objeto principal.
   * @param key La clave del objeto a obtener.
   * @returns El objeto, o null si no existe.
   */
  getItem<K extends keyof T>(key: K): T[K] | null {
    try {
      const main = this.getAll();
      if (!main || !(key in main)) {
        return null; // Retorna null si el objeto principal o el objeto no existen.
      }
      return main[key];
    } catch (error) {
      console.error(`Error al obtener objeto (clave: ${this.key}, key: ${String(key)}):`, error);
      return null;
    }
  }

  /**
   * Elimina un objeto específico del objeto principal.
   * @param key La clave del objeto a eliminar.
   */
  removeItem<K extends keyof T>(key: K): void {
    try {
      let main = this.getAll();
      if (main && key in main) {
        delete main[key]; // Elimina la propiedad (objeto).
        this.set(main); // Guarda el objeto principal actualizado.
      }
    } catch (error) {
      console.error(`Error al eliminar objeto (clave: ${this.key}, key: ${String(key)}):`, error);
    }
  }
  get<K extends keyof T>(key: K): T[K] | null {
    return this.getItem(key);
  }
  /**
   * Verifica si un objeto existe dentro del objeto principal.
   * @param key La clave del objeto a verificar.
   * @returns True si el objeto existe, false en caso contrario.
   */
  hasItem<K extends keyof T>(key: K): boolean {
    const main = this.getAll();
    return main !== null && Object.prototype.hasOwnProperty.call(main, key);
  }

  /**
   * Agrega un elemento a un array en el localStorage, limitando el tamaño del array.
   * Si la propiedad no es un array, la convierte en un array antes de agregar el elemento.
   * @param key La clave del array en el objeto principal.
   * @param item El elemento a agregar al array.
   * @param limit El tamaño máximo del array. Si es null, no hay límite.
   */
  pushToArray<K extends keyof T>(key: K, item: T[K] extends any[] ? T[K][number] : any, limit: number | null = null): void {
    try {
      let main = this.getAll();
      if (!main) {
        main = {} as T;
      }

      let array = main[key];

      if (!Array.isArray(array)) {
        array = [] as any; // Inicializa como un array si no lo es.
      }

      (array as any[]).push(item);

      if (limit !== null && (array as any[]).length > limit) {
        (array as any[]).shift(); // Elimina el primer elemento si excede el límite.
      }

      main[key] = array as any; // Asigna el array actualizado a la propiedad.
      this.set(main); // Guarda el objeto principal actualizado.
    } catch (error) {
      console.error(`Error al agregar al array (clave: ${this.key}, key: ${String(key)}):`, error);
    }
  }
}

export default LocalStorageManager;
export {
  LocalStorageManager
}
  // Ejemplo de uso:
/*   const itemStorage = new LocalStorageManager("items");
  
  // Agregar objetos:
  itemStorage.set("product1", { id: 1, name: "Laptop", price: 1200 });
  itemStorage.set("user1", { id: 101, name: "John Doe", email: "john@example.com" });
  
  const product1 = itemStorage.getItem("product1");
  console.log("Product 1:", product1);
  const user1 = itemStorage.getItem("user1");
  console.log("User 1:", user1);
    const product1Modified = {id: 1, name: "Laptop Pro", price: 1500};
  itemStorage.add("product1", product1Modified);
  const product1AfterModification = itemStorage.getItem("product1");
  console.log("Product 1 (modified):", product1AfterModification);
  
  console.log("Product 1 exists:", itemStorage.hasItem("product1")); // true
  console.log("Product 2 exists:", itemStorage.hasItem("product2")); // false
  
  // Eliminar un objeto:
  //itemStorage.removeItem("user1");
  
  const user1AfterDeletion = itemStorage.getItem("user1");
  console.log("User 1 (after deletion):", user1AfterDeletion); // null
  const allItems = itemStorage.getAll();
  console.log("All items:", allItems); */
  