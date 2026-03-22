import { config } from './config.js';
export function isUserAllowed(userId) {
    if (!config.ALLOWED_USER_ID)
        return false;
    return userId === config.ALLOWED_USER_ID;
}
