import { safeParse } from "./safeparse";
type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

type RequestBody = Record<string, any> | FormData;
async function handleResponse<T>(res: Response): Promise<T | any> { // <-- CAMBIO 1: El retorno ahora es Promise<T | undefined>
  if (res.status === 204) {
    // Ahora es seguro devolver undefined porque está en el tipo de retorno.
    return Promise.resolve(undefined);
  }

  const text = await res.text();

  if (!text) {
    // También es seguro devolver undefined aquí.
    return Promise.resolve(undefined);
  }

  try {
    // Tu safeParse es ideal aquí. El resultado se casteará al tipo T.
    return safeParse(text) as T;
  } catch (error) {
    console.error("Falló el análisis de la respuesta:", error);
    return Promise.reject(new Error("La respuesta no pudo ser analizada."));
  }
}
const http = {
  get: <T>(url: string, options: FetchOptions = {}): Promise<T> => {
    return fetch(url, {
      method: 'GET',
      ...options
    }).then(handleResponse); // Usamos el manejador de respuesta
  },

  post: <T>(url: string, body: RequestBody = {}, options: FetchOptions = {}): Promise<T> => {
    if (body instanceof FormData) {
      const filteredHeaders = Object.fromEntries(
        Object.entries(options.headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type')
      );

      const filteredOptions = { ...options, headers: filteredHeaders };

      return fetch(url, {
        method: 'POST',
        body: body,
        ...filteredOptions
      }).then(handleResponse); // Usamos el manejador de respuesta
    } else {
      const filteredOptions = { ...options };
      
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        body: JSON.stringify(body), // Usamos JSON.stringify para el cuerpo
        ...filteredOptions
      }).then(handleResponse); // Usamos el manejador de respuesta
    }
  },

  put: <T>(url: string, body: RequestBody = {}, options: FetchOptions = {}): Promise<T> => {
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: JSON.stringify(body), // Usamos JSON.stringify para el cuerpo
      ...options
    }).then(handleResponse); // Usamos el manejador de respuesta
  },

  patch: <T>(url: string, body: RequestBody = {}, options: FetchOptions = {}): Promise<T> => {
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
       ...(options.headers || {})
      },
      body: JSON.stringify(body), // Usamos JSON.stringify para el cuerpo
     ...options
    }).then(handleResponse); // Usamos el manejador de respuesta
  },

  delete: <T>(url: string, options: FetchOptions = {}): Promise<T> => {
    return fetch(url, {
      method: 'DELETE',
      ...options
    }).then(handleResponse); // Usamos el manejador de respuesta
  }
};
function getParams(paramNames: string[] = []): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  let paramsObject = Object.fromEntries(urlParams.entries());

  if (Object.keys(paramsObject).length === 0) {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length >= paramNames.length) {
      paramsObject = {};
      for (let i = 0; i < paramNames.length; i++) {
        paramsObject[paramNames[i]] = parts[i];
      }
    }
  }

  return paramsObject;
}
export {
    http,
    getParams,
    type FetchOptions,
    type RequestBody
}