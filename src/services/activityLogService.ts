import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export interface LogActivityParams {
  userId: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'transaction' | 'budget' | 'goal' | 'account' | 'creditCard' | 'category' | 'tag';
  entityId: string;
  description: string;
  dataBefore?: any;
  dataAfter?: any;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      dataBefore: params.dataBefore || null,
      dataAfter: params.dataAfter || null,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
