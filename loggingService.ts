import fs from 'fs';
import path from 'path';

class LoggingService {
    private logFilePath: string;

    constructor() {
        this.logFilePath = path.resolve(__dirname, 'suspiciousActivities.log');
    }

    logSuspiciousActivity(activity: string) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${activity}\n`;
        fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
    }
}

export default new LoggingService();
