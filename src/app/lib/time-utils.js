function humanReadableTime(timeInSeconds) {
    if (timeInSeconds === undefined || timeInSeconds === null) {
        return '';
    }

    let minutes = Math.floor(timeInSeconds / 60);
    const hours = Math.floor(minutes / 60);
    minutes -= hours * 60;

    return (hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`);
}

export {
    humanReadableTime
};
