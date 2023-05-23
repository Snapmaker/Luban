import { defaultAPIFactory, request } from './base';

export const saveEnv = defaultAPIFactory((data) => request.post('/api/file/saveEnv').send(data));
export const getEnv = defaultAPIFactory((data) => request.get('/api/file/getEnv').send(data));
export const recoverEnv = defaultAPIFactory((data) => request.post('/api/file/recoverEnv').send(data));
export const removeEnv = defaultAPIFactory((data) => request.post('/api/file/removeEnv').send(data));
export const packageEnv = defaultAPIFactory((data) => request.post('/api/file/packageEnv').send(data));
export const recoverProjectFile = defaultAPIFactory((data) => request.post('/api/file/recoverProjectFile').send(data));
