import rootReducer from './index';

import { dispatch } from '../store';

// TODO: Temporary file
export type RootState = ReturnType<typeof rootReducer>;

export type DispatchType = ReturnType<typeof dispatch>;
