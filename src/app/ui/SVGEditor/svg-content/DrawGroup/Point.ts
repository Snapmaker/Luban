export class EndPoint {
    public x: number
    public y: number
    public fragmentID?: number

    public constructor(x: number, y: number, fragmentID: number) {
        this.x = x;
        this.y = y;
        this.fragmentID = fragmentID;
    }
}

export class ControlPoint {
    public x: number
    public y: number
    public fragmentID?: number

    public constructor(x: number, y: number, fragmentID: number) {
        this.x = x;
        this.y = y;
        this.fragmentID = fragmentID;
    }
}
