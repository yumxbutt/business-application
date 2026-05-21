const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const toError = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (payload?.errors?.length) {
    return new Error(payload.errors[0].msg || 'Validation error');
  }

  return new Error(payload?.message || payload?.error || 'Request failed');
};

export const httpClient = {
  async get(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
    });

    if (!response.ok) throw await toError(response);
    return response.json();
  },

  async post(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) throw await toError(response);
    return response.json();
  },

  async put(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) throw await toError(response);
    return response.json();
  },

  async patch(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) throw await toError(response);
    return response.json();
  },

  async delete(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) throw await toError(response);
    return response.json();
  },
};
