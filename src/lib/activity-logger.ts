import { db } from '@/db';
import { userActivityLogs } from '@/db/schema';

type ActivityAction = 
    | 'GAME_CREATED' 
    | 'GAME_SCORED' 
    | 'GAME_UPDATED'
    | 'TEAM_CREATED'
    | 'COMMUNITY_CREATED'
    | 'MEMBER_INVITED'
    | 'MEMBER_JOINED'
    | 'MEMBER_REMOVED';

type ResourceType = 'game' | 'team' | 'community' | 'user';

interface LogActivityParams {
    userId: string;
    action: ActivityAction;
    resourceType: ResourceType;
    resourceId: string;
    communityId?: string;
    details?: any;
    ipAddress?: string;
}

export async function logActivity(params: LogActivityParams) {
    try {
        await db.insert(userActivityLogs).values({
            userId: params.userId,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            communityId: params.communityId,
            details: params.details,
            ipAddress: params.ipAddress,
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw, logging failure shouldn't block main action
    }
}
