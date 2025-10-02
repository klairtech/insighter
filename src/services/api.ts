import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Check if token is already set in headers (for Supabase tokens)
    if (!config.headers.Authorization) {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens but don't redirect automatically
      // Let the calling component handle the redirect
      localStorage.removeItem('authToken')
      sessionStorage.removeItem('authToken')
      // Don't redirect automatically to avoid infinite loops
      // window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface User {
  id: string
  email: string
  name?: string
  avatar_path?: string
  preferred_currency?: string
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  description?: string
  industry?: string
  size?: string
  website?: string
  location?: string
  created_at: string
  updated_at: string
  workspaces: Workspace[]
}

export interface Workspace {
  id: string
  name: string
  description?: string
  organization_id: string
  created_at: string
  updated_at: string
}

export interface DatabaseConnection {
  id: string
  name: string
  type: string
  host: string
  port: number
  database: string
  username: string
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface ExternalConnection {
  id: string
  name: string
  type: string
  url: string
  api_key?: string
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface FileUpload {
  id: string
  filename: string
  original_name: string
  file_type: string
  file_size: number
  workspace_id: string
  created_at: string
  updated_at: string
}

class ApiService {
  // Set auth token for API requests
  setAuthToken(token: string) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  // Clear auth token
  clearAuthToken() {
    delete api.defaults.headers.common['Authorization']
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  }

  async register(userData: { email: string; password: string; name?: string }) {
    const response = await api.post('/auth/register', userData)
    return response.data
  }

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('authToken')
      sessionStorage.removeItem('authToken')
    }
  }

  // User endpoints
  async getUserProfile(): Promise<User> {
    const response = await api.get('/user/profile')
    return response.data
  }

  async updateUserProfile(userData: Partial<User>): Promise<User> {
    const response = await api.put('/user/profile', userData)
    return response.data
  }

  // Organization endpoints
  async getOrganizations(): Promise<Organization[]> {
    const response = await api.get('/organizations')
    return response.data
  }

  async getOrganization(id: string): Promise<Organization> {
    const response = await api.get(`/organizations/${id}`)
    return response.data
  }

  async createOrganization(orgData: Partial<Organization>): Promise<Organization> {
    const response = await api.post('/organizations', orgData)
    return response.data
  }

  async updateOrganization(id: string, orgData: Partial<Organization>): Promise<Organization> {
    const response = await api.put(`/organizations/${id}`, orgData)
    return response.data
  }

  async deleteOrganization(id: string): Promise<void> {
    await api.delete(`/organizations/${id}`)
  }

  // Workspace endpoints
  async getWorkspace(id: string): Promise<Workspace> {
    const response = await api.get(`/workspaces/${id}`)
    return response.data
  }

  async createWorkspace(workspaceData: Partial<Workspace>): Promise<Workspace> {
    const response = await api.post('/workspaces', workspaceData)
    return response.data
  }

  async updateWorkspace(id: string, workspaceData: Partial<Workspace>): Promise<Workspace> {
    const response = await api.put(`/workspaces/${id}`, workspaceData)
    return response.data
  }

  async deleteWorkspace(id: string): Promise<void> {
    await api.delete(`/workspaces/${id}`)
  }

  // Database connection endpoints
  async getDatabaseConnections(workspaceId: string): Promise<DatabaseConnection[]> {
    const response = await api.get(`/workspaces/${workspaceId}/database-connections`)
    return response.data
  }

  async createDatabaseConnection(workspaceId: string, connectionData: Partial<DatabaseConnection>): Promise<DatabaseConnection> {
    const response = await api.post(`/workspaces/${workspaceId}/database-connections`, connectionData)
    return response.data
  }

  async testDatabaseConnection(workspaceId: string, connectionData: Partial<DatabaseConnection>): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/workspaces/${workspaceId}/database-connections/test`, connectionData)
    return response.data
  }

  async deleteDatabaseConnection(workspaceId: string, connectionId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/database-connections/${connectionId}`)
  }

  // External connection endpoints
  async getExternalConnections(workspaceId: string): Promise<ExternalConnection[]> {
    const response = await api.get(`/workspaces/${workspaceId}/external-connections`)
    return response.data
  }

  async createExternalConnection(workspaceId: string, connectionData: Partial<ExternalConnection>): Promise<ExternalConnection> {
    const response = await api.post(`/workspaces/${workspaceId}/external-connections`, connectionData)
    return response.data
  }

  async deleteExternalConnection(workspaceId: string, connectionId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/external-connections/${connectionId}`)
  }

  // File upload endpoints
  async uploadFile(workspaceId: string, file: File): Promise<FileUpload> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post(`/workspaces/${workspaceId}/files/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async getFiles(workspaceId: string): Promise<FileUpload[]> {
    const response = await api.get(`/workspaces/${workspaceId}/files`)
    return response.data
  }

  async deleteFile(workspaceId: string, fileId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/files/${fileId}`)
  }

  // Agent endpoints
  async askAgent(workspaceId: string, message: string, context?: unknown): Promise<{ response: string; sources?: unknown[] }> {
    const response = await api.post(`/workspaces/${workspaceId}/query-data`, {
      message,
      context,
    })
    return response.data
  }

  async getAgentHistory(workspaceId: string): Promise<unknown[]> {
    const response = await api.get(`/workspaces/${workspaceId}/agent-history`)
    return response.data
  }

  // Admin endpoints
  async adminLogin(email: string, password: string) {
    const response = await api.post('/admin/login', { email, password })
    return response.data
  }

  async getAdminDashboard(): Promise<unknown> {
    const response = await api.get('/admin/dashboard')
    return response.data
  }

  // Utility methods
  getProfilePictureUrl(avatarPath: string): string {
    if (!avatarPath) return ''
    return `${API_BASE_URL}/uploads/profile_pictures/${avatarPath}`
  }

  getFileUrl(workspaceId: string, filename: string): string {
    return `${API_BASE_URL}/uploads/workspace_${workspaceId}/${filename}`
  }
}

const apiService = new ApiService()
export default apiService
