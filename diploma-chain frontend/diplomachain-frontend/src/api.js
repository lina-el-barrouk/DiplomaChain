import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token automatically
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          err.config.headers.Authorization = `Bearer ${data.access_token}`
          return api(err.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (token) => api.post('/auth/refresh', { refresh_token: token }),
  logout: () => api.post('/auth/logout'),
}

// Institutions
export const institutionApi = {
  create: (data) => api.post('/institutions/', data),
  getMe: () => api.get('/institutions/me'),
  updateMe: (data) => api.put('/institutions/me', data),
  list: (params) => api.get('/institutions/', { params }),
  approve: (id) => api.post(`/institutions/${id}/approve`),
  reject: (id) => api.post(`/institutions/${id}/reject`),
}

// Students
export const studentApi = {
  createMe: (data) => api.post('/students/me', data),
  getMe: () => api.get('/students/me'),
  getPending: () => api.get('/students/pending'),
  approve: (id) => api.post(`/students/${id}/approve`),
  reject: (id, reason) => api.post(`/students/${id}/reject`, null, { params: { reason } }),
}

// Diplomas
export const diplomaApi = {
  create: (data) => api.post('/diplomas/', data),
  list: (params) => api.get('/diplomas/', { params }),
  get: (id) => api.get(`/diplomas/${id}`),
  issue: (id) => api.post(`/diplomas/${id}/issue`),
  anchor: (id) => api.post(`/diplomas/${id}/anchor`),
  revoke: (id, reason) => api.post(`/diplomas/${id}/revoke`, { reason }),
  verify: (code) => api.get(`/diplomas/verify/${code}`),
  verifyHistory: (code) => api.get(`/diplomas/verify/${code}/history`),
}

// QR Code
export const qrApi = {
  getBase64: (id) => api.get(`/qrcodes/${id}/qr/b64`),
}

// PDF
export const pdfApi = {
  generate: (id) => api.get(`/pdf/diplomas/${id}/generate`, { responseType: 'blob' }),
  uploadTemplate: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/pdf/templates/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  getTemplate: () => api.get('/pdf/templates/me'),
  getBulkTemplate: () => api.get('/pdf/diplomas/bulk-template', { responseType: 'blob' }),
  bulkGenerate: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/pdf/diplomas/bulk-generate', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
    })
  },
}

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  listUsers: (params) => api.get('/admin/users', { params }),
  toggleUser: (id, active) => api.put(`/admin/users/${id}/activate`, null, { params: { active } }),
  unlockUser: (id) => api.put(`/admin/users/${id}/unlock`),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  cleanupTokens: () => api.delete('/admin/tokens/cleanup'),
}

export default api
