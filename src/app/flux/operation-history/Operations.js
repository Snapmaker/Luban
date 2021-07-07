export default class Operations {
    operations = [];

    push(...operations) {
        this.operations.push(...operations);
    }

    mergePreviousOperation() {
        console.log('Operations.mergePreviousOperation');
    }
}
