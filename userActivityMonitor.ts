import LoggingService from './loggingService';

class UserActivityMonitor {
    monitorLoginAttempts(userId: string, failedAttempts: number) {
        if (failedAttempts > 5) {
            LoggingService.logSuspiciousActivity(`User ${userId} had ${failedAttempts} failed login attempts.`);
        }
    }

    monitorLocationAccess(userId: string, location: string) {
        const suspiciousLocations = ['Unknown', 'Restricted'];
        if (suspiciousLocations.includes(location)) {
            LoggingService.logSuspiciousActivity(`User ${userId} accessed from suspicious location: ${location}.`);
        }
    }
}

export default new UserActivityMonitor();
