import fs from 'fs';
import path from 'path';

class ErrorHandler {
    private logFilePath: string;

    constructor() {
        this.logFilePath = path.resolve(__dirname, 'errorLogs.log');
    }

    handleError(error: Error, userFacingMessage: string): string {
        this.logError(error);
        return userFacingMessage;
    }

    private logError(error: Error) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${error.name}: ${error.message}\nStack: ${error.stack}\n`;
        fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
    }
}

export default new ErrorHandler();
