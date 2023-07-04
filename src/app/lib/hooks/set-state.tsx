import { useState, useCallback } from 'react';

type UpdateStateAction<S> = (newState: S) => void;

function useSetState<S>(initial: S): [S, UpdateStateAction<object>] {
    const [state, saveState] = useState<S>(initial);

    const updateState = useCallback((newState: object) => {
        if (typeof newState === 'function') {
            saveState(prev => ({ ...prev, ...newState(prev) }));
        } else {
            saveState(prev => ({ ...prev, ...newState }));
        }
    }, []);

    return [state, updateState];
}

export default useSetState;
