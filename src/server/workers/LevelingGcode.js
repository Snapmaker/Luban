export default class LevelingGcode {
    startTask({ data, onProgress, onComplete, onFail }) {
        setInterval(() => onProgress({ progress: 10 }), 5000);
        setTimeout(() => onComplete({ a: 1 }), 3000);
        setTimeout(() => onFail({ a: 1 }), 5000);
    }
}
