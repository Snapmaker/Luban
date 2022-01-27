import { useState, useCallback } from 'react';

function useSetState(initial = {}) {
    const [state, saveState] = useState(initial);
    const setState = useCallback((newState) => {
        if (typeof newState === 'function') {
            saveState(prev => ({ ...prev, ...newState(prev) }));
        } else {
            saveState(prev => ({ ...prev, ...newState }));
        }
    }, []);

    return [state, setState];
}
export default useSetState;
