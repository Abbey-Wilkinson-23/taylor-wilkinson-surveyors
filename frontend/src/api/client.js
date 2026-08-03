import axios from 'axios'

// In dev, Vite proxies /api → localhost:8000
// In production, point VITE_API_URL to your Railway backend URL
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('tws_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tws_token')
      localStorage.removeItem('tws_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// --- Clients ---
export const getClients = (activeOnly = true) => api.get('/clients/', { params: { active_only: activeOnly } }).then(r => r.data)
export const getClient = (id) => api.get(`/clients/${id}`).then(r => r.data)
export const createClient = (data) => api.post('/clients/', data).then(r => r.data)
export const updateClient = (id, data) => api.patch(`/clients/${id}`, data).then(r => r.data)
export const deleteClient = (id) => api.delete(`/clients/${id}`)
export const restoreClient = (id) => api.post(`/clients/${id}/restore`).then(r => r.data)
export const addContact    = (clientId, data)            => api.post(`/clients/${clientId}/contacts`, data).then(r => r.data)
export const updateContact = (clientId, contactId, data) => api.patch(`/clients/${clientId}/contacts/${contactId}`, data).then(r => r.data)
export const deleteContact = (clientId, contactId)       => api.delete(`/clients/${clientId}/contacts/${contactId}`)

// --- Surveyors ---
export const getSurveyors = (activeOnly = true) => api.get('/surveyors/', { params: { active_only: activeOnly } }).then(r => r.data)
export const getSurveyor = (id) => api.get(`/surveyors/${id}`).then(r => r.data)
export const createSurveyor = (data) => api.post('/surveyors/', data).then(r => r.data)
export const updateSurveyor = (id, data) => api.patch(`/surveyors/${id}`, data).then(r => r.data)
export const deleteSurveyor = (id) => api.delete(`/surveyors/${id}`)
export const restoreSurveyor = (id) => api.post(`/surveyors/${id}/restore`).then(r => r.data)
export const setSurveyorCoverage = (id, coverage) => api.put(`/surveyors/${id}/coverage`, { coverage }).then(r => r.data)
export const setSurveyorSurveyTypes = (id, survey_type_ids) => api.put(`/surveyors/${id}/survey-types`, { survey_type_ids }).then(r => r.data)
export const setSurveyorClientExclusions = (id, client_ids) => api.put(`/surveyors/${id}/client-exclusions`, { client_ids }).then(r => r.data)

// --- Survey Types ---
export const getSurveyTypes = (activeOnly = true) => api.get('/survey-types/', { params: { active_only: activeOnly } }).then(r => r.data)
export const createSurveyType = (data) => api.post('/survey-types/', data).then(r => r.data)
export const updateSurveyType = (id, data) => api.patch(`/survey-types/${id}`, data).then(r => r.data)
export const deleteSurveyType = (id) => api.delete(`/survey-types/${id}`)
export const restoreSurveyType = (id) => api.post(`/survey-types/${id}/restore`).then(r => r.data)

// --- Instructions ---
export const getInstructions = (params) => api.get('/instructions/', {
  params,
  paramsSerializer: (p) => {
    const parts = []
    for (const [key, val] of Object.entries(p)) {
      if (Array.isArray(val)) {
        val.forEach(v => parts.push(`${key}=${encodeURIComponent(v)}`))
      } else if (val !== undefined && val !== null) {
        parts.push(`${key}=${encodeURIComponent(val)}`)
      }
    }
    return parts.join('&')
  },
}).then(r => r.data)
export const getInstruction  = (id) => api.get(`/instructions/${id}`).then(r => r.data)
export const getChasers      = ()    => api.get('/instructions/chasers').then(r => r.data)
export const createInstruction = (data) => api.post('/instructions/', data).then(r => r.data)
export const updateInstruction = (id, data) => api.patch(`/instructions/${id}`, data).then(r => r.data)
export const updateInstructionProperty = (id, data) => api.patch(`/instructions/${id}/property`, data).then(r => r.data)
export const updateStatus = (id, data) => api.patch(`/instructions/${id}/status`, data).then(r => r.data)
export const undoStatus   = (id)      => api.post(`/instructions/${id}/undo-status`).then(r => r.data)

// --- Auth / Users ---
export const googleAuth    = (credential) => api.post('/auth/google', { credential }).then(r => r.data)
export const getUsers      = ()            => api.get('/auth/users').then(r => r.data)
export const addUser       = (data)        => api.post('/auth/users', data).then(r => r.data)
export const updateUser    = (id, data)    => api.patch(`/auth/users/${id}`, data).then(r => r.data)
export const removeUser    = (id)          => api.delete(`/auth/users/${id}`)
export const pingActivity  = (page)        => api.post('/auth/activity', { page }).catch(() => {})

// --- Postcode coverage ---
export const getPostcodeSurveyors    = ()         => api.get('/postcode/').then(r => r.data)
export const addPostcodeSurveyor     = (data)     => api.post('/postcode/', data).then(r => r.data)
export const addPostcodeSurveyorBulk = (data)     => api.post('/postcode/bulk', data).then(r => r.data)
export const updatePostcodeSurveyor  = (id, data) => api.patch(`/postcode/${id}`, data).then(r => r.data)
export const deletePostcodeSurveyor  = (id)       => api.delete(`/postcode/${id}`)
export const deletePostcodeSurveyorByNumber = (surveyorNumber) => api.delete(`/postcode/by-number/${encodeURIComponent(surveyorNumber)}`)

// --- Postcode work types ---
export const getPostcodeWorkTypes    = ()         => api.get('/postcode-work-types/').then(r => r.data)
export const addPostcodeWorkType     = (data)     => api.post('/postcode-work-types/', data).then(r => r.data)
export const updatePostcodeWorkType  = (id, data) => api.patch(`/postcode-work-types/${id}`, data).then(r => r.data)
export const deletePostcodeWorkType  = (id)       => api.delete(`/postcode-work-types/${id}`)

// --- Postcode fee types ---
export const getPostcodeFeeTypes     = ()         => api.get('/postcode-fee-types/').then(r => r.data)
export const addPostcodeFeeType      = (data)     => api.post('/postcode-fee-types/', data).then(r => r.data)
export const updatePostcodeFeeType   = (id, data) => api.patch(`/postcode-fee-types/${id}`, data).then(r => r.data)
export const deletePostcodeFeeType   = (id)       => api.delete(`/postcode-fee-types/${id}`)

// --- Stats ---
const arrayParamSerializer = (p) => {
  const parts = []
  for (const [key, val] of Object.entries(p)) {
    if (Array.isArray(val)) {
      val.forEach(v => parts.push(`${key}=${encodeURIComponent(v)}`))
    } else if (val !== undefined && val !== null) {
      parts.push(`${key}=${encodeURIComponent(val)}`)
    }
  }
  return parts.join('&')
}
export const getStatsOverview  = (params) => api.get('/stats/overview',   { params, paramsSerializer: arrayParamSerializer }).then(r => r.data)
export const getStatsDaily     = (params) => api.get('/stats/daily',      { params, paramsSerializer: arrayParamSerializer }).then(r => r.data)
export const getStatsByClient  = (params) => api.get('/stats/by-client',  { params }).then(r => r.data)

export const getExportUrl = (params) => {
  const query = new URLSearchParams()
  if (params.client_id?.length) params.client_id.forEach(id => query.append('client_id', id))
  if (params.date_from) query.set('date_from', params.date_from)
  if (params.date_to) query.set('date_to', params.date_to)
  return `/api/instructions/export/csv?${query.toString()}`
}
