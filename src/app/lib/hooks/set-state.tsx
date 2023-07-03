import { useState, useCallback } from 'react';


function useSetState<S>(initial: S) {
    const [state, saveState] = useState<S>(initial);

    const updateState = useCallback((newState: S) => {
        if (typeof newState === 'function') {
            saveState(prev => ({ ...prev, ...newState(prev) }));
        } else {
            saveState(prev => ({ ...prev, ...newState }));
        }
    }, []);

    return [state, updateState];
}

export default useSetState;
