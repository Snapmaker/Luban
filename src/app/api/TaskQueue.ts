type Runner = <T>() => Promise<T>;

type onMessage = <T>(data: T, cb: () => void) => void;

type Task = {
    runner: Runner,
    onMessage,
    label: string;
}

class TaskQueue {
    private workersNumber: number;

    private queue: Task[] = [];

    public constructor(concurrency: number) {
        this.workersNumber = concurrency;
    }

    public push(runner: Runner, onMessage: onMessage, label: string = null) {
        const task = {
            runner,
            onMessage,
            label
        };
        this.queue.push(task);
        this.scheduleWork();
        return () => {
            this.cancelTask(task);
        };
    }

    private run() {
        this.workersNumber--;
        const task = this.queue.shift();
        task.onMessage(task.runner(), () => {
            this.workersNumber++;
            this.scheduleWork();
        });
    }

    private scheduleWork() {
        if (this.queue.length === 0 || !this.workersNumber) {
            return;
        }
        this.run();
    }

    private cancelTask(task: Task): void
    private cancelTask(label: string): void
    private cancelTask(flag: Task | string) {
        if (typeof flag === 'string') {
            this.queue = this.queue.filter((item) => {
                return item.label !== flag;
            });
        } else {
            this.queue = this.queue.filter((item) => {
                return item !== flag;
            });
        }
    }
}

export default TaskQueue;
