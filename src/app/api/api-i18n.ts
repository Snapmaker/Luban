import { defaultAPIFactory, request } from './base';

export const changeLanguage = defaultAPIFactory(
    (data: { lang }) => request.post('/api/i18n/lang').send(data)
);
